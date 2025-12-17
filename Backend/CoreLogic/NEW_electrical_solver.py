# Backend/CoreLogic/NEW_electrical_solver.py
import numpy as np
import time
import pandas as pd
import os
from pathlib import Path
from .battery_params import get_battery_params
from .next_soc import calculate_next_soc
from .reversible_heat import calculate_reversible_heat
from .triggers import parse_trigger_list_from_row, evaluate_triggers, check_hard_cutoffs
from .conversion import compute_module_current_from_step
from typing import Dict, List, Any

def run_electrical_solver_with_progress(setup: Dict, dc_table_path: str, sim_id: str = None,
                                        filename: str = "simulation_results.csv"):
    """
    Updated solver for new DC table (CSV path).
    - setup: From create_setup_from_configs (includes cells with 'rc_data').
    - dc_table_path: Path to new DC CSV.
    - Incremental write: Batch 10k rows or 20s.
    Returns filename.
    """
    # Unpack setup
    cells = setup['cells']
    N_cells = len(cells)
    capacity_Ah = setup['capacity']
    coulombic_eff = setup['columbic_efficiency']
    parallel_groups = sorted(set(c['parallel_group'] for c in cells))
    n_parallel = len(set(c['parallel_group'] for c in cells if 'parallel_group' in c))  # Unique groups
    n_series = len(parallel_groups)
    R_p = setup['R_p']
    R_s = setup['R_s']
    v_limits = setup['voltage_limits']
    HARD_V_cell_max, HARD_V_cell_min = v_limits['cell_upper'], v_limits['cell_lower']
    HARD_V_pack_max, HARD_V_pack_min = v_limits['module_upper'] or np.inf, v_limits['module_lower'] or -np.inf
    
    # Load DC table
    dc_table = pd.read_csv(dc_table_path)
    n_rows = len(dc_table)
    if n_rows == 0:
        raise ValueError("Empty DC table")
    
    # Initial states
    sim_SOC = np.array([c['SOC'] for c in cells])
    sim_TempK = np.array([c['temperature'] for c in cells])
    sim_SOH = np.array([c['SOH'] for c in cells])
    sim_DCIR = np.array([c['DCIR_AgingFactor'] for c in cells])
    sim_V_RC1 = np.zeros(N_cells)
    sim_V_RC2 = np.zeros(N_cells)
    sim_V_term = np.zeros(N_cells)
    
    # Time tracking
    t_global = 0.0
    per_day_time = 0.0
    current_day = 1
    dt_base = setup.get('Frequency', 1.0)  # From sim config
    
    # History buffer (list of dicts for long DF)
    buffer = []
    last_write_time = time.time()
    last_write_len = 0
    WRITE_BATCH = 10000
    WRITE_INTERVAL = 20
    
    def flush_buffer():
        nonlocal last_write_len
        if len(buffer) > last_write_len:
            df_batch = pd.DataFrame(buffer[last_write_len:])
            mode = 'w' if last_write_len == 0 else 'a'
            header = last_write_len == 0
            df_batch.to_csv(filename, mode=mode, header=header, index=False)
            last_write_len = len(buffer)
            progress = (t_global / (current_day * 86400)) * 100  # Approx %
            print(f"📝 Flushed {len(df_batch)} rows; Progress: {progress:.1f}% (t={t_global:.0f}s)")
    
    # Main loop: Outer over DC rows
    row_idx = 0
    while row_idx < n_rows:
        row = dc_table.iloc[row_idx]
        step_type = str(row['Step Type']).strip().lower()
        step_duration = row.get('Step Duration (s)', np.inf) if step_type != 'trigger_only' else 0.0
        dt_step = row.get('Timestep (s)', dt_base)
        value_type = str(row['Value Type']).strip().lower()
        value = float(row['Value'])
        unit = str(row['Unit']).strip().lower()
        
        # Parse triggers
        step_triggers = parse_trigger_list_from_row(row, 'step Trigger(s)')
        subcycle_triggers = parse_trigger_list_from_row(row, 'drive cycle trigger')  # Subcycle-level
        
        # Metadata
        global_idx = row['Global Step Index']
        day_of_year = row['Day_of_year']
        dc_id = row['DriveCycle_ID']
        subcycle_id = row['Subcycle_ID']
        sub_step_idx = row['Subcycle Step Index']
        label = row['Label']
        ambient_temp = row['Ambient Temp (°C)']
        location = row['Location']
        
        time_in_step = 0.0
        # Inner loop: Sub-steps until duration/trigger
        while True:
            dt = min(dt_step, dt_base)  # Cap dt
            remaining = step_duration - time_in_step if step_type in ['fixed', 'fixed_with_triggers'] else np.inf
            if remaining <= 0:
                break
            if dt > remaining:
                dt = remaining
            
            # Conversion to I_module
            I_module = compute_module_current_from_step(
                value_type, value, unit, capacity_Ah, n_parallel, cells, {
                    'sim_SOC': sim_SOC, 'sim_TempK': sim_TempK, 'sim_SOH': sim_SOH, 'sim_DCIR': sim_DCIR,
                    'sim_V_RC1': sim_V_RC1, 'sim_V_RC2': sim_V_RC2, 'sim_V_term': sim_V_term
                }, dt, parallel_groups, R_s, R_p, HARD_V_cell_max, HARD_V_cell_min
            )
            mode = 'CHARGE' if I_module < 0 else 'DISCHARGE'
            
            # Solve: Groups → Cells (core math)
            v_groups = []
            I_cells_step = np.zeros(N_cells)
            sim_OCV = np.zeros(N_cells)
            sim_R0 = np.zeros(N_cells)
            sim_R1 = np.zeros(N_cells)
            sim_R2 = np.zeros(N_cells)
            sim_C1 = np.zeros(N_cells)
            sim_C2 = np.zeros(N_cells)
            for group_id in parallel_groups:
                group_cells = [i for i, c in enumerate(cells) if c['parallel_group'] == group_id]
                N = len(group_cells)
                if N == 0: continue
                A = np.zeros((N + 1, N + 1))
                b = np.zeros(N + 1)
                I_cell_group = I_module / n_parallel  # Approx equal; solve for exact
                for i, cell_idx in enumerate(group_cells):
                    SOC = sim_SOC[cell_idx]
                    Temp_C = sim_TempK[cell_idx] - 273.15
                    SOH = sim_SOH[cell_idx]
                    DCIR = sim_DCIR[cell_idx]
                    V_rc1_prev = sim_V_RC1[cell_idx]
                    V_rc2_prev = sim_V_RC2[cell_idx]
                    OCV, R0, R1, R2, C1, C2 = get_battery_params(
                        cells[cell_idx]['rc_data'], SOC, Temp_C, mode, SOH, DCIR
                    )
                    tau1 = R1 * C1 if C1 > 0 else 1e-6
                    tau2 = R2 * C2 if C2 > 0 else 1e-6
                    K = OCV - (V_rc1_prev * np.exp(-dt / tau1) + V_rc2_prev * np.exp(-dt / tau2))
                    R_eff = R0 + 2 * R_p + R1 * (1 - np.exp(-dt / tau1)) + R2 * (1 - np.exp(-dt / tau2))
                    A[i, i] = R_eff
                    A[i, -1] = 1
                    b[i] = K
                    sim_OCV[cell_idx] = OCV
                    sim_R0[cell_idx] = R0
                    sim_R1[cell_idx] = R1
                    sim_R2[cell_idx] = R2
                    sim_C1[cell_idx] = C1
                    sim_C2[cell_idx] = C2
                A[-1, :N] = 1
                b[-1] = I_module / n_parallel  # I_cell avg
                x = np.linalg.solve(A, b)
                V_parallel = x[-1]
                v_groups.append(V_parallel)
                for i, cell_idx in enumerate(group_cells):
                    I_cell = x[i]
                    I_cells_step[cell_idx] = I_cell
                    R0, R1, R2, C1, C2, OCV = sim_R0[cell_idx], sim_R1[cell_idx], sim_R2[cell_idx], sim_C1[cell_idx], sim_C2[cell_idx], sim_OCV[cell_idx]
                    tau1 = R1 * C1 if C1 > 0 else 1e-6
                    tau2 = R2 * C2 if C2 > 0 else 1e-6
                    V_rc1 = sim_V_RC1[cell_idx] * np.exp(-dt / tau1) + R1 * I_cell * (1 - np.exp(-dt / tau1))
                    V_rc2 = sim_V_RC2[cell_idx] * np.exp(-dt / tau2) + R2 * I_cell * (1 - np.exp(-dt / tau2))
                    Vterm = OCV - I_cell * R0 - V_rc1 - V_rc2
                    next_SOC = calculate_next_soc(I_cell, dt, capacity_Ah, sim_SOC[cell_idx], coulombic_eff, sim_SOH[cell_idx])
                    q_irr = I_cell**2 * R0
                    q_rev = calculate_reversible_heat(sim_TempK[cell_idx], I_cell, sim_SOC[cell_idx])
                    q_gen = q_irr + q_rev
                    # Update
                    sim_SOC[cell_idx] = next_SOC
                    sim_V_RC1[cell_idx] = V_rc1
                    sim_V_RC2[cell_idx] = V_rc2
                    sim_V_term[cell_idx] = Vterm
                    # Cumulatives (global)
            
            # Module V
            v_module = sum(v_groups) - abs(I_module) * R_s * max(0, n_series - 1) if v_groups else 0.0
            
            # Log per-cell row (DC metadata repeated)
            for cell_id in range(N_cells):
                buffer.append({
                    'cell_id': cell_id,
                    'global_step_idx': global_idx,
                    'day_of_year': day_of_year,
                    'drivecycle_id': dc_id,
                    'drive_cycle_trigger': str(row['drive cycle trigger']),
                    'subcycle_id': subcycle_id,
                    'subcycle_step_idx': sub_step_idx,
                    'value_type': value_type,
                    'value': value,
                    'unit': unit,
                    'step_type': step_type,
                    'time_global_s': t_global + dt,
                    'time_in_step_s': time_in_step + dt,
                    'dt_s': dt,
                    'Vterm': sim_V_term[cell_id],
                    'SOC': sim_SOC[cell_id],
                    'OCV': sim_OCV[cell_id],
                    'Qgen': q_gen,  # Per cell
                    'Qirrev': q_irr,
                    'Qrev': q_rev,
                    'V_RC1': sim_V_RC1[cell_id],
                    'V_RC2': sim_V_RC2[cell_id],
                    'V_R0': sim_R0[cell_id],
                    'V_R1': sim_R1[cell_id],
                    'V_R2': sim_R2[cell_id],
                    'V_C1': sim_C1[cell_id],
                    'V_C2': sim_C2[cell_id],
                    'I_cell': I_cells_step[cell_id],
                    'I_module': I_module,
                    'V_module': v_module,
                    'ambient_temp_c': ambient_temp,
                    'location': location,
                    'label': label,
                    'step_triggers': str(row['step Trigger(s)'])
                })
            
            # Flush if batch/time
            if len(buffer) - last_write_len >= WRITE_BATCH or (time.time() - last_write_time >= WRITE_INTERVAL):
                flush_buffer()
                last_write_time = time.time()
            
            # Advance time
            time_in_step += dt
            t_global += dt
            per_day_time += dt
            if per_day_time >= 86400.0:
                per_day_time = 0.0
                current_day += 1
            
            # Triggers + Cutoffs
            all_triggers = step_triggers + subcycle_triggers
            fired = evaluate_triggers(all_triggers, {}, v_module, I_module, capacity_Ah, n_parallel, n_series,
                                      per_day_time, dt, t_global)  # Pass sim_states as {}
            # Precedence: Sort by level (day > subcycle > step)
            fired.sort(key=lambda t: {'day': 0, 'subcycle': 1, 'step': 2}[t['action_level']])
            
            if fired:
                action = fired[0]['action_level']  # Highest precedence
                if action == 'day':
                    # Jump to next day
                    row_idx += 1
                    while row_idx < n_rows and dc_table.iloc[row_idx]['Day_of_year'] == day_of_year:
                        row_idx += 1
                    break
                elif action == 'subcycle':
                    # Jump to next subcycle in day (change Subcycle_ID)
                    row_idx += 1
                    while row_idx < n_rows and dc_table.iloc[row_idx]['Day_of_year'] == day_of_year and \
                          dc_table.iloc[row_idx]['Subcycle_ID'] == subcycle_id:
                        row_idx += 1
                    break
                elif action == 'step':
                    row_idx += 1
                    break
            
            # Hard cutoffs (after log)
            if check_hard_cutoffs(sim_V_term, v_module, HARD_V_cell_max, HARD_V_cell_min, HARD_V_pack_max, HARD_V_pack_min):
                print(f"⚠️ Hard cutoff at t={t_global:.0f}s")
                flush_buffer()
                return filename
            
            # Step completion
            if step_type == 'trigger_only':
                continue  # Loop until trigger
            elif step_type == 'fixed':
                if time_in_step >= step_duration:
                    row_idx += 1
                    break
            elif step_type == 'fixed_with_triggers':
                if time_in_step >= step_duration:
                    row_idx += 1
                    break
            else:
                raise ValueError(f"Unknown step_type: {step_type}")
        
        row_idx += 1  # Next row if no break
    
    # Final flush
    flush_buffer()
    print(f"Simulation complete. CSV: {filename} ({len(buffer)} rows)")
    return filename
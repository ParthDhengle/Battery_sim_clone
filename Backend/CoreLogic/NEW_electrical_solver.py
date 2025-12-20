import numpy as np
import time
import pandas as pd
import os
from pathlib import Path
from .battery_params import get_battery_params
from .next_soc import calculate_next_soc
from .reversible_heat import calculate_reversible_heat
from .triggers import parse_trigger_list_from_row, evaluate_triggers, advance_row_idx_for_action, check_hard_cutoffs
from .conversion import compute_module_current_from_step
from typing import Dict, List, Any

def find_col(columns, candidates):
    """Find column name case-insensitively, ignoring spaces."""
    lower_cols = [c.lower().replace(" ", "") for c in columns]
    for cand in candidates:
        cand_norm = cand.lower().replace(" ", "")
        try:
            idx = lower_cols.index(cand_norm)
            return columns[idx]
        except ValueError:
            continue
    return None

def _history_to_long_dataframe(history: Dict, N_cells: int, n_series: int) -> pd.DataFrame:
    """Convert history dict to long DF with cell_id. Fixed I_cell scaling."""
    if N_cells == 0:
        df = pd.DataFrame({
            'cell_id': [],
            'time_global_s': history['t_global_s'],
            'I_module': history['I_module'],
            'V_module': history['V_module'],
        })
        for key in ['Global Step Index', 'Day_of_year', 'DriveCycle_ID', 'Subcycle_ID', 'Subcycle Step Index',
                    'Value Type', 'Value', 'Unit', 'Step Type', 'Label', 'Ambient Temp (°C)', 'Location',
                    'drive cycle trigger', 'step Trigger(s)', 'termination_msg']:
            if key in history:
                df[key] = history[key]
        return df
    rows = []
    n_p_avg = N_cells / n_series if n_series > 0 else 1
    for t_idx in range(len(history['dt'])):
        for cell_id in range(N_cells):
            row = {
                'cell_id': cell_id,
                'time_global_s': history['t_global_s'][t_idx],
                'dt': history['dt'][t_idx],
                'SOC': history['SOC'][t_idx][cell_id],
                'Vterm': history['Vterm'][t_idx][cell_id],
                'OCV': history['OCV'][t_idx][cell_id],
                'V_RC1': history['V_RC1'][t_idx][cell_id],
                'V_RC2': history['V_RC2'][t_idx][cell_id],
                'R0': history['V_R0'][t_idx][cell_id],
                'R1': history['V_R1'][t_idx][cell_id],
                'R2': history['V_R2'][t_idx][cell_id],
                'C1': history['V_C1'][t_idx][cell_id],
                'C2': history['V_C2'][t_idx][cell_id],
                'I_cell': history['I_module'][t_idx] / n_p_avg, # FIXED: Approx equal split
                'I_module': history['I_module'][t_idx],
                'V_module': history['V_module'][t_idx],
                'Qgen_cumulative': history['Qgen_cumulative'][t_idx][cell_id],
            }
            # Metadata + termination
            for key in ['Global Step Index', 'Day_of_year', 'DriveCycle_ID', 'Subcycle_ID', 'Subcycle Step Index',
                        'Value Type', 'Value', 'Unit', 'Step Type', 'Label', 'Ambient Temp (°C)', 'Location',
                        'drive cycle trigger', 'step Trigger(s)', 'termination_msg']:
                row[key] = history.get(key, [np.nan])[t_idx]
            rows.append(row)
    return pd.DataFrame(rows)

def run_electrical_solver(setup: Dict, dc_table: pd.DataFrame, sim_id: str = None, filename: str = "simulation_results.csv"):
    """Full solver: Triggers skip remaining duration/subcycle/day; global year cap prevents inf loops."""
    cells = setup['cells']
    N_cells = len(cells)
    capacity_Ah = setup['capacity']
    coulombic_eff = setup['columbic_efficiency']
    parallel_groups = sorted(set(c['parallel_group'] for c in cells))
    n_series = len(parallel_groups)
    R_p = setup['R_p']
    R_s = setup['R_s']
    v_limits = setup['voltage_limits']
    HARD_V_cell_max = v_limits['cell_upper']
    HARD_V_cell_min = v_limits['cell_lower'] or np.nan
    HARD_V_pack_max = v_limits['module_upper']
    HARD_V_pack_min = v_limits['module_lower'] or np.nan
    print(f"Voltage limits: cell {HARD_V_cell_min:.2f}-{HARD_V_cell_max:.2f}V, pack {HARD_V_pack_min:.2f}-{HARD_V_pack_max:.2f}V (n_series={n_series})")
    
    dc_table = dc_table.copy()
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
    t_global = 0.0
    per_day_time = 0.0
    dt_base = setup.get('Frequency', 1.0)
    max_t_global = setup.get('max_sim_time_s', 364 * 86400) # 364-day cap
    # History
    history = {
        'dt': [], 't_global_s': [], 'SOC': [], 'Vterm': [], 'OCV': [], 'V_RC1': [], 'V_RC2': [],
        'V_R0': [], 'V_R1': [], 'V_R2': [], 'V_C1': [], 'V_C2': [], 'I_module': [], 'V_module': [],
        'energy_throughput': [], 'Qgen_cumulative': [],
        'Global Step Index': [], 'Day_of_year': [], 'DriveCycle_ID': [], 'Subcycle_ID': [], 'Subcycle Step Index': [],
        'Value Type': [], 'Value': [], 'Unit': [], 'Step Type': [], 'Label': [], 'Ambient Temp (°C)': [], 'Location': [],
        'drive cycle trigger': [], 'step Trigger(s)': [], 'termination_msg': [""], # Init empty
        'parallel_groups': parallel_groups,
    }
    cum_energy_kWh = np.zeros(N_cells)
    cum_qgen_Ws = np.zeros(N_cells)
    # Trigger cols
    dc_trigger_col = find_col(dc_table.columns, ["drive cycle trigger", "drivecycletrigger", "dc_trigger"])
    step_trigger_col = find_col(dc_table.columns, ["step Trigger(s)", "step trigger", "step_triggers", "steptrigger(s)"])
    row_idx = 0
    sim_terminated = False
    cutoff_row_guard = {}  # NEW v5: Guard against repeated cutoffs per row
    log_every = 10  # NEW v5: Log every 10th dt to reduce overhead
    log_counter = 0
    while row_idx < n_rows and not sim_terminated and t_global < max_t_global:
        row = dc_table.iloc[row_idx]
        if pd.isna(row.get('Value Type')) or pd.isna(row.get('Value')):
            print(f"Skipping invalid row {row_idx}")
            row_idx += 1
            continue
        step_type = str(row.get("Step Type", "fixed")).strip().lower()
        step_duration = float(row.get("Step Duration (s)", np.inf)) if step_type != "trigger_only" else 0.0
        dt_step = float(row.get("Timestep (s)", dt_base))
        value_type = str(row.get("Value Type", "current")).strip().lower()
        value = float(row.get("Value", 0.0))
        unit = str(row.get("Unit", "")).strip().lower()
        current_day = int(row.get("Day_of_year", 1))
        current_dc = row.get("DriveCycle_ID", "")
        current_subcycle = str(row.get("Subcycle_ID", "")) or ""
        step_triggers = parse_trigger_list_from_row(row, column=step_trigger_col)
        dc_triggers = parse_trigger_list_from_row(row, column=dc_trigger_col)
        time_in_step = 0.0
        I_module_current_for_step = None
        inner_iters = 0
        max_inner_iters = int(step_duration / dt_step + 1000) if step_duration < np.inf else 1000000 # Guard
        has_triggers = len(step_triggers + dc_triggers) > 0  # NEW v5: Check for batching
        use_batching = step_type == 'fixed' and not has_triggers  # NEW v5: Batch if no triggers
        if use_batching:
            dt = step_duration  # Single big dt for whole step
            print(f"Batch fixed step {row_idx}: dt={dt}s (no triggers)")
        while True:
            if inner_iters > max_inner_iters:
                print(f"⚠️ Force advance row {row_idx}: Max inner iters hit (possible trigger_only stall)")
                row_idx += 1
                break
            inner_iters += 1
            # I_module compute
            if I_module_current_for_step is None or value_type in ['voltage', 'power']:
                current_states = {
                    'sim_SOC': sim_SOC, 'sim_TempK': sim_TempK, 'sim_SOH': sim_SOH, 'sim_DCIR': sim_DCIR,
                    'sim_V_RC1': sim_V_RC1, 'sim_V_RC2': sim_V_RC2, 'sim_V_term': sim_V_term
                }
                I_module_current = compute_module_current_from_step(
                    value_type=value_type, value=value, unit=unit, capacity_Ah=capacity_Ah,
                    n_series=n_series, cells=cells, sim_states=current_states, dt=dt_step if not use_batching else dt,
                    parallel_groups=parallel_groups, R_s=R_s, R_p=R_p,
                    cell_voltage_upper=HARD_V_cell_max, cell_voltage_lower=HARD_V_cell_min
                )
                if I_module_current_for_step is None:
                    I_module_current_for_step = I_module_current
            else:
                I_module_current = I_module_current_for_step
            # dt
            if step_type in ["fixed", "fixed_with_triggers"] and step_duration < np.inf and not use_batching:
                remaining = step_duration - time_in_step
                if remaining <= 0:
                    row_idx += 1
                    break
                dt = min(dt_step, remaining)
            else:
                dt = dt_step if not use_batching else step_duration
            # Physics
            mode = "CHARGE" if I_module_current < 0 else "DISCHARGE"
            v_groups = []
            sim_OCV = np.zeros(N_cells)
            sim_R0 = np.zeros(N_cells)
            sim_R1 = np.zeros(N_cells)
            sim_R2 = np.zeros(N_cells)
            sim_C1 = np.zeros(N_cells)
            sim_C2 = np.zeros(N_cells)
            I_cells_step = np.zeros(N_cells)
            cutoff_hit = False
            cutoff_type = None
            # NEW v5: Guard for this row
            cutoff_count = cutoff_row_guard.get(row_idx, 0)
            if cutoff_count >= 3:
                print(f"⚠️ Force-skip row {row_idx}: Repeated cutoffs ({cutoff_count})")
                row_idx += 1
                break
            for group_id in parallel_groups:
                if cutoff_hit:  # NEW v5: Skip remaining groups on cutoff
                    break
                group_cells = [i for i, c in enumerate(cells) if c["parallel_group"] == group_id]
                N = len(group_cells)
                if N == 0:
                    continue
                A = np.zeros((N + 1, N + 1))
                b = np.zeros(N + 1)
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
                    R_eff = R0 + 2.0 * R_p + R1 * (1.0 - np.exp(-dt / tau1)) + R2 * (1.0 - np.exp(-dt / tau2))
                    A[i, i] = R_eff
                    A[i, -1] = 1.0
                    b[i] = K
                    sim_OCV[cell_idx] = OCV
                    sim_R0[cell_idx] = R0
                    sim_R1[cell_idx] = R1
                    sim_R2[cell_idx] = R2
                    sim_C1[cell_idx] = C1
                    sim_C2[cell_idx] = C2
                A[-1, :N] = 1.0
                b[-1] = I_module_current
                try:
                    x = np.linalg.solve(A, b)
                    V_parallel = x[-1]
                    v_groups.append(V_parallel)
                    for i, cell_idx in enumerate(group_cells):
                        I_cell = x[i]
                        R1 = sim_R1[cell_idx]
                        R2 = sim_R2[cell_idx]
                        C1 = sim_C1[cell_idx]
                        C2 = sim_C2[cell_idx]
                        tau1 = R1 * C1 if C1 > 0 else 1e-6
                        tau2 = R2 * C2 if C2 > 0 else 1e-6
                        V_rc1 = sim_V_RC1[cell_idx] * np.exp(-dt / tau1) + R1 * I_cell * (1.0 - np.exp(-dt / tau1))
                        V_rc2 = sim_V_RC2[cell_idx] * np.exp(-dt / tau2) + R2 * I_cell * (1.0 - np.exp(-dt / tau2))
                        Vterm = sim_OCV[cell_idx] - I_cell * sim_R0[cell_idx] - V_rc1 - V_rc2
                        next_SOC = calculate_next_soc(I_cell, dt, capacity_Ah, sim_SOC[cell_idx], coulombic_eff, sim_SOH[cell_idx])
                        q_irr = (I_cell ** 2) * sim_R0[cell_idx]
                        q_rev = calculate_reversible_heat(sim_TempK[cell_idx], I_cell, sim_SOC[cell_idx])
                        q_gen = q_irr + q_rev
                        sim_SOC[cell_idx] = next_SOC
                        sim_V_RC1[cell_idx] = V_rc1
                        sim_V_RC2[cell_idx] = V_rc2
                        sim_V_term[cell_idx] = Vterm
                        I_cells_step[cell_idx] = I_cell
                        energy_kWh = abs(I_cell * Vterm * dt) / (3600.0 * 1000.0)
                        cum_energy_kWh[cell_idx] += energy_kWh
                        cum_qgen_Ws[cell_idx] += q_gen
                        # Cell limit check
                        if not np.isnan(HARD_V_cell_min) and (Vterm > HARD_V_cell_max or Vterm < HARD_V_cell_min):
                            cutoff_hit = True
                            cutoff_type = 'cell'
                            cutoff_row_guard[row_idx] = cutoff_count + 1  # Increment guard
                            break  # Break per-cell for
                except np.linalg.LinAlgError:
                    print(f"LinAlg error at row {row_idx}, dt {dt}; skipping group {group_id}")
                    continue
            num_series_eff = len(v_groups)
            v_module = float(np.sum(v_groups) - abs(I_module_current) * R_s * max(0, num_series_eff - 1)) if num_series_eff > 0 else 0.0
            if inner_iters % 100 == 0:  # Sparse debug
                print(f"Step {row_idx}: v_module={v_module:.3f}V, I_module={I_module_current:.1f}A, iter={inner_iters}")
            pack_cutoff = False
            if not np.isnan(HARD_V_pack_min) and not np.isnan(HARD_V_pack_max):
                pack_cutoff = v_module > HARD_V_pack_max or v_module < HARD_V_pack_min
            if pack_cutoff:
                cutoff_hit = True
                cutoff_type = 'pack'
            # NEW v5: Single print per dt, only if cutoff
            if cutoff_hit and log_counter % log_every == 0:
                print(f"⚠️ {cutoff_type.capitalize()} cutoff at t_global={t_global}, row={row_idx} (v_module={v_module:.3f}V)")
                log_counter += 1
            # Log (only if not cutoff or batched)
            if not cutoff_hit or use_batching:
                msg = ""
                history["dt"].append(float(dt))
                history["t_global_s"].append(float(t_global + dt))
                history["SOC"].append(sim_SOC.copy())
                history["Vterm"].append(sim_V_term.copy())
                history["OCV"].append(sim_OCV.copy())
                history["V_RC1"].append(sim_V_RC1.copy())
                history["V_RC2"].append(sim_V_RC2.copy())
                history["V_R0"].append(sim_R0.copy())
                history["V_R1"].append(sim_R1.copy())
                history["V_R2"].append(sim_R2.copy())
                history["V_C1"].append(sim_C1.copy())
                history["V_C2"].append(sim_C2.copy())
                history["I_module"].append(float(I_module_current))
                history["V_module"].append(float(v_module))
                history["energy_throughput"].append(cum_energy_kWh.copy())
                history["Qgen_cumulative"].append(cum_qgen_Ws.copy())
                # Metadata (same)
                history["Global Step Index"].append(row.get("Global Step Index", np.nan))
                history["Day_of_year"].append(row.get("Day_of_year", np.nan))
                history["DriveCycle_ID"].append(row.get("DriveCycle_ID", ""))
                history["Subcycle_ID"].append(current_subcycle)
                history["Subcycle Step Index"].append(row.get("Subcycle Step Index", np.nan))
                history["Value Type"].append(value_type)
                history["Value"].append(value)
                history["Unit"].append(unit)
                history["Step Type"].append(step_type)
                history["Label"].append(row.get("Label", ""))
                history["Ambient Temp (°C)"].append(row.get("Ambient Temp (°C)", np.nan))
                history["Location"].append(row.get("Location", ""))
                history["drive cycle trigger"].append(str(row.get(dc_trigger_col, "")) if dc_trigger_col else "")
                history["step Trigger(s)"].append(str(row.get(step_trigger_col, "")) if step_trigger_col else "")
                history["termination_msg"].append(msg)
                time_in_step += float(dt)
                t_global += float(dt)
                per_day_time += float(dt)
                if abs(per_day_time % 86400) < 1e-6:
                    per_day_time = 0.0
                if per_day_time >= 86400.0:
                    per_day_time -= 86400.0
            else:
                # NEW v5: On cutoff, log minimal (no states update)
                msg = f"Terminated: {cutoff_type.capitalize()} voltage cutoff (V_module={v_module:.3f}V)"
                history["dt"].append(0.0)  # Zero dt
                history["t_global_s"].append(float(t_global))
                history["SOC"].append(sim_SOC.copy())
                history["Vterm"].append(sim_V_term.copy())
                # ... (append others as-is)
                history["termination_msg"].append(msg)
                break  # Ensure inner break on cutoff
            # Triggers (after log, skip if cutoff)
            if cutoff_hit:
                break
            all_triggers = step_triggers + dc_triggers
            fired = evaluate_triggers(
                all_triggers, sim_SOC, sim_V_term, v_module, time_in_step, t_global,
                I_cells_step, I_module_current, capacity_Ah, per_day_time, current_day, parallel_groups
            )
            advance_actions = [tr['action_level'] for tr in fired]
            if 'day' in advance_actions:
                row_idx = advance_row_idx_for_action(dc_table, row_idx, 'day', current_subcycle, current_dc, current_day)
                print(f"Day trigger/skip to row {row_idx}")
                break
            elif 'dc' in advance_actions:
                row_idx = advance_row_idx_for_action(dc_table, row_idx, 'dc', current_subcycle, current_dc, current_day)
                print(f"DC trigger/skip to row {row_idx}")
                break
            elif 'step' in advance_actions:
                row_idx += 1
                print(f"Step trigger/skip to row {row_idx}")
                break
            # Duration exit
            if (step_type in ["fixed", "fixed_with_triggers"] and time_in_step >= step_duration) or use_batching:
                row_idx += 1
                break
            if step_type == "trigger_only" and inner_iters % 10000 == 0:
                print(f"Warning: trigger_only row {row_idx} no fire after {inner_iters} dt")
        # NEW v5: Force advance on cutoff
        if cutoff_hit:
            sim_terminated = True
            row_idx += 1  # Advance past bad row
            termination_msg = f"Simulation terminated at t={t_global:.1f}s: {cutoff_type.capitalize()} voltage cutoff"
            print(termination_msg)
            # Pad history if needed
            while len(history['termination_msg']) < len(history['dt']):
                history['termination_msg'].append(termination_msg)
            break
    # Global cap
    if t_global >= max_t_global:
        sim_terminated = True
        termination_msg = f"Simulation terminated at year end: t={t_global:.1f}s"
        print(termination_msg)
        while len(history['termination_msg']) < len(history['dt']):
            history['termination_msg'].append(termination_msg)
    # Save
    history_df = _history_to_long_dataframe(history, N_cells, n_series)
    if not history_df.empty:
        history_df.to_csv(filename, index=False)
    else:
        pd.DataFrame(columns=history_df.columns).to_csv(filename, index=False)
    status = 'terminated early' if sim_terminated else 'full run'
    print(f"Solver {status}: {filename} ({len(history['dt'])} timesteps, t_final={t_global:.1f}s)")
    return filename
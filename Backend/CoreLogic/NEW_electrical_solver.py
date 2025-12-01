# CoreLogic/NEW_electrical_solver.py
import numpy as np
import time
import pandas as pd
from CoreLogic.battery_params import get_battery_params
from CoreLogic.next_soc import calculate_next_soc
from CoreLogic.reversible_heat import calculate_reversible_heat
import os
from pathlib import Path

def run_electrical_solver_with_progress(setup, filename="simulation_results.csv", sim_id=None):
    """
    Run electrical solver with incremental CSV writes every 20 seconds.
    Allows frontend to track progress in real-time.
    """
    cells = setup['cells']
    N_cells = len(cells)
    time_array = setup['time']
    I_module = setup['I_module']
    time_steps = len(time_array)
    capacity = setup['capacity']
    coulombic_efficiency = setup['columbic_efficiency']
    R_p = setup['R_p']
    R_s = setup['R_s']
    cell_voltage_upper_limit = setup['voltage_limits']['cell_upper']
    cell_voltage_lower_limit = setup['voltage_limits']['cell_lower']
    
    BatteryData_SOH1 = setup['BatteryData_SOH1']
    BatteryData_SOH2 = setup['BatteryData_SOH2']
    BatteryData_SOH3 = setup['BatteryData_SOH3']
    
    parallel_groups = sorted(set(cell['parallel_group'] for cell in cells))
    
    # Initialize cell states
    sim_SOC = np.array([cell['SOC'] for cell in cells])
    sim_Temp = np.array([cell['temperature'] for cell in cells])
    sim_SOH = np.array([cell['SOH'] for cell in cells])
    sim_DCIR_AgingFactor = np.array([cell['DCIR_AgingFactor'] for cell in cells])
    sim_V_RC1 = np.zeros(N_cells)
    sim_V_RC2 = np.zeros(N_cells)
    sim_V_term = np.zeros(N_cells)
    sim_V_OCV = np.zeros(N_cells)
    sim_V_R0 = np.zeros(N_cells)
    sim_V_R1 = np.zeros(N_cells)
    sim_V_R2 = np.zeros(N_cells)
    sim_V_C1 = np.zeros(N_cells)
    sim_V_C2 = np.zeros(N_cells)
    
    # History buffers (store in memory, write periodically)
    history = {
        'Vterm': np.zeros((N_cells, time_steps), dtype='float32'),
        'SOC': np.zeros((N_cells, time_steps), dtype='float32'),
        'OCV': np.zeros((N_cells, time_steps), dtype='float32'),
        'Qgen': np.zeros((N_cells, time_steps), dtype='float32'),
        'Qirrev': np.zeros((N_cells, time_steps), dtype='float32'),
        'Qrev': np.zeros((N_cells, time_steps), dtype='float32'),
        'dt': np.zeros(time_steps, dtype='float32'),
        'V_RC1': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_RC2': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_R0': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_R1': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_R2': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_C1': np.zeros((N_cells, time_steps), dtype='float32'),
        'V_C2': np.zeros((N_cells, time_steps), dtype='float32'),
        'energy_throughput': np.zeros((N_cells, time_steps), dtype='float32'),
        'Qgen_cumulative': np.zeros((N_cells, time_steps), dtype='float32'),
    }
    
    I_cells_matrix = np.zeros((N_cells, time_steps), dtype='float32')
    V_parallel_matrix = np.zeros((N_cells, time_steps), dtype='float32')
    V_terminal_module_matrix = np.zeros(time_steps, dtype='float32')
    
    # Incremental write tracking
    last_write_time = time.time()
    last_written_step = 0
    WRITE_INTERVAL = 20  # Write every 20 seconds
    
    def write_partial_results(up_to_step):
        """Write results from last_written_step to up_to_step."""
        nonlocal last_written_step
        
        if up_to_step <= last_written_step:
            return
        
        data_rows = []
        for cell_id in range(N_cells):
            for ts in range(last_written_step, up_to_step):
                data_rows.append({
                    'cell_id': cell_id,
                    'time_step': ts,
                    'Vterm': history['Vterm'][cell_id, ts],
                    'SOC': history['SOC'][cell_id, ts],
                    'OCV': history['OCV'][cell_id, ts],
                    'Qgen': history['Qgen'][cell_id, ts],
                    'Qirrev': history['Qirrev'][cell_id, ts],
                    'Qrev': history['Qrev'][cell_id, ts],
                    'dt': history['dt'][ts],
                    'V_RC1': history['V_RC1'][cell_id, ts],
                    'V_RC2': history['V_RC2'][cell_id, ts],
                    'V_R0': history['V_R0'][cell_id, ts],
                    'V_R1': history['V_R1'][cell_id, ts],
                    'V_R2': history['V_R2'][cell_id, ts],
                    'V_C1': history['V_C1'][cell_id, ts],
                    'V_C2': history['V_C2'][cell_id, ts],
                    'energy_throughput': history['energy_throughput'][cell_id, ts],
                    'Qgen_cumulative': history['Qgen_cumulative'][cell_id, ts],
                    'I_module': I_module[ts],
                })
        
        df = pd.DataFrame(data_rows)
        
        # Append to CSV (or create if first write)
        if last_written_step == 0:
            df.to_csv(filename, mode='w', index=False)
        else:
            df.to_csv(filename, mode='a', header=False, index=False)
        
        last_written_step = up_to_step
        print(f"📝 Wrote results up to step {up_to_step}/{time_steps} ({(up_to_step/time_steps*100):.1f}%)")
    
    # Main simulation loop
    for t in range(time_steps):
        dt = time_array[t + 1] - time_array[t] if t < time_steps - 1 else time_array[t] - time_array[t - 1]
        history['dt'][t] = dt
        I_module_current = I_module[t]
        mode = 'CHARGE' if I_module_current < 0 else 'DISCHARGE'
        
        # Solve for each parallel group
        for group_id in parallel_groups:
            group_cells = [i for i, cell in enumerate(cells) if cell['parallel_group'] == group_id]
            N = len(group_cells)
            
            A = np.zeros((N + 1, N + 1))
            b = np.zeros(N + 1)
            
            for i, cell_idx in enumerate(group_cells):
                SOC = sim_SOC[cell_idx]
                Temp_C = sim_Temp[cell_idx] - 273.15
                SOH = sim_SOH[cell_idx]
                DCIR = sim_DCIR_AgingFactor[cell_idx]
                V_rc1 = sim_V_RC1[cell_idx]
                V_rc2 = sim_V_RC2[cell_idx]
                
                OCV, R0, R1, R2, C1, C2 = get_battery_params(
                    SOC, Temp_C, mode, SOH, DCIR,
                    BatteryData_SOH1, BatteryData_SOH2, BatteryData_SOH3
                )
                
                tau1 = R1 * C1
                tau2 = R2 * C2
                K = OCV - (V_rc1 * np.exp(-dt / tau1) + V_rc2 * np.exp(-dt / tau2))
                R_eff = R0 + 2 * R_p + R1 * (1 - np.exp(-dt / tau1)) + R2 * (1 - np.exp(-dt / tau2))
                
                A[i, i] = R_eff
                A[i, -1] = 1
                b[i] = K
                
                sim_V_OCV[cell_idx] = OCV
                sim_V_R0[cell_idx] = R0
                sim_V_R1[cell_idx] = R1
                sim_V_R2[cell_idx] = R2
                sim_V_C1[cell_idx] = C1
                sim_V_C2[cell_idx] = C2
            
            A[-1, :N] = 1
            b[-1] = I_module[t]
            
            x = np.linalg.solve(A, b)
            V_parallel = x[-1]
            
            for i, cell_idx in enumerate(group_cells):
                I_cell = x[i]
                OCV = sim_V_OCV[cell_idx]
                R0 = sim_V_R0[cell_idx]
                R1 = sim_V_R1[cell_idx]
                R2 = sim_V_R2[cell_idx]
                C1 = sim_V_C1[cell_idx]
                C2 = sim_V_C2[cell_idx]
                
                tau1 = R1 * C1
                tau2 = R2 * C2
                V_rc1 = sim_V_RC1[cell_idx] * np.exp(-dt / tau1) + R1 * I_cell * (1 - np.exp(-dt / tau1))
                V_rc2 = sim_V_RC2[cell_idx] * np.exp(-dt / tau2) + R2 * I_cell * (1 - np.exp(-dt / tau2))
                
                Vterm = OCV - I_cell * R0 - V_rc1 - V_rc2
                Vterm = round(Vterm, 5)
                
                # Voltage cutoff check
                if Vterm > cell_voltage_upper_limit or Vterm < cell_voltage_lower_limit:
                    print(f"⚠️ Simulation stopped: Cell {cell_idx} voltage cutoff at step {t}, V = {Vterm:.4f} V")
                    write_partial_results(t)
                    return filename
                
                next_SOC = calculate_next_soc(
                    I_cell, dt, capacity, sim_SOC[cell_idx],
                    coulombic_efficiency, sim_SOH[cell_idx]
                )
                
                q_irr = I_cell ** 2 * R0
                temp_K = sim_Temp[cell_idx]
                q_rev = calculate_reversible_heat(temp_K, I_cell, sim_SOC[cell_idx])
                q_gen = q_irr + q_rev
                
                sim_SOC[cell_idx] = next_SOC
                sim_V_RC1[cell_idx] = V_rc1
                sim_V_RC2[cell_idx] = V_rc2
                sim_V_term[cell_idx] = Vterm
                
                energy = abs(I_cell * Vterm * dt) / (3600 * 1000)
                
                I_cells_matrix[cell_idx, t] = I_cell
                V_parallel_matrix[cell_idx, t] = V_parallel
                
                history['SOC'][cell_idx, t] = next_SOC
                history['Vterm'][cell_idx, t] = Vterm
                history['Qgen'][cell_idx, t] = q_gen
                history['Qirrev'][cell_idx, t] = q_irr
                history['Qrev'][cell_idx, t] = q_rev
                history['OCV'][cell_idx, t] = OCV
                history['V_RC1'][cell_idx, t] = V_rc1
                history['V_RC2'][cell_idx, t] = V_rc2
                history['V_R0'][cell_idx, t] = R0
                history['V_R1'][cell_idx, t] = R1
                history['V_R2'][cell_idx, t] = R2
                history['V_C1'][cell_idx, t] = C1
                history['V_C2'][cell_idx, t] = C2
                history['energy_throughput'][cell_idx, t] = (
                    history['energy_throughput'][cell_idx, t - 1] + energy if t > 0 else energy
                )
                history['Qgen_cumulative'][cell_idx, t] = (
                    history['Qgen_cumulative'][cell_idx, t - 1] + q_gen if t > 0 else q_gen
                )
        
        # Calculate module voltage
        v_groups = []
        for group_id in parallel_groups:
            group_cells = [i for i, cell in enumerate(cells) if cell['parallel_group'] == group_id]
            if group_cells:
                v_group = V_parallel_matrix[group_cells[0], t]
                v_groups.append(v_group)
        
        num_series = len(v_groups)
        if num_series > 0:
            v_module = sum(v_groups) - abs(I_module_current) * R_s * max(0, num_series - 1)
        else:
            v_module = 0.0
        
        V_terminal_module_matrix[t] = v_module
        
        # Periodic write check (every 20 seconds)
        current_time = time.time()
        if current_time - last_write_time >= WRITE_INTERVAL:
            write_partial_results(t + 1)
            last_write_time = current_time
    
    # Final write
    write_partial_results(time_steps)
    print(f"✅ Simulation complete. Final CSV written to {filename}")
    
    return filename


# Keep original function for backward compatibility
def run_electrical_solver(setup, filename="simulation_results.csv"):
    """Original function without progress tracking."""
    return run_electrical_solver_with_progress(setup, filename, sim_id=None)
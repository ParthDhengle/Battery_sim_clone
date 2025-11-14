import numpy as np
import time
import pandas as pd
import asyncio
from bson import ObjectId
from app.config import db  # Relative import to app.config
from CoreLogic.battery_params import get_battery_params
from CoreLogic.next_soc import calculate_next_soc
from CoreLogic.parallel_group_currents import calculate_parallel_group_currents
from CoreLogic.reversible_heat import calculate_reversible_heat
import matplotlib.pyplot as plt
import os
from datetime import datetime

def update_plot(t, history, I_module, cells):
    dt = history['dt'][:t+1]
    time_cum = np.cumsum(dt)
    time_days = time_cum / 86400
    soc_cell0 = history['SOC'][0, :t+1]
    vterm_cell0 = history['Vterm'][0, :t+1]
    qgen_cell0 = history['Qgen'][0, :t+1]
    I_module_current = I_module[:t+1]
    plt.clf() # Clear the figure to update/overwrite the same graph
    fig, axs = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
    fig.suptitle('Simulation Progress for Cell 0 (Updating Every 10 Seconds)', fontsize=16)
    # SOC plot
    axs[0].plot(time_days, soc_cell0, color='blue', label='SOC')
    axs[0].set_ylabel('State of Charge (SOC)', fontsize=12)
    axs[0].set_title('SOC Over Time', fontsize=14)
    axs[0].grid(True, linestyle='--', alpha=0.7)
    axs[0].set_ylim(0, 1)
    axs[0].legend(loc='upper right')
    # Terminal Voltage plot
    axs[1].plot(time_days, vterm_cell0, color='green', label='Terminal Voltage')
    axs[1].set_ylabel('Terminal Voltage (V)', fontsize=12)
    axs[1].set_title('Terminal Voltage Over Time', fontsize=14)
    axs[1].grid(True, linestyle='--', alpha=0.7)
    axs[1].set_ylim(0, 5)
    axs[1].legend(loc='upper right')
    # Heat Generation plot
    axs[2].plot(time_days, qgen_cell0, color='red', label='Heat Generation')
    axs[2].set_ylabel('Heat Generation (W)', fontsize=12)
    axs[2].set_title('Heat Generation Over Time', fontsize=14)
    axs[2].grid(True, linestyle='--', alpha=0.7)
    axs[2].set_ylim(-1, max(qgen_cell0) * 1.1 if len(qgen_cell0) > 0 and max(qgen_cell0) > 0 else 1)
    axs[2].legend(loc='upper right')
    # Module Current plot
    axs[3].plot(time_days, I_module_current, color='purple', label='Module Current')
    axs[3].set_xlabel('Time (Days)', fontsize=12)
    axs[3].set_ylabel('Current (A)', fontsize=12)
    axs[3].set_title('Module Current Over Time', fontsize=14)
    axs[3].grid(True, linestyle='--', alpha=0.7)
    axs[3].legend(loc='upper right')
    # No fixed xticks/labels - let matplotlib auto-scale x-axis dynamically to current data range
    # Shade vacation periods (from calendarRules, approximate days)
    vacation_periods = [
        (90, 92), (101, 102), # Apr
        (181, 186), (209, 210), # Jul
        # Add for Aug/Dec if in rules, but based on your json, Oct is default
    ]
    for start, end in vacation_periods:
        if start < max(time_days):
            for ax in axs:
                ax.axvspan(max(0, start), min(end, max(time_days)), color='yellow', alpha=0.3, label='Vacation' if start == 90 else None)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    fig.canvas.draw()
    fig.canvas.flush_events()

def run_electrical_solver(setup, filename="simulation_results.csv", sim_id=None):
    cells = setup['cells']
    N_cells = len(cells)
    time_array = setup['time']
    I_module = setup['I_module']
    time_steps = len(time_array)
    capacity = setup['capacity']
    coulombic_efficiency = setup['columbic_efficiency']
    R_p = setup['R_p']
    R_s = setup['R_s']
    cell_voltage_upper_limit = setup ['voltage_limits']['cell_upper']
    cell_voltage_lower_limit = setup['voltage_limits']['cell_lower']
    
    BatteryData_SOH1 = setup['BatteryData_SOH1']
    BatteryData_SOH2 = setup['BatteryData_SOH2']
    BatteryData_SOH3 = setup['BatteryData_SOH3']
    parallel_groups = sorted(set(cell['parallel_group'] for cell in cells))
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
    
    # Incremental save setup
    chunk_data = []
    header_written = os.path.exists(filename) and os.path.getsize(filename) > 0 if os.path.exists(filename) else False
    last_save_time = time.time()
    
    for t in range(time_steps):
        dt = time_array[t + 1] - time_array[t] if t < time_steps - 1 else time_array[t] - time_array[t - 1]
        history['dt'][t] = dt
        I_module_current = I_module[t]
        mode = 'CHARGE' if I_module_current < 0 else 'DISCHARGE'
        for group_id in parallel_groups:
            group_cells = [i for i, cell in enumerate(cells) if cell['parallel_group'] == group_id]
            N = len(group_cells)
            A = np.zeros((N + 1, N + 1))
            b = np.zeros(N + 1)
            # Build equations
            for i, cell_idx in enumerate(group_cells):
                SOC = sim_SOC[cell_idx]
                Temp_C = sim_Temp[cell_idx] - 273.15
                SOH = sim_SOH[cell_idx]
                DCIR = sim_DCIR_AgingFactor[cell_idx]
                V_rc1 = sim_V_RC1[cell_idx]
                V_rc2 = sim_V_RC2[cell_idx]
                OCV, R0, R1, R2, C1, C2 = get_battery_params(SOC, Temp_C, mode, SOH, DCIR,
                                                             BatteryData_SOH1, BatteryData_SOH2, BatteryData_SOH3)
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
                if Vterm > cell_voltage_upper_limit or Vterm < cell_voltage_lower_limit:
                    print(f"Simulation stopped: Cell {cell_idx} terminal voltage cutoff at step {t}, V = {Vterm:.4f} V")
                    # Save partial results
                    if chunk_data:
                        df_chunk = pd.DataFrame(chunk_data)
                        df_chunk.to_csv(filename, mode='a', header=not header_written, index=False)
                        header_written = True
                        chunk_data = []
                    data_for_df = []
                    for cell_id in range(N_cells):
                        for ts in range(t):
                            row = {
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
                            }
                            data_for_df.append(row)
                    history_df = pd.DataFrame(data_for_df)
                    history_df.to_csv(filename, mode='a', header=not header_written, index=False)
                    print(f"Partial results saved to {filename}")
                    return filename
#-----------------------------------------------------------------------------------------------------------------------------------
                next_SOC = calculate_next_soc(I_cell, dt, capacity, sim_SOC[cell_idx],
                                              coulombic_efficiency, sim_SOH[cell_idx])
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
                history['V_RC1'][cell_idx, t] = sim_V_RC1[cell_idx]
                history['V_RC2'][cell_idx, t] = sim_V_RC2[cell_idx]
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
                
                # Append row to chunk
                row = {
                    'cell_id': cell_idx,
                    'time_step': t,
                    'Vterm': Vterm,
                    'SOC': next_SOC,
                    'OCV': OCV,
                    'Qgen': q_gen,
                    'Qirrev': q_irr,
                    'Qrev': q_rev,
                    'dt': dt,
                    'V_RC1': sim_V_RC1[cell_idx],
                    'V_RC2': sim_V_RC2[cell_idx],
                    'V_R0': R0,
                    'V_R1': R1,
                    'V_R2': R2,
                    'V_C1': C1,
                    'V_C2': C2,
                    'energy_throughput': history['energy_throughput'][cell_idx, t],
                    'Qgen_cumulative': history['Qgen_cumulative'][cell_idx, t],
                    'I_module': I_module[t],
                }
                chunk_data.append(row)
        
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
        
        # Check for incremental save every step, but only save if 10 sec passed
        current_time = time.time()
        if current_time - last_save_time >= 10:
            if chunk_data:
                df_chunk = pd.DataFrame(chunk_data)
                df_chunk.to_csv(filename, mode='a', header=not header_written, index=False)
                header_written = True
                chunk_data = []
            last_save_time = current_time
            
            # Update progress
            progress = ((t + 1) / time_steps) * 100
            async def update_progress():
                await db.simulations.update_one(
                    {"_id": ObjectId(sim_id)},
                    {"$set": {"metadata.progress": progress, "updated_at": datetime.utcnow()}}
                )
            if sim_id:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(update_progress())
                loop.close()

    # Save remaining chunk at end
    if chunk_data:
        df_chunk = pd.DataFrame(chunk_data)
        df_chunk.to_csv(filename, mode='a', header=not header_written, index=False)
    
    return filename
# main.py  –  CSV-based post-processing
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from data_processor import create_setup_from_json
from electrical_solver import run_electrical_solver   # <-- this now returns a CSV path

if __name__ == '__main__':
    # ----------------------------------------------------------------------
    # 1. Load the JSON configuration files and build the setup dictionary
    # ----------------------------------------------------------------------
    pack_json = 'pack_config.json'
    drive_json = 'drive_config.json'
    sim_json   = 'model_config.json'

    print("Loading and processing configs...")
    setup_data = create_setup_from_json(pack_json, drive_json, sim_json)

    # ----------------------------------------------------------------------
    # 2. Run the electrical solver
    # ----------------------------------------------------------------------
    print("Running simulation...")
    csv_path = run_electrical_solver(setup_data)   # <-- returns the CSV file name
    print("\nSimulation complete! History saved to", csv_path)

    # ----------------------------------------------------------------------
    # 3. Load the CSV and slice to the *effective* simulation length
    # ----------------------------------------------------------------------
    # The CSV contains one row per (cell, time-step).  We only need Cell 0.
    df = pd.read_csv(csv_path)

    # Keep only the first cell (cell_id == 0)
    cell0 = df[df['cell_id'] == 0].copy()

    # The simulation may have stopped early (voltage cut-off).  The column
    # `dt` is zero after the last valid step, so we trim there.
    # Find the last row where dt > 0
    last_valid = (cell0['dt'] > 0).idxmax()          # first True → start of valid data
    if cell0['dt'].iloc[-1] == 0:                  # if the file ends with zeros
        effective_end = cell0[cell0['dt'] > 0].index[-1] + 1
    else:
        effective_end = len(cell0)                 # whole file is valid

    cell0 = cell0.iloc[:effective_end].reset_index(drop=True)

    # ----------------------------------------------------------------------
    # 4. Build the time axis (cumulative seconds → days)
    # ----------------------------------------------------------------------
    dt_array      = cell0['dt'].values
    time_cum      = np.cumsum(dt_array)                 # seconds
    time_days     = time_cum / 86400.0                  # days

    # ----------------------------------------------------------------------
    # 5. Extract the variables we want to plot (Cell 0 only)
    # ----------------------------------------------------------------------
    soc_cell0     = cell0['SOC'].values
    vterm_cell0   = cell0['Vterm'].values
    qgen_cell0    = cell0['Qgen'].values
    I_module      = setup_data['I_module'][:len(cell0)]   # original current profile

    # ----------------------------------------------------------------------
    # 6. Plot the results (identical to the original script)
    # ----------------------------------------------------------------------
    fig, axs = plt.subplots(4, 1, figsize=(14, 12), sharex=True)
    fig.suptitle('Simulation Results for Cell 0 Over 1 Year (Calendar Time)', fontsize=16)

    # ---- SOC --------------------------------------------------------------
    axs[0].plot(time_days, soc_cell0, color='blue', label='SOC')
    axs[0].set_ylabel('State of Charge (SOC)', fontsize=12)
    axs[0].set_title('SOC Over Time', fontsize=14)
    axs[0].grid(True, linestyle='--', alpha=0.7)
    axs[0].set_ylim(0, 1)
    axs[0].legend(loc='upper right')

    # ---- Terminal Voltage -------------------------------------------------
    axs[1].plot(time_days, vterm_cell0, color='green', label='Terminal Voltage')
    axs[1].set_ylabel('Terminal Voltage (V)', fontsize=12)
    axs[1].set_title('Terminal Voltage Over Time', fontsize=14)
    axs[1].grid(True, linestyle='--', alpha=0.7)
    axs[1].set_ylim(0, 5)
    axs[1].legend(loc='upper right')

    # ---- Heat Generation --------------------------------------------------
    axs[2].plot(time_days, qgen_cell0, color='red', label='Heat Generation')
    axs[2].set_ylabel('Heat Generation (W)', fontsize=12)
    axs[2].set_title('Heat Generation Over Time', fontsize=14)
    axs[2].grid(True, linestyle='--', alpha=0.7)
    if len(qgen_cell0) > 0:
        q_max = np.max(qgen_cell0)
        axs[2].set_ylim(-1, q_max * 1.1 if q_max > 0 else 1)
    else:
        axs[2].set_ylim(-1, 1)
    axs[2].legend(loc='upper right')

    # ---- Module Current ---------------------------------------------------
    axs[3].plot(time_days, I_module, color='purple', label='Module Current')
    axs[3].set_xlabel('Time (Days)', fontsize=12)
    axs[3].set_ylabel('Current (A)', fontsize=12)
    axs[3].set_title('Module Current Over Time', fontsize=14)
    axs[3].grid(True, linestyle='--', alpha=0.7)
    axs[3].legend(loc='upper right')

    # ----------------------------------------------------------------------
    # 7. Finalise and save/show the figure
    # ----------------------------------------------------------------------
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig('simulation_plot.png')
    plt.show()
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os

def create_plot(time_axis, data, title, ylabel, filename, color='blue'):
    """
    Helper function to create and save a single plot.
    """
    plt.figure(figsize=(12, 6))
    plt.plot(time_axis, data, label=title, color=color)
        
    plt.title(title + ' Over Time', fontsize=16)
    plt.xlabel('Time (Days)', fontsize=12)
    plt.ylabel(ylabel, fontsize=12)
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.legend(loc='upper right')
    plt.tight_layout()
    plt.savefig(filename)
    plt.close() # Close the figure to save memory
    print(f"Saved plot: {filename}")

if __name__ == '__main__':
    
    # --- 1. Configuration (UPDATE THESE) ---
    
    # Set the name of your BIG simulation results file
    SIMULATION_CSV_FILE = r'C:\Users\Parth Dhengle\Desktop\Projects\YCS TECH\battery-simulation-ycs-firebase\Testing_backend\Simulation_results\simulation_results_DS3.csv' # <-- IMPORTANT: Change this
    
    # Set the name of your NEW current file
    CURRENT_CSV_FILE = r'C:\Users\Parth Dhengle\Desktop\Projects\YCS TECH\battery-simulation-ycs-firebase\Testing_backend\drive_cycles\drive_cycle3new.csv'     # <-- IMPORTANT: Change this
    
    # Folder to save plots in
    OUTPUT_DIR = 'individual_plots'
    
    # --- 2. Create output directory ---
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # --- 3. Load Data ---
    print(f"Loading simulation data from {SIMULATION_CSV_FILE}...")
    try:
        sim_df = pd.read_csv(SIMULATION_CSV_FILE)
    except FileNotFoundError:
        print(f"Error: Could not find the file '{SIMULATION_CSV_FILE}'.")
        exit()

    print(f"Loading current data from {CURRENT_CSV_FILE}...")
    try:
        current_df = pd.read_csv(CURRENT_CSV_FILE)
    except FileNotFoundError:
        print(f"Error: Could not find the file '{CURRENT_CSV_FILE}'.")
        exit()

    # --- 4. Process Simulation Data (cell 0 only) ---
    cell0 = sim_df[sim_df['cell_id'] == 0].copy()

    if cell0.empty:
        print("Error: No data found for cell_id == 0 in simulation file.")
        exit()

    # Find the last valid step (where dt > 0)
    if not (cell0['dt'] > 0).any():
        print("Error: No data found with dt > 0. Cannot plot.")
        exit()

    if cell0['dt'].iloc[-1] == 0:
        last_valid_index = cell0[cell0['dt'] > 0].index[-1]
        effective_end_pos = cell0.index.get_loc(last_valid_index) + 1
    else:
        effective_end_pos = len(cell0)

    # Trim the simulation data to its valid length
    cell0 = cell0.iloc[:effective_end_pos].reset_index(drop=True)
    num_valid_steps = len(cell0)
    print(f"Processing {num_valid_steps} valid time-steps for Cell 0.")

    # --- 5. Build Time Axis ---
    dt_array = cell0['dt'].values
    time_cum = np.cumsum(dt_array)
    time_days = time_cum / 86400.0

    # --- 6. Extract Data and Align ---
    
    # Extract from simulation data
    soc_cell0 = cell0['SOC'].values
    vterm_cell0 = cell0['Vterm'].values
    qgen_cell0 = cell0['Qgen'].values
    
    # Check if current data is long enough
    if len(current_df) < num_valid_steps:
        print(f"Warning: Current data has {len(current_df)} rows, but simulation has {num_valid_steps} valid steps.")
        print("The plots will be trimmed to the shorter length.")
        # Trim all data to the shorter length
        num_valid_steps = len(current_df)
        time_days = time_days[:num_valid_steps]
        soc_cell0 = soc_cell0[:num_valid_steps]
        vterm_cell0 = vterm_cell0[:num_valid_steps]
        qgen_cell0 = qgen_cell0[:num_valid_steps]

    # Extract from current data (and trim to match simulation length)
    # We assume the 'Current' column is named 'Current' as in your snippet
    try:
        i_module_cell0 = current_df['Current'].values[:num_valid_steps]
    except KeyError:
        print("Error: Could not find a column named 'Current' in your current data file.")
        print(f"Available columns are: {current_df.columns.tolist()}")
        exit()

    # --- 7. Calculate Power ---
    # Power (W) = Voltage (V) * Current (A)
    power_cell0 = vterm_cell0 * i_module_cell0

    # --- 8. Generate All Plots ---
    print("Generating plots...")
    
    # Plot SOC
    create_plot(time_days, soc_cell0, 
                'State of Charge (SOC)', 'SOC', 
                os.path.join(OUTPUT_DIR, 'plot_soc.png'), 
                color='blue')
    
    # Plot Terminal Voltage
    create_plot(time_days, vterm_cell0, 
                'Terminal Voltage', 'Voltage (V)', 
                os.path.join(OUTPUT_DIR, 'plot_vterm.png'), 
                color='green')

    # Plot Heat Generation
    create_plot(time_days, qgen_cell0, 
                'Heat Generation', 'Heat (W)', 
                os.path.join(OUTPUT_DIR, 'plot_qgen.png'), 
                color='red')

    # Plot Module Current
    create_plot(time_days, i_module_cell0, 
                'Module Current', 'Current (A)', 
                os.path.join(OUTPUT_DIR, 'plot_current.png'), 
                color='purple')
    
    # Plot Power
    create_plot(time_days, power_cell0, 
                'Calculated Power', 'Power (W)', 
                os.path.join(OUTPUT_DIR, 'plot_power.png'), 
                color='orange')

    print(f"\nDone. All plots saved in '{OUTPUT_DIR}' folder.")
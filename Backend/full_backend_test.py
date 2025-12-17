# Backend/CoreLogic/full_backend_test.py
"""
Full Backend Simulation Test Script.
- Hardcodes cell, pack, sim config from provided data.
- Simulates API call to /simulations/run by directly invoking the run_sim_background logic.
- Uses real paths for RC CSV and DC CSV (assumes they exist in Backend/app/uploads/...).
- Loads RC with wide CSV parser.
- Runs NEW_data_processor and NEW_electrical_solver.
- Debug prints throughout.
- Generates plots from output CSV: SOC (mean), Current (I_module), Voltage (V_module), Heat (cum Qgen mean), Temp (approx).
Run: python full_backend_test.py (from Backend/ dir)
Requires: All CoreLogic files updated; httpx optional for sim API call.
"""
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import os
from pathlib import Path
from datetime import datetime
import asyncio
import traceback
from typing import Dict, Any

# Add CoreLogic to path if needed
sys.path.append('CoreLogic')
import CoreLogic.NEW_data_processor as adp
import CoreLogic.NEW_electrical_solver as aes
from CoreLogic.geometry import init_geometry
from CoreLogic.initial_conditions import init_initial_cell_conditions
from CoreLogic.busbar_connections import define_busbar_connections
from CoreLogic.classify_cells import init_classify_cells
from CoreLogic.battery_params import load_cell_rc_data  # Updated for wide CSV

# Hardcoded Cell Data (from DB)
CELL_DATA = {
    "name": "Testing cell 1",
    "formFactor": "cylindrical",
    "dims": {
        "height": 70,
        "radius": 10.5
    },
    "cell_nominal_voltage": 3.7,
    "cell_upper_voltage_cutoff": 4.2,
    "cell_lower_voltage_cutoff": 2.5,
    "capacity": 5,
    "columbic_efficiency": 1,
    "cell_weight": 0.05,
    "cell_volume": 0.000024245241304079233,
    "rc_pair_type": "rc2",
    "rc_parameter_file_path": "app/uploads/rc-parameters/20251213_054501_2RC_parameter_template.csv"
}

# Hardcoded Pack Data (from DB)
PACK_DATA = {
    "name": "testing pack",
    "cell_id": "693cfd5de2bda6bf74744373",
    "connection_type": "row_series_column_parallel",
    "r_p": 0.001,
    "r_s": 0.001,
    "voltage_limits": {
        "module_upper": 60,
        "module_lower": 40
    },
    "options": {
        "allow_overlap": False,
        "compute_neighbors": True,
        "label_schema": "R{row}C{col}L{layer}"
    },
    "constraints": {
        "max_weight": 10,
        "max_volume": 0.01
    },
    "cost_per_cell": 3,
    "layers": [
        {
            "grid_type": "rectangular",
            "n_rows": 3,
            "n_cols": 3,
            "pitch_x": 25,
            "pitch_y": 25,
            "z_mode": "explicit",
            "z_center": 0
        }
    ],
    "z_pitch": None
}

# Sim Config
SIM_CONFIG = {
    "simulation_frequency": 1.0,
    "name": "TESTING_SIMULATION_CYCLE_20251217_045600_6563",
    "type": "Generic"
}

# Paths (relative to Backend/)
RC_PATH = Path("app/uploads/rc-parameters/20251213_054501_2RC_parameter_template.csv")
DC_PATH = Path("app/uploads/simulation_cycle/TESTING_SIMULATION_CYCLE_20251217_045600_6563.csv")
OUTPUT_CSV = "test_simulation_results.csv"

# Debug flag
DEBUG = True

def debug_print(msg: str, level: str = "INFO"):
    """Debug print wrapper."""
    if DEBUG:
        print(f"[{level}] {datetime.now()}: {msg}")

# Step 1: Load RC Data (wide CSV parser)
def load_rc_wide_csv(file_path: Path) -> Dict[str, Any]:
    """Load wide RC CSV to mode/temp grids."""
    debug_print(f"Loading RC from {file_path}")
    if not file_path.exists():
        raise FileNotFoundError(f"RC file missing: {file_path}")
    df = pd.read_csv(file_path)
    debug_print(f"RC CSV shape: {df.shape}, columns: {list(df.columns)}")
    data = {'CHARGE': {}, 'DISCHARGE': {}}
    temps = ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']
    for mode in ['CHARGE', 'DISCHARGE']:
        for temp in temps:
            prefix = f"{mode}_{temp}_"
            soc_col = prefix + 'soc'
            if soc_col not in df.columns:
                debug_print(f"Missing {soc_col}, skipping {mode}-{temp}", "WARN")
                continue
            soc = df[soc_col].dropna().values
            if len(soc) == 0:
                continue
            grid = np.zeros((len(soc), 7))
            grid[:, 0] = soc
            params = ['ocv', 'r0', 'r1', 'r2', 'c1', 'c2']
            for p_idx, param in enumerate(params, 1):
                col = prefix + param
                if col in df.columns:
                    vals = df[col].dropna().values[:len(soc)]
                    grid[:, p_idx] = vals
                    debug_print(f"Loaded {mode}-{temp}-{param}: min={vals.min():.4f}, max={vals.max():.4f}")
                else:
                    default = 0.02 if 'r0' in param else 0.01 if 'r1' in param else 0.005 if 'r2' in param else 1000 if 'c1' in param else 10000
                    grid[:, p_idx] = np.full(len(soc), default)
                    debug_print(f"Default {param}={default} for {mode}-{temp}", "WARN")
            data[mode][temp] = grid
    debug_print(f"RC loaded: {len(data['CHARGE'])} temps for CHARGE, {len(data['DISCHARGE'])} for DISCHARGE")
    return data

# Step 2: Prepare Pack with Cell
def prepare_pack(cell_data: Dict, pack_data: Dict) -> Dict:
    """Merge cell into pack."""
    debug_print("Preparing pack with cell data")
    pack = pack_data.copy()
    pack['cell'] = cell_data.copy()
    pack['initial_conditions'] = {
        "temperature": 298.15,  # 25C K
        "soc": 0.8,
        "soh": 1.0,
        "dcir_aging_factor": 1.0,
        "varying_conditions": []
    }
    # Load RC into pack['cell']['rc_data']
    try:
        pack['cell']['rc_data'] = load_rc_wide_csv(RC_PATH)
    except Exception as e:
        debug_print(f"RC load error: {e}", "ERROR")
        raise
    debug_print("Pack prepared successfully")
    return pack

# Step 3: Create Setup (using NEW_data_processor)
async def create_test_setup(pack: Dict, dc_path: Path, sim_config: Dict) -> Dict:
    """Wrapper for adp.create_setup_from_configs with debug."""
    debug_print("Creating setup from configs")
    try:
        setup = adp.create_setup_from_configs(pack, str(dc_path), sim_config)
        debug_print(f"Setup created: {len(setup['cells'])} cells, {setup['time_steps']} steps")
        return setup
    except Exception as e:
        debug_print(f"Setup error: {traceback.format_exc()}", "ERROR")
        raise

# Step 4: Run Solver (using NEW_electrical_solver)
def run_test_solver(setup: Dict, sim_id: str, filename: str) -> str:
    """Wrapper for aes.run_electrical_solver_with_progress with debug."""
    debug_print(f"Running solver for sim {sim_id}, output {filename}")
    try:
        output = aes.run_electrical_solver_with_progress(setup, setup['dc_table_path'], sim_id, filename)
        debug_print(f"Solver complete: {output}")
        return output
    except Exception as e:
        debug_print(f"Solver error: {traceback.format_exc()}", "ERROR")
        raise

# Step 5: Plot Results
def plot_results(csv_path: Path):
    """Load CSV and plot SOC, I, V, Heat, Temp."""
    debug_print("Plotting results")
    if not csv_path.exists():
        raise FileNotFoundError(f"Output CSV missing: {csv_path}")
    df = pd.read_csv(csv_path)
    debug_print(f"Results loaded: {df.shape[0]} rows, columns: {list(df.columns)}")
    
    # Group by time_global_s for means
    df_grouped = df.groupby('time_global_s').agg({
        'SOC': 'mean',
        'I_module': 'first',
        'V_module': 'first',
        'Qgen_cumulative': 'mean',
        'Qgen': 'mean',
        'Vterm': 'mean'
    }).reset_index()
    
    time = df_grouped['time_global_s']
    
    fig, axs = plt.subplots(5, 1, figsize=(12, 16))
    
    # 1. Mean SOC
    axs[0].plot(time, df_grouped['SOC'])
    axs[0].set_title('Mean SOC vs Time')
    axs[0].set_ylabel('SOC')
    axs[0].grid(True)
    
    # 2. I_module
    axs[1].plot(time, df_grouped['I_module'])
    axs[1].set_title('Module Current vs Time')
    axs[1].set_ylabel('I (A)')
    axs[1].grid(True)
    
    # 3. V_module
    axs[2].plot(time, df_grouped['V_module'])
    axs[2].set_title('Module Voltage vs Time')
    axs[2].set_ylabel('V (V)')
    axs[2].grid(True)
    
    # 4. Mean Cum Heat
    axs[3].plot(time, df_grouped['Qgen_cumulative'])
    axs[3].set_title('Mean Cumulative Heat vs Time')
    axs[3].set_ylabel('Qgen (Ws)')
    axs[3].grid(True)
    
    # 5. Approx Temp (25 + Qgen_cum / (n_cells * m_cell * cp); cp=1000 J/kgK, rough)
    n_cells = PACK_DATA['layers'][0]['n_rows'] * PACK_DATA['layers'][0]['n_cols']
    m_total = n_cells * CELL_DATA['cell_weight']
    cp = 1000  # J/kgK
    temp_approx = 25 + df_grouped['Qgen_cumulative'] / (m_total * cp)  # Ws ≈ J / 3600, but approx
    axs[4].plot(time, temp_approx)
    axs[4].set_title('Approx Mean Temp vs Time')
    axs[4].set_ylabel('Temp (°C)')
    axs[4].set_xlabel('Time (s)')
    axs[4].grid(True)
    
    plt.tight_layout()
    plot_path = 'backend_test_plots.png'
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    plt.show()
    debug_print(f"Plots saved to {plot_path}")
    
    # Summary stats
    final_soc = df_grouped['SOC'].iloc[-1] if len(df_grouped) > 0 else np.nan
    final_v = df_grouped['V_module'].iloc[-1] if len(df_grouped) > 0 else np.nan
    debug_print(f"Summary: {len(df)} rows, Final SOC: {final_soc:.4f}, Final V: {final_v:.2f}V")

# Main Test Flow (Simulates /simulations/run endpoint)
async def run_full_test():
    """Mimic API flow: Prepare → Setup → Solver → Plot."""
    debug_print("=== Starting Full Backend Test ===")
    
    # Check paths
    for p in [RC_PATH, DC_PATH]:
        if not p.exists():
            debug_print(f"PATH ERROR: {p} does not exist!", "ERROR")
            return
    debug_print("Paths OK")
    
    # Prepare pack
    pack = prepare_pack(CELL_DATA, PACK_DATA)
    
    # Create setup
    setup = await create_test_setup(pack, DC_PATH, SIM_CONFIG)
    
    # Run solver (background-like)
    sim_id = "test_backend_run"
    output_csv = run_test_solver(setup, sim_id, OUTPUT_CSV)
    
    # Plot
    plot_results(Path(output_csv))
    
    debug_print("=== Test Complete ===")

if __name__ == "__main__":
    asyncio.run(run_full_test())
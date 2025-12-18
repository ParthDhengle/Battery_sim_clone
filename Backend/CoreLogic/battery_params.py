import numpy as np
from scipy.interpolate import RegularGridInterpolator
import pandas as pd
import os

def load_cell_rc_data(file_path: str, rc_pair_type: str = 'rc2') -> dict:
    """Load RC data from CSV. If file is invalid/empty, return dummy data."""
    if not os.path.exists(file_path):
        print(f"Warning: RC file not found: {file_path}. Using dummy RC data.")
        return _get_dummy_rc_data()

    try:
        df = pd.read_csv(file_path)
        if df.empty:
            print(f"Warning: RC CSV is empty: {file_path}. Using dummy data.")
            return _get_dummy_rc_data()

        print(f"Loaded RC CSV: {file_path} — shape {df.shape}, columns: {list(df.columns)}")

        data = {'CHARGE': {}, 'DISCHARGE': {}}
        temps = ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']
        loaded_any = False

        for mode in ['CHARGE', 'DISCHARGE']:
            for temp in temps:
                prefix = f"{mode}_{temp}_" if "_" in df.columns[0] else f"{mode}*{temp}*"
                soc_col = next((c for c in df.columns if c.endswith('soc') and prefix in c), None)
                if not soc_col:
                    continue

                soc = df[soc_col].dropna().values
                if len(soc) == 0:
                    continue

                grid = np.zeros((len(soc), 7))
                grid[:, 0] = soc
                params = ['ocv', 'r0', 'r1', 'r2', 'c1', 'c2']
                for p_idx, param in enumerate(params, 1):
                    col = next((c for c in df.columns if param in c.lower() and prefix in c), None)
                    if col and col in df.columns:
                        vals = df[col].dropna().values[:len(soc)]
                        grid[:, p_idx] = vals
                    else:
                        # Sensible defaults
                        default = 3.7 if param == 'ocv' else \
                                  0.02 if param == 'r0' else \
                                  0.01 if param == 'r1' else \
                                  0.005 if param == 'r2' else \
                                  1000 if param == 'c1' else 10000
                        grid[:, p_idx] = default

                data[mode][temp] = grid
                loaded_any = True

        if not loaded_any:
            print(f"Warning: No valid RC data found in {file_path}. Using dummy data.")
            return _get_dummy_rc_data()

        # Validate SOC consistency
        soc_refs = [grid[:, 0] for mode_data in data.values() for grid in mode_data.values()]
        if soc_refs:
            soc_ref = soc_refs[0]
            for soc in soc_refs[1:]:
                if not np.allclose(soc, soc_ref, atol=1e-6):
                    print("Warning: Inconsistent SOC across temps/modes. Using first as reference.")

        return data

    except Exception as e:
        print(f"Error loading RC file {file_path}: {e}. Falling back to dummy data.")
        return _get_dummy_rc_data()

def _get_dummy_rc_data():
    """Return simple constant RC data for testing when real file is missing/invalid."""
    soc = np.linspace(0, 1, 21)
    grid = np.zeros((21, 7))
    grid[:, 0] = soc
    grid[:, 1] = 3.7  # OCV
    grid[:, 2] = 0.02 # R0
    grid[:, 3] = 0.01 # R1
    grid[:, 4] = 0.005# R2
    grid[:, 5] = 1000 # C1
    grid[:, 6] = 10000# C2

    dummy = {'CHARGE': {}, 'DISCHARGE': {}}
    for mode in dummy:
        for temp in ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']:
            dummy[mode][temp] = grid.copy()
    print("Using dummy constant RC data (OCV=3.7V, low R)")
    return dummy

def get_battery_params(rc_data: dict, SOC: float, Temp_C: float, mode: str, SOH: float, DCIR_aging_factor: float):
    """Interpolate params, apply aging."""
    if mode.upper() == 'CHARGE':
        data_temp = rc_data['CHARGE']
    elif mode.upper() == 'DISCHARGE':
        data_temp = rc_data['DISCHARGE']
    else:
        raise ValueError('Mode: CHARGE or DISCHARGE')

    temp_keys = sorted(data_temp.keys(), key=lambda k: int(k[1:]))
    temp_vals = [int(k[1:]) for k in temp_keys]
    soc_grid = data_temp[temp_keys[0]][:, 0]

    # Interp each param (cols 1-6)
    OCV, R0, R1, R2, C1, C2 = 0, 0, 0, 0, 0, 0
    for col, param_name in enumerate(['OCV', 'R0', 'R1', 'R2', 'C1', 'C2'], 1):
        grid = np.stack([data_temp[temp][:, col] for temp in temp_keys], axis=1)
        interp = RegularGridInterpolator((soc_grid, np.array(temp_vals)), grid, bounds_error=False, fill_value=np.nan)
        param = interp((SOC, Temp_C))
        if np.isnan(param):
            param = 3.7 if param_name == 'OCV' else 0.02 if 'R' in param_name else 1000
        if param_name == 'OCV':
            OCV = param
        elif param_name == 'R0':
            R0 = param * DCIR_aging_factor
        elif param_name == 'R1':
            R1 = param * DCIR_aging_factor
        elif param_name == 'R2':
            R2 = param * DCIR_aging_factor
        elif param_name == 'C1':
            C1 = param
        elif param_name == 'C2':
            C2 = param

    if OCV < 2.5 or OCV > 4.2:
        print(f"Warning: OCV {OCV:.2f}V out of range at SOC={SOC:.2f}, T={Temp_C:.1f}C")
    return OCV, R0, R1, R2, C1, C2
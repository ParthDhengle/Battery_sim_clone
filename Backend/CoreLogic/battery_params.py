# FILE: Backend/CoreLogic/battery_params.py
# (Updated to load from path, as in router)
import numpy as np
from scipy.interpolate import RegularGridInterpolator
import json
import os
import pandas as pd
from scipy.io import loadmat

def load_cell_rc_data(file_path: str, rc_pair_type: str = 'rc2') -> dict:
    """Load RC from file to {'CHARGE': {'T05': array(n_soc,7)}, ...}"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"RC file not found: {file_path}")
    ext = os.path.splitext(file_path)[1].lower()
    data = {'CHARGE': {}, 'DISCHARGE': {}}

    if ext == '.json':
        with open(file_path, 'r') as f:
            raw = json.load(f)
        for mode in ['CHARGE', 'DISCHARGE']:
            for temp_key in raw.get(mode, {}):
                grid_list = raw[mode][temp_key]  # [[SOC], [OCV], ...]
                grid = np.array(grid_list).T  # (n_soc, 7)
                data[mode][temp_key] = grid
    elif ext == '.csv':
        # Assume wide format: CHARGE*T05*soc, CHARGE*T05*ocv, etc.
        df = pd.read_csv(file_path)
        temps = ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']
        for mode in ['CHARGE', 'DISCHARGE']:
            for temp in temps:
                prefix = f"{mode}*{temp}*"
                soc_col = prefix + 'soc'
                if soc_col not in df.columns:
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
                    else:
                        # Defaults
                        default = 0.02 if 'r0' in param else 0.01 if 'r1' in param else 0.005 if 'r2' in param else 1000 if 'c1' in param else 10000
                        grid[:, p_idx] = np.full(len(soc), default)
                data[mode][temp] = grid
    elif ext == '.mat':
        mat = loadmat(file_path)
        # Assume structure data.CHARGE.T05 = [SOC OCV R0 R1 R2 C1 C2]
        for mode in ['CHARGE', 'DISCHARGE']:
            for temp_key in [k for k in mat.keys() if mode.lower() in k.lower() and 'T' in k]:
                temp_data = mat[temp_key]
                grid = temp_data  # Assume (n_soc, 7)
                data[mode][temp_key] = grid
    else:
        raise ValueError(f"Unsupported: {ext}")

    # Validate consistent SOC
    if data:
        soc_ref = next(iter(next(iter(data.values())).values()))[:, 0]
        for mode in data:
            for temp in data[mode]:
                if not np.allclose(data[mode][temp][:, 0], soc_ref):
                    raise ValueError(f"Inconsistent SOC in {file_path}")
    return data

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
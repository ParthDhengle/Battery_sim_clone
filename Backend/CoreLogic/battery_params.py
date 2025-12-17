import numpy as np
from scipy.interpolate import RegularGridInterpolator
import json
import os
import pandas as pd
from scipy.io import loadmat  # For MAT files

def load_cell_rc_data(file_path: str, rc_pair_type: str = 'rc2') -> dict:
    """
    Load RC parameters from cell's uploaded file (JSON/CSV/MAT).
    Returns: {'CHARGE': {'T05': np.array([[SOC], [OCV], [R0], [R1], [R2], [C1], [C2]]), ...},
              'DISCHARGE': ...}
    Assumes 2RC (ignores extra for 'rc3').
    """
    if not os.path.exists(file_path):
        raise ValueError(f"RC file not found: {file_path}")
    
    ext = os.path.splitext(file_path)[1].lower()
    data = {}
    
    if ext == '.json':
        with open(file_path, 'r') as f:
            raw = json.load(f)
        for mode in ['CHARGE', 'DISCHARGE']:
            data[mode] = {}
            for temp_key in raw.get(mode, {}):
                grid_list = raw[mode][temp_key]  # [[SOC], [OCV], [R0], ...]
                grid = np.array(grid_list).T  # Shape: (n_SOC, 7)
                data[mode][temp_key] = grid
    
    elif ext == '.csv':
        df = pd.read_csv(file_path)
        # Assume columns: Mode, Temp, SOC, OCV, R0, R1, R2, C1, C2
        for mode in df['Mode'].unique():
            mode_df = df[df['Mode'] == mode]
            temps = sorted(mode_df['Temp'].unique())
            soc_points = sorted(mode_df['SOC'].unique())
            for temp in temps:
                temp_df = mode_df[mode_df['Temp'] == temp].sort_values('SOC')
                if len(temp_df) != len(soc_points):
                    raise ValueError(f"Incomplete data for {mode} at {temp}°C")
                grid = np.zeros((len(soc_points), 7))
                grid[:, 0] = temp_df['SOC'].values  # SOC
                grid[:, 1] = temp_df['OCV'].values  # OCV
                grid[:, 2] = temp_df['R0'].values   # R0
                grid[:, 3] = temp_df['R1'].values   # R1
                grid[:, 4] = temp_df['R2'].values   # R2
                grid[:, 5] = temp_df['C1'].values   # C1
                grid[:, 6] = temp_df['C2'].values   # C2
                data.setdefault(mode, {})[f"T{int(temp):02d}"] = grid
    
    elif ext == '.mat':
        mat = loadmat(file_path)
        # Assume struct: data.CHARGE.T05.SOC, data.CHARGE.T05.OCV, etc.
        for mode in ['CHARGE', 'DISCHARGE']:
            data[mode] = {}
            for temp_key in [k for k in mat if mode.lower() in k.lower() and 'T' in k]:
                temp_data = mat[temp_key]
                # Flatten: assume [SOC, OCV, R0, R1, R2, C1, C2] x n_SOC
                grid = temp_data.T  # Adjust shape if needed
                data[mode][temp_key] = grid
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    
    # Validate: All modes/temps have consistent SOC grid
    soc_ref = next(iter(next(iter(data.values())).__iter__()))[:, 0]
    for mode in data:
        for temp in data[mode]:
            if not np.allclose(data[mode][temp][:, 0], soc_ref):
                raise ValueError(f"Inconsistent SOC grid in {file_path}")
    
    return data

def get_battery_params(cell_rc_data: dict, SOC: float, cell_temp_C: float, mode: str, SOH: float, DCIR_aging_factor: float):
    """
    Interpolate OCV/R0/R1/R2/C1/C2 for a cell using its RC data.
    Applies SOH (selects grid) and DCIR aging to resistances.
    Warns on invalid values.
    """
    if SOH >= 0.9:
        soh_key = 'SOH1'  # Assume data has SOH variants; extend if needed
    elif SOH >= 0.8:
        soh_key = 'SOH2'
    else:
        soh_key = 'SOH3'
    # If no SOH variants, use base; TODO: extend for real SOH grids
    base_data = cell_rc_data
    if mode.upper() == 'CHARGE':
        data_temp = base_data['CHARGE']
    elif mode.upper() == 'DISCHARGE':
        data_temp = base_data['DISCHARGE']
    else:
        raise ValueError('Invalid mode. Use "CHARGE" or "DISCHARGE".')
    
    temp_keys = sorted([k for k in data_temp], key=lambda k: int(k[1:]))  # T05, T15,...
    temp_vals = [int(k[1:]) for k in temp_keys]
    soc_grid = data_temp[temp_keys[0]][:, 0]
    
    # Build grids for each param (col 1-6: OCV, R0, R1, R2, C1, C2)
    parameter_grids = []
    for col in range(1, 7):
        grid = np.stack([data_temp[temp][:, col] for temp in temp_keys], axis=1)
        interp = RegularGridInterpolator((soc_grid, np.array(temp_vals)), grid, bounds_error=False, fill_value=None)
        param = interp((SOC, cell_temp_C))
        parameter_grids.append(param)
    
    OCV, R0, R1, R2, C1, C2 = parameter_grids
    
    # Apply aging
    R0 *= DCIR_aging_factor
    R1 *= DCIR_aging_factor
    R2 *= DCIR_aging_factor
    
    # Warnings
    for val, name in zip([OCV, R0, R1, R2, C1, C2], ['OCV', 'R0', 'R1', 'R2', 'C1', 'C2']):
        if val < 0:
            print(f"Warning: {name} negative ({val:.4f}) at SOC={SOC:.4f}, T={cell_temp_C:.2f}°C")
    if OCV < 2.5 or OCV > 4.2:
        print(f"Warning: OCV out of range ({OCV:.4f}V) at SOC={SOC:.4f}")
    
    return OCV, R0, R1, R2, C1, C2
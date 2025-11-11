import numpy as np
from scipy.interpolate import RegularGridInterpolator
import json
import os
def create_mock_battery_data():
    temps = ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']
    soc_points = np.linspace(0, 1, 11)
    data = {}
    for mode in ['CHARGE', 'DISCHARGE']:
        data[mode] = {}
        for temp in temps:
            grid = np.zeros((len(soc_points), 7))
            grid[:, 0] = soc_points  # SOC
            grid[:, 1] = 2.5 + soc_points * 1.7  # OCV
            grid[:, 2] = 0.02  # R0
            grid[:, 3] = 0.01  # R1
            grid[:, 4] = 0.01  # R2
            grid[:, 5] = 1000  # C1
            grid[:, 6] = 10000 # C2
            data[mode][temp] = grid
    return data

def load_battery_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    # Convert lists to numpy arrays for compatibility with the rest of your code
    for mode in data:
        for temp in data[mode]:
            data[mode][temp] = np.array(data[mode][temp])
    return data

# Assuming files are in same directory as script
base_path = os.path.dirname(__file__)
 
BatteryData_SOH1 = create_mock_battery_data()
BatteryData_SOH2 = create_mock_battery_data()
BatteryData_SOH3 = create_mock_battery_data()

def get_battery_params(SOC, cell_temp_C, mode, SOH, DCIR_aging_factor, BatteryData_SOH1, BatteryData_SOH2, BatteryData_SOH3):
    # Select SOH dataset
    if SOH >= 0.9:
        BatteryData = BatteryData_SOH1
    elif SOH >= 0.8:
        BatteryData = BatteryData_SOH2
    else:
        BatteryData = BatteryData_SOH3

    # Select mode
    if mode.upper() == 'CHARGE':
        Data_Temp = BatteryData['CHARGE']
    elif mode.upper() == 'DISCHARGE':
        Data_Temp = BatteryData['DISCHARGE']
    else:
        raise ValueError('Invalid mode. Use "CHARGE" or "DISCHARGE".')

    # Extract grids
    temp_keys = ['T05', 'T15', 'T25', 'T35', 'T45', 'T55']
    temp_vals = [5, 15, 25, 35, 45, 55]
    parameter_grids = []

    for col in range(1, 7):
        grid = np.stack([Data_Temp[temp][:, col] for temp in temp_keys], axis=1)
        parameter_grids.append(grid)

    SOC_grid = Data_Temp['T05'][:, 0]
    Temp_grid = np.array(temp_vals)

    # Interpolators
    def make_interp(grid):
        return RegularGridInterpolator((SOC_grid, Temp_grid), grid, bounds_error=False, fill_value=None)

    OCV = make_interp(parameter_grids[0])((SOC, cell_temp_C))
    R0 = make_interp(parameter_grids[1])((SOC, cell_temp_C))
    R1 = make_interp(parameter_grids[2])((SOC, cell_temp_C))
    R2 = make_interp(parameter_grids[3])((SOC, cell_temp_C))
    C1 = make_interp(parameter_grids[4])((SOC, cell_temp_C))
    C2 = make_interp(parameter_grids[5])((SOC, cell_temp_C))
    # Apply aging
    R0 *= DCIR_aging_factor
    R1 *= DCIR_aging_factor
    R2 *= DCIR_aging_factor

    # Warnings (same as original)
    def warn_if_negative(val, name):
        if val < 0:
            print(f"Warning: {name} is negative ({val:.4f}) at SOC={SOC:.4f}, T={cell_temp_C:.2f}°C")

    for val, name in zip([OCV, R0, R1, R2, C1, C2], ['OCV', 'R0', 'R1', 'R2', 'C1', 'C2']):
        warn_if_negative(val, name)

    if OCV < 2.5 or OCV > 4.2:
        print(f"Warning: OCV ({OCV:.4f} V) out of expected range at SOC={SOC:.4f}, T={cell_temp_C:.2f}°C")

    return OCV, R0, R1, R2, C1, C2

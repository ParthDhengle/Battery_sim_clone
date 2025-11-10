import json
import numpy as np
from datetime import datetime, timedelta
from geometry import init_geometry
from classify_cells import init_classify_cells
from initial_conditions import init_initial_cell_conditions
from busbar_connections import define_busbar_connections
from battery_params import BatteryData_SOH1, BatteryData_SOH2, BatteryData_SOH3
from drive_cycle import flatten_drive_cycle
def create_setup_from_json(pack_json_path, drive_json_path, sim_json_path):
    with open(pack_json_path, 'r') as f:
        pack = json.load(f)
    with open(drive_json_path, 'r') as f:
        drive = json.load(f)
    with open(sim_json_path, 'r') as f:
        sim = json.load(f)
    
    # Generate cells from inputs
    cells = init_geometry(pack)
    layers = pack['layers']
    form_factor = pack['meta']['formFactor']
    capacity = pack['cell']['capacity']
    columbic_efficiency = pack['cell']['columbic_efficiency']
    connection_type = pack['connection_type']
    R_p = pack['R_p']
    R_s = pack['R_s']
    voltage_limits = pack['voltage_limits']
    voltage_limits['cell_upper'] = pack['cell']['cell_voltage_upper_limit']
    voltage_limits['cell_lower'] = pack['cell']['cell_voltage_lower_limit']
    masses = {'cell': pack['cell']['m_cell'], 'jellyroll': pack['cell']['m_jellyroll']}
    
    # Extract initial conditions from pack JSON
    initial_conditions = pack.get('initial_conditions', {})
    initial_temperature = initial_conditions.get('temperature', 300.0)
    initial_SOC = initial_conditions.get('soc', drive.get('startingSoc', 100.0) / 100.0)
    initial_SOH = initial_conditions.get('soh', 1.0)
    initial_DCIR_AgingFactor = initial_conditions.get('dcir_aging_factor', 1.0)
    varying_cells = [vc['cell_index'] for vc in initial_conditions.get('varying_cells', [])]
    varying_temps = [vc['temperature'] for vc in initial_conditions.get('varying_cells', [])]
    varying_SOCs = [vc['soc'] for vc in initial_conditions.get('varying_cells', [])]
    varying_SOHs = [vc['soh'] for vc in initial_conditions.get('varying_cells', [])]
    varying_DCIRs = [vc['dcir_aging_factor'] for vc in initial_conditions.get('varying_cells', [])]
    
    # Initialize cell conditions
    for idx, c in enumerate(cells):
        c['global_index'] = idx  # 0-based
    for layer_idx, layer in enumerate(layers, 1):
        layer_cells = [c for c in cells if c['layer_index'] == layer_idx]
        init_classify_cells(layer_cells, layer['n_rows'], layer['n_cols'])
    print(f"Initialized {len(cells)} cells across {len(layers)} layers with form factor '{form_factor}'.")
    
    cells = init_initial_cell_conditions(
        cells,
        initial_temperature,
        initial_SOC,
        initial_SOH,
        initial_DCIR_AgingFactor,
        varying_cells,
        varying_temps,
        varying_SOCs,
        varying_SOHs,
        varying_DCIRs
    )
    
    cells, parallel_groups = define_busbar_connections(cells, layers, connection_type)
    print(f"Defined {len(parallel_groups)} parallel groups based on connection type '{connection_type}'.")

    time, I_module = flatten_drive_cycle(drive, capacity=capacity)
    time_steps = len(time)
    print(time)
    print(f"Drive cycle flattened to {time_steps} time steps over {time[-1]:.1f} seconds.")
    
    
    V_term_test = np.zeros(time_steps)
    
    return {
        'cells': cells,
        'capacity': capacity,
        'columbic_efficiency': columbic_efficiency,
        'connection_type': connection_type,
        'R_p': R_p,
        'R_s': R_s,
        'voltage_limits': {
            'cell_upper': voltage_limits['cell_upper'],
            'cell_lower': voltage_limits['cell_lower'] or np.nan,
            'module_upper': voltage_limits['module_upper'],
            'module_lower': voltage_limits['module_lower'] or np.nan
        },
        'masses': {
            'cell': masses['cell'],
            'jellyroll': masses['jellyroll']
        },
        'time': time,
        'I_module': I_module,
        'V_term_test': V_term_test,
        'time_steps': time_steps,
        'BatteryData_SOH1': BatteryData_SOH1,
        'BatteryData_SOH2': BatteryData_SOH2,
        'BatteryData_SOH3': BatteryData_SOH3
    }

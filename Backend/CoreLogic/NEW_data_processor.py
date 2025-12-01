import numpy as np
from CoreLogic.geometry import init_geometry
from CoreLogic.classify_cells import init_classify_cells
from CoreLogic.initial_conditions import init_initial_cell_conditions
from CoreLogic.busbar_connections import define_busbar_connections
from CoreLogic.battery_params import BatteryData_SOH1, BatteryData_SOH2, BatteryData_SOH3
import pandas as pd

def create_setup_from_configs(pack: dict, drive_df: pd.DataFrame, sim: dict):
    
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
    initial_SOC = initial_conditions.get('soc', 1.0)
    initial_SOH = initial_conditions.get('soh', 1.0)
    initial_DCIR_AgingFactor = initial_conditions.get('dcir_aging_factor', 1.0)
    
    # UPDATED: Build label-to-index mapping
    label_to_index = {}
    for idx, cell in enumerate(cells):
        cell['global_index'] = idx  # 0-based
        label_to_index[cell.get('label', '')] = idx
    
    # UPDATED: Convert cell_ids (labels) to indices for varying_conditions
    varying_cells_indices = []
    varying_temps = []
    varying_SOCs = []
    varying_SOHs = []
    varying_DCIRs = []
    
    for vc in initial_conditions.get('varying_conditions', []):
        cell_ids = vc.get('cell_ids', [])
        indices = [label_to_index.get(cid) for cid in cell_ids if cid in label_to_index]
        
        if indices:  # Only add if we found valid indices
            # Add each index separately (as original function expects)
            for idx in indices:
                varying_cells_indices.append(idx)
                varying_temps.append(vc.get('temperature', initial_temperature))
                varying_SOCs.append(vc.get('soc', initial_SOC))
                varying_SOHs.append(vc.get('soh', initial_SOH))
                varying_DCIRs.append(vc.get('dcir_aging_factor', initial_DCIR_AgingFactor))
    
    # Initialize cell conditions
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
        varying_cells_indices if varying_cells_indices else None,
        varying_temps if varying_temps else None,
        varying_SOCs if varying_SOCs else None,
        varying_SOHs if varying_SOHs else None,
        varying_DCIRs if varying_DCIRs else None
    )
    
    freq=sim['simulation_frequency']
  
    cells, parallel_groups = define_busbar_connections(cells, layers, connection_type)
    print(f"Defined {len(parallel_groups)} parallel groups based on connection type '{connection_type}'.")
    
    time = drive_df['Time'].values
    I_module = drive_df['Current'].values
    time_steps = len(time)
    print(f"Drive cycle loaded from CSV with {time_steps} time steps over {time[-1]:.1f} seconds.")
  
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
        'BatteryData_SOH3': BatteryData_SOH3,

        'Frequency':freq
    }
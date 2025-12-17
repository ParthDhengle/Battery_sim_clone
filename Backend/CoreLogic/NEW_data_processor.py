# FILE: Backend/CoreLogic/NEW_data_processor.py
import numpy as np
from .geometry import init_geometry
from .classify_cells import init_classify_cells
from .initial_conditions import init_initial_cell_conditions
from .busbar_connections import define_busbar_connections
import pandas as pd

def create_setup_from_configs(pack: dict, dc_table: pd.DataFrame, sim_config: dict):
    """Create setup from pack, new DC table (df), and sim config."""
    # Geometry and classification
    cells = init_geometry(pack)
    layers = pack['layers']
    # Assign rc_data to each cell (identical)
    rc_data = pack['cell'].get('rc_data')
    for cell in cells:
        cell['rc_data'] = rc_data
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

    # Initial conditions
    initial_conditions = pack.get('initial_conditions', {})
    initial_temperature = initial_conditions.get('temperature', 300.0)
    initial_SOC = initial_conditions.get('soc', 1.0)
    initial_SOH = initial_conditions.get('soh', 1.0)
    initial_DCIR_AgingFactor = initial_conditions.get('dcir_aging_factor', 1.0)

    # Build label-to-index mapping for varying_conditions
    label_to_index = {cell.get('label', ''): idx for idx, cell in enumerate(cells)}

    varying_cells_indices = []
    varying_temps = []
    varying_SOCs = []
    varying_SOHs = []
    varying_DCIRs = []

    for vc in initial_conditions.get('varying_conditions', []):
        cell_ids = vc.get('cell_ids', [])
        indices = [label_to_index.get(cid) for cid in cell_ids if cid in label_to_index]
        if indices:
            for idx in indices:
                varying_cells_indices.append(idx)
                varying_temps.append(vc.get('temperature', initial_temperature))
                varying_SOCs.append(vc.get('soc', initial_SOC))
                varying_SOHs.append(vc.get('soh', initial_SOH))
                varying_DCIRs.append(vc.get('dcir_aging_factor', initial_DCIR_AgingFactor))

    # Classify cells per layer
    for layer_idx, layer in enumerate(layers, 1):
        layer_cells = [c for c in cells if c['layer_index'] == layer_idx]
        init_classify_cells(layer_cells, layer['n_rows'], layer['n_cols'])

    print(f"Initialized {len(cells)} cells across {len(layers)} layers with form factor '{form_factor}'.")

    # Set initial conditions
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

    time_gap = sim_config.get('simulation_frequency', 1.0)

    # Busbar connections
    cells, parallel_groups = define_busbar_connections(cells, layers, connection_type)
    print(f"Defined {len(parallel_groups)} parallel groups based on connection type '{connection_type}'.")

    # DC table is already loaded as df
    print(f"Drive cycle table loaded with {len(dc_table)} steps over {dc_table['Day_of_year'].max()} days.")

    # No time/I_module arrays; solver loops over rows

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
        'masses': masses,
        'dc_table': dc_table,  # Pass df directly
        'Frequency': time_gap
    }
def init_initial_cell_conditions(
    cells,
    initial_temperature,
    initial_SOC,
    initial_SOH,
    initial_DCIR_AgingFactor,
    varying_cells=None,
    varying_temps=None,
    varying_SOCs=None,
    varying_SOHs=None,
    varying_DCIRs=None
):
    for cell in cells:
        cell['temperature'] = initial_temperature
        cell['SOC'] = initial_SOC
        cell['SOH'] = initial_SOH
        cell['DCIR_AgingFactor'] = initial_DCIR_AgingFactor

    if all(v is not None for v in [varying_cells, varying_temps, varying_SOCs, varying_SOHs, varying_DCIRs]):
        if len(varying_cells) != len(varying_temps) == len(varying_SOCs) == len(varying_SOHs) == len(varying_DCIRs):
            raise ValueError("All varying_* lists must be the same length.")
        
        for idx, cell_idx in enumerate(varying_cells):
            if cell_idx < 0 or cell_idx >= len(cells):
                raise IndexError(f"Invalid cell index {cell_idx} specified. Index must be 0-based and less than {len(cells)}.")
            
            cell = cells[cell_idx] 
            
            cell['temperature'] = varying_temps[idx]
            cell['SOC'] = varying_SOCs[idx]
            cell['SOH'] = varying_SOHs[idx]
            cell['DCIR_AgingFactor'] = varying_DCIRs[idx]
            
    print("Initial cell conditions set.")
    # _plot_initial_conditions(cells) # Commented to prevent blocking and errors; uncomment if needed
    return cells

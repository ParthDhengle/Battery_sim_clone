def define_busbar_connections(cells, layers, connection_type):
    parallel_groups = []
    layer_group_ranges = []
    group_offset = 0
    layer_first_cells = []
    for layer_idx, layer in enumerate(layers):
        n_rows = layer['n_rows']
        n_cols = layer['n_cols']
        layer_cells = [c for c in cells if c['layer_index'] == layer_idx + 1]
        layer_group_start = group_offset + 1
        layer_first_cells.append(layer_cells[0]['global_index'])
        num_groups_layer = n_rows if connection_type == 'row_series_column_parallel' else n_cols
        for i in range(n_rows):
            for j in range(n_cols):
                local_idx = i * n_cols + j
                cell = layer_cells[local_idx]
                if connection_type == 'row_series_column_parallel':
                    cell['parallel_group'] = layer_group_start + i
                    if i < n_rows - 1:
                        cell['next_series'] = cell['global_index'] + n_cols # Global next row same col
                    else:
                        cell['next_series'] = None
                elif connection_type == 'row_parallel_column_series':
                    cell['parallel_group'] = layer_group_start + j
                    if j < n_cols - 1:
                        cell['next_series'] = cell['global_index'] + 1
                    else:
                        cell['next_series'] = None
                else:
                    raise ValueError("Unsupported connection type.")
                if cell['parallel_group'] not in parallel_groups:
                    parallel_groups.append(cell['parallel_group'])
        layer_group_ranges.append((layer_group_start, layer_group_start + num_groups_layer - 1))
        group_offset = layer_group_ranges[-1][1]
    
    # Connect layers in series
    for l in range(1, len(layers)):
        prev_last_group = layer_group_ranges[l-1][1]
        current_first_group = layer_group_ranges[l][0]
        n_rows = layers[l-1]['n_rows'] # Assume same
        n_cols = layers[l-1]['n_cols'] # Assume same
        if connection_type == 'row_series_column_parallel':
            # Connect per column: last row prev to first row next
            for col in range(1, n_cols + 1):
                prev_cell_list = [c for c in cells if c['parallel_group'] == prev_last_group and c['col_index'] == col]
                if not prev_cell_list:
                    raise ValueError(f"No cell in prev group {prev_last_group} col {col}")
                prev_cell = prev_cell_list[0]
                curr_cell_list = [c for c in cells if c['parallel_group'] == current_first_group and c['col_index'] == col]
                if not curr_cell_list:
                    raise ValueError(f"No cell in curr group {current_first_group} col {col}")
                curr_global = curr_cell_list[0]['global_index']
                prev_cell['next_series'] = curr_global
        elif connection_type == 'row_parallel_column_series':
            # Connect per row: last col prev to first col next
            for row in range(1, n_rows + 1):
                prev_cell_list = [c for c in cells if c['parallel_group'] == prev_last_group and c['row_index'] == row]
                if not prev_cell_list:
                    raise ValueError(f"No cell in prev group {prev_last_group} row {row}")
                prev_cell = prev_cell_list[0]
                curr_cell_list = [c for c in cells if c['parallel_group'] == current_first_group and c['row_index'] == row]
                if not curr_cell_list:
                    raise ValueError(f"No cell in curr group {current_first_group} row {row}")
                curr_global = curr_cell_list[0]['global_index']
                prev_cell['next_series'] = curr_global
    parallel_groups = sorted(parallel_groups)
    return cells, parallel_groups
import math

def init_geometry(pack):
    # Extract from pack inputs
    cell_config = pack['cell']
    form_factor = cell_config['formFactor']
    dims_mm = cell_config['dims']
    layers = pack['layers']
    allow_overlap = pack['options']['allow_overlap']
    compute_neighbors = pack['options']['compute_neighbors']
    label_schema = pack['options']['label_schema']
    max_volume = pack['constraints']['max_volume'] if not math.isnan(pack['constraints']['max_volume']) else None
    max_weight = pack['constraints']['max_weight'] if not math.isnan(pack['constraints']['max_weight']) else None
    z_pitch = pack['z_pitch'] if pack['z_pitch'] is not None else 0
    m_cell = cell_config['m_cell']

    # Convert dims to meters
    real_dims = {}
    if form_factor == 'cylindrical':
        real_dims['radius'] = dims_mm['radius'] / 1000
        real_dims['height'] = dims_mm['height'] / 1000
    else:
        real_dims['length'] = dims_mm['length'] / 1000
        real_dims['width'] = dims_mm['width'] / 1000
        real_dims['height'] = dims_mm['height'] / 1000

    use_index_pitch = any(layer['z_mode'] == 'index_pitch' for layer in layers)
    real_z_pitch = z_pitch / 1000 if use_index_pitch else 0

    # Compute z_centers
    z_centers = []
    for li, layer in enumerate(layers):
        if layer['z_mode'] == 'index_pitch':
            z = li * real_z_pitch
        else:
            z = float(layer['z_center']) / 1000
        z_centers.append(z)

    shift = z_centers[0]
    z_centers = [z - shift for z in z_centers]

    cells = []
    index_map = {}
    global_index = 1
    layer_configs = []

    for li, layer in enumerate(layers):
        l = li + 1
        grid_type = layer['grid_type']
        n_rows = layer['n_rows']
        n_cols = layer['n_cols']
        pitch_x = layer['pitch_x'] / 1000
        pitch_y = layer['pitch_y'] / 1000
        z = z_centers[li]

        # Validation
        if n_rows <= 0 or n_cols <= 0 or pitch_x <= 0 or pitch_y <= 0:
            raise ValueError(f"Invalid parameters for layer {l}")

        if not allow_overlap:
            if form_factor == 'prismatic':
                if pitch_x < real_dims['length'] or pitch_y < real_dims['width']:
                    raise ValueError(f"Pitch too small for prismatic cells in layer {l}")
            else:
                d = 2 * real_dims['radius']
                min_dist = math.inf
                if grid_type == 'rectangular':
                    min_dist = min(pitch_x, pitch_y)
                elif grid_type in ['brick_row_stagger', 'hex_flat']:
                    diag = math.sqrt((0.5 * pitch_x)**2 + pitch_y**2)
                    min_dist = min(pitch_x, diag)
                elif grid_type == 'hex_pointy':
                    diag = math.sqrt((0.5 * pitch_y)**2 + pitch_x**2)
                    min_dist = min(pitch_y, diag)
                if min_dist < d:
                    raise ValueError(f"Pitch settings would cause cell overlap in layer {l}")

        layer_configs.append({
            'grid_type': grid_type,
            'n_rows': n_rows,
            'n_cols': n_cols,
            'pitch_x': pitch_x,
            'pitch_y': pitch_y,
            'z_center': z,
            'z_mode': layer['z_mode'],
        })

        for r in range(1, n_rows + 1):
            for c in range(1, n_cols + 1):
                x = 0
                y = 0
                if grid_type == 'rectangular':
                    x = (c - 1) * pitch_x
                    y = (r - 1) * pitch_y
                elif grid_type in ['brick_row_stagger', 'hex_flat']:
                    x = (c - 1) * pitch_x + (0.5 * pitch_x if r % 2 == 0 else 0)
                    y = (r - 1) * pitch_y
                elif grid_type == 'hex_pointy':
                    x = (c - 1) * pitch_x
                    y = (r - 1) * pitch_y + (0.5 * pitch_y if c % 2 == 1 else 0)

                half_x = real_dims['radius'] if form_factor == 'cylindrical' else real_dims['length'] / 2
                half_y = real_dims['radius'] if form_factor == 'cylindrical' else real_dims['width'] / 2

                bbox_2d = {
                    'xmin': x - half_x,
                    'xmax': x + half_x,
                    'ymin': y - half_y,
                    'ymax': y + half_y,
                }

                default_label = f"R{r}C{c}L{l}"
                label = default_label
                if label_schema:
                    label = label_schema.replace('{row}', str(r)).replace('{col}', str(c)).replace('{layer}', str(l))

                cell = {
                    'global_index': global_index,
                    'layer_index': l,
                    'row_index': r,
                    'col_index': c,
                    'position': [x, y, z],
                    'dims': real_dims.copy(),
                    'bbox_2d': bbox_2d,
                    'neighbors_same_layer': [],
                    'label': label,
                }
                cells.append(cell)
                index_map[f"{l}-{r}-{c}"] = global_index
                global_index += 1

    if compute_neighbors:
        for cell in cells:
            l = cell['layer_index']
            r = cell['row_index']
            c = cell['col_index']
            layer_config = layer_configs[l - 1]
            grid_type = layer_config['grid_type']
            n_rows = layer_config['n_rows']
            n_cols = layer_config['n_cols']
            dirs = []
            is_hex = grid_type in ['hex_flat', 'hex_pointy']
            if is_hex:
                is_pointy = grid_type == 'hex_pointy'
                odd = (c % 2 == 1) if is_pointy else (r % 2 == 1)
                dirs = [(0, -1), (0, 1)]
                if odd:
                    dirs += [(-1, 0), (-1, 1), (1, 0), (1, 1)]
                else:
                    dirs += [(-1, -1), (-1, 0), (1, -1), (1, 0)]
            else:
                dirs = [(0, -1), (0, 1), (-1, 0), (1, 0)]

            neighbors = []
            for dr, dc in dirs:
                nr = r + dr
                nc = c + dc
                if 1 <= nr <= n_rows and 1 <= nc <= n_cols:
                    nid = index_map.get(f"{l}-{nr}-{nc}")
                    if nid:
                        neighbors.append(nid)
            cell['neighbors_same_layer'] = neighbors

    # Compute bbox, volume, weight
    xmin = math.inf
    xmax = -math.inf
    ymin = math.inf
    ymax = -math.inf
    zmin = math.inf
    zmax = -math.inf
    half_h = real_dims['height'] / 2
    for cell in cells:
        xmin = min(xmin, cell['bbox_2d']['xmin'])
        xmax = max(xmax, cell['bbox_2d']['xmax'])
        ymin = min(ymin, cell['bbox_2d']['ymin'])
        ymax = max(ymax, cell['bbox_2d']['ymax'])
        cz = cell['position'][2]
        zmin = min(zmin, cz - half_h)
        zmax = max(zmax, cz + half_h)

    bbox = {'xmin': xmin, 'xmax': xmax, 'ymin': ymin, 'ymax': ymax, 'zmin': zmin, 'zmax': zmax}
    volume = (xmax - xmin) * (ymax - ymin) * (zmax - zmin)
    weight = len(cells) * m_cell

    constraint_warnings = []
    if max_volume is not None and volume > max_volume:
        constraint_warnings.append(f"Pack volume {volume:.6f} m³ exceeds maximum {max_volume} m³")
    if max_weight is not None and weight > max_weight:
        constraint_warnings.append(f"Pack weight {weight:.3f} kg exceeds maximum {max_weight} kg")
    if constraint_warnings:
        print("Design Constraint Warnings:\n" + "\n".join(constraint_warnings))

    pack['meta'] = {
        'bbox': bbox,
        'layers': layer_configs,
        'formFactor': form_factor,
    }

    print(f"Initialized {len(cells)} cells across {len(layers)} layers.")
    #_plot_cell_distribution(cells)

    return cells

def _plot_cell_distribution(cells):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots()
    ax.set_aspect('equal')
    ax.set_xlabel('X Position (m)')
    ax.set_ylabel('Y Position (m)')
    ax.set_title('Cell Distribution (Projection)')

    for cell in cells:
        x, y, z = cell['position']
        r = cell['dims']['radius'] if 'radius' in cell['dims'] else max(cell['dims']['length'], cell['dims']['width']) / 2
        circle = plt.Circle((x, y), r, edgecolor='blue', facecolor='none')
        ax.add_patch(circle)
        ax.text(x, y, f"{cell['global_index']}", ha='center', va='center', fontsize=8, color='black')

    plt.grid(True)
    plt.show()
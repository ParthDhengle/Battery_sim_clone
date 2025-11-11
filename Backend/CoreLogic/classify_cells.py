import re

def init_classify_cells(layer_cells, n_rows, n_cols):
    for cell in layer_cells:
        match = re.match(r'R(\d+)C(\d+)L\d+', cell['label'])
        if not match:
            raise ValueError(f"Invalid cell label format: {cell['label']}")
        row = int(match.group(1))
        col = int(match.group(2))

        if (row in [1, n_rows]) and (col in [1, n_cols]):
            cell['type'] = 'corner'
        elif row in [1, n_rows] or col in [1, n_cols]:
            cell['type'] = 'edge'
        else:
            cell['type'] = 'center'

        row_adjacent = []
        col_adjacent = []
        diagonal_adjacent = []

        if col > 1:
            left_neighbor = (row - 1) * n_cols + (col - 2)
            row_adjacent.append(left_neighbor)
        if col < n_cols:
            right_neighbor = (row - 1) * n_cols + col
            row_adjacent.append(right_neighbor)

        if row > 1:
            top_neighbor = (row - 2) * n_cols + (col - 1)
            col_adjacent.append(top_neighbor)
        if row < n_rows:
            bottom_neighbor = row * n_cols + (col - 1)
            col_adjacent.append(bottom_neighbor)

        if row > 1 and col > 1:
            diagonal_adjacent.append((row - 2) * n_cols + (col - 2))
        if row > 1 and col < n_cols:
            diagonal_adjacent.append((row - 2) * n_cols + col)
        if row < n_rows and col > 1:
            diagonal_adjacent.append(row * n_cols + (col - 2))
        if row < n_rows and col < n_cols:
            diagonal_adjacent.append(row * n_cols + col)

        cell['row_adjacent'] = row_adjacent
        cell['col_adjacent'] = col_adjacent
        cell['diagonal_adjacent'] = diagonal_adjacent

    return layer_cells
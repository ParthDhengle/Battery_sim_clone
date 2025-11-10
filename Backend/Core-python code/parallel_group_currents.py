import numpy as np

def calculate_parallel_group_currents(cells, I_module, R_p, t, I_cells_matrix, V_parallel_matrix, sim_V_term):
    parallel_groups = sorted(set(cell['parallel_group'] for cell in cells))

    for group_id in parallel_groups:
        group_cells = [idx for idx, cell in enumerate(cells) if cell['parallel_group'] == group_id]
        N = len(group_cells)
        if N == 0:
            continue

        A = np.zeros((N + 1, N + 1))
        b = np.zeros(N + 1)

        for i, cell_idx in enumerate(group_cells):
            cell = cells[cell_idx]

            if t == 0:
                OCV = cell.get('OCV', 3.7)  # Mock if not set
                R0 = cell.get('R0', 0.02)
            else:
                OCV = sim_V_term[cell_idx]
                R0 = 0.0

            A[i, i] = R0 + R_p
            A[i, -1] = 1.0
            b[i] = OCV

        A[-1, :N] = 1.0
        b[-1] = I_module[t]

        try:
            x = np.linalg.solve(A, b)
        except np.linalg.LinAlgError:
            print(f"Warning: Singular matrix at time step {t}. Setting currents to zero.")
            x = np.zeros(N + 1)

        V_parallel_group = x[-1]
        for i, cell_idx in enumerate(group_cells):
            I_cells_matrix[cell_idx, t] = x[i]
            V_parallel_matrix[cell_idx, t] = V_parallel_group

    return I_cells_matrix, V_parallel_matrix
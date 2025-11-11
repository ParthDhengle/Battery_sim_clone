import numpy as np

def calculate_module_voltage(cells, V_parallel_matrix, I_module, R_s, t, V_terminal_module_matrix):
    parallel_groups = sorted(set(cell['parallel_group'] for cell in cells))
    num_series_connections = len(parallel_groups) - 1

    V_sum_parallel_groups = 0.0
    for group_id in parallel_groups:
        for cell_idx, cell in enumerate(cells):
            if cell['parallel_group'] == group_id:
                V_sum_parallel_groups += V_parallel_matrix[cell_idx, t]
                break

    V_terminal_module = V_sum_parallel_groups - I_module[t] * (num_series_connections + 1) * R_s

    V_terminal_module_matrix[t] = V_terminal_module

    return V_terminal_module_matrix
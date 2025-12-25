import numpy as np
from .battery_params import get_battery_params  # Adjust for tables if needed

def compute_module_current_from_step(
    value_type: str, value: float, unit: str, capacity_Ah: float,
    n_series: int, cells: list, sim_states: dict, dt: float,
    parallel_groups: list, R_s: float, R_p: float,
    cell_voltage_upper: float, cell_voltage_lower: float
) -> float:

    N_cells = len(cells)
    if n_series == 0 or N_cells == 0:
        return 0.0
    n_p_avg = N_cells / n_series

    # 1. CURRENT/C-RATE: Direct (no solve needed)
    if value_type.lower() == 'current':
        if unit.lower() != 'a':
            raise ValueError("Current requires 'A'")
        return float(value)  # Pack-level
    elif value_type.lower() == 'c_rate':
        if unit.lower() not in ['1/hr', 'c', '1/h']:
            raise ValueError("C-rate requires '1/hr', 'C', or '1/h'")
        I_cell = value * capacity_Ah
        return float(I_cell * n_p_avg)  # Pack-level

    # Simplified approximations for VOLTAGE/POWER (match detailed info; averages + prev for power)
    avg_SOC = np.mean(sim_states['sim_SOC'])
    avg_Temp_C = np.mean(sim_states['sim_TempK']) - 273.15
    avg_SOH = np.mean(sim_states['sim_SOH'])
    avg_DCIR = np.mean(sim_states['sim_DCIR'])
    avg_Vrc1 = np.mean(sim_states['sim_V_RC1'])
    avg_Vrc2 = np.mean(sim_states['sim_V_RC2'])

    # Assume DISCHARGE mode for params (since sign unknown in approx)
    params = get_battery_params(
        cells[0].get('rc_data'), avg_SOC, avg_Temp_C, 'DISCHARGE', avg_SOH, avg_DCIR
    )
    OCV, R0, _, _, _, _ = params

    if value_type.lower() == 'voltage':
        if unit.lower() != 'v':
            raise ValueError("Voltage requires 'V'")
        if n_series == 0:
            return 0.0
        V_cell_target = value / n_series
        I_cell = (OCV - V_cell_target - avg_Vrc1 - avg_Vrc2) / max(R0, 1e-6)  # Avoid div0
        return I_cell * n_p_avg

    elif value_type.lower() == 'power':
        if unit.lower() != 'w':
            raise ValueError("Power requires 'W'")
        # Approx using prev pack V (detailed: previous time step)
        v_groups_prev = []
        for group_id in parallel_groups:
            group_cells = [i for i, c in enumerate(cells) if c['parallel_group'] == group_id]
            if group_cells:
                mean_v = np.mean([sim_states['sim_V_term'][i] for i in group_cells])
                v_groups_prev.append(mean_v)
        v_pack_prev = sum(v_groups_prev) if v_groups_prev else 1e-3
        v_pack_prev = max(abs(v_pack_prev), 1e-3)
        return value / v_pack_prev

    else:
        raise ValueError(f"Unsupported: {value_type}")
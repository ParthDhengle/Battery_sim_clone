import numpy as np
from scipy.optimize import bisect
from .battery_params import get_battery_params

def compute_module_current_from_step(
    value_type: str, value: float, unit: str, capacity_Ah: float,
    n_parallel_groups: int, cells: list, sim_states: dict, dt: float,
    parallel_groups: list, R_s: float, R_p: float,
    cell_voltage_upper: float, cell_voltage_lower: float
) -> float:
    """Convert step to I_module_current (A, pack-level). Positive=discharge. FIXED: For 'current', return value as pack I."""
    if value_type.lower() == 'current':
        if unit.lower() != 'a':
            raise ValueError("Current requires unit 'A'")
        return float(value)  # FIXED: Direct pack current, not * n_parallel (assumes Value is pack-level)
    elif value_type.lower() == 'c_rate':
        if unit.lower() not in ['1/hr', 'c']:
            raise ValueError("C-rate requires unit '1/hr' or 'C'")
        I_cell = value * capacity_Ah
        total_cells = len(cells)
        return I_cell * (total_cells / n_parallel_groups) if n_parallel_groups > 0 else 0  # Pack C-rate equiv: I_module = I_cell * n_series_per_group * n_parallel_groups, but approx total
    elif value_type.lower() == 'voltage':
        if unit.lower() != 'v':
            raise ValueError("Voltage requires unit 'V'")
        n_series = len(parallel_groups)
        V_target_module = value
        def v_error(I_cell_trial: float) -> float:
            I_module_trial = I_cell_trial * (len(cells) / n_series)  # Approx total cells / series = parallel equiv
            mode = 'CHARGE' if I_module_trial < 0 else 'DISCHARGE'
            v_groups = []
            for group_id in parallel_groups:
                group_cells = [i for i, c in enumerate(cells) if c['parallel_group'] == group_id]
                N = len(group_cells)
                if N == 0: continue
                A = np.zeros((N + 1, N + 1))
                b = np.zeros(N + 1)
                for i, cell_idx in enumerate(group_cells):
                    SOC = sim_states['sim_SOC'][cell_idx]
                    Temp_C = sim_states['sim_TempK'][cell_idx] - 273.15
                    SOH = sim_states['sim_SOH'][cell_idx]
                    DCIR = sim_states['sim_DCIR'][cell_idx]
                    V_rc1_prev = sim_states['sim_V_RC1'][cell_idx]
                    V_rc2_prev = sim_states['sim_V_RC2'][cell_idx]
                    OCV, R0, R1, R2, C1, C2 = get_battery_params(
                        cells[cell_idx]['rc_data'], SOC, Temp_C, mode, SOH, DCIR
                    )
                    tau1 = R1 * C1 if C1 > 0 else 1e-6
                    tau2 = R2 * C2 if C2 > 0 else 1e-6
                    K = OCV - (V_rc1_prev * np.exp(-dt / tau1) + V_rc2_prev * np.exp(-dt / tau2))
                    R_eff = R0 + 2 * R_p + R1 * (1 - np.exp(-dt / tau1)) + R2 * (1 - np.exp(-dt / tau2))
                    A[i, i] = R_eff
                    A[i, -1] = 1.0
                    b[i] = K
                A[-1, :N] = 1.0
                b[-1] = I_cell_trial
                x = np.linalg.solve(A, b)
                V_parallel = x[-1]
                v_groups.append(V_parallel)
            if not v_groups:
                return 0.0
            V_module = np.sum(v_groups) - abs(I_module_trial) * R_s * max(0, n_series - 1)
            return V_module - V_target_module
        I_cell_low = -10 * capacity_Ah
        I_cell_high = 10 * capacity_Ah
        I_cell_guess = bisect(v_error, I_cell_low, I_cell_high, xtol=1e-3)
        return I_cell_guess * (len(cells) / n_series)  # Back to I_module
    elif value_type.lower() == 'power':
        if unit.lower() != 'w':
            raise ValueError("Power requires unit 'W'")
        prev_V_module = np.mean(sim_states['sim_V_term']) * len(parallel_groups)
        def p_error(I_cell_trial: float) -> float:
            I_module_trial = I_cell_trial * (len(cells) / len(parallel_groups))
            # Reuse v_error logic but compute V_module
            v_err_func = v_error(I_cell_trial)  # From above, but adapt
            V_approx = prev_V_module  # Simplified; full would recurse
            return V_approx * I_module_trial - value
        I_cell_low = -10 * capacity_Ah
        I_cell_high = 10 * capacity_Ah
        I_cell_guess = bisect(p_error, I_cell_low, I_cell_high, xtol=1e-3)
        return I_cell_guess * (len(cells) / len(parallel_groups))
    elif value_type.lower() == 'resistance':
        print("Warning: Resistance not supported; I_module=0")
        return 0.0
    else:
        raise ValueError(f"Invalid value_type: {value_type}")
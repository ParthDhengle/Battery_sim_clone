import numpy as np
from scipy.optimize import bisect
from .battery_params import get_battery_params
from .next_soc import calculate_next_soc
from .reversible_heat import calculate_reversible_heat

def compute_module_current_from_step(value_type: str, value: float, unit: str, capacity_Ah: float,
                                     n_parallel: int, cells: list, sim_states: dict, dt: float,
                                     parallel_groups: list, R_s: float, R_p: float,
                                     cell_voltage_upper: float, cell_voltage_lower: float) -> float:
    """
    Convert step value to I_module (A).
    - sim_states: {'sim_SOC': np.array, 'sim_TempK': np.array, ...} (current states).
    - For voltage/power: Bisect I in [-10*C, 10*C] to match target (tol=1e-3 A).
    Returns I_module (positive=discharge).
    """
    if unit.lower() not in ['a', 'c', 'v', 'w', 'ohm']:
        raise ValueError(f"Invalid unit: {unit}")
    
    if value_type.lower() == 'current':
        if unit.lower() != 'a':
            raise ValueError("Current requires unit 'A'")
        I_cell = value  # Direct; sign handled by value
        return I_cell * n_parallel  # I_module
    
    elif value_type.lower() == 'c_rate':
        if unit.lower() != '1/hr':  # Or 'c'
            raise ValueError("C-rate requires unit '1/hr'")
        I_cell = value * capacity_Ah  # A (C * Ah = A)
        return I_cell * n_parallel
    
    elif value_type.lower() == 'voltage':
        if unit.lower() != 'v':
            raise ValueError("Voltage requires unit 'V'")
        n_series = len(parallel_groups)
        V_target_cell = value / n_series  # Assume uniform; target per cell
        
        def v_module_error(I_trial: float) -> float:
            # Temp solver: Compute V_module for trial I_module = I_trial * n_parallel
            I_module_trial = I_trial * n_parallel
            # Reuse solver logic: Compute V_groups for this I
            v_groups = []
            mode = 'CHARGE' if I_module_trial < 0 else 'DISCHARGE'
            for group_id in parallel_groups:
                group_cells = [i for i, c in enumerate(cells) if c['parallel_group'] == group_id]
                N = len(group_cells)
                if N == 0: continue
                # Simplified: Assume equal I_cell = I_trial per cell (parallel)
                # Full: Build A/b as in solver, but for error func, approx with avg
                # For accuracy, mini-solve per group (copy from solver)
                A = np.zeros((N + 1, N + 1))
                b = np.zeros(N + 1)
                for i, cell_idx in enumerate(group_cells):
                    SOC = sim_states['sim_SOC'][cell_idx]
                    Temp_C = sim_states['sim_TempK'][cell_idx] - 273.15
                    SOH = sim_states['sim_SOH'][cell_idx]
                    DCIR = sim_states['sim_DCIR'][cell_idx]
                    V_rc1 = sim_states['sim_V_RC1'][cell_idx]
                    V_rc2 = sim_states['sim_V_RC2'][cell_idx]
                    OCV, R0, R1, R2, C1, C2 = get_battery_params(
                        cells[cell_idx]['rc_data'], SOC, Temp_C, mode, SOH, DCIR
                    )
                    tau1 = R1 * C1 if C1 > 0 else 1e-6
                    tau2 = R2 * C2 if C2 > 0 else 1e-6
                    K = OCV - (V_rc1 * np.exp(-dt / tau1) + V_rc2 * np.exp(-dt / tau2))
                    R_eff = R0 + 2 * R_p + R1 * (1 - np.exp(-dt / tau1)) + R2 * (1 - np.exp(-dt / tau2))
                    A[i, i] = R_eff
                    A[i, -1] = 1
                    b[i] = K
                A[-1, :N] = 1
                b[-1] = I_trial  # I_cell trial
                x = np.linalg.solve(A, b)
                V_parallel = x[-1]
                v_groups.append(V_parallel)
            if not v_groups:
                return 0
            V_module = sum(v_groups) - abs(I_module_trial) * R_s * max(0, n_series - 1)
            V_target_module = value
            return V_module - V_target_module  # Zero when matches
        
        I_cell_guess = bisect(v_module_error, -10 * capacity_Ah, 10 * capacity_Ah, xtol=1e-3)
        return I_cell_guess * n_parallel
    
    elif value_type.lower() == 'power':
        if unit.lower() != 'w':
            raise ValueError("Power requires unit 'W'")
        
        def p_module_error(I_trial: float) -> float:
            I_module_trial = I_trial * n_parallel
            # Reuse v_module_error logic to get V_module(I_trial)
            v_error = v_module_error(I_trial)  # From above (V_module - V_target=0, but here compute V)
            # Wait, modify: return V_module * I_module - value
            # Extract V_module from above logic
            # ... (copy v_module computation here, return V_module * I_module_trial - value)
            # For brevity: Implement full copy or refactor to func compute_v_module(I_cell, states...)
            # Assume refactored: v_mod = compute_v_module(I_trial, ...)  # TODO: Add helper
            # Placeholder: Use previous V approx + dV/dI * I
            prev_v = np.mean(sim_states['sim_V_term']) * n_series  # Approx
            v_mod_approx = prev_v  # + delta (simple)
            return v_mod_approx * I_module_trial - value
        
        I_cell_guess = bisect(p_module_error, -10 * capacity_Ah, 10 * capacity_Ah, xtol=1e-3)
        return I_cell_guess * n_parallel
    
    elif value_type.lower() == 'resistance':
        print(f"Warning: Resistance drive not supported; setting I_module=0")
        return 0.0
    
    raise ValueError(f"Invalid value_type: {value_type}")
import numpy as np
import re

TRIGGER_REGISTRY = {
    # Cell-level
    'V_cell_high', 'V_cell_low', 'I_cell_high', 'I_cell_low', 'SOC_cell_high', 'SOC_cell_low',
    'C_rate_cell_high', 'C_rate_cell_low', 'P_cell_high', 'P_cell_low',
    # Pack-level
    'V_pack_high', 'V_pack_low', 'I_pack_high', 'I_pack_low', 'SOC_pack_high', 'SOC_pack_low',
    'C_rate_pack_high', 'C_rate_pack_low', 'P_pack_high', 'P_pack_low',
    # Solver
    'time_elapsed'
}

def parse_trigger_list_from_row(row: pd.Series, column: str = 'step Trigger(s)') -> list:
    """
    Parse "V_cell_high:4.2;SOC_pack_low:0.2" to [{'type': 'V_cell_high', 'value': 4.2}, ...]
    """
    trigger_str = str(row.get(column, '')).strip()
    if not trigger_str:
        return []
    triggers = []
    for part in trigger_str.split(';'):
        part = part.strip()
        match = re.match(r'([^\s:]+):([+-]?\d*\.?\d+)', part)
        if match:
            trig_type, val_str = match.groups()
            if trig_type in TRIGGER_REGISTRY:
                triggers.append({'type': trig_type, 'value': float(val_str)})
            else:
                print(f"Warning: Unknown trigger {trig_type}")
    return triggers

def evaluate_triggers(step_triggers: list, subcycle_triggers: list, sim_states: dict, v_module: float,
                      I_module: float, capacity_Ah: float, n_parallel: int, n_series: int,
                      per_day_time: float, dt: float, t_global: float) -> list:
    """
    Evaluate step_triggers + subcycle_triggers + time_elapsed.
    Returns fired: [{'name': type, 'value': thresh, 'action_level': str, 'metric': float}, ...]
    action_level: 'step' (default), 'subcycle' (for drive cycle trigger col), 'day' (time_elapsed).
    """
    fired = []
    
    # Solver-defined: time_elapsed (day-level)
    if per_day_time + dt >= 86400.0:
        fired.append({
            'name': 'time_elapsed', 'value': 86400.0, 'action_level': 'day',
            'metric': per_day_time + dt
        })
    
    # Step triggers (step-level)
    for trig in step_triggers:
        metric = compute_trigger_metric(trig['type'], sim_states, v_module, I_module, capacity_Ah, n_parallel, n_series)
        is_fired = is_trigger_fired(trig['type'], metric, trig['value'])
        if is_fired:
            fired.append({**trig, 'action_level': 'step', 'metric': metric})
    
    # Subcycle triggers (subcycle/DC-level)
    for trig in subcycle_triggers:
        metric = compute_trigger_metric(trig['type'], sim_states, v_module, I_module, capacity_Ah, n_parallel, n_series)
        is_fired = is_trigger_fired(trig['type'], metric, trig['value'])
        if is_fired:
            fired.append({**trig, 'action_level': 'subcycle', 'metric': metric})
    
    return fired

def compute_trigger_metric(trig_type: str, sim_states: dict, v_module: float, I_module: float,
                           capacity_Ah: float, n_parallel: int, n_series: int) -> float:
    """Compute metric for trigger (e.g., max V_cell for V_cell_high)."""
    V_term = sim_states['sim_V_term']
    I_cell = sim_states.get('I_cells_step', np.zeros_like(V_term))  # From current step
    SOC = sim_states['sim_SOC']
    
    if 'V_cell' in trig_type:
        return np.max(V_term) if 'high' in trig_type else np.min(V_term)
    elif 'I_cell' in trig_type:
        return np.max(np.abs(I_cell))  # Abs for high/low
    elif 'SOC_cell' in trig_type:
        return np.max(SOC) if 'high' in trig_type else np.min(SOC)
    elif 'C_rate_cell' in trig_type:
        c_rates = np.abs(I_cell) / capacity_Ah
        return np.max(c_rates) if 'high' in trig_type else np.min(c_rates)
    elif 'P_cell' in trig_type:
        powers = V_term * I_cell
        return np.max(powers) if 'high' in trig_type else np.min(powers)
    
    # Pack
    if 'V_pack' in trig_type:
        return v_module
    elif 'I_pack' in trig_type:
        return abs(I_module)
    elif 'SOC_pack' in trig_type:
        return np.min(SOC)  # Conservative
    elif 'C_rate_pack' in trig_type:
        return abs(I_module) / (capacity_Ah * n_parallel)
    elif 'P_pack' in trig_type:
        return v_module * I_module
    raise ValueError(f"Unknown trigger: {trig_type}")

def is_trigger_fired(trig_type: str, metric: float, threshold: float) -> bool:
    """High: metric > thresh; Low: metric < thresh."""
    if 'high' in trig_type or 'time_elapsed' in trig_type:
        return metric > threshold
    elif 'low' in trig_type:
        return metric < threshold
    return False

def check_hard_cutoffs(sim_V_term: np.array, v_module: float, upper_cell: float, lower_cell: float,
                       upper_pack: float, lower_pack: float) -> bool:
    """True if any hard cutoff hit (stop sim)."""
    return (np.any(sim_V_term > upper_cell) or np.any(sim_V_term < lower_cell) or
            v_module > upper_pack or v_module < lower_pack)
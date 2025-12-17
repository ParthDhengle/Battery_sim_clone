# FILE: Backend/CoreLogic/triggers.py
import numpy as np
import re

TRIGGER_REGISTRY = {
    'V_cell_high', 'V_cell_low', 'I_cell_high', 'I_cell_low', 'SOC_cell_high', 'SOC_cell_low',
    'C_rate_cell_high', 'C_rate_cell_low', 'P_cell_high', 'P_cell_low',
    'V_pack_high', 'V_pack_low', 'I_pack_high', 'I_pack_low', 'SOC_pack_high', 'SOC_pack_low',
    'C_rate_pack_high', 'C_rate_pack_low', 'P_pack_high', 'P_pack_low',
    'time_elapsed'
}

def parse_trigger_list_from_row(row, column: str = 'step Trigger(s)') -> list:
    """Parse 'V_cell_high:4.2;SOC_pack_low:0.2' to [{'type': 'V_cell_high', 'value': 4.2}, ...]"""
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

def evaluate_triggers(
    triggers: list, sim_SOC: np.array, sim_V_term: np.array, v_module: float,
    time_in_step: float, t_global: float, I_cells: np.array, I_pack: float,
    capacity_Ah: float, per_day_time: float
) -> list:
    """Evaluate triggers, return fired [{'name': type, 'value': thresh, 'action_level': 'step/dc/day', 'metric': val}, ...]"""
    fired = []

    # time_elapsed (day-level)
    if per_day_time + time_in_step >= 86400.0:
        fired.append({
            'name': 'time_elapsed', 'value': 86400.0, 'action_level': 'day', 'metric': per_day_time + time_in_step
        })

    # User triggers (step or dc level based on source, but here combined; assume step unless specified)
    for trig in triggers:
        trig_type = trig['type']
        # Compute metric (conservative: max/min over cells for cell-level)
        if 'V_cell' in trig_type:
            metric = np.max(sim_V_term) if 'high' in trig_type else np.min(sim_V_term)
        elif 'I_cell' in trig_type:
            metric = np.max(np.abs(I_cells))
        elif 'SOC_cell' in trig_type:
            metric = np.max(sim_SOC) if 'high' in trig_type else np.min(sim_SOC)
        elif 'C_rate_cell' in trig_type:
            c_rates = np.abs(I_cells) / capacity_Ah
            metric = np.max(c_rates) if 'high' in trig_type else np.min(c_rates)
        elif 'P_cell' in trig_type:
            powers = sim_V_term * I_cells
            metric = np.max(powers) if 'high' in trig_type else np.min(powers)
        elif 'V_pack' in trig_type:
            metric = v_module
        elif 'I_pack' in trig_type:
            metric = abs(I_pack)
        elif 'SOC_pack' in trig_type:
            metric = np.min(sim_SOC)  # Conservative low
        elif 'C_rate_pack' in trig_type:
            metric = abs(I_pack) / (capacity_Ah * len(I_cells) / len(np.unique(I_cells)))  # Approx
        elif 'P_pack' in trig_type:
            metric = v_module * I_pack
        else:
            continue

        if ('high' in trig_type and metric > trig['value']) or ('low' in trig_type and metric < trig['value']):
            action_level = 'dc' if 'drive cycle trigger' in str(trig.get('source', '')) else 'step'  # Assume
            fired.append({**trig, 'action_level': action_level, 'metric': metric})

    return fired

def check_hard_cutoffs(sim_V_term: np.array, v_module: float, HARD_V_cell_max: float, HARD_V_cell_min: float,
                       HARD_V_pack_max: float, HARD_V_pack_min: float) -> bool:
    """True if cutoff hit."""
    return (np.any(sim_V_term > HARD_V_cell_max) or np.any(sim_V_term < HARD_V_cell_min) or
            v_module > HARD_V_pack_max or v_module < HARD_V_pack_min)
# FILE: Backend/CoreLogic/triggers.py
import numpy as np
import re
from typing import List, Dict, Any
import pandas as pd  # For row access in advance func

TRIGGER_REGISTRY = {
    'V_cell_high', 'V_cell_low', 'I_cell_high', 'I_cell_low', 'SOC_cell_high', 'SOC_cell_low',
    'C_rate_cell_high', 'C_rate_cell_low', 'P_cell_high', 'P_cell_low',
    'V_pack_high', 'V_pack_low', 'I_pack_high', 'I_pack_low', 'SOC_pack_high', 'SOC_pack_low',
    'C_rate_pack_high', 'C_rate_pack_low', 'P_pack_high', 'P_pack_low',
    'time_elapsed'  # Internal day trigger
}

def parse_trigger_list_from_row(row: pd.Series, column: str) -> List[Dict[str, Any]]:
    """Parse 'V_cell_high:4.2:dc;SOC_pack_low:0.2' → [{'type': 'V_cell_high', 'value': 4.2, 'source': 'dc'}, ...]. Source from column."""
    trigger_str = str(row.get(column, '')).strip()
    source = 'step' if 'step' in column.lower() else 'dc'
    if not trigger_str:
        return []
    triggers = []
    for part in trigger_str.split(';'):
        part = part.strip()
        # Match: type:value[:action_override]
        match = re.match(r'([^\s:]+):([+-]?\d*\.?\d+)(?::([a-z]+))?', part)
        if match:
            trig_type, val_str, action_str = match.groups()
            if trig_type in TRIGGER_REGISTRY:
                trig = {'type': trig_type, 'value': float(val_str), 'source': source}
                if action_str:  # e.g., :dc override
                    trig['action_override'] = action_str
                triggers.append(trig)
            else:
                print(f"Warning: Unknown trigger {trig_type}")
    return triggers

def evaluate_triggers(
    triggers: List[Dict[str, Any]], sim_SOC: np.array, sim_V_term: np.array, v_module: float,
    time_in_step: float, t_global: float, I_cells: np.array, I_pack: float,
    capacity_Ah: float, per_day_time: float, current_day: int, parallel_groups: list
) -> List[Dict[str, Any]]:
    """Evaluate, return fired [{'name': type, 'value': thresh, 'action_level': 'step/dc/day', 'metric': val}, ...]."""
    fired = []

    # Internal day trigger (fires on rollover or exact multiple)
    if per_day_time + time_in_step >= 86400.0:
        fired.append({
            'name': 'time_elapsed', 'value': 86400.0, 'action_level': 'day',
            'metric': per_day_time + time_in_step, 'source': 'internal'
        })

    # User triggers
    n_series = len(parallel_groups)
    n_p_avg = len(I_cells) / n_series if n_series > 0 else 1
    for trig in triggers:
        trig_type = trig['type']
        # Metrics (conservative max/min for cell highs/lows; pack avg/mean)
        if 'V_cell' in trig_type:
            metric = np.max(sim_V_term) if 'high' in trig_type else np.min(sim_V_term)
        elif 'I_cell' in trig_type:
            metric = np.max(np.abs(I_cells)) if 'high' in trig_type else np.min(np.abs(I_cells))
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
            metric = np.mean(sim_SOC)  # Avg for pack
        elif 'C_rate_pack' in trig_type:
            metric = abs(I_pack) / (capacity_Ah * n_p_avg)
        elif 'P_pack' in trig_type:
            metric = v_module * I_pack
        else:
            continue

        is_fired = ('high' in trig_type and metric > trig['value']) or \
                   ('low' in trig_type and metric < trig['value'])
        if is_fired:
            action_level = trig.get('action_override', 'dc' if trig['source'] == 'dc' else 'step')
            fired.append({**trig, 'action_level': action_level, 'metric': metric, 'name': trig_type})

    return fired

def advance_row_idx_for_action(dc_table: pd.DataFrame, row_idx: int, action_level: str,
                               current_subcycle: str, current_dc: str, current_day: int) -> int:
    """Advance row_idx: 'step' +1; 'dc' to next subcycle in DC/day or next day; 'day' to next day."""
    if row_idx >= len(dc_table) - 1:
        return row_idx
    if action_level == 'step':
        return row_idx + 1
    elif action_level == 'dc':
        # Skip to next subcycle in same DC (same day)
        target_subcycle = None
        next_row_idx = row_idx + 1
        while next_row_idx < len(dc_table):
            next_row = dc_table.iloc[next_row_idx]
            next_dc = next_row.get('DriveCycle_ID', '')
            next_sub = str(next_row.get('Subcycle_ID', ''))
            next_day = int(next_row.get('Day_of_year', 1))
            if next_dc == current_dc and next_day == current_day and next_sub != current_subcycle:
                return next_row_idx  # Next subcycle same day/DC
            if next_day > current_day:
                # No more subcycles same day: Jump to next day's first subcycle
                return next_row_idx
            next_row_idx += 1
        return len(dc_table) - 1  # End if none
    elif action_level == 'day':
        # Skip to first row of next day
        next_row_idx = row_idx + 1
        while next_row_idx < len(dc_table):
            next_row = dc_table.iloc[next_row_idx]
            if int(next_row.get('Day_of_year', 1)) > current_day:
                return next_row_idx  # First of next day
            next_row_idx += 1
        return len(dc_table) - 1  # End
    return row_idx

def check_hard_cutoffs(sim_V_term: np.array, v_module: float,
                       HARD_V_cell_max: float, HARD_V_cell_min: float,
                       HARD_V_pack_max: float, HARD_V_pack_min: float) -> bool:
    """True if any hard cutoff hit."""
    return (np.any(sim_V_term > HARD_V_cell_max) or np.any(sim_V_term < HARD_V_cell_min) or
            v_module > HARD_V_pack_max or v_module < HARD_V_pack_min)
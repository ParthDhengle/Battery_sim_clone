# FILE: Backend/CoreLogic/triggers.py
"""
7. Trigger Model
Defines step-level transitions in the solver. Triggers are conditions evaluated every dt.
When TRUE, terminate current step and advance per action level (step/dc/day).
Handles cell-level (any cell violates), pack-level (aggregated), and internal time_elapsed.
Hard cutoffs (voltage limits) are separate: terminate entire sim after dt log.
"""

import numpy as np
import re
from typing import List, Dict, Any
import pandas as pd  # For row access in advance func

# 7.3 Standard Trigger Registry (exact match required)
TRIGGER_REGISTRY = {
    # Cell-Level (any cell violates: max for high, min for low)
    'V_cell_high', 'V_cell_low', 'I_cell_high', 'I_cell_low', 'SOC_cell_high', 'SOC_cell_low',
    'C_rate_cell_high', 'C_rate_cell_low', 'P_cell_high', 'P_cell_low',
    # Pack-Level (aggregated: avg SOC, total V/I/P)
    'V_pack_high', 'V_pack_low', 'I_pack_high', 'I_pack_low', 'SOC_pack_high', 'SOC_pack_low',
    'C_rate_pack_high', 'C_rate_pack_low', 'P_pack_high', 'P_pack_low',
    # Internal (solver-defined)
    'time_elapsed'  # Fires on daily limit (86400s); highest precedence
}


def parse_trigger_list_from_row(row: pd.Series, column: str) -> List[Dict[str, Any]]:
    """
    7.4 Trigger Specification Format
    Parse column string (e.g., 'V_cell_high:4.2:dc;SOC_pack_low:0.2') → list of dicts.
    - Optional :value (doc examples omit; if missing, value=None → skipped in eval).
    - Optional :action (step/dc/day; defaults: step for step-col, dc for dc-col).
    Source: 'step' or 'dc' from column name.
    """
    trigger_str = str(row.get(column, '')).strip()
    source = 'step' if 'step' in column.lower() else 'dc'
    if not trigger_str:
        return []
    triggers = []
    for part in trigger_str.split(';'):
        part = part.strip()
        # Regex: type[:value[:action]]? (value/action optional)
        match = re.match(r'([^\s:]+)(?::([+-]?\d*\.?\d+))?(?::([a-z]+))?', part)
        if match:
            trig_type, val_str, action_str = match.groups()
            if trig_type in TRIGGER_REGISTRY:
                trig = {'type': trig_type, 'source': source}
                if val_str:  # Optional value
                    trig['value'] = float(val_str)
                if action_str:  # Optional override
                    trig['action_override'] = action_str
                triggers.append(trig)
            elif trig_type == 'nan':
                continue 
            else:
                print(f"Warning: Unknown trigger '{trig_type}' in {column} step: {row.name}")
    return triggers


def evaluate_triggers(
    triggers: List[Dict[str, Any]],
    sim_SOC: np.ndarray, sim_V_term: np.ndarray, v_module: float,
    dt: float,  # Current timestep (for time_elapsed crossover)
    t_global: float, I_cells: np.ndarray, I_pack: float,
    capacity_Ah: float, per_day_time: float,  # Pre-dt per_day_time
    current_day: int, parallel_groups: list
) -> List[Dict[str, Any]]:
    """
    7.5 Trigger Evaluation Logic
    Evaluate all triggers every dt. Return fired list.
    - Internal time_elapsed: Highest precedence; fires if per_day_time + dt >= 86400s.
    - User triggers: Skip if value=None (per doc shorthand). Cell: max/high min/low; Pack: avg/total.
    - 7.6 Precedence: Caller prioritizes (day > dc > step); log all fired.
    """
    fired = []

    # 7.3 Solver-Defined: time_elapsed (always ends day; check crossover this dt)
    if dt > 0 and per_day_time + dt >= 86400.0:
        fired.append({
            'name': 'time_elapsed', 'value': 86400.0, 'action_level': 'day',
            'metric': per_day_time + dt, 'source': 'internal'
        })

    # User triggers (7.2 Cell vs Pack)
    if not triggers:
        return fired
    n_series = len(parallel_groups)
    n_p_avg = len(I_cells) / n_series if n_series > 0 else 1
    for trig in triggers:
        trig_type = trig['type']
        # For time_elapsed, always evaluate (even if value=None)
        if trig_type != 'time_elapsed' and trig['value'] is None:  # Skip if no threshold (doc examples)
            print(f"Warning: Skipping trigger '{trig['type']}' (missing value)")
            continue
        # Compute metric (conservative for safety)
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
            metric = np.mean(sim_SOC)  # Avg SOC for pack
        elif 'C_rate_pack' in trig_type:
            metric = abs(I_pack) / (capacity_Ah * n_p_avg)
        elif 'P_pack' in trig_type:
            metric = v_module * I_pack
        elif trig_type == 'time_elapsed':
            metric = per_day_time + dt  # Check crossover this dt
            trig['value'] = trig.get('value', 86400.0)  # Default to end-of-day
        else:
            continue  # Unknown (logged in parse)

        # Fire if violated
        is_fired = ('high' in trig_type and metric > trig['value']) or \
                   ('low' in trig_type and metric < trig['value']) or \
                   (trig_type == 'time_elapsed' and metric >= trig['value'])
        if is_fired:
            action_level = trig.get('action_override', 
                                   'day' if trig_type == 'time_elapsed' else 
                                   'dc' if trig['source'] == 'dc' else 'step')
            fired.append({**trig, 'action_level': action_level, 'metric': metric, 'name': trig_type})

    return fired


def advance_row_idx_for_action(
    dc_table: pd.DataFrame, row_idx: int, action_level: str,
    current_subcycle: str, current_dc: str, current_day: int
) -> int:
    """
    7.8 Trigger Actions
    Advance row_idx based on fired action_level.
    - 'step': +1 row (end current step).
    - 'dc' (subcycle): Next subcycle in same DC/day, or next day's first.
    - 'day': First row of next Day_of_year.
    If end of table, stay.
    """
    if row_idx >= len(dc_table) - 1:
        return row_idx
    if action_level == 'step':
        return row_idx + 1
    next_row_idx = row_idx + 1
    while next_row_idx < len(dc_table):
        next_row = dc_table.iloc[next_row_idx]
        next_day = int(next_row.get('Day_of_year', 1))
        if action_level == 'day':
            if next_day > current_day:
                return next_row_idx  # 7.8.C: Next day
            next_row_idx += 1
            continue
        # 'dc': Check same day/DC, next subcycle
        next_dc = next_row.get('DriveCycle_ID', '')
        next_sub = str(next_row.get('Subcycle_ID', ''))
        if next_dc == current_dc and next_day == current_day and next_sub != current_subcycle:
            return next_row_idx  # 7.8.B: Next subcycle
        if next_day > current_day:
            return next_row_idx  # No more: Next day
        next_row_idx += 1
    return len(dc_table) - 1  # End


def check_hard_cutoffs(
    sim_V_term: np.ndarray, v_module: float,
    HARD_V_cell_max: float, HARD_V_cell_min: float,
    HARD_V_pack_max: float, HARD_V_pack_min: float
) -> tuple[bool, str]:
    """
    7.8.D Cell/Pack Hard Cutoff
    Check after full dt log (caller). Returns (hit: bool, type: 'cell'/'pack'/None).
    Terminates entire sim (set sim_terminated=True in caller).
    """
    cell_hit = np.any(sim_V_term > HARD_V_cell_max) or np.any(sim_V_term < HARD_V_cell_min)
    pack_hit = (not np.isnan(HARD_V_pack_min) and v_module < HARD_V_pack_min) or \
               (not np.isnan(HARD_V_pack_max) and v_module > HARD_V_pack_max)
    if cell_hit:
        return True, 'cell'
    if pack_hit:
        return True, 'pack'
    return False, None
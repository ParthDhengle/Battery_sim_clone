# FILE: CoreLogic/NEW_electrical_solver.py
import numpy as np
import time
import pandas as pd
import os
import zipfile
import json
from pathlib import Path
from .battery_params import get_battery_params
from .next_soc import calculate_next_soc
from .reversible_heat import calculate_reversible_heat
from .triggers import parse_trigger_list_from_row, evaluate_triggers, advance_row_idx_for_action, check_hard_cutoffs
from .conversion import compute_module_current_from_step
from typing import Dict, List, Any, Optional
from io import StringIO
import pprint 
def initialize_simulation(setup, dc_table, filename, sim_id=None):
   
    # Extract cell configuration
    cells = setup['cells']
    N_cells = len(cells)
    capacity_Ah = setup['capacity']
    coulombic_eff = setup['columbic_efficiency']
    parallel_groups = sorted(set(c['parallel_group'] for c in cells))
    n_series = len(parallel_groups)
    
    # Extract resistances
    R_p = setup['R_p']
    R_s = setup['R_s']
    
    # Extract voltage limits
    v_limits = setup['voltage_limits']
    HARD_V_cell_max = v_limits['cell_upper']
    HARD_V_cell_min = v_limits['cell_lower'] or np.nan
    HARD_V_pack_max = v_limits['module_upper']
    HARD_V_pack_min = v_limits['module_lower'] or np.nan
    
    # Print initialization info
    print(f"🚀 Solver started: N_cells={N_cells}, n_series={n_series}")
    print(f"   Voltage limits: cell [{HARD_V_cell_min:.2f}, {HARD_V_cell_max:.2f}]V, "
          f"pack [{HARD_V_pack_min:.2f}, {HARD_V_pack_max:.2f}]V")
    
    # Prepare drive cycle table
    dc_table = dc_table.copy()
    n_rows = len(dc_table)
    if n_rows == 0:
        raise ValueError("Empty DC table")
    
    # Detect existing CSV for resume (append mode)
    csv_mode = 'w'
    last_written_timestep = 0
    if os.path.exists(filename) and os.path.getsize(filename) > 0:
        csv_mode = 'a'
        print(f"   Detected existing CSV on resume: {os.path.getsize(filename)} bytes")
    
    # Setup signal files
    stop_signal_file = f"simulations/{sim_id}.stop" if sim_id else None
    pause_signal_file = f"simulations/{sim_id}.pause" if sim_id else None
    
    # Clean old signal files
    if stop_signal_file and os.path.exists(stop_signal_file):
        os.remove(stop_signal_file)
    if pause_signal_file and os.path.exists(pause_signal_file):
        os.remove(pause_signal_file)
    
    return {
        'cells': cells,
        'N_cells': N_cells,
        'capacity_Ah': capacity_Ah,
        'coulombic_eff': coulombic_eff,
        'parallel_groups': parallel_groups,
        'n_series': n_series,
        'R_p': R_p,
        'R_s': R_s,
        'HARD_V_cell_max': HARD_V_cell_max,
        'HARD_V_cell_min': HARD_V_cell_min,
        'HARD_V_pack_max': HARD_V_pack_max,
        'HARD_V_pack_min': HARD_V_pack_min,
        'dc_table': dc_table,
        'n_rows': n_rows,
        'csv_mode': csv_mode,
        'last_written_timestep': last_written_timestep,
        'stop_signal_file': stop_signal_file,
        'pause_signal_file': pause_signal_file
    }

def write_partial_history(
    history: Dict,
    from_idx: int,
    to_idx: int,
    filename: str,
    csv_mode: str,
    last_written_timestep: int,
    N_cells: int,
    n_series: int
) -> tuple[str, int]:
    
    if to_idx <= from_idx:
        return csv_mode, last_written_timestep
    
    # Extract slice of history
    partial_history = {
        'dt': history['dt'][from_idx:to_idx],
        't_global_s': history['t_global_s'][from_idx:to_idx],
        'SOC': history['SOC'][from_idx:to_idx],
        'Vterm': history['Vterm'][from_idx:to_idx],
        'OCV': history['OCV'][from_idx:to_idx],
        'V_RC1': history['V_RC1'][from_idx:to_idx],
        'V_RC2': history['V_RC2'][from_idx:to_idx],
        'V_R0': history['V_R0'][from_idx:to_idx],
        'V_R1': history['V_R1'][from_idx:to_idx],
        'V_R2': history['V_R2'][from_idx:to_idx],
        'V_C1': history['V_C1'][from_idx:to_idx],
        'V_C2': history['V_C2'][from_idx:to_idx],
        'I_module': history['I_module'][from_idx:to_idx],
        'V_module': history['V_module'][from_idx:to_idx],
        'Qgen_cumulative': history['Qgen_cumulative'][from_idx:to_idx],
        'energy_throughput': history['energy_throughput'][from_idx:to_idx],
        'Global Step Index': history['Global Step Index'][from_idx:to_idx],
        'Day_of_year': history['Day_of_year'][from_idx:to_idx],
        'DriveCycle_ID': history['DriveCycle_ID'][from_idx:to_idx],
        'Subcycle_ID': history['Subcycle_ID'][from_idx:to_idx],
        'Subcycle Step Index': history['Subcycle Step Index'][from_idx:to_idx],
        'Value Type': history['Value Type'][from_idx:to_idx],
        'Value': history['Value'][from_idx:to_idx],
        'Unit': history['Unit'][from_idx:to_idx],
        'Step Type': history['Step Type'][from_idx:to_idx],
        'Label': history['Label'][from_idx:to_idx],
        'Ambient Temp (°C)': history['Ambient Temp (°C)'][from_idx:to_idx],
        'Location': history['Location'][from_idx:to_idx],
        'drive cycle trigger': history['drive cycle trigger'][from_idx:to_idx],
        'step Trigger(s)': history['step Trigger(s)'][from_idx:to_idx],
        'termination_msg': history['termination_msg'][from_idx:to_idx],
    }
    
    # Convert to DataFrame
    df_chunk = _history_to_long_dataframe(partial_history, N_cells, n_series)
    if df_chunk.empty:
        return csv_mode, last_written_timestep
    
    # Append to CSV
    df_chunk.to_csv(filename, mode=csv_mode, index=False, header=(csv_mode == 'w'))
    
    # Update mode and timestamp
    updated_csv_mode = 'a' if csv_mode == 'w' else csv_mode
    updated_last_written = to_idx
    
    # Progress logging
    progress = (to_idx / max(1, len(history['dt']))) * 100
    print(f"📝 Wrote timesteps [{from_idx}, {to_idx}) to CSV ({len(df_chunk)} rows, {progress:.1f}% complete)")
    
    return updated_csv_mode, updated_last_written

def find_col(columns, candidates):
    """Find column name case-insensitively, ignoring spaces."""
    lower_cols = [c.lower().replace(" ", "") for c in columns]
    for cand in candidates:
        cand_norm = cand.lower().replace(" ", "")
        try:
            idx = lower_cols.index(cand_norm)
            return columns[idx]
        except ValueError:
            continue
    return None

def _history_to_long_dataframe(history: Dict, N_cells: int, n_series: int) -> pd.DataFrame:
    """Convert history dict to long DF with cell_id. Fixed I_cell scaling. Added energy_throughput."""
    if N_cells == 0:
        df = pd.DataFrame({
            'cell_id': [],
            'time_global_s': history['t_global_s'],
            'I_module': history['I_module'],
            'V_module': history['V_module'],
        })
        for key in ['Global Step Index', 'Day_of_year', 'DriveCycle_ID', 'Subcycle_ID', 'Subcycle Step Index',
                    'Value Type', 'Value', 'Unit', 'Step Type', 'Label', 'Ambient Temp (°C)', 'Location',
                    'drive cycle trigger', 'step Trigger(s)', 'termination_msg']:
            if key in history:
                df[key] = history[key]
        return df
    rows = []
    n_p_avg = N_cells / n_series if n_series > 0 else 1
    for t_idx in range(len(history['dt'])):
        for cell_id in range(N_cells):
            row = {
                'cell_id': cell_id,
                'time_global_s': history['t_global_s'][t_idx],
                'dt': history['dt'][t_idx],
                'SOC': history['SOC'][t_idx][cell_id],
                'Vterm': history['Vterm'][t_idx][cell_id],
                'OCV': history['OCV'][t_idx][cell_id],
                'V_RC1': history['V_RC1'][t_idx][cell_id],
                'V_RC2': history['V_RC2'][t_idx][cell_id],
                'R0': history['V_R0'][t_idx][cell_id],
                'R1': history['V_R1'][t_idx][cell_id],
                'R2': history['V_R2'][t_idx][cell_id],
                'C1': history['V_C1'][t_idx][cell_id],
                'C2': history['V_C2'][t_idx][cell_id],
                'I_cell': history['I_module'][t_idx] / n_p_avg,
                'I_module': history['I_module'][t_idx],
                'V_module': history['V_module'][t_idx],
                'Qgen_cumulative': history['Qgen_cumulative'][t_idx][cell_id],
                'energy_throughput': history['energy_throughput'][t_idx][cell_id],
            }
            # Metadata
            for key in ['Global Step Index', 'Day_of_year', 'DriveCycle_ID', 'Subcycle_ID', 'Subcycle Step Index',
                        'Value Type', 'Value', 'Unit', 'Step Type', 'Label', 'Ambient Temp (°C)', 'Location',
                        'drive cycle trigger', 'step Trigger(s)', 'termination_msg']:
                row[key] = history.get(key, [np.nan])[t_idx]
            rows.append(row)
    return pd.DataFrame(rows)

def finalize_simulation(
    history: Dict,
    last_written_timestep: int,
    filename: str,
    csv_mode: str,
    N_cells: int,
    n_series: int,
    t_global: float,
    stop_requested: bool,
    sim_terminated: bool,
    stop_signal_file: Optional[str],
    sim_id: Optional[str]
) -> tuple[str, int, str]:
    
    print(f"💾 Writing final results...")
    current_timestep = len(history['dt'])
    
    # Write remaining data
    csv_mode, last_written_timestep = write_partial_history(
        history=history,
        from_idx=last_written_timestep,
        to_idx=current_timestep,
        filename=filename,
        csv_mode=csv_mode,
        last_written_timestep=last_written_timestep,
        N_cells=N_cells,
        n_series=n_series
    )
    
    # Clean up stop signal if present
    cleanup_stop_signal(stop_requested, stop_signal_file)
    
    # Determine final status
    status = determine_simulation_status(stop_requested, sim_terminated, sim_id)
    
    print(f"🏁 Solver {status}: {filename} ({current_timestep} timesteps, t_final={t_global:.1f}s)")
    
    return filename, current_timestep, status


def cleanup_stop_signal(stop_requested: bool, stop_signal_file: Optional[str]) -> None:
    if stop_requested and stop_signal_file and os.path.exists(stop_signal_file):
        os.remove(stop_signal_file)
        print(f"🗑️ Removed stop signal file")


def determine_simulation_status(
    stop_requested: bool,
    sim_terminated: bool,
    sim_id: Optional[str]
) -> str:
    """
    Determine final simulation status based on termination conditions.
    
    Parameters:
    -----------
    stop_requested : bool
        Whether user requested stop
    sim_terminated : bool
        Whether simulation terminated early
    sim_id : str, optional
        Simulation ID
        
    Returns:
    --------
    str
        Status string ('paused', 'stopped by user', 'terminated early', or 'completed')
    """
    # Check if paused (pause ZIP exists)
    if sim_id and os.path.exists(f"simulations/{sim_id}_pause.zip"):
        return 'paused'
    
    # Check other termination conditions
    if stop_requested:
        return 'stopped by user'
    elif sim_terminated:
        return 'terminated early'
    else:
        return 'completed'

def handle_pause_signal(
    pause_signal_file: Optional[str],
    t_global: float,
    row_idx: int,
    history: Dict,
    last_written_timestep: int,
    filename: str,
    csv_mode: str,
    N_cells: int,
    n_series: int,
    pack_id: Optional[str],
    dc_id: Optional[str],
    sim_id: Optional[str],
    original_start_row: int
) -> tuple[bool, str, int]:
    """
    Handle pause signal detection and create continuation ZIP.
    
    Returns:
    --------
    tuple[bool, str, int]
        (should_terminate, csv_mode, last_written_timestep)
    """
    if not (pause_signal_file and os.path.exists(pause_signal_file)):
        return False, csv_mode, last_written_timestep
    
    print(f"⏸️ Pause signal detected at t={t_global:.1f}s, row {row_idx}")
    
    # Flush remaining history to CSV
    current_timestep = len(history['dt'])
    csv_mode, last_written_timestep = write_partial_history(
        history=history,
        from_idx=last_written_timestep,
        to_idx=current_timestep,
        filename=filename,
        csv_mode=csv_mode,
        last_written_timestep=last_written_timestep,
        N_cells=N_cells,
        n_series=n_series
    )
    
    # Create continuation ZIP
    create_pause_zip(pack_id, dc_id, sim_id, row_idx, original_start_row, t_global, filename)
    
    # Remove signal
    os.remove(pause_signal_file)
    
    return True, csv_mode, last_written_timestep


def create_pause_zip(
    pack_id: Optional[str],
    dc_id: Optional[str],
    sim_id: Optional[str],
    row_idx: int,
    original_start_row: int,
    t_global: float,
    filename: str
) -> None:
    """Create continuation ZIP file for paused simulation."""
    if not (pack_id and dc_id and sim_id):
        print("⚠️ Warning: Missing pack_id, dc_id, or sim_id; ZIP not created")
        return
    
    metadata = {
        "pack_id": pack_id,
        "dc_id": dc_id,
        "last_row": row_idx + original_start_row,
        "t_global": t_global
    }
    
    zip_path = f"simulations/{sim_id}_pause.zip"
    try:
        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.write(filename, "simulation_data.csv")
            zf.writestr("metadata.json", json.dumps(metadata))
        print(f"⏸️ Pause ZIP created: {zip_path}, last_row={row_idx + original_start_row}")
    except Exception as e:
        print(f"❌ Error creating pause ZIP: {e}")


def handle_stop_signal(
    stop_signal_file: Optional[str],
    t_global: float,
    row_idx: int
) -> bool:
    """
    Handle stop signal detection.
    
    Returns:
    --------
    bool
        True if stop signal detected, False otherwise
    """
    if stop_signal_file and os.path.exists(stop_signal_file):
        print(f"🛑 Stop signal detected at t={t_global:.1f}s, row {row_idx}")
        return True
    return False


def handle_periodic_write(
    current_time: float,
    last_write_time: float,
    write_interval: float,
    history: Dict,
    last_written_timestep: int,
    filename: str,
    csv_mode: str,
    N_cells: int,
    n_series: int
) -> tuple[float, str, int]:
    """
    Handle periodic CSV writes.
    
    Returns:
    --------
    tuple[float, str, int]
        (last_write_time, csv_mode, last_written_timestep)
    """
    if current_time - last_write_time >= write_interval:
        current_timestep = len(history['dt'])
        csv_mode, last_written_timestep = write_partial_history(
            history=history,
            from_idx=last_written_timestep,
            to_idx=current_timestep,
            filename=filename,
            csv_mode=csv_mode,
            last_written_timestep=last_written_timestep,
            N_cells=N_cells,
            n_series=n_series
        )
        return current_time, csv_mode, last_written_timestep
    
    return last_write_time, csv_mode, last_written_timestep


def parse_row_data(row: pd.Series, dc_trigger_col: Optional[str], step_trigger_col: Optional[str], dt_base: float) -> Optional[Dict]:
   
    # Validate row
    if pd.isna(row.get('Value Type')) or pd.isna(row.get('Value')):
        return None
    
    step_type = str(row.get("Step Type", "fixed")).strip().lower()
    step_duration = float(row.get("Step Duration (s)", np.inf)) if step_type != "trigger_only" else 0.0
    dt_step = float(row.get("Timestep (s)", dt_base))
    value_type = str(row.get("Value Type", "current")).strip().lower()
    value = float(row.get("Value", 0.0))
    unit = str(row.get("Unit", "")).strip().lower()
    current_day = int(row.get("Day_of_year", 1))
    current_dc = row.get("DriveCycle_ID", "")
    current_subcycle = str(row.get("Subcycle_ID", "")) or ""
    
    step_triggers = parse_trigger_list_from_row(row, column=step_trigger_col)
    dc_triggers = parse_trigger_list_from_row(row, column=dc_trigger_col)
    
    has_triggers = len(step_triggers + dc_triggers) > 0
    use_batching = step_type == 'fixed' and not has_triggers
    
    return {
        'step_type': step_type,
        'step_duration': step_duration,
        'dt_step': dt_step,
        'value_type': value_type,
        'value': value,
        'unit': unit,
        'current_day': current_day,
        'current_dc': current_dc,
        'current_subcycle': current_subcycle,
        'step_triggers': step_triggers,
        'dc_triggers': dc_triggers,
        'has_triggers': has_triggers,
        'use_batching': use_batching,
        'row': row
    }


def compute_timestep(
    step_type: str,
    step_duration: float,
    time_in_step: float,
    dt_step: float,
    use_batching: bool
) -> Optional[float]:
    """
    Compute the timestep for current iteration.
    
    Returns:
    --------
    Optional[float]
        Timestep dt, or None if step is complete
    """
    if step_type in ["fixed", "fixed_with_triggers"] and step_duration < np.inf and not use_batching:
        remaining = step_duration - time_in_step
        if remaining <= 0:
            return None
        return min(dt_step, remaining)
    else:
        return dt_step if not use_batching else step_duration


def solve_parallel_group(
    group_id: int,
    cells: List[Dict],
    sim_SOC: np.ndarray,
    sim_TempK: np.ndarray,
    sim_SOH: np.ndarray,
    sim_DCIR: np.ndarray,
    sim_V_RC1: np.ndarray,
    sim_V_RC2: np.ndarray,
    I_module_current: float,
    dt: float,
    R_p: float,
    mode: str
) -> Optional[tuple]:
    """
    Solve electrical equations for a parallel group.
    
    Returns:
    --------
    Optional[tuple]
        (V_parallel, cell_updates) where cell_updates is a list of dicts with cell results,
        or None if solving failed
    """
    group_cells = [i for i, c in enumerate(cells) if c["parallel_group"] == group_id]
    N = len(group_cells)
    
    if N == 0:
        return None
    
    A = np.zeros((N + 1, N + 1))
    b = np.zeros(N + 1)
    
    cell_params = []
    
    for i, cell_idx in enumerate(group_cells):
        SOC = sim_SOC[cell_idx]
        Temp_C = sim_TempK[cell_idx] - 273.15
        SOH = sim_SOH[cell_idx]
        DCIR = sim_DCIR[cell_idx]
        V_rc1_prev = sim_V_RC1[cell_idx]
        V_rc2_prev = sim_V_RC2[cell_idx]
        
        OCV, R0, R1, R2, C1, C2 = get_battery_params(
            cells[cell_idx]['rc_data'], SOC, Temp_C, mode, SOH, DCIR
        )
        
        tau1 = R1 * C1 if C1 > 0 else 1e-6
        tau2 = R2 * C2 if C2 > 0 else 1e-6
        K = OCV - (V_rc1_prev * np.exp(-dt / tau1) + V_rc2_prev * np.exp(-dt / tau2))
        R_eff = R0 + 2.0 * R_p + R1 * (1.0 - np.exp(-dt / tau1)) + R2 * (1.0 - np.exp(-dt / tau2))
        
        A[i, i] = R_eff
        A[i, -1] = 1.0
        b[i] = K
        
        cell_params.append({
            'cell_idx': cell_idx,
            'OCV': OCV,
            'R0': R0,
            'R1': R1,
            'R2': R2,
            'C1': C1,
            'C2': C2,
            'tau1': tau1,
            'tau2': tau2
        })
    
    A[-1, :N] = 1.0
    b[-1] = I_module_current
    
    try:
        x = np.linalg.solve(A, b)
        V_parallel = x[-1]
        
        cell_updates = []
        for i, params in enumerate(cell_params):
            I_cell = x[i]
            cell_updates.append({
                'cell_idx': params['cell_idx'],
                'I_cell': I_cell,
                'params': params
            })
        
        return V_parallel, cell_updates
    
    except np.linalg.LinAlgError:
        return None


def update_cell_states(
    cell_idx: int,
    I_cell: float,
    dt: float,
    params: Dict,
    sim_SOC: np.ndarray,
    sim_V_RC1: np.ndarray,
    sim_V_RC2: np.ndarray,
    sim_V_term: np.ndarray,
    capacity_Ah: float,
    coulombic_eff: float,
    sim_SOH: np.ndarray,
    sim_TempK: np.ndarray,
    cum_energy_kWh: np.ndarray,
    cum_qgen_Ws: np.ndarray
) -> tuple[float, bool]:
    """
    Update cell states after solving.
    
    Returns:
    --------
    tuple[float, bool]
        (Vterm, cutoff_hit)
    """
    R1 = params['R1']
    R2 = params['R2']
    tau1 = params['tau1']
    tau2 = params['tau2']
    
    V_rc1 = sim_V_RC1[cell_idx] * np.exp(-dt / tau1) + R1 * I_cell * (1.0 - np.exp(-dt / tau1))
    V_rc2 = sim_V_RC2[cell_idx] * np.exp(-dt / tau2) + R2 * I_cell * (1.0 - np.exp(-dt / tau2))
    Vterm = params['OCV'] - I_cell * params['R0'] - V_rc1 - V_rc2
    
    next_SOC = calculate_next_soc(I_cell, dt, capacity_Ah, sim_SOC[cell_idx], coulombic_eff, sim_SOH[cell_idx])
    
    q_irr = (I_cell ** 2) * params['R0']
    q_rev = calculate_reversible_heat(sim_TempK[cell_idx], I_cell, sim_SOC[cell_idx])
    q_gen = q_irr + q_rev
    
    # Update states
    sim_SOC[cell_idx] = next_SOC
    sim_V_RC1[cell_idx] = V_rc1
    sim_V_RC2[cell_idx] = V_rc2
    sim_V_term[cell_idx] = Vterm
    
    energy_kWh = abs(I_cell * Vterm * dt) / (3600.0 * 1000.0)
    cum_energy_kWh[cell_idx] += energy_kWh
    cum_qgen_Ws[cell_idx] += q_gen
    
    return Vterm, False


def check_voltage_cutoffs(
    sim_V_term: np.ndarray,
    v_module: float,
    HARD_V_cell_min: float,
    HARD_V_cell_max: float,
    HARD_V_pack_min: float,
    HARD_V_pack_max: float
) -> tuple[bool, Optional[str]]:
    """
    Check if voltage cutoffs have been hit.
    
    Returns:
    --------
    tuple[bool, Optional[str]]
        (cutoff_hit, cutoff_type) where cutoff_type is 'cell' or 'pack'
    """
    # Cell voltage check
    if not np.isnan(HARD_V_cell_min):
        if np.any(sim_V_term > HARD_V_cell_max) or np.any(sim_V_term < HARD_V_cell_min):
            return True, 'cell'
    
    # Pack voltage check
    if not np.isnan(HARD_V_pack_min) and not np.isnan(HARD_V_pack_max):
        if v_module > HARD_V_pack_max or v_module < HARD_V_pack_min:
            return True, 'pack'
    
    return False, None


def log_to_history(
    history: Dict,
    dt: float,
    t_global: float,
    sim_SOC: np.ndarray,
    sim_V_term: np.ndarray,
    sim_OCV: np.ndarray,
    sim_V_RC1: np.ndarray,
    sim_V_RC2: np.ndarray,
    sim_R0: np.ndarray,
    sim_R1: np.ndarray,
    sim_R2: np.ndarray,
    sim_C1: np.ndarray,
    sim_C2: np.ndarray,
    I_module_current: float,
    v_module: float,
    cum_energy_kWh: np.ndarray,
    cum_qgen_Ws: np.ndarray,
    row_data: Dict,
    dc_trigger_col: Optional[str],
    step_trigger_col: Optional[str],
    msg: str = ""
) -> None:
    """Log current timestep data to history."""
    row = row_data['row']
    
    history["dt"].append(float(dt))
    history["t_global_s"].append(float(t_global + dt))
    history["SOC"].append(sim_SOC.copy())
    history["Vterm"].append(sim_V_term.copy())
    history["OCV"].append(sim_OCV.copy())
    history["V_RC1"].append(sim_V_RC1.copy())
    history["V_RC2"].append(sim_V_RC2.copy())
    history["V_R0"].append(sim_R0.copy())
    history["V_R1"].append(sim_R1.copy())
    history["V_R2"].append(sim_R2.copy())
    history["V_C1"].append(sim_C1.copy())
    history["V_C2"].append(sim_C2.copy())
    history["I_module"].append(float(I_module_current))
    history["V_module"].append(float(v_module))
    history["energy_throughput"].append(cum_energy_kWh.copy())
    history["Qgen_cumulative"].append(cum_qgen_Ws.copy())
    
    # Metadata
    history["Global Step Index"].append(row.get("Global Step Index", np.nan))
    history["Day_of_year"].append(row.get("Day_of_year", np.nan))
    history["DriveCycle_ID"].append(row.get("DriveCycle_ID", ""))
    history["Subcycle_ID"].append(row_data['current_subcycle'])
    history["Subcycle Step Index"].append(row.get("Subcycle Step Index", np.nan))
    history["Value Type"].append(row_data['value_type'])
    history["Value"].append(row_data['value'])
    history["Unit"].append(row_data['unit'])
    history["Step Type"].append(row_data['step_type'])
    history["Label"].append(row.get("Label", ""))
    history["Ambient Temp (°C)"].append(row.get("Ambient Temp (°C)", np.nan))
    history["Location"].append(row.get("Location", ""))
    history["drive cycle trigger"].append(str(row.get(dc_trigger_col, "")) if dc_trigger_col else "")
    history["step Trigger(s)"].append(str(row.get(step_trigger_col, "")) if step_trigger_col else "")
    history["termination_msg"].append(msg)


def evaluate_and_handle_triggers(
    step_triggers: List,
    dc_triggers: List,
    sim_SOC: np.ndarray,
    sim_V_term: np.ndarray,
    v_module: float,
    time_in_step: float,
    t_global: float,
    I_cells_step: np.ndarray,
    I_module_current: float,
    capacity_Ah: float,
    per_day_time: float,
    current_day: int,
    parallel_groups: List,
    dc_table: pd.DataFrame,
    row_idx: int,
    current_subcycle: str,
    current_dc: str
) -> tuple[bool, int]:
    """
    Evaluate triggers and advance row index if needed.
    
    Returns:
    --------
    tuple[bool, int]
        (should_break, new_row_idx)
    """
    all_triggers = step_triggers + dc_triggers
    
    fired = evaluate_triggers(
        all_triggers, sim_SOC, sim_V_term, v_module, time_in_step, t_global,
        I_cells_step, I_module_current, capacity_Ah, per_day_time, current_day, parallel_groups
    )
    
    advance_actions = [tr['action_level'] for tr in fired]
    
    if 'day' in advance_actions:
        new_row_idx = advance_row_idx_for_action(dc_table, row_idx, 'day', current_subcycle, current_dc, current_day)
        return True, new_row_idx
    elif 'dc' in advance_actions:
        new_row_idx = advance_row_idx_for_action(dc_table, row_idx, 'dc', current_subcycle, current_dc, current_day)
        return True, new_row_idx
    elif 'step' in advance_actions:
        return True, row_idx + 1
    
    return False, row_idx


def process_single_row(
    row_idx: int,
    dc_table: pd.DataFrame,
    dc_trigger_col: Optional[str],
    step_trigger_col: Optional[str],
    dt_base: float,
    sim_states: Dict,
    cells: List[Dict],
    capacity_Ah: float,
    coulombic_eff: float,
    parallel_groups: List,
    n_series: int,
    R_p: float,
    R_s: float,
    HARD_V_cell_max: float,
    HARD_V_cell_min: float,
    HARD_V_pack_max: float,
    HARD_V_pack_min: float,
    history: Dict,
    cutoff_row_guard: Dict,
    t_global: float,
    per_day_time: float
) -> tuple[int, float, float, bool, bool]:
    """
    Process a single row from the drive cycle table.
    
    Returns:
    --------
    tuple[int, float, float, bool, bool]
        (new_row_idx, new_t_global, new_per_day_time, sim_terminated, cutoff_hit)
    """
    row = dc_table.iloc[row_idx]
    
    # Parse row data
    row_data = parse_row_data(row, dc_trigger_col, step_trigger_col, dt_base)
    
    if row_data is None:
        print(f"⚠️ Skipping invalid row {row_idx}")
        return row_idx + 1, t_global, per_day_time, False, False
    
    # Initialize step variables
    time_in_step = 0.0
    I_module_current_for_step = None
    inner_iters = 0

    max_inner_iters = int(row_data['step_duration'] / row_data['dt_step'] ) if row_data['step_duration'] < np.inf else 1000000
    if(row_data['step_type'] == 'trigger_only'):
        max_inner_iters = 86400  # 1 day max for trigger only steps

    dt = row_data['step_duration'] if row_data['use_batching'] else row_data['dt_step']
    
    # Inner step loop
    while True:
        if inner_iters > max_inner_iters:
            print(f"⚠️ Force advance row {row_idx}: Max inner iters")
            return row_idx + 1, t_global, per_day_time, False, False
        
        inner_iters += 1
        
        # Compute module current
        if I_module_current_for_step is None or row_data['value_type'] in ['voltage', 'power']:
            I_module_current = compute_module_current_from_step(
                value_type=row_data['value_type'],
                value=row_data['value'],
                unit=row_data['unit'],
                capacity_Ah=capacity_Ah,
                n_series=n_series,
                cells=cells,
                sim_states=sim_states,
                dt=dt,
                parallel_groups=parallel_groups,
                R_s=R_s,
                R_p=R_p,
                cell_voltage_upper=HARD_V_cell_max,
                cell_voltage_lower=HARD_V_cell_min
            )
            if I_module_current_for_step is None:
                I_module_current_for_step = I_module_current
        else:
            I_module_current = I_module_current_for_step
        
        # Compute dt
        dt_computed = compute_timestep(
            row_data['step_type'],
            row_data['step_duration'],
            time_in_step,
            row_data['dt_step'],
            row_data['use_batching']
        )
        
        if dt_computed is None:
            return row_idx + 1, t_global, per_day_time, False, False
        
        dt = dt_computed
        
        # Physics simulation
        mode = "CHARGE" if I_module_current < 0 else "DISCHARGE"
        v_groups = []
        
        sim_OCV = np.zeros(len(cells))
        sim_R0 = np.zeros(len(cells))
        sim_R1 = np.zeros(len(cells))
        sim_R2 = np.zeros(len(cells))
        sim_C1 = np.zeros(len(cells))
        sim_C2 = np.zeros(len(cells))
        I_cells_step = np.zeros(len(cells))
        
        cutoff_count = cutoff_row_guard.get(row_idx, 0)

        if cutoff_count >= 3:
            print(f"⚠️ Force-skip row {row_idx}: Repeated cutoffs ({cutoff_count})")
            return row_idx + 1, t_global, per_day_time, False, False
        
        cutoff_hit = False
        
        # Solve for each parallel group
        for group_id in parallel_groups:
            if cutoff_hit:
                break
            
            result = solve_parallel_group(
                group_id=group_id,
                cells=cells,
                sim_SOC=sim_states['sim_SOC'],
                sim_TempK=sim_states['sim_TempK'],
                sim_SOH=sim_states['sim_SOH'],
                sim_DCIR=sim_states['sim_DCIR'],
                sim_V_RC1=sim_states['sim_V_RC1'],
                sim_V_RC2=sim_states['sim_V_RC2'],
                I_module_current=I_module_current,
                dt=dt,
                R_p=R_p,
                mode=mode
            )
            
            if result is None:
                print(f"⚠️ LinAlg error at row {row_idx}, dt {dt}; skipping group {group_id}")
                continue
            
            
            V_parallel, cell_updates = result
            v_groups.append(V_parallel)
            print(f"✅ Solved group {group_id} with V_parallel={V_parallel:.3f}V \n cell updates : {cell_updates}")
        
            
            # Update each cell in the group
            for update in cell_updates:
                cell_idx = update['cell_idx']
                I_cell = update['I_cell']
                params = update['params']
                
                # Store parameters
                sim_OCV[cell_idx] = params['OCV']
                sim_R0[cell_idx] = params['R0']
                sim_R1[cell_idx] = params['R1']
                sim_R2[cell_idx] = params['R2']
                sim_C1[cell_idx] = params['C1']
                sim_C2[cell_idx] = params['C2']

                I_cells_step[cell_idx] = I_cell
                
                Vterm, cell_cutoff = update_cell_states(
                    cell_idx=cell_idx,
                    I_cell=I_cell,
                    dt=dt,
                    params=params,
                    sim_SOC=sim_states['sim_SOC'],
                    sim_V_RC1=sim_states['sim_V_RC1'],
                    sim_V_RC2=sim_states['sim_V_RC2'],
                    sim_V_term=sim_states['sim_V_term'],
                    capacity_Ah=capacity_Ah,
                    coulombic_eff=coulombic_eff,
                    sim_SOH=sim_states['sim_SOH'],
                    sim_TempK=sim_states['sim_TempK'],
                    cum_energy_kWh=sim_states['cum_energy_kWh'],
                    cum_qgen_Ws=sim_states['cum_qgen_Ws']
                )
                
                # Check cell cutoff
                if not np.isnan(HARD_V_cell_min) and (Vterm > HARD_V_cell_max or Vterm < HARD_V_cell_min):
                    cutoff_hit = True
                    cutoff_row_guard[row_idx] = cutoff_count + 1
                    break
        
        # Calculate module voltage
        num_series_eff = len(v_groups)
        v_module = float(np.sum(v_groups) - abs(I_module_current) * R_s * max(0, num_series_eff - 1)) if num_series_eff > 0 else 0.0
        
        # Check pack cutoff
        pack_cutoff_hit, cutoff_type = check_voltage_cutoffs(
            sim_states['sim_V_term'], v_module,
            HARD_V_cell_min, HARD_V_cell_max,
            HARD_V_pack_min, HARD_V_pack_max
        )
        
        if pack_cutoff_hit:
            cutoff_hit = True
        
        # Log to history
        if not cutoff_hit or row_data['use_batching']:
            log_to_history(
                history=history,
                dt=dt,
                t_global=t_global,
                sim_SOC=sim_states['sim_SOC'],
                sim_V_term=sim_states['sim_V_term'],
                sim_OCV=sim_OCV,
                sim_V_RC1=sim_states['sim_V_RC1'],
                sim_V_RC2=sim_states['sim_V_RC2'],
                sim_R0=sim_R0,
                sim_R1=sim_R1,
                sim_R2=sim_R2,
                sim_C1=sim_C1,
                sim_C2=sim_C2,
                I_module_current=I_module_current,
                v_module=v_module,
                cum_energy_kWh=sim_states['cum_energy_kWh'],
                cum_qgen_Ws=sim_states['cum_qgen_Ws'],
                row_data=row_data,
                dc_trigger_col=dc_trigger_col,
                step_trigger_col=step_trigger_col
            )
            
            time_in_step += float(dt)
            t_global += float(dt)
            per_day_time += float(dt)
            
            if abs(per_day_time % 86400) < 1e-6:
                per_day_time = 0.0
            if per_day_time >= 86400.0:
                per_day_time -= 86400.0
        else:
            # Cutoff - log minimal
            msg = f"Terminated: {cutoff_type.capitalize()} voltage cutoff (V_module={v_module:.3f}V)"
            print(f"⚠️ {msg}")
            
            log_to_history(
                history=history,
                dt=0.0,
                t_global=t_global,
                sim_SOC=sim_states['sim_SOC'],
                sim_V_term=sim_states['sim_V_term'],
                sim_OCV=sim_OCV,
                sim_V_RC1=sim_states['sim_V_RC1'],
                sim_V_RC2=sim_states['sim_V_RC2'],
                sim_R0=sim_R0,
                sim_R1=sim_R1,
                sim_R2=sim_R2,
                sim_C1=sim_C1,
                sim_C2=sim_C2,
                I_module_current=I_module_current,
                v_module=v_module,
                cum_energy_kWh=sim_states['cum_energy_kWh'],
                cum_qgen_Ws=sim_states['cum_qgen_Ws'],
                row_data=row_data,
                dc_trigger_col=dc_trigger_col,
                step_trigger_col=step_trigger_col,
                msg=msg
            )
            
            return row_idx + 1, t_global, per_day_time, True, True
        
        # Evaluate triggers
        if cutoff_hit:
            break
        
        should_break, new_row_idx = evaluate_and_handle_triggers(
            step_triggers=row_data['step_triggers'],
            dc_triggers=row_data['dc_triggers'],
            sim_SOC=sim_states['sim_SOC'],
            sim_V_term=sim_states['sim_V_term'],
            v_module=v_module,
            time_in_step=time_in_step,
            t_global=t_global,
            I_cells_step=I_cells_step,
            I_module_current=I_module_current,
            capacity_Ah=capacity_Ah,
            per_day_time=per_day_time,
            current_day=row_data['current_day'],
            parallel_groups=parallel_groups,
            dc_table=dc_table,
            row_idx=row_idx,
            current_subcycle=row_data['current_subcycle'],
            current_dc=row_data['current_dc']
        )
        
        if should_break:
            return new_row_idx, t_global, per_day_time, False, False
        
        # Check duration exit
        if (row_data['step_type'] in ["fixed", "fixed_with_triggers"] and time_in_step >= row_data['step_duration']) or row_data['use_batching']:
            return row_idx + 1, t_global, per_day_time, False, False
        
        if row_data['step_type'] == "trigger_only" and inner_iters % 86400 == 0:
            print(f"⚠️ trigger_only row {row_idx} no fire after {inner_iters} dt")
    
    return row_idx + 1, t_global, per_day_time, False, cutoff_hit

def testing_DC_table():
    data = {
        'Global Step Index': [1, 2, 3, 4],
        'Day_of_year': [1, 1, 1, 1],
        'DriveCycle_ID': ['test_dc', 'test_dc', 'test_dc', 'test_dc'],
        'drive cycle trigger': ['', '', '', ''],
        'Subcycle_ID': ['test_sub1', 'test_sub1', 'test_sub1', 'test_sub1'],
        'Subcycle Step Index': [1, 2, 3, 4],
        'Value Type': ['current', 'current', 'current', 'power'],
        'Value': [0.0, 10.0, -5.0, 100.0],
        'Unit': ['A', 'A', 'A', 'W'],
        'Step Type': ['fixed', 'fixed', 'fixed', 'fixed'],
        'Step Duration (s)': [10.0, 60.0, 30.0, 20.0],
        'Timestep (s)': [1.0, 1.0, 1.0, 1.0],
        'Ambient Temp (°C)': [25.0, 25.0, 25.0, 25.0],
        'Location': ['', '', '', ''],
        'step Trigger(s)': ['', '', '', ''],
        'Label': [
            'Idle Initialization',
            'Constant Discharge (10A)',
            'Constant Charge (5A)',
            'Power Load (100W)'
        ]
    }
    dc_table = pd.DataFrame(data)
    return dc_table

def run_electrical_solver(
    setup: Dict,
    # dc_table: pd.DataFrame,
    dc_table: pd.DataFrame,
    sim_id: str = None,
    filename: str = "simulation_results.csv",
    continuation_history: Optional[dict] = None,
    full_drive_df: Optional[pd.DataFrame] = None,
    original_start_row: int = 0,
    pack_id: str = None,
    dc_id: str = None
):
    """Run the electrical solver for the given setup and drive cycle table."""
    # Initialize simulation parameters
    sim_params = initialize_simulation(setup, testing_DC_table(), filename, sim_id)

    # Extract parameters from the returned dictionary
    cells = sim_params['cells']
    N_cells = sim_params['N_cells']
    capacity_Ah = sim_params['capacity_Ah']
    coulombic_eff = sim_params['coulombic_eff']
    parallel_groups = sim_params['parallel_groups']
    n_series = sim_params['n_series']
    R_p = sim_params['R_p']
    R_s = sim_params['R_s']
    HARD_V_cell_max = sim_params['HARD_V_cell_max']
    HARD_V_cell_min = sim_params['HARD_V_cell_min']
    HARD_V_pack_max = sim_params['HARD_V_pack_max']
    HARD_V_pack_min = sim_params['HARD_V_pack_min']
    v_limits = setup['voltage_limits']
    dc_table = sim_params['dc_table']
    n_rows = sim_params['n_rows']
    csv_mode = sim_params['csv_mode']
    last_written_timestep = sim_params['last_written_timestep']
    stop_signal_file = sim_params['stop_signal_file']
    pause_signal_file = sim_params['pause_signal_file']
    

    # Periodic write setup
    last_write_time = time.time()
    WRITE_INTERVAL = 20 # seconds (wall-clock)
    
    # Initial states
    sim_SOC = np.array([c['SOC'] for c in cells])
    sim_TempK = np.array([c['temperature'] for c in cells])
    sim_SOH = np.array([c['SOH'] for c in cells])
    sim_DCIR = np.array([c['DCIR_AgingFactor'] for c in cells])
    sim_V_RC1 = np.zeros(N_cells)
    sim_V_RC2 = np.zeros(N_cells)
    sim_V_term = np.zeros(N_cells)
    t_global = 0.0
    per_day_time = 0.0
    dt_base = 1
    max_t_global = setup.get('max_sim_time_s', 364 * 86400)
    
    # Continuation support
    if continuation_history:
        sim_SOC = np.array(continuation_history['SOC'])
        sim_V_RC1 = np.array(continuation_history['V_RC1'])
        sim_V_RC2 = np.array(continuation_history['V_RC2'])
        sim_V_term = np.array(continuation_history['Vterm'])
        cum_qgen_Ws = np.array(continuation_history['Qgen_cumulative'])
        cum_energy_kWh = np.array(continuation_history['energy_throughput'])
        t_global = continuation_history['t_global']
        per_day_time = t_global % 86400.0
        print(f"✓ Loaded continuation: t_global={t_global:.1f}s")
    else:
        cum_qgen_Ws = np.zeros(N_cells)
        cum_energy_kWh = np.zeros(N_cells)
    

    # History (store ALL timesteps, write periodically)
    history = {
        'dt': [], 't_global_s': [], 'SOC': [], 'Vterm': [], 'OCV': [], 'V_RC1': [], 'V_RC2': [],
        'V_R0': [], 'V_R1': [], 'V_R2': [], 'V_C1': [], 'V_C2': [], 'I_module': [], 'V_module': [],
        'energy_throughput': [], 'Qgen_cumulative': [],
        'Global Step Index': [], 'Day_of_year': [], 'DriveCycle_ID': [], 'Subcycle_ID': [], 'Subcycle Step Index': [],
        'Value Type': [], 'Value': [], 'Unit': [], 'Step Type': [], 'Label': [], 'Ambient Temp (°C)': [], 'Location': [],
        'drive cycle trigger': [], 'step Trigger(s)': [], 'termination_msg': [],
        'parallel_groups': parallel_groups,
    }

    # Trigger cols
    dc_trigger_col = find_col(dc_table.columns, ["drive cycle trigger", "drivecycletrigger", "dc_trigger"])
    step_trigger_col = find_col(dc_table.columns, ["step Trigger(s)", "step trigger", "step_triggers", "steptrigger(s)"])
    row_idx = 0
    sim_terminated = False
    stop_requested = False
    cutoff_row_guard = {}
    
    
    # === MAIN LOOP ===
    while row_idx < n_rows and not sim_terminated and t_global < max_t_global:
        # Handle pause signal
        should_terminate, csv_mode, last_written_timestep = handle_pause_signal(
            pause_signal_file=pause_signal_file,
            t_global=t_global,
            row_idx=row_idx,
            history=history,
            last_written_timestep=last_written_timestep,
            filename=filename,
            csv_mode=csv_mode,
            N_cells=N_cells,
            n_series=n_series,
            pack_id=pack_id,
            dc_id=dc_id,
            sim_id=sim_id,
            original_start_row=original_start_row
        )
        
        if should_terminate:
            sim_terminated = True
            break
        
        # Handle stop signal
        if handle_stop_signal(stop_signal_file, t_global, row_idx):
            stop_requested = True
            sim_terminated = True
            break
        
        # Periodic CSV write
        current_time = time.time()
        last_write_time, csv_mode, last_written_timestep = handle_periodic_write(
            current_time=current_time,
            last_write_time=last_write_time,
            write_interval=WRITE_INTERVAL,
            history=history,
            last_written_timestep=last_written_timestep,
            filename=filename,
            csv_mode=csv_mode,
            N_cells=N_cells,
            n_series=n_series
        )
        
        # Prepare simulation states
        sim_states = {
            'sim_SOC': sim_SOC,
            'sim_TempK': sim_TempK,
            'sim_SOH': sim_SOH,
            'sim_DCIR': sim_DCIR,
            'sim_V_RC1': sim_V_RC1,
            'sim_V_RC2': sim_V_RC2,
            'sim_V_term': sim_V_term,
            'cum_energy_kWh': cum_energy_kWh,
            'cum_qgen_Ws': cum_qgen_Ws
        }
        
        # Process single row
        row_idx, t_global, per_day_time, sim_terminated, cutoff_hit = process_single_row(
            row_idx=row_idx,
            dc_table=dc_table,
            dc_trigger_col=dc_trigger_col,
            step_trigger_col=step_trigger_col,
            dt_base=dt_base,
            sim_states=sim_states,
            cells=cells,
            capacity_Ah=capacity_Ah,
            coulombic_eff=coulombic_eff,
            parallel_groups=parallel_groups,
            n_series=n_series,
            R_p=R_p,
            R_s=R_s,
            HARD_V_cell_max=HARD_V_cell_max,
            HARD_V_cell_min=HARD_V_cell_min,
            HARD_V_pack_max=HARD_V_pack_max,
            HARD_V_pack_min=HARD_V_pack_min,
            history=history,
            cutoff_row_guard=cutoff_row_guard,
            t_global=t_global,
            per_day_time=per_day_time
        )
        
        if cutoff_hit:
            break
    # === END MAIN LOOP ===

    # === GLOBAL TIME CAP ===
    if t_global >= max_t_global:
        sim_terminated = True
        print(f"⏱️ Simulation terminated at year end: t={t_global:.1f}s")
    
    # === FINAL WRITE ===
    filename, total_timesteps, status = finalize_simulation(
        history=history,
        last_written_timestep=last_written_timestep,
        filename=filename,
        csv_mode=csv_mode,
        N_cells=N_cells,
        n_series=n_series,
        t_global=t_global,
        stop_requested=stop_requested,
        sim_terminated=sim_terminated,
        stop_signal_file=stop_signal_file,
        sim_id=sim_id
    )
    return filename
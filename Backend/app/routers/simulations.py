# FILE: Backend/app/routers/simulations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
import pandas as pd
import numpy as np
from datetime import datetime
from bson import ObjectId
import io
import os
from app.config import db, storage_manager, SIMULATIONS_DIR, DRIVE_CYCLES_DIR
from CoreLogic import NEW_data_processor as adp
from CoreLogic import NEW_electrical_solver as aes
import asyncio
import concurrent.futures
from app.models.simulation import InitialConditions, SimulationStatus
from fastapi.responses import StreamingResponse
import io
from pathlib import Path
import tempfile 
from typing import Optional
from io import StringIO
from app.utils.zip_utils import load_continuation_zip
router = APIRouter(tags=["simulations"])

async def inject_cell_config(pack_config: dict) -> dict:
    cell_id = pack_config.get("cell_id")
    if not cell_id:
        raise ValueError("Missing cell_id in pack_config")
    if not ObjectId.is_valid(cell_id):
        raise ValueError("Invalid cell_id format")
    cell_doc = await db.cells.find_one({"_id": ObjectId(cell_id)})
    if not cell_doc:
        raise ValueError("Cell not found")
    pack_config["cell"] = {
        "name": cell_doc.get("name", "Unknown Cell"),
        "form_factor": cell_doc.get("formFactor", "cylindrical"),
        "dims": cell_doc.get("dims", {}),
        "capacity": cell_doc.get("capacity", 0),
        "columbic_efficiency": cell_doc.get("columbic_efficiency", 1.0),
        "m_cell": cell_doc.get("cell_weight", 0),
        "m_jellyroll": cell_doc.get("cell_weight", 0) * 0.85,
        "cell_voltage_upper_limit": cell_doc.get("cell_upper_voltage_cutoff", 4.2),
        "cell_voltage_lower_limit": cell_doc.get("cell_lower_voltage_cutoff", 2.5),
        "cell_volume": cell_doc.get("cell_volume", 0.0),
        "rc_parameter_file_path": cell_doc.get("rc_parameter_file_path"),
        "rc_pair_type": cell_doc.get("rc_pair_type", "rc2"),
        "cell_nominal_voltage": cell_doc.get("cell_nominal_voltage", 3.7),
    }
    from CoreLogic.battery_params import load_cell_rc_data
    rc_path = pack_config["cell"]["rc_parameter_file_path"]
    if rc_path and await storage_manager.exists(rc_path):
        # Load file content
        rc_bytes = await storage_manager.load_file(rc_path)
        # For load_cell_rc_data, assume it takes file path, but since cloud, save temp local or modify
        # For simplicity, assume load_cell_rc_data can take bytes or path; here use temp file for local compat
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(rc_path).suffix) as tmp:
            tmp.write(rc_bytes)
            tmp_path = tmp.name
        try:
            pack_config["cell"]["rc_data"] = load_cell_rc_data(tmp_path, pack_config["cell"]["rc_pair_type"])
        finally:
            os.unlink(tmp_path)
    else:
        raise ValueError(f"RC file not found: {rc_path}")
    return pack_config

def _normalize_pack_for_core(pack: dict, initial_conditions: dict = None) -> dict:
    if not isinstance(pack, dict):
        return pack
    cell = pack.get("cell", {})
    norm_cell = {
        "formFactor": cell.get("form_factor", cell.get("formFactor")),
        "dims": cell.get("dims", {}),
        "capacity": float(cell.get("capacity", 0) or 0),
        "columbic_efficiency": float(cell.get("columbic_efficiency", 1) or 1),
        "m_cell": float(cell.get("m_cell", 0) or 0),
        "m_jellyroll": float(cell.get("m_jellyroll", 0) or 0),
        "cell_voltage_upper_limit": float(cell.get("cell_voltage_upper_limit", 0) or 0),
        "cell_voltage_lower_limit": float(cell.get("cell_voltage_lower_limit", 0) or 0),
        "cell_nominal_voltage": float(cell.get("cell_nominal_voltage", 3.7) or 3.7),
        "rc_data": cell.get("rc_data"),
    }
    layers = []
    for lyr in pack.get("layers", []):
        layers.append({
            "grid_type": lyr.get("grid_type"),
            "n_rows": int(lyr.get("n_rows", 0) or 0),
            "n_cols": int(lyr.get("n_cols", 0) or 0),
            "pitch_x": float(lyr.get("pitch_x", 0) or 0),
            "pitch_y": float(lyr.get("pitch_y", 0) or 0),
            "z_mode": lyr.get("z_mode", "explicit"),
            "z_center": lyr.get("z_center", 0),
        })
    init = initial_conditions or {}
    varying_conditions_normalized = []
    for vc in init.get("varying_conditions", []):
        varying_conditions_normalized.append({
            "cell_ids": vc.get("cell_ids", []),
            "temperature": float(vc.get("temperature", init.get("temperature", 300))),
            "soc": float(vc.get("soc", init.get("soc", 1))),
            "soh": float(vc.get("soh", init.get("soh", 1))),
            "dcir_aging_factor": float(vc.get("dcir_aging_factor", init.get("dcir_aging_factor", 1))),
        })
    return {
        "cell": norm_cell,
        "connection_type": pack.get("connection_type"),
        "R_p": float(pack.get("R_p", pack.get("r_p", 0.001)) or 0.001),
        "R_s": float(pack.get("R_s", pack.get("r_s", 0.001)) or 0.001),
        "voltage_limits": pack.get("voltage_limits", {}),
        "options": pack.get("options", {}),
        "constraints": pack.get("constraints", {}),
        "z_pitch": pack.get("z_pitch"),
        "layers": layers,
        "initial_conditions": {
            "temperature": float(init.get("temperature", 300)),
            "soc": float(init.get("soc", 1)),
            "soh": float(init.get("soh", 1)),
            "dcir_aging_factor": float(init.get("dcir_aging_factor", 1)),
            "varying_conditions": varying_conditions_normalized,
        },
    }

def compute_partial_summary(df: pd.DataFrame) -> dict:
    """FIXED: Use mean SOC at min/max time for pack-level summary."""
    if df.empty:
        return {"end_soc": 1.0, "max_temp": 25.0, "capacity_fade": 0.0}
    try:
        if 'time_global_s' not in df.columns or 'SOC' not in df.columns:
            return {"end_soc": 1.0, "max_temp": 25.0, "capacity_fade": 0.0}
        start_time = df['time_global_s'].min()
        end_time = df['time_global_s'].max()
        start_df = df[df['time_global_s'] == start_time]
        end_df = df[df['time_global_s'] == end_time]
        start_soc = start_df['SOC'].mean()
        end_soc = end_df['SOC'].mean()
        max_qgen = float(df["Qgen_cumulative"].max()) if "Qgen_cumulative" in df.columns else 0
        max_temp = round(max_qgen * 0.01 + 25, 2)
        capacity_fade = round(abs((start_soc - end_soc) / start_soc * 100) if start_soc > 0 else 0, 2)
        return {"end_soc": round(end_soc, 4), "max_temp": max_temp, "capacity_fade": capacity_fade}
    except Exception:
        return {"end_soc": 1.0, "max_temp": 25.0, "capacity_fade": 0.0}

async def run_sim_background(
    pack_config: dict,
    drive_df: pd.DataFrame, # Remaining DF (sliced)
    model_config: dict,
    sim_id: str,
    sim_name: str,
    sim_type: str,
    initial_conditions: dict,
    drive_cycle_id: str, # NEW: Added for pause ZIP
    continuation_zip_data: Optional[dict] = None,
    full_drive_df: Optional[pd.DataFrame] = None, # NEW: For pause
    original_start_row: int = 0 # NEW: For pause global row
):
    try:
        pack_config = await inject_cell_config(pack_config)
        csv_rel_path = f"{SIMULATIONS_DIR}/{sim_id}.csv"
        last_row = 0
        existing_df = pd.DataFrame()
        continuation_history = None
        full_df_for_pause = drive_df if full_drive_df is None else full_drive_df
        orig_start_row_for_pause = original_start_row
        pack_id = str(pack_config.get("_id") or pack_config.get("id", "unknown"))
    
        total_n_cells = sum(l.get("n_rows", 0) * l.get("n_cols", 0) for l in pack_config.get("layers", []))
    
        if continuation_zip_data:
            metadata, csv_str, last_row, existing_df = await load_continuation_zip(continuation_zip_data["zip_path"])
            if metadata:
                # NEW: Validate continuation data
                if not existing_df.empty:
                    last_time = existing_df['time_global_s'].max()
                    if 't_global' in metadata and metadata['t_global'] != last_time:
                        raise ValueError(f"t_global mismatch: metadata {metadata['t_global']} vs CSV {last_time}")
                  
                    last_rows = existing_df[existing_df['time_global_s'] == last_time]
                    if len(last_rows) != total_n_cells:
                        raise ValueError(f"Incomplete last timestep: {len(last_rows)} rows vs {total_n_cells} cells")
                  
                    required_cols = ['SOC', 'V_RC1', 'V_RC2', 'Vterm', 'Qgen_cumulative']
                    missing_cols = [col for col in required_cols if col not in last_rows.columns]
                    if missing_cols:
                        raise ValueError(f"Missing columns in continuation CSV: {missing_cols}")
              
                if not existing_df.empty and len(existing_df) >= total_n_cells:
                    last_timestep_rows = existing_df.tail(total_n_cells)
                    continuation_history = {
                        'SOC': last_timestep_rows['SOC'].tolist(),
                        'V_RC1': last_timestep_rows['V_RC1'].tolist(),
                        'V_RC2': last_timestep_rows['V_RC2'].tolist(),
                        'Vterm': last_timestep_rows['Vterm'].tolist(),
                        'Qgen_cumulative': last_timestep_rows['Qgen_cumulative'].tolist(),
                        'energy_throughput': last_timestep_rows['energy_throughput'].tolist() if 'energy_throughput' in existing_df.columns else [0.0] * total_n_cells,
                        't_global': float(existing_df['time_global_s'].max()),
                    }
                # FIXED: Restore partial CSV before solver (prevents overwrite)
                if not existing_df.empty:
                    csv_buffer = io.StringIO()
                    existing_df.to_csv(csv_buffer, index=False)
                    await storage_manager.save_file(csv_rel_path, csv_buffer.getvalue(), is_text=True)
                    print(f"Restored partial CSV on resume: {len(existing_df)} rows")
                print(f"Resuming from ZIP {continuation_zip_data['zip_path']}, global row {last_row}, existing rows {len(existing_df)}")
                initial_conditions["continuation_history"] = continuation_history
                full_df_for_pause = drive_df
                orig_start_row_for_pause = last_row
            else:
                print("Warning: Continuation ZIP invalid; starting fresh")
    
        # Touch equivalent (create empty file)
        await storage_manager.save_file(csv_rel_path, b"", is_text=False)
    
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {"status": "running", "file_csv": csv_rel_path, "updated_at": datetime.utcnow()}}
        )
    
        normalized_pack = _normalize_pack_for_core(pack_config, initial_conditions)
        setup = adp.create_setup_from_configs(normalized_pack, drive_df, model_config)
        
        loop = asyncio.get_running_loop()
        
        # ✅ NEW: Determine CSV path based on storage type
        if storage_manager.storage_type == "local":
            # For local storage: solver writes directly to storage directory
            csv_full_path = str(storage_manager.root / csv_rel_path)
            print(f"📁 Local storage: solver writing directly to {csv_full_path}")
            
            with concurrent.futures.ProcessPoolExecutor() as executor:
                await loop.run_in_executor(
                    executor,
                    aes.run_electrical_solver,
                    setup, drive_df, sim_id, csv_full_path, initial_conditions.get("continuation_history"),
                    full_df_for_pause, orig_start_row_for_pause, pack_id, drive_cycle_id
                )
        else:
            # For cloud storage: solver writes to temp, we sync periodically
            temp_csv_path = os.path.join(tempfile.gettempdir(), f"{sim_id}.csv")
            print(f"☁️ Cloud storage: solver writing to temp, syncing to {csv_rel_path}")
            
            sync_running = True
            
            async def sync_task():
                """Background task to sync temp file to cloud storage every 5 seconds"""
                while sync_running:
                    await asyncio.sleep(5)
                    if os.path.exists(temp_csv_path) and os.path.getsize(temp_csv_path) > 0:
                        try:
                            with open(temp_csv_path, 'r') as f:
                                content = f.read()
                            await storage_manager.save_file(csv_rel_path, content, is_text=True)
                            print(f"🔄 Synced {os.path.getsize(temp_csv_path)} bytes to cloud")
                        except Exception as e:
                            print(f"⚠️ Sync error: {e}")
            
            task = asyncio.create_task(sync_task())
            
            try:
                with concurrent.futures.ProcessPoolExecutor() as executor:
                    await loop.run_in_executor(
                        executor,
                        aes.run_electrical_solver,
                        setup, drive_df, sim_id, temp_csv_path, initial_conditions.get("continuation_history"),
                        full_df_for_pause, orig_start_row_for_pause, pack_id, drive_cycle_id
                    )
            finally:
                # Stop sync task
                sync_running = False
                try:
                    task.cancel()
                    await task
                except asyncio.CancelledError:
                    pass
                
                # Final sync
                if os.path.exists(temp_csv_path):
                    with open(temp_csv_path, 'r') as f:
                        content = f.read()
                    await storage_manager.save_file(csv_rel_path, content, is_text=True)
                    print(f"✅ Final sync: {len(content)} bytes to cloud")
                    os.unlink(temp_csv_path)
    
        # FIXED: Reload full CSV (handles append)
        csv_bytes = await storage_manager.load_file(csv_rel_path)
        full_csv_df = pd.read_csv(io.StringIO(csv_bytes.decode('utf-8')))
        summary = compute_partial_summary(full_csv_df)
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {
                "status": "completed",
                "metadata.summary": summary,
                "metadata.name": sim_name,
                "metadata.type": sim_type,
                "metadata.progress": 100.0,
                "metadata.pack_name": pack_config.get("name", "Unknown"),
                "updated_at": datetime.utcnow()
            }}
        )
        # Cleanup manual ZIP if used
        if continuation_zip_data and await storage_manager.exists(continuation_zip_data["zip_path"]):
            await storage_manager.delete_file(continuation_zip_data["zip_path"])
    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.utcnow()}}
        )


@router.post("/run", status_code=202)
async def run_simulation(request: dict, background_tasks: BackgroundTasks):
    pack_config = request.get("packConfig")
    model_config = request.get("modelConfig", {})
    sim_name = request.get("name", "Untitled Simulation")
    sim_type = request.get("type", "Generic")
    continuation_zip_data = request.get("continuation_zip_data", None)
    if not pack_config:
        raise HTTPException(status_code=400, detail="Missing 'packConfig' in request body")
    default_initial = {
        "temperature": 298.15,
        "soc": 0.8,
        "soh": 1.0,
        "dcir_aging_factor": 1.0,
        "varying_conditions": []
    }
    provided_initial = model_config.get("initial_conditions", {})
    initial_conditions = {**default_initial, **provided_initial}
    try:
        InitialConditions(**initial_conditions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid initial_conditions: {str(e)}")
    driveCycleCsv = request.get("driveCycleCsv")
    if not driveCycleCsv:
        raise HTTPException(status_code=400, detail="Missing 'driveCycleCsv' in request body")
    drive_cycle_source = request.get("driveCycleSource", {})
    drive_cycle_name = drive_cycle_source.get("name", "Unknown Drive Cycle")
    drive_cycle_id = drive_cycle_source.get("id", "unknown") if drive_cycle_source.get("type") == "database" else drive_cycle_source.get("filename", "unknown.csv")
    drive_cycle_file = f"{drive_cycle_name}.csv" if drive_cycle_source.get("type") == "database" else drive_cycle_source.get("filename", "unknown.csv")
    try:
        drive_df_original = pd.read_csv(StringIO(driveCycleCsv))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid driveCycleCsv format: {str(e)}")
  
    # Save original drive cycle to storage (without idle row)
    local_drive_rel = f"{DRIVE_CYCLES_DIR}/{drive_cycle_file}"
    drive_buffer = io.StringIO()
    drive_df_original.to_csv(drive_buffer, index=False)
    await storage_manager.save_file(local_drive_rel, drive_buffer.getvalue(), is_text=True)
    print(f"Saved drive cycle to storage: {local_drive_rel}")
  
    required = ["Global Step Index", "Day_of_year", "DriveCycle_ID", "Value Type", "Value", "Unit", "Step Type", "Step Duration (s)", "Timestep (s)"]
    missing = [c for c in required if c not in drive_df_original.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"driveCycleCsv missing required columns: {missing}")
    idle_row = pd.DataFrame([{
        'Global Step Index': 0, 'Day_of_year': 1, 'DriveCycle_ID': 'idle_init',
        'Value Type': 'current', 'Value': 0.0, 'Unit': 'A',
        'Step Type': 'fixed', 'Step Duration (s)': 0.1, 'Timestep (s)': 0.01,
        'Subcycle_ID': 'idle', 'Subcycle Step Index': 0,
        'Label': 'Idle Init', 'Ambient Temp (°C)': 20.0, 'Location': '',
        'drive cycle trigger': '', 'step Trigger(s)': ''
    }])
    drive_df = pd.concat([idle_row, drive_df_original], ignore_index=True)
    print(f"Prepended idle step; new DF shape: {drive_df.shape}")
    pack_id = str(pack_config.get("_id") or pack_config.get("id", "unknown"))
    pack_name = pack_config.get("name", "Unknown Pack")
    sim_doc = {
        "status": SimulationStatus.PENDING if not continuation_zip_data else SimulationStatus.RUNNING,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "pack_id": pack_id,
        "pack_name": pack_name,
        "drive_cycle_id": drive_cycle_id,
        "drive_cycle_name": drive_cycle_name,
        "drive_cycle_file": drive_cycle_file,
        "initial_conditions": initial_conditions,
        "metadata": {
            "name": sim_name,
            "type": sim_type,
            "progress": 0.0,
            "pack_name": pack_name,
        },
    }
    if continuation_zip_data:
        sim_doc["continuation_zip"] = continuation_zip_data.get("zip_path")
        sim_doc["last_executed_row"] = continuation_zip_data.get("last_row", 0)
        sim_doc["pause_metadata"] = {
            "pack_id": pack_id,
            "dc_id": drive_cycle_id
        }
    result = await db.simulations.insert_one(sim_doc)
    sim_id = str(result.inserted_id)
    background_tasks.add_task(
        run_sim_background,
        pack_config=pack_config,
        drive_df=drive_df,
        model_config=model_config,
        sim_id=sim_id,
        sim_name=sim_name,
        sim_type=sim_type,
        initial_conditions=initial_conditions,
        drive_cycle_id=drive_cycle_id,
        continuation_zip_data=continuation_zip_data,
        full_drive_df=drive_df,
        original_start_row=0 if not continuation_zip_data else continuation_zip_data.get("last_row", 0)
    )
    return {"simulation_id": sim_id, "status": "started" if not continuation_zip_data else "resumed"}

@router.post("/{sim_id}/stop")
async def stop_simulation(sim_id: str, background_tasks: BackgroundTasks):
    """Stop a running simulation using file-based signaling."""
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.get("status") not in ["running", "pending"]:
        raise HTTPException(status_code=400, detail="Simulation is not running")
    # Create stop signal file
    stop_signal_rel = f"{SIMULATIONS_DIR}/{sim_id}.stop"
    await storage_manager.save_file(stop_signal_rel, b"", is_text=False)
    print(f"🛑 Stop signal created: {stop_signal_rel}")
    # Update DB status
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {
            "status": "stopping",
            "updated_at": datetime.utcnow(),
            "metadata.stop_requested_at": datetime.utcnow()
        }}
    )
    # Background task to wait for solver completion and finalize
    background_tasks.add_task(finalize_stopped_simulation, sim_id)
    return {
        "simulation_id": sim_id,
        "status": "stopping",
        "message": "Stop signal sent. Solver will save data and terminate shortly."
    }

async def finalize_stopped_simulation(sim_id: str):
    """
    Background task: Wait for solver to finish, then update status to 'stopped'.
    Called after creating stop signal.
    """
    max_wait = 60 # Wait up to 60 seconds
    waited = 0
    while waited < max_wait:
        await asyncio.sleep(2)
        waited += 2
    
        sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
        if not sim:
            return
    
        csv_rel_path = sim.get("file_csv")
        stop_signal_rel = f"{SIMULATIONS_DIR}/{sim_id}.stop"
    
        # Check if solver has removed stop signal (indicates completion)
        if not await storage_manager.exists(stop_signal_rel):
            print(f"✓ Stop signal removed by solver for {sim_id}")
        
            # Compute partial summary
            partial_summary = {}
            if csv_rel_path and await storage_manager.exists(csv_rel_path):
                try:
                    csv_bytes = await storage_manager.load_file(csv_rel_path)
                    df = pd.read_csv(io.StringIO(csv_bytes.decode('utf-8')))
                    partial_summary = compute_partial_summary(df)
                except Exception as e:
                    print(f"⚠️ Could not compute partial summary: {e}")
        
            # Update final status
            await db.simulations.update_one(
                {"_id": ObjectId(sim_id)},
                {"$set": {
                    "status": "stopped",
                    "metadata.partial_summary": partial_summary,
                    "metadata.stopped_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }}
            )
        
            print(f"🏁 Simulation {sim_id} finalized as 'stopped'")
            return
    # Timeout - force update status
    print(f"⏱️ Timeout waiting for solver to stop {sim_id}")
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {
            "status": "stopped",
            "updated_at": datetime.utcnow()
        }}
    )

@router.get("/all")
async def list_simulations():
    # FIXED: Use aggregation pipeline to enable allowDiskUse=True for large sorts
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$limit": 100},
    ]
    sims = await db.simulations.aggregate(pipeline, allowDiskUse=True).to_list(100)
    return [{
        "_id": str(s["_id"]),
        "name": s.get("metadata", {}).get("name", "Untitled"),
        "type": s.get("metadata", {}).get("type", "Generic"),
        "status": s.get("status", "unknown"),
        "created_at": s.get("created_at"),
        "pack_name": s.get("pack_name"),
        "drive_cycle_name": s.get("drive_cycle_name"),
        "summary": s.get("metadata", {}).get("summary"),
        "progress": s.get("metadata", {}).get("progress", 0.0),
    } for s in sims]

@router.get("/{sim_id}")
async def get_simulation_status(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    sim["simulation_id"] = str(sim["_id"])
    del sim["_id"]
    return sim


@router.get("/{sim_id}/data")
async def get_simulation_data(
    sim_id: str,
    cell_id: int = 0,
    time_range: str = "full",
    max_points: int = 5000
):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    csv_rel_path = sim.get("file_csv") or f"{SIMULATIONS_DIR}/{sim_id}.csv"
    if not await storage_manager.exists(csv_rel_path):
        raise HTTPException(status_code=202, detail="Data not ready yet")
    
    try:
        csv_bytes = await storage_manager.load_file(csv_rel_path)
        
        # ✅ FIX: Handle empty CSV
        csv_content = csv_bytes.decode('utf-8').strip()
        if not csv_content or len(csv_content) < 10:  # Less than 10 chars = effectively empty
            raise HTTPException(status_code=202, detail="Data not ready yet - simulation starting")
        
        df = pd.read_csv(io.StringIO(csv_content))
        
        # ✅ FIX: Handle CSV with only headers (no data rows)
        if df.empty or len(df) == 0:
            raise HTTPException(status_code=202, detail="Data not ready yet - no timesteps recorded")
        
        if 'cell_id' not in df.columns:
            raise HTTPException(status_code=500, detail="CSV missing cell_id column")
        
        # Rest of the function remains the same...
        available_cells = sorted(df['cell_id'].unique())
        if cell_id not in available_cells:
            cell_id = available_cells[0]
        cell_df = df[df['cell_id'] == cell_id].copy()
        cell_df = cell_df.sort_values('time_global_s')
        t_min, t_max = cell_df['time_global_s'].min(), cell_df['time_global_s'].max()
        if time_range != "full":
            try:
                low, high = map(float, time_range.split("-"))
                cell_df = cell_df[(cell_df['time_global_s'] >= low) & (cell_df['time_global_s'] <= high)]
            except:
                raise HTTPException(status_code=400, detail="Invalid time_range format. Use 'start-end' or 'full'")
        total_points = len(cell_df)
        if total_points == 0:
            raise HTTPException(status_code=400, detail="No data in selected range")
        if total_points > max_points:
            step = max(1, total_points // max_points)
            cell_df = cell_df.iloc[::step]
        sampled_points = len(cell_df)
        data_points = []
        for _, row in cell_df.iterrows():
            data_points.append({
                "time": round(float(row['time_global_s'])),
                "voltage": round(float(row['Vterm']), 3),
                "soc": round(float(row['SOC']), 4),
                "current": round(float(row['I_module']), 2),
                "temperature": 25.0 + round(float(row.get('Qgen_cumulative', 0)) * 0.01, 2),
                "power": round(float(row['V_module'] * row['I_module']) / 1000, 2),
                "qgen": round(float(row.get('Qgen_cumulative', 0)), 2)
            })
        summary = sim.get("metadata", {}).get("summary", {})
        is_partial = sim.get("status") != "completed"
        return {
            "simulation_id": sim_id,
            "cell_id": int(cell_id),
            "available_cells": [int(c) for c in available_cells],
            "time_range": f"{t_min:.0f}-{t_max:.0f}",
            "total_points": total_points,
            "sampled_points": sampled_points,
            "sampling_ratio": total_points // sampled_points if sampled_points > 0 else 1,
            "data": data_points,
            "summary": summary,
            "is_partial": is_partial,
            "status": sim.get("status", "unknown"),
            "progress": sim.get("metadata", {}).get("progress", 100.0)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Error in /data:", traceback.format_exc())
        # ✅ FIX: If pandas throws EmptyDataError, return 202 instead of 500
        if "EmptyDataError" in str(type(e).__name__):
            raise HTTPException(status_code=202, detail="Data not ready yet - file being written")
        raise HTTPException(status_code=500, detail=f"Error processing data: {str(e)}")

@router.get("/{sim_id}/export")
async def export_simulation_data(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    csv_rel_path = sim.get("file_csv") or f"{SIMULATIONS_DIR}/{sim_id}.csv"
    if not await storage_manager.exists(csv_rel_path):
        raise HTTPException(status_code=404, detail="CSV not found")
    
    # FIXED: Load file content first, then create generator
    if storage_manager.storage_type == "local":
        def iterfile():
            full_path = storage_manager.root / csv_rel_path
            with open(full_path, "rb") as f:
                yield from f
    else:
        # For cloud storage, load entire file first
        content = await storage_manager.load_file(csv_rel_path)
        def iterfile():
            yield content
    
    return StreamingResponse(iterfile(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={sim_id}.csv"})
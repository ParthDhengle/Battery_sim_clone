# FILE: Backend/app/routers/simulations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, UploadFile, File
import os
import pandas as pd
import numpy as np
from datetime import datetime
from bson import ObjectId
from app.config import db
from CoreLogic import NEW_data_processor as adp
from CoreLogic import NEW_electrical_solver as aes
from pathlib import Path
import asyncio
import concurrent.futures
import json
import zipfile
import shutil
from app.models.simulation import InitialConditions, SimulationStatus
from fastapi.responses import StreamingResponse, FileResponse
from typing import Optional
router = APIRouter(prefix="/simulations", tags=["simulations"])
os.makedirs("simulations", exist_ok=True)
os.makedirs("continuations", exist_ok=True) # NEW: Dir for ZIP files
# -----------------------------------------------------
# HELPERS (unchanged from your working version)
# -----------------------------------------------------
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
        # FIXED: Add missing cell_nominal_voltage (default 3.7V if absent)
        "cell_nominal_voltage": cell_doc.get("cell_nominal_voltage", 3.7),
    }
    from CoreLogic.battery_params import load_cell_rc_data
    rc_path = pack_config["cell"]["rc_parameter_file_path"]
    if rc_path and os.path.exists("app" + rc_path):
        pack_config["cell"]["rc_data"] = load_cell_rc_data("app" + rc_path, pack_config["cell"]["rc_pair_type"])
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
        # FIXED: Propagate cell_nominal_voltage to normalized cell
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
    if df.empty:
        return {"end_soc": 1.0, "max_temp": 25.0, "capacity_fade": 0.0} # FIXED: Non-null defaults
    try:
        end_soc = float(df["SOC"].iloc[-1])
        max_qgen = float(df["Qgen_cumulative"].max()) if "Qgen_cumulative" in df.columns else 0
        max_temp = round(max_qgen * 0.01 + 25, 2)
        start_soc = float(df["SOC"].iloc[0])
        capacity_fade = round(abs((start_soc - end_soc) / start_soc * 100) if start_soc > 0 else 0, 2) # FIXED: Safe calc, default 0
        return {"end_soc": round(end_soc, 4), "max_temp": max_temp, "capacity_fade": capacity_fade}
    except Exception:
        return {"end_soc": 1.0, "max_temp": 25.0, "capacity_fade": 0.0}
# NEW: Helper to save continuation ZIP (CSV + JSON metadata, no file path in JSON)
async def save_continuation_zip(sim_id: str, last_row: int, dc_table: pd.DataFrame, pack_id: str, dc_id: str, csv_path: str):
    zip_path = os.path.join("continuations", f"{sim_id}_continuation.zip")
    metadata = {
        "pack_id": pack_id,
        "dc_id": dc_id,
        "last_executed_row": last_row,
        "dc_last_row_data": dc_table.iloc[last_row].to_dict() if last_row < len(dc_table) else None,
        "paused_at": datetime.utcnow().isoformat()
    }
    # Save metadata JSON
    metadata_json = zip_path.replace('.zip', '_metadata.json')
    with open(metadata_json, 'w') as f:
        json.dump(metadata, f, default=str) # Handle np arrays/datetimes
    # Create ZIP
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(csv_path, os.path.basename(csv_path)) # Half-completed CSV
        zf.write(metadata_json, 'metadata.json') # JSON without CSV path
    os.remove(metadata_json) # Cleanup temp JSON
    return zip_path
# NEW: Helper to load/extract from continuation ZIP
def load_continuation_zip(zip_path: str) -> tuple[Optional[dict], str, int, pd.DataFrame]:
    if not os.path.exists(zip_path):
        return None, None, 0, pd.DataFrame()
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # Extract CSV and JSON
        csv_name = [f for f in zf.namelist() if f.endswith('.csv')]
        json_name = [f for f in zf.namelist() if f.endswith('.json')]
        if not csv_name or not json_name:
            return None, None, 0, pd.DataFrame()
        csv_name = csv_name[0]
        json_name = json_name[0]
        extract_dir = "temp_extract"
        zf.extractall(extract_dir)
        csv_file = os.path.join(extract_dir, csv_name)
        json_file = os.path.join(extract_dir, json_name)
        with open(json_file, 'r') as f:
            metadata = json.load(f)
        df_csv = pd.read_csv(csv_file) if os.path.exists(csv_file) else pd.DataFrame()
        last_row = metadata.get("last_executed_row", 0)
        # Cleanup
        shutil.rmtree(extract_dir)
    return metadata, csv_file, last_row, df_csv
# -----------------------------------------------------
# BACKGROUND TASK (updated with ZIP continuation support)
# -----------------------------------------------------
async def run_sim_background(pack_config: dict, drive_df: pd.DataFrame, model_config: dict, sim_id: str, sim_name: str, sim_type: str, initial_conditions: dict, continuation_zip_data: Optional[dict] = None):
    try:
        pack_config = await inject_cell_config(pack_config)
        csv_path = os.path.join("simulations", f"{sim_id}.csv")
        zip_path = None
        last_row = 0
        existing_df = pd.DataFrame()
        continuation_history = None
        if continuation_zip_data:
            # Load from ZIP
            metadata, csv_file, last_row, existing_df = load_continuation_zip(continuation_zip_data["zip_path"])
            if metadata:
                # Prepare last states for solver (wide format for last timestep)
                N_cells = len(pack_config.get("layers", [{}])[0].get("n_rows", 1) * len(pack_config.get("layers", [{}])[0].get("n_cols", 1)))  # Approx N_cells
                if not existing_df.empty and len(existing_df) >= N_cells:
                    last_timestep_rows = existing_df.tail(N_cells)
                    continuation_history = {
                        'SOC': last_timestep_rows['SOC'].tolist(),
                        'V_RC1': last_timestep_rows['V_RC1'].tolist(),
                        'V_RC2': last_timestep_rows['V_RC2'].tolist(),
                        'Vterm': last_timestep_rows['Vterm'].tolist(),
                        'Qgen_cumulative': last_timestep_rows['Qgen_cumulative'].tolist(),
                        'energy_throughput': last_timestep_rows['energy_throughput'].tolist() if 'energy_throughput' in existing_df.columns else [0.0] * N_cells,
                        't_global': float(existing_df['time_global_s'].max()),
                    }
                zip_path = continuation_zip_data["zip_path"]
                print(f"Resuming from ZIP {zip_path}, row {last_row}, existing rows {len(existing_df)}")
                initial_conditions["continuation_history"] = continuation_history
            else:
                print("Warning: Continuation ZIP invalid; starting fresh")
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        if not os.path.exists(csv_path):
            Path(csv_path).touch()
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {"status": "running", "file_csv": csv_path, "updated_at": datetime.utcnow()}}
        )
        normalized_pack = _normalize_pack_for_core(pack_config, initial_conditions)
        remaining_df = drive_df.iloc[last_row:]
        setup = adp.create_setup_from_configs(normalized_pack, remaining_df, model_config) # Resume from last_row
        loop = asyncio.get_running_loop()
        with concurrent.futures.ProcessPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                aes.run_electrical_solver,
                setup, remaining_df, sim_id, csv_path, initial_conditions.get("continuation_history")
            )
        # Handle append if continuation
        new_df = pd.read_csv(csv_path)
        if not existing_df.empty:
            full_df = pd.concat([existing_df, new_df], ignore_index=True)
            full_df.to_csv(csv_path, index=False)
        summary = compute_partial_summary(pd.read_csv(csv_path))
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
        # Cleanup ZIP on success
        if zip_path and os.path.exists(zip_path):
            os.remove(zip_path)
    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.utcnow()}}
        )
# -----------------------------------------------------
# MAIN ENDPOINT - NOW MATCHES FRONTEND PAYLOAD
# -----------------------------------------------------
@router.post("/run", status_code=202)
async def run_simulation(request: dict, background_tasks: BackgroundTasks):
    # Frontend sends: packConfig, modelConfig, name, type
    pack_config = request.get("packConfig")
    model_config = request.get("modelConfig", {})
    sim_name = request.get("name", "Untitled Simulation")
    sim_type = request.get("type", "Generic")
    # UPDATED: Optional ZIP for manual
    continuation_zip_data = request.get("continuation_zip_data", None) # {zip_path: str} or uploaded ZIP
    if not pack_config:
        raise HTTPException(status_code=400, detail="Missing 'packConfig' in request body")
    # === Initial conditions: safe defaults + optional override ===
    default_initial = {
        "temperature": 298.15, # 25°C
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
    # === Hardcoded drive cycle (for current testing) ===
    dc_path = "app/TESTING_SIMULATION_CYCLE_88_20251217_143422_2345.csv"
    if not os.path.exists(dc_path):
        raise HTTPException(status_code=404, detail="Drive cycle file not found")
    drive_df = pd.read_csv(dc_path)
    required = ["Global Step Index", "Day_of_year", "DriveCycle_ID", "Value Type", "Value", "Unit", "Step Type", "Step Duration (s)", "Timestep (s)"]
    missing = [c for c in required if c not in drive_df.columns]
    if missing:
        raise ValueError(f"DB CSV missing required columns: {missing}")
    drive_cycle_id = "test_dc_id"
    drive_cycle_name = "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345"
    drive_cycle_file = "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345.csv"
  
    # NEW: Prepend idle step (I=0A) to avoid instant high-current cutoff
    idle_row = pd.DataFrame([{
        'Global Step Index': 0, 'Day_of_year': 1, 'DriveCycle_ID': 'idle_init',
        'Value Type': 'current', 'Value': 0.0, 'Unit': 'A',
        'Step Type': 'fixed', 'Step Duration (s)': 0.1, 'Timestep (s)': 0.01,
        'Subcycle_ID': 'idle', 'Subcycle Step Index': 0,
        'Label': 'Idle Init', 'Ambient Temp (°C)': 20.0, 'Location': '',
        'drive cycle trigger': '', 'step Trigger(s)': ''
    }])
    drive_df = pd.concat([idle_row, drive_df], ignore_index=True)
    print(f"Prepended idle step; new DF shape: {drive_df.shape}")
  
    # === Save simulation record ===
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
            "dc_id": drive_cycle_id # From request or ZIP
        }
    result = await db.simulations.insert_one(sim_doc)
    sim_id = str(result.inserted_id)
    # === Start background job ===
    background_tasks.add_task(
        run_sim_background,
        pack_config=pack_config,
        drive_df=drive_df,
        model_config=model_config,
        sim_id=sim_id,
        sim_name=sim_name,
        sim_type=sim_type,
        initial_conditions=initial_conditions,
        continuation_zip_data=continuation_zip_data
    )
    return {"simulation_id": sim_id, "status": "started" if not continuation_zip_data else "resumed"}
@router.post("/{sim_id}/stop")
async def stop_simulation(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.get("status") not in ["running", "pending"]:
        raise HTTPException(status_code=400, detail="Simulation not running")
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {"status": "stopped", "updated_at": datetime.utcnow()}}
    )
    return {"simulation_id": sim_id, "status": "stopped"}
@router.post("/{sim_id}/pause")
async def pause_simulation(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.get("status") not in [SimulationStatus.RUNNING, SimulationStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Simulation not pausable")
    # TODO: In prod, signal background task to pause and save state
    # For now, mock save
    csv_path = sim.get("file_csv")
    last_row = 0  # Mock; in real, from solver state
    if csv_path and os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        # Approximate last_row from CSV length / estimated steps per row
        last_row = len(df) // 100  # Mock approximation
    # Load dc_table for metadata
    dc_path = f"app{sim['drive_cycle_file']}"
    if os.path.exists(dc_path):
        dc_table = pd.read_csv(dc_path)
    else:
        dc_table = pd.DataFrame()  # Fallback
    # Mock history save (in real: from solver)
    mock_history = {"SOC": [1.0] * 100, "V_RC1": [0.0] * 100} # From solver state
    zip_path = await save_continuation_zip(sim_id, last_row, dc_table, sim["pack_id"], sim["drive_cycle_id"], csv_path)
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {
            "status": SimulationStatus.PAUSED,
            "continuation_zip": zip_path,
            "last_executed_row": last_row,
            "pause_metadata": {"pack_id": sim["pack_id"], "dc_id": sim["drive_cycle_id"]},
            "updated_at": datetime.utcnow()
        }}
    )
    return {"simulation_id": sim_id, "status": "paused", "continuation_zip": zip_path}
@router.post("/{sim_id}/resume")
async def resume_simulation(sim_id: str, zip_file: Optional[UploadFile] = File(None), background_tasks: BackgroundTasks):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim or sim.get("status") != SimulationStatus.PAUSED:
        raise HTTPException(status_code=400, detail="No pausable simulation found")
    zip_data = {"zip_path": sim["continuation_zip"]}
    last_row_from_zip = 0
    if zip_file: # Manual: Validate uploaded ZIP
        uploaded_zip = os.path.join("continuations", f"{sim_id}_manual.zip")
        with open(uploaded_zip, "wb") as f:
            content = await zip_file.read()
            f.write(content)
        # Validate: Extract and check pack_id/dc_id match pause_metadata
        metadata, _, last_row_from_zip, _ = load_continuation_zip(uploaded_zip)
        if not metadata or metadata["pack_id"] != sim["pause_metadata"]["pack_id"] or metadata["dc_id"] != sim["drive_cycle_id"]:
            os.remove(uploaded_zip)
            raise HTTPException(status_code=400, detail="Continuation ZIP mismatch")
        zip_data["zip_path"] = uploaded_zip
        zip_data["last_row"] = last_row_from_zip
    # Reload params for resume (similar to /run)
    pack_doc = await db.packs.find_one({"_id": ObjectId(sim["pack_id"])})  # Assume db.packs
    if not pack_doc:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack_config = pack_doc
    model_config = {}  # Default; in prod, store in sim_doc
    initial_conditions = sim["initial_conditions"]
    # Load drive_df (hardcoded for testing)
    dc_path = f"app{sim['drive_cycle_file']}"
    if not os.path.exists(dc_path):
        raise HTTPException(status_code=404, detail="Drive cycle file not found")
    drive_df = pd.read_csv(dc_path)
    # Prepend idle if fresh, but for resume, assume already included; skip for simplicity
    # Trigger resume background
    background_tasks.add_task(
        run_sim_background,
        pack_config=pack_config,
        drive_df=drive_df,
        model_config=model_config,
        sim_id=sim_id,
        sim_name=sim["metadata"]["name"],
        sim_type=sim["metadata"]["type"],
        initial_conditions=initial_conditions,
        continuation_zip_data=zip_data
    )
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)}, {"$set": {"status": SimulationStatus.RUNNING, "updated_at": datetime.utcnow()}}
    )
    return {"simulation_id": sim_id, "status": "resumed"}
@router.get("/{sim_id}/download-continuation")
async def download_continuation(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim or not sim.get("continuation_zip"):
        raise HTTPException(status_code=404, detail="No continuation ZIP")
    zip_path = sim["continuation_zip"]
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="ZIP not found")
    return FileResponse(zip_path, filename=f"{sim_id}_continuation.zip", media_type="application/zip")
@router.get("/all")
async def list_simulations():
    sims = await db.simulations.find().sort("created_at", -1).to_list(None)
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
    cell_id: int = 0, # Which cell to show (0 = first)
    time_range: str = "full", # e.g., "0-1000" or "full"
    max_points: int = 5000
):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
 
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
 
    csv_path = sim.get("file_csv") or os.path.join("simulations", f"{sim_id}.csv")
    if not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0:
        raise HTTPException(status_code=202, detail="Data not ready yet")
 
    try:
        # Load only needed columns for speed
        df = pd.read_csv(csv_path)
     
        if 'cell_id' not in df.columns:
            raise HTTPException(status_code=500, detail="CSV missing cell_id column")
     
        available_cells = sorted(df['cell_id'].unique())
        if cell_id not in available_cells:
            cell_id = available_cells[0] # Default to first cell
     
        cell_df = df[df['cell_id'] == cell_id].copy()
        cell_df = cell_df.sort_values('time_global_s')
     
        # Time range filtering
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
     
        # Downsample if too many points
        if total_points > max_points:
            step = max(1, total_points // max_points)
            cell_df = cell_df.iloc[::step]
     
        sampled_points = len(cell_df)
     
        # Build time-series data
        data_points = []
        for _, row in cell_df.iterrows():
            data_points.append({
                "time": round(float(row['time_global_s'])),
                "voltage": round(float(row['Vterm']), 3),
                "soc": round(float(row['SOC']), 4),
                "current": round(float(row['I_module']), 2),
                "temperature": 25.0 + round(float(row.get('Qgen_cumulative', 0)) * 0.01, 2), # Approx
                "power": round(float(row['V_module'] * row['I_module']) / 1000, 2) # kW
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
     
    except Exception as e:
        import traceback
        print("Error in /data:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing data: {str(e)}")
@router.get("/{sim_id}/export")
async def export_simulation_data(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    csv_path = sim.get("file_csv") or os.path.join("simulations", f"{sim_id}.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="CSV not found")
    def iterfile():
        with open(csv_path, "rb") as f:
            yield from f
    return StreamingResponse(iterfile(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={sim_id}.csv"})
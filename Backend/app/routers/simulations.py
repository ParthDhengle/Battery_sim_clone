# FILE: Backend/app/routers/simulations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
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
from app.models.simulation import InitialConditions
from fastapi.responses import StreamingResponse
router = APIRouter(prefix="/simulations", tags=["simulations"])
os.makedirs("simulations", exist_ok=True)
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
# -----------------------------------------------------
# BACKGROUND TASK (unchanged)
# -----------------------------------------------------
async def run_sim_background(pack_config: dict, drive_df: pd.DataFrame, model_config: dict, sim_id: str, sim_name: str, sim_type: str, initial_conditions: dict):
    try:
        pack_config = await inject_cell_config(pack_config)
        csv_path = os.path.join("simulations", f"{sim_id}.csv")
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        Path(csv_path).touch()
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {"status": "running", "file_csv": csv_path, "updated_at": datetime.utcnow()}}
        )
        normalized_pack = _normalize_pack_for_core(pack_config, initial_conditions)
        setup = adp.create_setup_from_configs(normalized_pack, drive_df, model_config)
        loop = asyncio.get_running_loop()
        with concurrent.futures.ProcessPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                aes.run_electrical_solver,
                setup, drive_df, sim_id, csv_path
            )
        df = pd.read_csv(csv_path)
        summary = compute_partial_summary(df)
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
    drive_cycle_csv = request.get("driveCycleCsv", "")
    drive_cycle_source = request.get("driveCycleSource", {})
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
    # === Handle drive cycle ===
    source_type = drive_cycle_source.get("type", "upload")
    if source_type == "upload":
        if not drive_cycle_csv.strip():
            raise HTTPException(status_code=400, detail="Missing driveCycleCsv for upload")
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        filename = f"user_upload_{timestamp}.csv"
        dc_dir = "app/uploads/simulation_cycle"
        os.makedirs(dc_dir, exist_ok=True)
        dc_path = os.path.join(dc_dir, filename)
        with open(dc_path, "w") as f:
            f.write(drive_cycle_csv)
        # Build mock full table from simple Time,Current
        simple_df = pd.read_csv(dc_path)
        if 'Time' not in simple_df.columns or 'Current' not in simple_df.columns:
            raise ValueError("Uploaded CSV missing Time or Current columns")
        time = simple_df['Time'].values
        I_module = simple_df['Current'].values
        # Build mock table
        drive_df = pd.DataFrame({
            'Global Step Index': range(1, len(time)+1),
            'Day_of_year': 1,
            'DriveCycle_ID': 'Uploaded DC',
            'Value Type': 'current',
            'Value': I_module,
            'Unit': 'A',
            'Step Type': 'fixed',
            'Step Duration (s)': np.diff(time, prepend=time[0]),
            'Timestep (s)': np.ones(len(time)) * (time[1]-time[0]) if len(time)>1 else [1.0],
            'Subcycle_ID': 'uploaded',
            'Subcycle Step Index': range(1, len(time)+1),
            'Label': ['Uploaded Step']*len(time),
            'Ambient Temp (°C)': 20.0,
            'Location': '',
            'drive cycle trigger': '',
            'step Trigger(s)': ''
        })
        drive_cycle_id = None
        drive_cycle_name = drive_cycle_source.get("name", "Uploaded CSV")
        drive_cycle_file = f"uploads/simulation_cycle/{filename}"
    elif source_type == "database":
        cycle_id = drive_cycle_source.get("id")
        if not cycle_id:
            raise HTTPException(status_code=400, detail="Missing id for database drive cycle")
        # FIX: Query by string _id (custom string, not ObjectId) and include deleted_at filter
        cycle = await db.simulation_cycles.find_one({"_id": cycle_id, "deleted_at": None})
        if not cycle:
            raise HTTPException(status_code=404, detail="Drive cycle not found")
        simulation_table_path = cycle.get("simulation_table_path")
        if not simulation_table_path:
            raise HTTPException(status_code=400, detail="No simulation table generated for this cycle")
        dc_path = f"app{simulation_table_path}"
        if not os.path.exists(dc_path):
            raise HTTPException(status_code=404, detail="Drive cycle file not found")
        drive_df = pd.read_csv(dc_path)
        required = ["Global Step Index", "Day_of_year", "DriveCycle_ID", "Value Type", "Value", "Unit", "Step Type", "Step Duration (s)", "Timestep (s)"]
        missing = [c for c in required if c not in drive_df.columns]
        if missing:
            raise ValueError(f"DB CSV missing required columns: {missing}")
        drive_cycle_id = cycle_id
        drive_cycle_name = cycle.get("name", "Unknown Cycle")
        drive_cycle_file = simulation_table_path
    else:
        raise HTTPException(status_code=400, detail="Invalid driveCycleSource type")
   
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
        "status": "pending",
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
        initial_conditions=initial_conditions
    )
    return {"simulation_id": sim_id, "status": "started"}

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
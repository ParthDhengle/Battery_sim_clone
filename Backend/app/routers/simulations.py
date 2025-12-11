# Backend/app/routers/simulations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
import os, io, sys, shutil
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
from app.models.simulation import InitialConditions, VaryingCellsCondition
from fastapi.responses import StreamingResponse
import json

BASE_DIR = Path(__file__).parent.parent.parent
CORE_CODE_DIR = BASE_DIR / "Core-python code"
sys.path.append(str(CORE_CODE_DIR))
router = APIRouter(prefix="/simulations", tags=["simulations"])
os.makedirs("simulations", exist_ok=True)

# -----------------------------------------------------
# HELPERS
# -----------------------------------------------------
async def inject_cell_config(pack_config: dict) -> dict:
    """Fetch cell by cell_id and inject into pack_config."""
    cell_id = pack_config.get("cell_id")
    if not cell_id:
        raise ValueError("Missing cell_id in pack_config")
    if not ObjectId.is_valid(cell_id):
        raise ValueError("Invalid cell_id format")
    cell_doc = await db.cells.find_one({"_id": ObjectId(cell_id)})
    if not cell_doc:
        raise ValueError("Cell not found")
    pack_config["cell"] = {
        "formFactor": cell_doc.get("formFactor", "cylindrical"),
        "dims": cell_doc.get("dims", {}),
        "capacity": cell_doc.get("capacity", 0),
        "columbic_efficiency": cell_doc.get("columbic_efficiency", 1.0),
        "m_cell": cell_doc.get("cell_weight", 0),
        "m_jellyroll": cell_doc.get("cell_weight", 0) * 0.85,
        "cell_voltage_upper_limit": cell_doc.get("cell_upper_voltage_cutoff", 0),
        "cell_voltage_lower_limit": cell_doc.get("cell_lower_voltage_cutoff", 0),
    }
    return pack_config

def _normalize_pack_for_core(pack: dict, initial_conditions: dict = None) -> dict:
    """Normalize API/DB pack (snake_case) into core engine schema (camelCase)."""
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
    """Compute summary from partial data."""
    if df.empty:
        return {"end_soc": None, "max_temp": None, "capacity_fade": None}
    
    try:
        end_soc = float(df["SOC"].iloc[-1])
        start_soc = float(df["SOC"].iloc[0])
        soc_diff = max(0, start_soc - end_soc)
        max_qgen = float(df["Qgen"].max())
        max_temp = round(max_qgen * 0.01 + 26.85, 2)
        capacity_fade = round(min(100, soc_diff * 100), 3)
        
        summary = {
            "end_soc": round(end_soc, 4),
            "max_temp": max_temp,
            "capacity_fade": capacity_fade
        }
        print(f"📊 Computed summary: SOC={end_soc:.4f}, Temp={max_temp}°C, Fade={capacity_fade}%")
        return summary
    except Exception as e:
        print(f"⚠️ Error computing partial summary: {e}")
        return {"end_soc": None, "max_temp": None, "capacity_fade": None}

# -----------------------------------------------------
# BACKGROUND SIMULATION EXECUTION WITH PROGRESS
# -----------------------------------------------------
async def run_sim_background(
    pack_config: dict, 
    drive_df: pd.DataFrame, 
    model_config: dict, 
    sim_id: str, 
    sim_name: str, 
    sim_type: str, 
    test: bool = False, 
    initial_conditions: dict = None
):
    try:
        pack_config = await inject_cell_config(pack_config)
        
        csv_path = os.path.join("simulations", f"{sim_id}.csv")
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        Path(csv_path).touch()
        
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {
                "status": "running",
                "file_csv": csv_path,
                "updated_at": datetime.utcnow(),
                "metadata.progress": 0.0
            }}
        )

        #==Simulation entry==
        print("⚡ Running full simulation with progress tracking...")
        normalized_pack = _normalize_pack_for_core(pack_config, initial_conditions)
        
        #==main data processor==
        setup = adp.create_setup_from_configs(normalized_pack, drive_df, model_config)
        
        # Run simulation with progress callback
        loop = asyncio.get_running_loop()
        with concurrent.futures.ProcessPoolExecutor() as executor:
            csv_path = await loop.run_in_executor(
                executor,
                aes.run_electrical_solver_with_progress,
                setup,
                csv_path,
                sim_id  # Pass sim_id for progress updates
            )
        
        print(f"✅ Simulation complete → Output saved at {csv_path}")
        sim_doc = await db.simulations.find_one({"_id": ObjectId(sim_id)})
        if not sim_doc:
            raise ValueError("Simulation document disappeared")
        # Compute final summary
        df = pd.read_csv(csv_path)
        summary = compute_partial_summary(df)
        drive_cycle_name = sim_doc.get("drive_cycle_name") or sim_doc.get("drive_cycle_file") or "Unknown Cycle"
        pack_name = sim_doc.get("pack_name") or "Unknown Pack"

        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {
                "status": "completed",
                "file_csv": csv_path,
                "metadata.summary": summary,
                "metadata.name": sim_name,
                "metadata.type": sim_type,
                "metadata.progress": 100.0,
                "metadata.pack_name": pack_config.get("name", "Unknown Pack"),
                "metadata.drive_cycle_name": drive_cycle_name,
                "updated_at": datetime.utcnow()
            }}
        )
        print(f"✅ Simulation {sim_name} ({sim_type}) completed and saved.")
        
    except Exception as e:
        print("❌ ERROR in run_sim_background:", e)
        import traceback
        traceback.print_exc()
        await db.simulations.update_one(
            {"_id": ObjectId(sim_id)},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "updated_at": datetime.utcnow()
            }}
        )

# -----------------------------------------------------
# START SIMULATION ENDPOINT
# -----------------------------------------------------
@router.post("/run", status_code=202)
async def run_simulation(request: dict, background_tasks: BackgroundTasks, test: bool = Query(False)):
    pack_config = request.get("packConfig")
    model_config = request.get("modelConfig")
    drive_cycle_csv = request.get("driveCycleCsv")
    drive_cycle_source = request.get("driveCycleSource") 
    initial_conditions = model_config.get("initial_conditions") if model_config else None
    sim_name = request.get("name", "Untitled Simulation")
    sim_type = request.get("type", "Generic")

    if not pack_config or not model_config or not drive_cycle_csv:
        raise HTTPException(status_code=400, detail="Missing required configurations")
    if not initial_conditions:
        raise HTTPException(status_code=400, detail="Missing initialConditions in modelConfig")

    # === Extract pack info ===
    pack_id = str(pack_config.get("_id") or pack_config.get("id"))
    pack_name = pack_config.get("name") or "Unnamed Pack"

    # === Extract drive cycle info ===
    drive_cycle_id = None
    drive_cycle_name = None
    drive_cycle_file = None

    if drive_cycle_source:
        if drive_cycle_source.get("type") == "upload":
            drive_cycle_file = drive_cycle_source.get("filename")
            drive_cycle_name = drive_cycle_file
        elif drive_cycle_source.get("type") == "database":
            drive_cycle_id = drive_cycle_source.get("id")
            drive_cycle_name = drive_cycle_source.get("name", "Database Cycle")
    else:
        # Fallback: guess from CSV content length + sessionStorage pattern
        if len(drive_cycle_csv) > 200 and "Time,Current" in drive_cycle_csv[:100]:
            guessed_name = "uploaded_drive_cycle.csv"
            drive_cycle_file = guessed_name
            drive_cycle_name = guessed_name

    try:
        drive_df = pd.read_csv(io.StringIO(drive_cycle_csv))
        if "Time" not in drive_df.columns or "Current" not in drive_df.columns:
            raise ValueError("Drive cycle CSV must contain 'Time' and 'Current' columns")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid drive cycle CSV: {e}")

    try:
        initial_conditions_obj = InitialConditions(**initial_conditions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid initialConditions: {e}")

    sim_doc = {
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "pack_id": pack_id,
        "pack_name": pack_name,
        "drive_cycle_id": drive_cycle_id,
        "drive_cycle_name": drive_cycle_name,
        "drive_cycle_file": drive_cycle_file,
        "initial_conditions": initial_conditions_obj.model_dump(),
        "metadata": {
            "name": sim_name,
            "type": sim_type,
            "progress": 0.0,
            "pack_name": pack_name,
            "drive_cycle_name": drive_cycle_name or "Unknown Cycle",
        },
    }
    result = await db.simulations.insert_one(sim_doc)
    sim_id = str(result.inserted_id)

    background_tasks.add_task(
        run_sim_background,
        pack_config,
        drive_df,
        model_config,
        sim_id,
        sim_name,
        sim_type,
        test,
        initial_conditions_obj.model_dump()
    )

    return {"simulation_id": sim_id, "status": "started"}
# -----------------------------------------------------
# STOP SIMULATION ENDPOINT
# -----------------------------------------------------
@router.post("/{sim_id}/stop")
async def stop_simulation(sim_id: str):
    """Stop a running simulation and mark it as stopped."""
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    if sim.get("status") not in ["running", "pending"]:
        raise HTTPException(status_code=400, detail="Simulation is not running")
    
    # Update status to stopped
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {
            "status": "stopped",
            "updated_at": datetime.utcnow(),
            "metadata.stopped_at": datetime.utcnow()
        }}
    )
    
    # Compute partial summary if CSV exists
    csv_path = sim.get("file_csv")
    partial_summary = {}
    if csv_path and os.path.exists(csv_path) and os.path.getsize(csv_path) > 0:
        try:
            df = pd.read_csv(csv_path)
            partial_summary = compute_partial_summary(df)
            await db.simulations.update_one(
                {"_id": ObjectId(sim_id)},
                {"$set": {"metadata.partial_summary": partial_summary}}
            )
        except Exception as e:
            print(f"⚠️ Could not compute partial summary: {e}")
    
    print(f"🛑 Simulation {sim_id} stopped by user")
    
    return {
        "simulation_id": sim_id,
        "status": "stopped",
        "message": "Simulation stopped successfully",
        "partial_summary": partial_summary
    }

# -----------------------------------------------------
# LIST ALL SIMULATIONS
# -----------------------------------------------------
@router.get("/all")
async def list_simulations():
    sims = await db.simulations.find().sort("created_at", -1).to_list(None)
    return [{
        "_id": str(s["_id"]),
        "name": s.get("metadata", {}).get("name", "Untitled Simulation"),
        "type": s.get("metadata", {}).get("type", "Generic"),
        "status": s.get("status", "unknown"),
        "created_at": s.get("created_at"),
        "pack_name": s.get("pack_name") or s.get("metadata", {}).get("pack_name"),
        "drive_cycle_name": s.get("drive_cycle_name") or s.get("metadata", {}).get("drive_cycle_name"),
        "drive_cycle_file": s.get("drive_cycle_file"),
        "summary": s.get("metadata", {}).get("summary"),
        "progress": s.get("metadata", {}).get("progress", 0.0),
    } for s in sims]
# -----------------------------------------------------
# GET SIMULATION STATUS WITH PROGRESS
# -----------------------------------------------------
@router.get("/{sim_id}")
async def get_simulation_status(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    # Check if CSV has data and compute partial summary
    csv_path = sim.get("file_csv")
    if csv_path and os.path.exists(csv_path) and os.path.getsize(csv_path) > 0:
        try:
            df = pd.read_csv(csv_path)
            if not df.empty and sim.get("status") == "running":
                partial_summary = compute_partial_summary(df)
                sim["metadata"]["partial_summary"] = partial_summary
        except Exception as e:
            print(f"⚠️ Could not read CSV for partial summary: {e}")
    
    sim["simulation_id"] = str(sim["_id"])
    del sim["_id"]
    return sim

# -----------------------------------------------------
# GET SIMULATION DATA WITH SAMPLING
# -----------------------------------------------------
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
    
    csv_path = sim.get("file_csv")
    if not csv_path or not os.path.exists(csv_path):
        csv_path = os.path.join("simulations", f"{sim_id}.csv")
    
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=500, detail=f"Simulation CSV not found for {sim_id}")
    
    if os.path.getsize(csv_path) == 0:
        raise HTTPException(status_code=202, detail="Simulation data not ready yet. Please wait.")
    
    try:
        df = pd.read_csv(csv_path, usecols=["cell_id", "time_step", "Vterm", "SOC", "Qgen", "dt", "I_module"])
        print(f"✅ Loaded CSV ({len(df)} rows, {df['cell_id'].nunique()} cells)")
        
        if cell_id not in df["cell_id"].values:
            cell_id = int(df["cell_id"].min())
            print(f"⚠️ Requested cell {cell_id} not found — defaulted to first cell")
        
        cell_df = df[df["cell_id"] == cell_id].sort_values("time_step").reset_index(drop=True)
        time_cum = np.cumsum(cell_df["dt"].fillna(1.0).values)
        
        low, high = 0.0, float(time_cum[-1])
        if time_range != "full":
            try:
                low, high = map(float, time_range.split("-"))
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid time_range format")
        
        mask = (time_cum >= low) & (time_cum <= high)
        cell_df, time_cum = cell_df.loc[mask], time_cum[mask]
        
        n = len(cell_df)
        if n == 0:
            raise HTTPException(status_code=400, detail="No data in selected time range")
        
        # Smart sampling to keep max_points
        if n > max_points:
            idx = np.linspace(0, n - 1, max_points, dtype=int)
            cell_df, time_cum = cell_df.iloc[idx], time_cum[idx]
        
        sampling_ratio = max(1, int(n / len(cell_df)))
        
        data = [{
            "time": int(round(float(time_cum[i]))),
            "voltage": float(getattr(row, "Vterm", 0.0)),
            "soc": float(getattr(row, "SOC", 1.0)),
            "current": float(getattr(row, "I_module", 0.0)),
            "qgen": float(getattr(row, "Qgen", 0.0)),
            "temp": 26.85
        } for i, row in enumerate(cell_df.itertuples(index=False))]
        
        print(f"✅ Returning {len(data)} points for cell {cell_id}")
        
        # Get summary (partial or final)
        summary = sim.get("metadata", {}).get("summary") or sim.get("metadata", {}).get("partial_summary", {})
        is_partial = sim.get("status") != "completed"
        
        return {
            "simulation_id": sim_id,
            "cell_id": cell_id,
            "time_range": f"{low:.2f} to {high:.2f}",
            "total_points": int(n),
            "sampled_points": len(data),
            "sampling_ratio": sampling_ratio,
            "data": data,
            "summary": summary,
            "is_partial": is_partial,
            "status": sim.get("status"),
            "progress": sim.get("metadata", {}).get("progress", 0.0)
        }
        
    except Exception as e:
        import traceback
        print("❌ ERROR in get_simulation_data:", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error reading simulation data: {e}")

# -----------------------------------------------------
# EXPORT SIMULATION DATA
# -----------------------------------------------------
@router.get("/{sim_id}/export")
async def export_simulation_data(sim_id: str):
    """Export simulation data as CSV file."""
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    csv_path = sim.get("file_csv")
    if not csv_path or not os.path.exists(csv_path):
        csv_path = os.path.join("simulations", f"{sim_id}.csv")
    
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Simulation CSV not found")
    
    if os.path.getsize(csv_path) == 0:
        raise HTTPException(status_code=400, detail="Simulation data not ready yet")
    
    def iter_file():
        with open(csv_path, 'rb') as f:
            yield from f
    
    sim_name = sim.get("metadata", {}).get("name", "simulation")
    filename = f"{sim_name.replace(' ', '_')}_{sim_id[:8]}.csv"
    
    return StreamingResponse(
        iter_file(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
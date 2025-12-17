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

BASE_DIR = Path(__file__).parent.parent.parent
CORE_CODE_DIR = BASE_DIR / "CoreLogic"

router = APIRouter(prefix="/simulations", tags=["simulations"])
os.makedirs("simulations", exist_ok=True)

# -----------------------------------------------------
# HELPERS
# -----------------------------------------------------
async def inject_cell_config(pack_config: dict) -> dict:
    """Fetch cell from DB by cell_id and inject full details + RC data into pack_config."""
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
    }
    # Load RC data
    from CoreLogic.battery_params import load_cell_rc_data
    rc_path = pack_config["cell"]["rc_parameter_file_path"]
    if rc_path and os.path.exists("app" + rc_path):
        pack_config["cell"]["rc_data"] = load_cell_rc_data("app" + rc_path, pack_config["cell"]["rc_pair_type"])
    else:
        raise ValueError(f"RC file not found: {rc_path}")
    return pack_config

def _normalize_pack_for_core(pack: dict, initial_conditions: dict = None) -> dict:
    """Convert DB/API pack format to core solver expected format."""
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
        return {"end_soc": None, "max_temp": None, "capacity_fade": None}
    try:
        end_soc = float(df["SOC"].mean()) if "SOC" in df.columns else None
        max_qgen = float(df["Qgen_cumulative"].max()) if "Qgen_cumulative" in df.columns else 0
        max_temp = round(max_qgen * 0.01 + 25, 2)  # Rough approximation
        return {
            "end_soc": round(end_soc, 4) if end_soc else None,
            "max_temp": max_temp,
            "capacity_fade": None,
        }
    except Exception:
        return {"end_soc": None, "max_temp": None, "capacity_fade": None}

# -----------------------------------------------------
# BACKGROUND TASK
# -----------------------------------------------------
async def run_sim_background(
    pack_config: dict,
    drive_df: pd.DataFrame,
    model_config: dict,
    sim_id: str,
    sim_name: str,
    sim_type: str,
    initial_conditions: dict
):
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
                "metadata.drive_cycle_name": "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345",
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
# ENDPOINTS
# -----------------------------------------------------
@router.post("/run", status_code=202)
async def run_simulation(request: dict, background_tasks: BackgroundTasks):
    pack_config = request.get("pack")
    model_config = request.get("simulation")
    initial_conditions = model_config.get("initial_conditions")
    sim_name = request.get("name", "Hardcoded Test Simulation")
    sim_type = request.get("type", "Generic")

    if not pack_config or not model_config:
        raise HTTPException(status_code=400, detail="Missing pack or simulation config")
    if not initial_conditions:
        raise HTTPException(status_code=400, detail="Missing initial_conditions")

    # === Hardcoded drive cycle path (for testing only) ===
    hardcoded_dc_path = "app/uploads/simulation_cycle/TESTING_SIMULATION_CYCLE_88_20251217_143422_2345.csv"
    if not os.path.exists(hardcoded_dc_path):
        raise HTTPException(status_code=500, detail=f"Hardcoded drive cycle file not found: {hardcoded_dc_path}")

    drive_df = pd.read_csv(hardcoded_dc_path)
    required_cols = ["Global Step Index", "Day_of_year", "DriveCycle_ID", "Value Type", "Value", "Unit", "Step Type", "Step Duration (s)", "Timestep (s)"]
    missing = [c for c in required_cols if c not in drive_df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns in drive cycle: {missing}")

    pack_id = str(pack_config.get("_id") or pack_config.get("id"))
    pack_name = pack_config.get("name", "Test Pack")

    try:
        InitialConditions(**initial_conditions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid initial_conditions: {e}")

    sim_doc = {
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "pack_id": pack_id,
        "pack_name": pack_name,
        "drive_cycle_name": "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345",
        "drive_cycle_file": "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345.csv",
        "initial_conditions": initial_conditions,
        "metadata": {
            "name": sim_name,
            "type": sim_type,
            "progress": 0.0,
            "pack_name": pack_name,
            "drive_cycle_name": "TESTING_SIMULATION_CYCLE_88_20251217_143422_2345",
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
        initial_conditions
    )

    return {"simulation_id": sim_id, "status": "started"}

# Remaining endpoints unchanged (stop, all, status, data, export)
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
async def get_simulation_data(sim_id: str, cell_id: int = 0, time_range: str = "full", max_points: int = 5000):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    csv_path = sim.get("file_csv") or os.path.join("simulations", f"{sim_id}.csv")
    if not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0:
        raise HTTPException(status_code=202, detail="Data not ready yet")
    df = pd.read_csv(csv_path)
    # Simplified response for testing
    return {"status": sim.get("status"), "rows": len(df), "columns": list(df.columns)}

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
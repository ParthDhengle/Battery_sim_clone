# FILE: Backend/app/routers/continuation.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
import os
import pandas as pd
from datetime import datetime
from bson import ObjectId
from app.config import db
from app.models.simulation import SimulationStatus
from fastapi.responses import FileResponse
from typing import Optional
from .simulations import run_sim_background, inject_cell_config, _normalize_pack_for_core
import json
import zipfile
import shutil
from io import StringIO

router = APIRouter(tags=["continuations"])

os.makedirs("continuations", exist_ok=True)

async def save_continuation_zip(sim_id: str, last_row: int, dc_table: pd.DataFrame, pack_id: str, dc_id: str, csv_path: str):
    zip_path = os.path.join("continuations", f"{sim_id}_continuation.zip")
    metadata = {
        "pack_id": pack_id,
        "dc_id": dc_id,
        "last_executed_row": last_row,
        "dc_last_row_data": dc_table.iloc[last_row].to_dict() if last_row < len(dc_table) else None,
        "paused_at": datetime.utcnow().isoformat()
    }
    metadata_json = zip_path.replace('.zip', '_metadata.json')
    with open(metadata_json, 'w') as f:
        json.dump(metadata, f, default=str)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(csv_path):
            zf.write(csv_path, os.path.basename(csv_path))
        zf.write(metadata_json, 'metadata.json')
    os.remove(metadata_json)
    return zip_path

def load_continuation_zip(zip_path: str) -> tuple[Optional[dict], str, int, pd.DataFrame]:
    if not os.path.exists(zip_path):
        return None, None, 0, pd.DataFrame()
    with zipfile.ZipFile(zip_path, 'r') as zf:
        csv_name = [f for f in zf.namelist() if f.endswith('.csv')]
        json_name = [f for f in zf.namelist() if f.endswith('.json')]
        if not json_name:
            return None, None, 0, pd.DataFrame()
        json_name = json_name[0]
        extract_dir = "temp_extract"
        zf.extractall(extract_dir)
        json_file = os.path.join(extract_dir, json_name)
        with open(json_file, 'r') as f:
            metadata = json.load(f)
        csv_file = os.path.join(extract_dir, csv_name[0]) if csv_name else None
        df_csv = pd.read_csv(csv_file) if csv_file and os.path.exists(csv_file) else pd.DataFrame()
        last_row = metadata.get("last_executed_row", 0)
        shutil.rmtree(extract_dir)
    return metadata, csv_file or "", last_row, df_csv

@router.post("/{sim_id}/pause")
async def pause_simulation(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.get("status") not in [SimulationStatus.RUNNING, SimulationStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Simulation not pausable")
    # UPDATED: Set to 'pausing' to signal solver to stop and save state
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {"status": "pausing", "updated_at": datetime.utcnow()}}
    )
    # NOTE: The background task/solver should detect 'pausing', save incomplete CSV, then set to 'paused'
    # For now, mock wait for 'paused' or immediate mock save
    # Mock: Assume after set, do the save
    csv_path = sim.get("file_csv")
    last_row = 0
    if csv_path and os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            last_row = len(df) // 100 if len(df) > 0 else 0
        except Exception as e:
            print(f"Warning: Could not read CSV for pause: {e}")
            last_row = 0
    drive_cycle_file = sim.get("drive_cycle_file", "")
    dc_path = f"app/{drive_cycle_file}" if drive_cycle_file else ""
    if os.path.exists(dc_path):
        dc_table = pd.read_csv(dc_path)
    else:
        dc_table = pd.DataFrame()
    zip_path = await save_continuation_zip(sim_id, last_row, dc_table, sim["pack_id"], sim["drive_cycle_id"], csv_path or "")
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
async def resume_simulation(
    sim_id: str,
    background_tasks: BackgroundTasks,
    zip_file: Optional[UploadFile] = File(None),
):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim or sim.get("status") != SimulationStatus.PAUSED:
        raise HTTPException(status_code=400, detail="No pausable simulation found")
    zip_data = {"zip_path": sim["continuation_zip"]}
    last_row_from_zip = 0
    if zip_file:
        uploaded_zip = os.path.join("continuations", f"{sim_id}_manual.zip")
        with open(uploaded_zip, "wb") as f:
            content = await zip_file.read()
            f.write(content)
        metadata, _, last_row_from_zip, _ = load_continuation_zip(uploaded_zip)
        if not metadata or metadata["pack_id"] != sim["pause_metadata"]["pack_id"] or metadata["dc_id"] != sim["drive_cycle_id"]:
            os.remove(uploaded_zip)
            raise HTTPException(status_code=400, detail="Continuation ZIP mismatch")
        zip_data["zip_path"] = uploaded_zip
        zip_data["last_row"] = last_row_from_zip
    pack_doc = await db.packs.find_one({"_id": ObjectId(sim["pack_id"])})
    if not pack_doc:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack_config = pack_doc
    model_config = {}
    initial_conditions = sim["initial_conditions"]
    # UPDATED: Use stored drive_cycle_csv
    driveCycleCsv = sim.get("drive_cycle_csv", "Global Step Index,Day_of_year,DriveCycle_ID,Value Type,Value,Unit,Step Type,Step Duration (s),Timestep (s)\n0,1,idle_init,current,0,A,fixed,0.1,0.01")
    drive_df = pd.read_csv(StringIO(driveCycleCsv))
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


from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
import os
import pandas as pd
from datetime import datetime
from bson import ObjectId
from app.config import db, SIMULATIONS_DIR, CONTINUATIONS_DIR, DRIVE_CYCLES_DIR
from app.models.simulation import SimulationStatus
from fastapi.responses import FileResponse
from typing import Optional
from app.routers.simulations import run_sim_background, compute_partial_summary
from app.utils.zip_utils import load_continuation_zip
import asyncio
from pathlib import Path

router = APIRouter(tags=["continuations"])

@router.post("/{sim_id}/pause")
async def pause_simulation(sim_id: str, background_tasks: BackgroundTasks):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.get("status") not in [SimulationStatus.RUNNING, SimulationStatus.PENDING]:
        raise HTTPException(status_code=400, detail="Simulation not pausable")
  
    pause_signal_file = os.path.join(SIMULATIONS_DIR, f"{sim_id}.pause")
    Path(pause_signal_file).touch()
    print(f"⏸️ Pause signal created: {pause_signal_file}")
  
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {"status": "pausing", "updated_at": datetime.utcnow(), "metadata.pause_requested_at": datetime.utcnow()}}
    )
  
    background_tasks.add_task(finalize_paused_simulation, sim_id)
  
    return {
        "simulation_id": sim_id,
        "status": "pausing",
        "message": "Pause signal sent. Solver will save state and pause shortly."
    }

async def finalize_paused_simulation(sim_id: str):
    max_wait = 60
    waited = 0
    pause_file = os.path.join(SIMULATIONS_DIR, f"{sim_id}.pause")
    zip_path = os.path.join(SIMULATIONS_DIR, f"{sim_id}_pause.zip")
  
    while waited < max_wait:
        await asyncio.sleep(2)
        waited += 2
      
        if not os.path.exists(pause_file):
            print(f"✓ Pause signal removed by solver for {sim_id}")
            if os.path.exists(zip_path):
                try:
                    metadata, _, last_row, existing_df = load_continuation_zip(zip_path)
                    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
                    if metadata and metadata.get("pack_id") == sim.get("pack_id") and metadata.get("dc_id") == sim.get("drive_cycle_id"):
                        partial_summary = compute_partial_summary(existing_df)
                        await db.simulations.update_one(
                            {"_id": ObjectId(sim_id)},
                            {"$set": {
                                "status": "paused",
                                "continuation_zip": zip_path,
                                "last_executed_row": last_row,
                                "metadata.partial_summary": partial_summary,
                                "metadata.paused_at": datetime.utcnow(),
                                "updated_at": datetime.utcnow()
                            }}
                        )
                        print(f"⏸️ Simulation {sim_id} finalized as 'paused' with ZIP {zip_path}")
                        return
                    else:
                        print("❌ Pause ZIP metadata mismatch")
                        if os.path.exists(zip_path):
                            os.remove(zip_path)
                except Exception as e:
                    print(f"⚠️ Could not load pause ZIP: {e}")
                    if os.path.exists(zip_path):
                        os.remove(zip_path)
            await db.simulations.update_one(
                {"_id": ObjectId(sim_id)},
                {"$set": {"status": "error", "error": "Pause failed: no valid ZIP created", "updated_at": datetime.utcnow()}}
            )
            return
  
    print(f"⏱️ Timeout waiting for pause {sim_id}")
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {"status": "paused", "updated_at": datetime.utcnow()}}
    )

@router.post("/{sim_id}/resume")
async def resume_simulation(
    sim_id: str,
    background_tasks: BackgroundTasks,
    zip_file: Optional[UploadFile] = File(None),
):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
  
    if not sim or sim.get("status") not in [SimulationStatus.PAUSED, "stopped"]:
        raise HTTPException(status_code=400, detail=f"Cannot resume simulation with status: {sim.get('status')}")
  
    drive_cycle_file = sim.get("drive_cycle_file")
    if not drive_cycle_file:
        raise HTTPException(status_code=500, detail="Missing drive_cycle_file in simulation document")
    local_drive_path = os.path.join(DRIVE_CYCLES_DIR, drive_cycle_file)
    if not os.path.exists(local_drive_path):
        raise HTTPException(status_code=404, detail="Drive cycle file not found in local storage")
    try:
        drive_df_original = pd.read_csv(local_drive_path)
        print(f"Loaded original drive cycle CSV from local storage: {len(drive_df_original)} rows")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read drive cycle file: {str(e)}")
  
    idle_row = pd.DataFrame([{
        'Global Step Index': 0, 'Day_of_year': 1, 'DriveCycle_ID': 'idle_init',
        'Value Type': 'current', 'Value': 0.0, 'Unit': 'A',
        'Step Type': 'fixed', 'Step Duration (s)': 0.1, 'Timestep (s)': 0.01,
        'Subcycle_ID': 'idle', 'Subcycle Step Index': 0,
        'Label': 'Idle Init', 'Ambient Temp (°C)': 20.0, 'Location': '',
        'drive cycle trigger': '', 'step Trigger(s)': ''
    }])
    drive_df_full = pd.concat([idle_row, drive_df_original], ignore_index=True)
  
    stored_zip_path = sim.get("continuation_zip")
    if not stored_zip_path or not os.path.exists(stored_zip_path):
        raise HTTPException(status_code=404, detail="No continuation ZIP found")
  
    metadata, _, last_row, existing_df = load_continuation_zip(stored_zip_path)
    if not metadata or metadata["pack_id"] != sim["pack_id"] or metadata["dc_id"] != sim["drive_cycle_id"]:
        raise HTTPException(status_code=400, detail="Stored ZIP metadata mismatch")
  
    zip_data = {"zip_path": stored_zip_path, "last_row": last_row}
  
    manual_zip_path = None
    if zip_file:
        manual_zip_path = os.path.join(CONTINUATIONS_DIR, f"{sim_id}_manual.zip")
        with open(manual_zip_path, "wb") as f:
            content = await zip_file.read()
            f.write(content)
        manual_metadata, _, manual_last_row, _ = load_continuation_zip(manual_zip_path)
        if not manual_metadata or manual_metadata["pack_id"] != sim["pack_id"] or manual_metadata["dc_id"] != sim["drive_cycle_id"]:
            if os.path.exists(manual_zip_path):
                os.remove(manual_zip_path)
            raise HTTPException(status_code=400, detail="Uploaded ZIP mismatch")
        zip_data["zip_path"] = manual_zip_path
        zip_data["last_row"] = manual_last_row
        print(f"Manual ZIP override: resuming from row {manual_last_row}")
  
    remaining_df = drive_df_full.iloc[last_row:]
    print(f"Resuming from global row {last_row}, remaining shape: {len(remaining_df)}")
  
    pack_doc = await db.packs.find_one({"_id": ObjectId(sim["pack_id"])})
    if not pack_doc:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack_config = pack_doc
  
    background_tasks.add_task(
        run_sim_background,
        pack_config=pack_config,
        drive_df=remaining_df,
        model_config={},
        sim_id=sim_id,
        sim_name=sim["metadata"].get("name", "Resumed Simulation"),
        sim_type=sim["metadata"].get("type", "Generic"),
        initial_conditions=sim["initial_conditions"],
        drive_cycle_id=sim["drive_cycle_id"],
        continuation_zip_data=zip_data,
        full_drive_df=drive_df_full,
        original_start_row=last_row
    )
  
    await db.simulations.update_one(
        {"_id": ObjectId(sim_id)},
        {"$set": {"status": SimulationStatus.RUNNING, "updated_at": datetime.utcnow()}}
    )
  
    return {"simulation_id": sim_id, "status": "resumed"}

@router.get("/{sim_id}/download-continuation")
async def download_continuation(sim_id: str):
    if not ObjectId.is_valid(sim_id):
        raise HTTPException(status_code=400, detail="Invalid simulation ID")
    sim = await db.simulations.find_one({"_id": ObjectId(sim_id)})
    if not sim or not sim.get("continuation_zip"):
        raise HTTPException(status_code=404, detail="No continuation ZIP available")
    zip_path = sim["continuation_zip"]
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Continuation ZIP file not found on server")
    return FileResponse(
        zip_path,
        filename=f"{sim_id}_continuation.zip",
        media_type="application/zip"
    )
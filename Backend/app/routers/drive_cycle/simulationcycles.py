# FILE: Backend/app/routers/drive_cycle/simulationcycles.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict
from app.config import db
from app.utils.simulation_generator import generate_simulation_csv
from app.utils.file_utils import save_csv_async
import os
router = APIRouter()
@router.post("/{sim_id}/generate", response_model=Dict)
async def generate_simulation_table(sim_id: str):
    """
    Generates full simulation cycle CSV using exact frontend logic
    and saves it to app/upload/simulation_cycle/{sim_id}.csv
    """
    sim = await db.simulation_cycles.find_one({"_id": sim_id, "deleted_at": None})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    # Generate CSV using ported frontend logic
    csv_content = await generate_simulation_csv(sim, db)
    # Save to local upload directory
    upload_dir = os.getenv("UPLOAD_DIR", "app/uploads/simulation_cycle")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{sim_id}.csv"
    # Use async file write
    await save_csv_async(sim_id, csv_content)
    # Update simulation document with path
    relative_path = f"/uploads/simulation_cycle/{sim_id}.csv"
    await db.simulation_cycles.update_one(
        {"_id": sim_id, "deleted_at": None},
        {"$set": {"simulation_table_path": relative_path}}
    )
    # Optional: return basic stats
    total_days = len(sim.get("calendar_assignments", []))
    total_drive_cycles = len(sim.get("drive_cycles_metadata", []))
    return {
        "message": "Simulation cycle generated and saved successfully",
        "path": relative_path,
        "totalDaysAssigned": total_days,
        "totalDriveCycles": total_drive_cycles,
        "fileSizeBytes": len(csv_content.encode('utf-8'))
    }
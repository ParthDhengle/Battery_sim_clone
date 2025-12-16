# FILE: Backend/app/routers/drive_cycle/manager.py
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict
from app.config import db
from app.models.simulation_cycle import SimulationCycle, SimulationCycleCreate, DriveCycleDefinition
from datetime import datetime
import uuid
import random
from app.utils.soft_delete import soft_delete_item
def generate_custom_id(prefix: str, timestamp: str, suffix: str = None) -> str:
    """Generate meaningful ID: prefix_timestamp_random"""
    random_num = f"{random.randint(1000, 9999):04d}"
    return f"{prefix}_{timestamp}_{random_num}"
class SubcycleIdsUpdate(BaseModel):
    subcycle_ids: List[str]
class CalendarUpdate(BaseModel):
    calendar_assignments: List[Dict]
router = APIRouter(
    prefix="/simulation-cycles",
    tags=["Simulation Cycles"],
    responses={404: {"description": "Not found"}},
)
@router.post("/", response_model=SimulationCycle)
async def create_simulation_cycle(sim_data: SimulationCycleCreate):
    """
    Initialize a new Simulation Cycle with custom ID.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    custom_id = generate_custom_id(sim_data.name.replace(" ", "_").upper(), timestamp)
    new_sim = sim_data.model_dump()
    new_sim["_id"] = custom_id  # Use string ID
    new_sim["created_at"] = datetime.utcnow()
    new_sim["updated_at"] = datetime.utcnow()
    new_sim["deleted_at"] = None
 
    await db.simulation_cycles.insert_one(new_sim)
    return SimulationCycle.model_validate(new_sim)
@router.get("/{id}", response_model=SimulationCycle)
async def get_simulation_cycle(id: str):
    sim = await db.simulation_cycles.find_one({"_id": id, "deleted_at": None})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return SimulationCycle.model_validate(sim)
@router.put("/{id}/subcycles", response_model=SimulationCycle)
async def update_simulation_subcycles(id: str, data: SubcycleIdsUpdate = Body(...)):
    """
    Update the list of subcycles available in this simulation.
    Validates that all subcycle IDs exist.
    """
    subcycle_ids = data.subcycle_ids
    # 1. Validate subcycle IDs exist
    unique_ids = set(subcycle_ids)
    count = await db.subcycles.count_documents({"_id": {"$in": list(unique_ids)}, "deleted_at": None})
    if count < len(unique_ids):
        # Log missing for debugging
        existing = await db.subcycles.find({"_id": {"$in": list(unique_ids)}, "deleted_at": None}).to_list(None)
        existing_set = {doc["_id"] for doc in existing}
        missing = unique_ids - existing_set
        print(f"Missing subcycle IDs in validation: {missing}") # Debug log
        raise HTTPException(status_code=400, detail=f"One or more Subcycle IDs are invalid: {list(missing)}")
    # 2. Update
    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id, "deleted_at": None},
        {
            "$set": {
                "subcycle_ids": subcycle_ids,
                "updated_at": datetime.utcnow()
            }
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return SimulationCycle.model_validate(result)
@router.put("/{id}/drive-cycles", response_model=SimulationCycle)
async def update_drive_cycles(id: str, definitions: List[DriveCycleDefinition] = Body(...)):
    """
    Update the list of Drive Cycle Definitions with full composition.
    Validates that all SubCycle IDs exist.
    """
    # Verify subcycle IDs
    all_sub_ids = set()
    for d in definitions:
        for row in d.composition:
            all_sub_ids.add(row.subcycleId)
 
    # Check distinct IDs existence in DB
    count = await db.subcycles.count_documents({"_id": {"$in": list(all_sub_ids)}, "deleted_at": None})
    if count != len(all_sub_ids):
        raise HTTPException(status_code=400, detail="One or more SubCycle IDs are invalid")
    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id, "deleted_at": None},
        {
            "$set": {
                "drive_cycles_metadata": [d.model_dump() for d in definitions],
                "updated_at": datetime.utcnow()
            }
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return SimulationCycle.model_validate(result)
@router.put("/{id}/calendar", response_model=SimulationCycle)
async def update_calendar(id: str, data: CalendarUpdate = Body(...)):
    """
    Update calendar assignments (Rules).
    """
    assignments = data.calendar_assignments
    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id, "deleted_at": None},
        {
            "$set": {
                "calendar_assignments": assignments,
                "updated_at": datetime.utcnow()
            }
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return SimulationCycle.model_validate(result)
@router.post("/{id}/generate")
async def generate_simulation_table(id: str):
    """
    Trigger generation of the CSV simulation table.
    """
    from app.utils.simulation_generator import generate_simulation_csv
    from app.utils.file_utils import save_csv_async
    sim = await db.simulation_cycles.find_one({"_id": id, "deleted_at": None})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    try:
        csv_content = await generate_simulation_csv(sim, db)
     
        # Save file with custom name
        relative_path = await save_csv_async(id, csv_content)
     
        # Update record with path
        await db.simulation_cycles.update_one(
            {"_id": id, "deleted_at": None},
            {"$set": {
                "simulation_table_path": relative_path,
                "updated_at": datetime.utcnow()
            }}
        )
     
        return {
            "message": "Simulation table generated successfully",
            "path": relative_path,
            "size_bytes": len(csv_content.encode('utf-8'))
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
@router.get("/", response_model=List[SimulationCycle])
async def list_simulation_cycles():
    cycles = await db.simulation_cycles.find({"deleted_at": None}).to_list(100)
    return [SimulationCycle.model_validate(c) for c in cycles]
@router.delete("/{id}", status_code=204)
async def delete_simulation_cycle(id: str):
    """
    Soft delete a simulation cycle.
    """
    try:
        result = await soft_delete_item("simulation_cycles", id, "simulation_cycle")
        if not result:
            raise HTTPException(status_code=404, detail="Simulation Cycle not found")
        return None
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
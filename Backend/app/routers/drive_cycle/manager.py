from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict
from app.config import db
from app.models.simulation_cycle import SimulationCycle, SimulationCycleCreate, DriveCycleDefinition
from datetime import datetime
import uuid

router = APIRouter(
    prefix="/simulation-cycles",
    tags=["Simulation Cycles"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=SimulationCycle)
async def create_simulation_cycle(sim_data: SimulationCycleCreate):
    """
    Initialize a new Simulation Cycle (or update if ID provided - simplified for now as Create New).
    """
    new_sim = sim_data.dict()
    new_sim["_id"] = str(uuid.uuid4())
    new_sim["created_at"] = datetime.utcnow()
    new_sim["updated_at"] = datetime.utcnow()
    
    await db.simulation_cycles.insert_one(new_sim)
    return new_sim

@router.get("/{id}", response_model=SimulationCycle)
async def get_simulation_cycle(id: str):
    sim = await db.simulation_cycles.find_one({"_id": id})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return sim

@router.put("/{id}/subcycles", response_model=SimulationCycle)
async def update_simulation_subcycles(id: str, subcycle_ids: List[str] = Body(..., embed=True)):
    """
    Update the list of subcycles available in this simulation.
    Validates that all subcycle IDs exist.
    """
    # 1. Validate subcycle IDs exist
    count = await db.subcycles.count_documents({"_id": {"$in": subcycle_ids}})
    if count != len(set(subcycle_ids)):
         raise HTTPException(status_code=400, detail="One or more Subcycle IDs are invalid")

    # 2. Update
    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id},
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
    return result

@router.put("/{id}/drive-cycles", response_model=SimulationCycle)
async def update_drive_cycles(id: str, definitions: List[DriveCycleDefinition]):
    """
    Update the list of Drive Cycle Definitions.
    Validates that all SubCycle IDs exist.
    """
    # Verify subcycle IDs
    all_sub_ids = set()
    for d in definitions:
        all_sub_ids.update(d.subcycle_ids)
    
    # Check distinct IDs existence in DB
    count = await db.subcycles.count_documents({"_id": {"$in": list(all_sub_ids)}})
    if count != len(all_sub_ids):
        raise HTTPException(status_code=400, detail="One or more SubCycle IDs are invalid")

    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id},
        {
            "$set": {
                "drive_cycles_metadata": [d.dict() for d in definitions],
                "updated_at": datetime.utcnow()
            }
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")
    return result

@router.put("/{id}/calendar", response_model=SimulationCycle)
async def update_calendar(id: str, assignments: List[Dict] = Body(...)):
    """
    Update calendar assignments (Rules).
    """
    result = await db.simulation_cycles.find_one_and_update(
        {"_id": id},
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
    return result

@router.post("/{id}/generate")
async def generate_simulation_table(id: str):
    """
    Trigger generation of the CSV simulation table.
    """
    from app.utils.simulation_generator import generate_simulation_csv
    from app.utils.file_utils import save_csv_async

    sim = await db.simulation_cycles.find_one({"_id": id})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation Cycle not found")

    try:
        csv_content = await generate_simulation_csv(sim, db)
        
        # Save file
        relative_path = await save_csv_async(id, csv_content)
        
        # Update record with path
        await db.simulation_cycles.update_one(
            {"_id": id},
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

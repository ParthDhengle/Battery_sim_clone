# FILE: Backend/app/routers/drive_cycle/subcycles.py
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional
from app.config import db
from app.models.subcycle import Subcycle, SubcycleCreate
from datetime import datetime
import random
from app.utils.soft_delete import soft_delete_item
def generate_subcycle_id(sim_name: Optional[str], sub_name: str, timestamp: str) -> str:
    """Generate meaningful ID: [sim_name_]sub_name_timestamp_random"""
    prefix = f"{sim_name}_" if sim_name else ""
    return f"{prefix}{sub_name.replace(' ', '_').upper()}_{timestamp}_{random.randint(1000, 9999):04d}"
router = APIRouter(
    prefix="/subcycles",
    tags=["Subcycles"],
    responses={404: {"description": "Not found"}},
)
@router.get("/", response_model=List[Subcycle])
async def list_subcycles():
    """
    List all available subcycles.
    """
    subcycles_cursor = db.subcycles.find({"deleted_at": None})
    subcycles = await subcycles_cursor.to_list(1000)
    return [Subcycle.model_validate(sc) for sc in subcycles]
@router.get("/{id}", response_model=Subcycle)
async def get_subcycle(id: str):
    """
    Get a specific subcycle by ID.
    """
    subcycle = await db.subcycles.find_one({"_id": id, "deleted_at": None})
    if not subcycle:
        raise HTTPException(status_code=404, detail="Subcycle not found")
    return Subcycle.model_validate(subcycle)
@router.post("/", response_model=Subcycle, status_code=201)
async def create_subcycle(subcycle: SubcycleCreate, sim_name: Optional[str] = None):
    """
    Create a new subcycle with custom ID. sim_name optional for prefixed ID.
    Validates name uniqueness.
    """
    # Check for name uniqueness
    existing = await db.subcycles.find_one({"name": subcycle.name, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Subcycle with this name already exists")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    custom_id = generate_subcycle_id(sim_name, subcycle.name, timestamp)
    new_subcycle = subcycle.model_dump()
    new_subcycle["_id"] = custom_id  # Use string ID
    new_subcycle["createdAt"] = datetime.utcnow()
    new_subcycle["updatedAt"] = datetime.utcnow()
    new_subcycle["deleted_at"] = None
    await db.subcycles.insert_one(new_subcycle)
    return Subcycle.model_validate(new_subcycle)
@router.put("/{id}", response_model=Subcycle)
async def update_subcycle(id: str, subcycle: SubcycleCreate):
    """
    Update a subcycle.
    """
    existing = await db.subcycles.find_one({"_id": id, "deleted_at": None})
    if not existing:
        raise HTTPException(status_code=404, detail="Subcycle not found")
    # Check for name uniqueness (excluding self)
    if subcycle.name != existing["name"]:
        name_existing = await db.subcycles.find_one({"name": subcycle.name, "deleted_at": None})
        if name_existing:
            raise HTTPException(status_code=400, detail="Subcycle with this name already exists")
    updated = subcycle.model_dump()
    updated["updatedAt"] = datetime.utcnow()
    result = await db.subcycles.find_one_and_update(
        {"_id": id, "deleted_at": None},
        {"$set": updated},
        return_document=True
    )
    return Subcycle.model_validate(result)
@router.delete("/{id}", status_code=204)
async def delete_subcycle(id: str):
    """
    Soft delete a subcycle.
    """
    try:
        result = await soft_delete_item("subcycles", id, "subcycle")
        if not result:
            raise HTTPException(status_code=404, detail="Subcycle not found")
        return None
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
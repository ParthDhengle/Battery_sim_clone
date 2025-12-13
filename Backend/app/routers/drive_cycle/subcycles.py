from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.config import db
from app.models.subcycle import Subcycle, SubcycleCreate
from datetime import datetime
import uuid

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
    subcycles = await db.subcycles.find().to_list(1000)
    return subcycles

@router.get("/{id}", response_model=Subcycle)
async def get_subcycle(id: str):
    """
    Get a specific subcycle by ID.
    """
    subcycle = await db.subcycles.find_one({"_id": id})
    if not subcycle:
        raise HTTPException(status_code=404, detail="Subcycle not found")
    return subcycle

@router.post("/", response_model=Subcycle, status_code=201)
async def create_subcycle(subcycle: SubcycleCreate):
    """
    Create a new subcycle.
    Validates name uniqueness.
    """
    # Check for name uniqueness
    existing = await db.subcycles.find_one({"name": subcycle.name})
    if existing:
        raise HTTPException(status_code=400, detail="Subcycle with this name already exists")

    new_subcycle = subcycle.dict()
    new_subcycle["_id"] = str(uuid.uuid4())
    new_subcycle["createdAt"] = datetime.utcnow()
    new_subcycle["updatedAt"] = datetime.utcnow()

    await db.subcycles.insert_one(new_subcycle)
    return new_subcycle

@router.delete("/{id}", status_code=204)
async def delete_subcycle(id: str):
    """
    Delete a subcycle.
    """
    result = await db.subcycles.delete_one({"_id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subcycle not found")
    return None

# FILE: Backend/app/routers/drive_cycle/subcycles.py
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional
from app.config import db
from app.models.subcycle import Subcycle, SubcycleCreate
from datetime import datetime
import random
import os
import json
import aiofiles
from app.utils.soft_delete import soft_delete_item
from pydantic import BaseModel

UPLOAD_SUBCYCLES_DIR = os.path.join(os.getenv("UPLOAD_DIR", "app/uploads"), "subcycles")
LARGE_THRESHOLD = int(os.getenv("LARGE_SUBCYCLE_THRESHOLD", "1000"))

class LightSubcycle(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source: str
    num_steps: Optional[int] = None
    total_duration: Optional[float] = None

def generate_subcycle_id(sim_name: Optional[str], sub_name: str, timestamp: str) -> str:
    """Generate meaningful ID: [sim_name_]sub_name_timestamp_random"""
    prefix = f"{sim_name}_" if sim_name else ""
    return f"{prefix}{sub_name.replace(' ', '_').upper()}_{timestamp}_{random.randint(1000, 9999):04d}"

async def save_steps_to_file(steps: list, file_id: str) -> str:
    """Save steps as JSON file and return relative path."""
    os.makedirs(UPLOAD_SUBCYCLES_DIR, exist_ok=True)
    abs_path = os.path.join(UPLOAD_SUBCYCLES_DIR, f"{file_id}.json")
    steps_data = [s.model_dump() for s in steps]  # Convert to dicts
    async with aiofiles.open(abs_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(steps_data, default=str, indent=2))
    return f"/uploads/subcycles/{file_id}.json"

async def load_steps_from_file(rel_path: str) -> list:
    """Load steps from JSON file."""
    file_id = os.path.basename(rel_path)
    abs_path = os.path.join(UPLOAD_SUBCYCLES_DIR, f"{file_id}")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Subcycle file not found")
    async with aiofiles.open(abs_path, "r", encoding="utf-8") as f:
        content = await f.read()
    steps_data = json.loads(content)
    return [Subcycle.model_validate({"steps": [Subcycle.model_validate(s).steps[0]]}).steps[0] for s in steps_data]  # Reconstruct

def compute_summary(steps: list) -> tuple:
    """Compute num_steps and total_duration."""
    num_s = len(steps)
    total_dur = sum(s.duration * s.repetitions for s in steps)
    return num_s, total_dur

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

@router.get("/light", response_model=List[LightSubcycle])
async def list_light_subcycles():
    """
    List lightweight subcycles (ID, name, summary only - no steps).
    """
    cursor = db.subcycles.find({"deleted_at": None}, {"steps": 0, "createdAt": 0, "updatedAt": 0, "deleted_at": 0})
    docs = await cursor.to_list(1000)
    return [LightSubcycle.model_validate(doc) for doc in docs]

@router.get("/{id}", response_model=Subcycle)
async def get_subcycle(id: str):
    """
    Get a specific subcycle by ID.
    """
    subcycle = await db.subcycles.find_one({"_id": id, "deleted_at": None})
    if not subcycle:
        raise HTTPException(status_code=404, detail="Subcycle not found")
    # Load steps if large import file
    if subcycle.get("source") == "import_file":
        try:
            steps = await load_steps_from_file(id)
            subcycle["steps"] = [s.model_dump() for s in steps]  # Set as dicts for validation
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load subcycle steps: {str(e)}")
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
    sub_name = subcycle.name
    num_s, total_dur = compute_summary(subcycle.steps)
    is_large_import = subcycle.source == "import" and num_s > LARGE_THRESHOLD
    new_subcycle = subcycle.model_dump()
    new_subcycle["num_steps"] = num_s
    new_subcycle["total_duration"] = total_dur
    new_subcycle["createdAt"] = datetime.utcnow()
    new_subcycle["updatedAt"] = datetime.utcnow()
    new_subcycle["deleted_at"] = None
    if is_large_import:
        # Save to file
        file_id = f"IMPORT_{sub_name.replace(' ', '_').upper()}_{timestamp}_{random.randint(1000, 9999):04d}"
        rel_path = await save_steps_to_file(subcycle.steps, file_id)
        new_subcycle["_id"] = rel_path
        new_subcycle["source"] = "import_file"
        new_subcycle["steps"] = []  # Empty in DB
    else:
        # Normal DB save
        custom_id = generate_subcycle_id(sim_name, sub_name, timestamp)
        new_subcycle["_id"] = custom_id
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
    # For large imports, updates are metadata-only (no steps change)
    if existing.get("source") == "import_file":
        updated = {
            "name": subcycle.name,
            "description": subcycle.description or "",
            "source": existing["source"],  # Keep import_file
            "updatedAt": datetime.utcnow()
        }
    else:
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
        # Optional: Delete file if import_file
        subcycle = await db.subcycles.find_one({"_id": id})  # Even if deleted
        if subcycle and subcycle.get("source") == "import_file":
            file_id = os.path.basename(subcycle["_id"])
            abs_path = os.path.join(UPLOAD_SUBCYCLES_DIR, f"{file_id}")
            if os.path.exists(abs_path):
                os.remove(abs_path)
        return None
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
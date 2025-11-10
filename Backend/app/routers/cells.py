from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId
from app.config import db
from app.models.cell import Cell, CellCreate
from datetime import datetime


router = APIRouter(prefix="/cells", tags=["cells"])


def serialize_cell(item: dict) -> dict:
    """Convert MongoDB document to API response format"""
    # Convert ObjectId to string
    if "_id" in item:
        item["id"] = str(item["_id"])
        del item["_id"]
    
    # Ensure dims is a dict
    if "dims" in item and not isinstance(item["dims"], dict):
        item["dims"] = dict(item["dims"])
    
    # Ensure soh_file is properly formatted
    if "soh_file" in item and item["soh_file"]:
        if not isinstance(item["soh_file"], dict):
            item["soh_file"] = dict(item["soh_file"])
    
    return item


@router.get("/", response_model=List[Cell])
async def get_cells():
    """Get all non-deleted cells"""
    try:
        cursor = db.cells.find({"deleted_at": None})
        cells = []
        async for item in cursor:
            cells.append(serialize_cell(item))
        return cells
    except Exception as e:
        print(f"❌ Error fetching cells: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{id}", response_model=Cell)
async def get_cell(id: str):
    """Get a single cell by ID"""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        item = await db.cells.find_one({"_id": ObjectId(id), "deleted_at": None})
        if not item:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        return serialize_cell(item)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/", response_model=Cell, status_code=201)
async def create_cell(cell: CellCreate):
    """Create a new cell"""
    try:
        # Convert Pydantic model to dict
        data = cell.model_dump(mode='json', by_alias=False)
        
        # Add timestamps
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["deleted_at"] = None
        
        # Insert into database
        result = await db.cells.insert_one(data)
        
        # Fetch the created document
        created = await db.cells.find_one({"_id": result.inserted_id})
        
        return serialize_cell(created)
    except Exception as e:
        print(f"❌ Error creating cell: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create cell: {str(e)}")


@router.put("/{id}", response_model=Cell)
async def update_cell(id: str, cell: CellCreate):
    """Update an existing cell"""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        # Convert Pydantic model to dict
        data = cell.model_dump(mode='json', by_alias=False, exclude_unset=True)
        data["updated_at"] = datetime.utcnow()
        
        # Update in database
        result = await db.cells.update_one(
            {"_id": ObjectId(id), "deleted_at": None},
            {"$set": data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        # Fetch updated document
        updated = await db.cells.find_one({"_id": ObjectId(id)})
        
        return serialize_cell(updated)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update cell: {str(e)}")


@router.delete("/{id}", status_code=204)
async def delete_cell(id: str):
    """Soft delete a cell"""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        result = await db.cells.update_one(
            {"_id": ObjectId(id), "deleted_at": None},
            {"$set": {"deleted_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete cell: {str(e)}")

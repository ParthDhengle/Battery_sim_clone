from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional, Literal
from bson import ObjectId
from app.config import db
from app.models.cell import Cell, CellCreate, SOHFile
from datetime import datetime
import os
import shutil
from pathlib import Path
from fastapi import File, UploadFile, Form
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/cells", tags=["cells"])

# Configure upload directory
UPLOAD_DIR = Path("app/uploads/rc-parameters")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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

@router.post("/with-rc-file", response_model=Cell, status_code=201)
async def create_cell_with_rc_file(
    name: str = Form(...),
    formFactor: Literal["cylindrical", "prismatic", "pouch", "coin"] = Form(...),
    radius: Optional[float] = Form(None),
    length: Optional[float] = Form(None),
    width: Optional[float] = Form(None),
    height: float = Form(...),
    cell_nominal_voltage: float = Form(...),
    cell_upper_voltage_cutoff: float = Form(...),
    cell_lower_voltage_cutoff: float = Form(...),
    capacity: float = Form(...),
    max_charging_current_continuous: Optional[float] = Form(None),
    max_charging_current_instantaneous: Optional[float] = Form(None),
    max_discharging_current_continuous: Optional[float] = Form(None),
    max_discharging_current_instantaneous: Optional[float] = Form(None),
    max_charge_voltage: Optional[float] = Form(None),
    columbic_efficiency: float = Form(1.0),
    cell_weight: float = Form(...),
    cell_volume: Optional[float] = Form(None),
    cost_per_cell: float = Form(0.0),
    anode_composition: str = Form(""),
    cathode_composition: str = Form(""),
    rc_pair_type: Optional[str] = Form(None),
    rc_parameter_file: Optional[UploadFile] = File(None),
):
    try:
        dims = {"height": height}
        if formFactor in ["cylindrical", "coin"]:
            if radius is None:
                raise HTTPException(400, detail="Radius required for cylindrical/coin cells")
            dims["radius"] = radius
        else:
            if length is None or width is None:
                raise HTTPException(400, detail="Length and width required for prismatic/pouch cells")
            dims["length"] = length
            dims["width"] = width

        rc_file_path = None
        if rc_parameter_file:
            file_ext = rc_parameter_file.filename.lower().split(".")[-1]
            if file_ext != "csv":
                raise HTTPException(400, detail="Only CSV files allowed")
            
            filename = f"{ObjectId()}_{rc_parameter_file.filename}"
            file_path = UPLOAD_DIR / filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(rc_parameter_file.file, buffer)
            rc_file_path = f"/uploads/rc-parameters/{filename}"

        data = {
            "name": name,
            "formFactor": formFactor,
            "dims": dims,
            "cell_nominal_voltage": cell_nominal_voltage,
            "cell_upper_voltage_cutoff": cell_upper_voltage_cutoff,
            "cell_lower_voltage_cutoff": cell_lower_voltage_cutoff,
            "capacity": capacity,
            "max_charging_current_continuous": max_charging_current_continuous or 0,
            "max_charging_current_instantaneous": max_charging_current_instantaneous or 0,
            "max_discharging_current_continuous": max_discharging_current_continuous or 0,
            "max_discharging_current_instantaneous": max_discharging_current_instantaneous or 0,
            "max_charge_voltage": max_charge_voltage or 0,
            "columbic_efficiency": columbic_efficiency,
            "cell_weight": cell_weight,
            "cell_volume": cell_volume or 0,
            "cost_per_cell": cost_per_cell,
            "anode_composition": anode_composition,
            "cathode_composition": cathode_composition,
            "rc_pair_type": rc_pair_type,
            "rc_parameter_file_path": rc_file_path,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted_at": None,
        }

        result = await db.cells.insert_one(data)
        created = await db.cells.find_one({"_id": result.inserted_id})
        return serialize_cell(created)

    except Exception as e:
        print(f"Error creating cell with RC file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-rc-file/{cell_id}")
async def upload_rc_file(
    cell_id: str,
    file: UploadFile = File(...),
    rc_pair_type: str = Form(...)
):
    """Upload RC parameter file for a cell"""
    if not ObjectId.is_valid(cell_id):
        raise HTTPException(status_code=400, detail="Invalid cell ID format")
    
    # Validate RC pair type
    if rc_pair_type not in ["rc2", "rc3"]:
        raise HTTPException(status_code=400, detail="Invalid RC pair type. Must be 'rc2' or 'rc3'")
    
    # Validate file type
    allowed_extensions = [".csv", ".json", ".mat"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{cell_id}_{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / safe_filename
        
        # Save file locally
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create SOHFile object
        soh_file_data = {
            "name": file.filename,
            "path": str(file_path),
            "type": file_ext[1:],  # Remove the dot
            "rc_pair_type": rc_pair_type
        }
        
        # Update cell in database
        result = await db.cells.update_one(
            {"_id": ObjectId(cell_id), "deleted_at": None},
            {
                "$set": {
                    "soh_file": soh_file_data,
                    "rc_pair_type": rc_pair_type,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            # Clean up uploaded file if cell not found
            os.remove(file_path)
            raise HTTPException(status_code=404, detail="Cell not found")
        
        return {
            "message": "File uploaded successfully",
            "file": soh_file_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error uploading file: {e}")
        # Clean up file if something went wrong
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


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
        # Get cell data to delete associated file
        cell = await db.cells.find_one({"_id": ObjectId(id), "deleted_at": None})
        
        if not cell:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        # Delete associated RC parameter file if exists
        if cell.get("soh_file") and cell["soh_file"].get("path"):
            file_path = Path(cell["soh_file"]["path"])
            if file_path.exists():
                os.remove(file_path)
        
        # Soft delete the cell
        result = await db.cells.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"deleted_at": datetime.utcnow()}}
        )
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete cell: {str(e)}")
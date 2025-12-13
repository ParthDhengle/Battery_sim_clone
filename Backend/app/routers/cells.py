from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional, Literal
from bson import ObjectId
from app.config import db
from app.models.cell import Cell,CellUpdate, CellCreate, CellDimensions
from datetime import datetime
import os
import shutil
from pathlib import Path
import math

router = APIRouter(prefix="/cells", tags=["cells"])

# Configure upload directory
UPLOAD_DIR = Path("app/uploads/rc-parameters")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def serialize_cell(item: dict) -> dict:
    """Convert MongoDB document to API response format"""
    if "_id" in item:
        item["id"] = str(item["_id"])
        del item["_id"]
    
    # Ensure dims is properly formatted
    if "dims" in item and not isinstance(item["dims"], dict):
        item["dims"] = dict(item["dims"])
    
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
async def create_cell(
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
    max_charging_current_continuous: Optional[float] = Form(0.0),
    max_charging_current_instantaneous: Optional[float] = Form(0.0),
    max_discharging_current_continuous: Optional[float] = Form(0.0),
    max_discharging_current_instantaneous: Optional[float] = Form(0.0),
    max_charge_voltage: Optional[float] = Form(0.0),
    columbic_efficiency: float = Form(1.0),
    cell_weight: float = Form(...),
    cost_per_cell: float = Form(0.0),
    anode_composition: str = Form(""),
    cathode_composition: str = Form(""),
    rc_pair_type: Optional[Literal["rc2", "rc3"]] = Form(None),
    rc_parameter_file: Optional[UploadFile] = File(None),
):
    print("=" * 80)
    print("🔵 ENDPOINT HIT - Request received!")
    print(f"Name: {name}")
    print(f"Form Factor: {formFactor}")
    print(f"RC File: {rc_parameter_file.filename if rc_parameter_file else 'None'}")
    print("=" * 80)
    
    try:
        # Build dimensions based on form factor
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
        
        # Calculate and store cell volume in m³
        if formFactor in ["cylindrical", "coin"]:
            radius_m = radius / 1000
            height_m = height / 1000
            volume_m3 = math.pi * radius_m ** 2 * height_m
        else:  # prismatic or pouch
            length_m = length / 1000
            width_m = width / 1000
            height_m = height / 1000
            volume_m3 = length_m * width_m * height_m


        # Handle RC parameter file upload
        rc_file_path = None
        if rc_parameter_file and rc_parameter_file.filename:
            print(f"📎 Processing RC file: {rc_parameter_file.filename}")
            
            # Validate file extension
            file_ext = rc_parameter_file.filename.lower().split(".")[-1]
            print(f"📎 File extension: {file_ext}")
            
            if file_ext not in ["csv", "json", "mat"]:
                print(f"❌ Invalid file extension: {file_ext}")
                raise HTTPException(400, detail="Only CSV, JSON, or MAT files allowed for RC parameters")
            
            # Generate unique filename with timestamp
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            safe_filename = f"{timestamp}_{rc_parameter_file.filename}"
            file_path = UPLOAD_DIR / safe_filename
            
            print(f"💾 Saving file to: {file_path}")
            
            # Save file
            try:
                content = await rc_parameter_file.read()
                print(f"📦 File size: {len(content)} bytes")
                
                with open(file_path, "wb") as buffer:
                    buffer.write(content)
                
                print(f"✅ File saved successfully")
            except Exception as file_err:
                print(f"❌ File save error: {file_err}")
                raise HTTPException(500, detail=f"Failed to save file: {str(file_err)}")
            
            # Store relative path for API access
            rc_file_path = f"/uploads/rc-parameters/{safe_filename}"
            print(f"🔗 File path stored as: {rc_file_path}")

        # Build cell data
        data = {
            "name": name,
            "formFactor": formFactor,
            "dims": dims,
            "cell_nominal_voltage": cell_nominal_voltage,
            "cell_upper_voltage_cutoff": cell_upper_voltage_cutoff,
            "cell_lower_voltage_cutoff": cell_lower_voltage_cutoff,
            "capacity": capacity,
            "max_charging_current_continuous": max_charging_current_continuous,
            "max_charging_current_instantaneous": max_charging_current_instantaneous,
            "max_discharging_current_continuous": max_discharging_current_continuous,
            "max_discharging_current_instantaneous": max_discharging_current_instantaneous,
            "max_charge_voltage": max_charge_voltage,
            "columbic_efficiency": columbic_efficiency,
            "cell_weight": cell_weight,
            "cell_volume": volume_m3,
            "cost_per_cell": cost_per_cell,
            "anode_composition": anode_composition,
            "cathode_composition": cathode_composition,
            "rc_pair_type": rc_pair_type,
            "rc_parameter_file_path": rc_file_path,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted_at": None,
        }

        # Insert into database
        print(f"💾 Inserting into database...")
        result = await db.cells.insert_one(data)
        print(f"✅ Inserted with ID: {result.inserted_id}")
        
        created = await db.cells.find_one({"_id": result.inserted_id})
        print(f"✅ Cell created successfully")
        print("=" * 80)
        
        return serialize_cell(created)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating cell with RC file: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create cell: {str(e)}")

@router.post("/upload-rc-file/{cell_id}")
async def upload_rc_file(
    cell_id: str,
    file: UploadFile = File(...),
    rc_pair_type: Literal["rc2", "rc3"] = Form(...)
):
    """Upload or update RC parameter file for an existing cell"""
    if not ObjectId.is_valid(cell_id):
        raise HTTPException(status_code=400, detail="Invalid cell ID format")
    
    # Validate file type
    allowed_extensions = ["csv", "json", "mat"]
    file_ext = os.path.splitext(file.filename)[1].lower()[1:]  # Remove dot
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Check if cell exists
        cell = await db.cells.find_one({"_id": ObjectId(cell_id), "deleted_at": None})
        if not cell:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        # Delete old RC parameter file if exists
        if cell.get("rc_parameter_file_path"):
            old_file_path = Path("app" + cell["rc_parameter_file_path"])
            if old_file_path.exists():
                os.remove(old_file_path)
                print(f"🗑️ Deleted old RC file: {old_file_path}")
        
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{cell_id}_{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / safe_filename
        
        # Save new file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Relative path for API access
        rc_file_path = f"/uploads/rc-parameters/{safe_filename}"
        
        # Update cell in database
        result = await db.cells.update_one(
            {"_id": ObjectId(cell_id), "deleted_at": None},
            {
                "$set": {
                    "rc_pair_type": rc_pair_type,
                    "rc_parameter_file_path": rc_file_path,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "message": "RC parameter file uploaded successfully",
            "cell_id": cell_id,
            "rc_pair_type": rc_pair_type,
            "file_path": rc_file_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error uploading RC file: {e}")
        # Clean up file if something went wrong
        if 'file_path' in locals() and Path(file_path).exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.put("/{id}", response_model=Cell)
async def update_cell(id: str, cell: CellUpdate):  # ← Use CellUpdate!
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        # Only include fields that were actually provided
        update_data = cell.model_dump(exclude_unset=True)  # This is correct!

        if not update_data:
            raise HTTPException(status_code=400, detail="No data provided to update")

        update_data["updated_at"] = datetime.utcnow()

        result = await db.cells.update_one(
            {"_id": ObjectId(id), "deleted_at": None},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cell not found")

        updated_cell = await db.cells.find_one({"_id": ObjectId(id)})
        return serialize_cell(updated_cell)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update cell: {str(e)}")
    

@router.delete("/{id}", status_code=204)
async def delete_cell(id: str):
    """Soft delete a cell and remove associated RC parameter file"""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        # Get cell data to delete associated file
        cell = await db.cells.find_one({"_id": ObjectId(id), "deleted_at": None})
        
        if not cell:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        # Delete associated RC parameter file if exists
        if cell.get("rc_parameter_file_path"):
            file_path = Path("app" + cell["rc_parameter_file_path"])
            if file_path.exists():
                os.remove(file_path)
                print(f"🗑️ Deleted RC parameter file: {file_path}")
        
        # Soft delete the cell
        await db.cells.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"deleted_at": datetime.utcnow()}}
        )
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting cell {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete cell: {str(e)}")
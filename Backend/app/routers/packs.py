
from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId
from app.models.pack import (
    PackCreate, PackUpdate, PackResponse, PackSummary,
    ElectricalMetrics, MechanicalMetrics, CommercialMetrics, CellConfig, CellDimensions
)
from app.config import db
import math

router = APIRouter(prefix="/packs", tags=["packs"])

async def extract_cell_config(cell_doc: dict) -> CellConfig:
    """
    Extract CellConfig from cell document
    """
    return CellConfig(
        name=cell_doc.get("name", "Unknown Cell"), 
        form_factor=cell_doc["formFactor"],
        dims=CellDimensions(**cell_doc["dims"]),
        capacity=cell_doc["capacity"],
        columbic_efficiency=cell_doc.get("columbic_efficiency", 1.0),
        m_cell=cell_doc["cell_weight"],
        m_jellyroll=cell_doc["cell_weight"] * 0.85,  # Assuming 85% of cell mass is jellyroll; adjust as needed
        cell_voltage_upper_limit=cell_doc["cell_upper_voltage_cutoff"],
        cell_voltage_lower_limit=cell_doc["cell_lower_voltage_cutoff"]
    )

def calculate_pack_summary(pack_data: dict) -> PackSummary:
    """
    Calculate pack metrics based on configuration
    """
    cell = pack_data["cell"]
    layers = pack_data["layers"]
    connection_type = pack_data["connection_type"]
    custom_parallel_groups = pack_data.get("custom_parallel_groups", [])
    cost_per_cell = pack_data.get("cost_per_cell", 3.0)
   
    # Calculate total cells
    total_cells = sum(layer["n_rows"] * layer["n_cols"] for layer in layers)
   
    # Calculate series and parallel configuration
    first_layer = layers[0]
    n_rows = first_layer["n_rows"]
    n_cols = first_layer["n_cols"]
   
    if connection_type == "row_series_column_parallel":
        n_series = n_cols
        n_parallel = n_rows
    elif connection_type == "row_parallel_column_series":
        n_series = n_rows
        n_parallel = n_cols
    elif connection_type == "custom":
        n_series = len(custom_parallel_groups)
        n_parallel = len(custom_parallel_groups[0]["cell_ids"].split(",")) if custom_parallel_groups else 1
    else:
        raise ValueError(f"Invalid connection type: {connection_type}")
   
    # Electrical calculations
    v_upper = cell["cell_voltage_upper_limit"]
    v_lower = cell["cell_voltage_lower_limit"]
    v_cell_nominal = (v_upper + v_lower) / 2
   
    pack_nominal_voltage = n_series * v_cell_nominal
    pack_max_voltage = n_series * v_upper
    pack_min_voltage = n_series * v_lower
    pack_capacity = n_parallel * cell["capacity"]
    pack_energy_wh = pack_capacity * pack_nominal_voltage
    pack_energy_kwh = pack_energy_wh / 1000
    adjusted_pack_energy_wh = pack_energy_wh * cell["columbic_efficiency"]
    busbar_total_resistance = (n_series - 1) * pack_data["r_s"]
   
    electrical = ElectricalMetrics(
        n_series=n_series,
        n_parallel=n_parallel,
        n_total=total_cells,
        v_cell_nominal=v_cell_nominal,
        pack_nominal_voltage=pack_nominal_voltage,
        pack_max_voltage=pack_max_voltage,
        pack_min_voltage=pack_min_voltage,
        pack_capacity=pack_capacity,
        pack_energy_wh=pack_energy_wh,
        pack_energy_kwh=pack_energy_kwh,
        adjusted_pack_energy_wh=adjusted_pack_energy_wh,
        busbar_total_resistance=busbar_total_resistance
    )
   
    # Mechanical calculations
    dims = cell["dims"]
    form_factor = cell["form_factor"]
   
    if form_factor == "cylindrical":
        radius_mm = dims.get("radius")
        if radius_mm is None:
            raise ValueError("Cylindrical cell must have 'radius' in dims")
        
        height_mm = dims.get("height")
        if height_mm is None:
            raise ValueError("Cylindrical cell must have 'height' in dims")
        
        # Convert to meters
        radius_m = radius_mm / 1000
        height_m = height_mm / 1000
        cell_volume_m3 = math.pi * radius_m ** 2 * height_m
    else:  # prismatic
        length_mm = dims.get("length")
        width_mm = dims.get("width")
        height_mm = dims.get("height")
        
        if length_mm is None or width_mm is None or height_mm is None:
            raise ValueError("Prismatic cell must have 'length', 'width', and 'height' in dims")
        
        # Convert to meters
        length_m = length_mm / 1000
        width_m = width_mm / 1000
        height_m = height_mm / 1000
   
    total_cell_volume = total_cells * cell['cell_volume']
    total_pack_weight = total_cells * cell["m_cell"]
   
    # Approximate pack volume (this is simplified - actual implementation would calculate bbox)
    total_pack_volume = total_cell_volume * 1.5 # Assuming 50% overhead for packaging
   
    energy_density_gravimetric = pack_energy_wh / total_pack_weight if total_pack_weight > 0 else 0
    energy_density_volumetric = pack_energy_wh / (total_pack_volume * 1000) if total_pack_volume > 0 else 0
   
    mechanical = MechanicalMetrics(
        total_cells=total_cells,
        total_pack_weight=total_pack_weight,
        total_cell_volume=total_cell_volume,
        total_pack_volume=total_pack_volume,
        energy_density_gravimetric=energy_density_gravimetric,
        energy_density_volumetric=energy_density_volumetric
    )
   
    # Commercial calculations
    total_pack_cost = total_cells * cost_per_cell
    cost_per_kwh = total_pack_cost / pack_energy_kwh if pack_energy_kwh > 0 else 0
   
    commercial = CommercialMetrics(
        total_pack_cost=total_pack_cost,
        cost_per_kwh=cost_per_kwh
    )
   
    return PackSummary(
        electrical=electrical,
        mechanical=mechanical,
        commercial=commercial
    )

@router.post("/", response_model=PackResponse, status_code=status.HTTP_201_CREATED)
async def create_pack(pack: PackCreate):
    """Create a new battery pack configuration"""
    try:
        # Validate cell_id
        if not ObjectId.is_valid(pack.cell_id):
            raise HTTPException(status_code=400, detail="Invalid cell ID format")
        
        # Fetch cell document
        cell_doc = await db.cells.find_one({"_id": ObjectId(pack.cell_id), "deleted_at": None})
        if not cell_doc:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        # Extract CellConfig from cell_doc
        cell_config = await extract_cell_config(cell_doc)
        
        # Create pack_dict from input
        pack_dict = pack.model_dump()
        
        # Inject cell_config for summary calculation
        pack_dict["cell"] = cell_config.model_dump()
        
        # Calculate summary
        summary = calculate_pack_summary(pack_dict)
        pack_dict["summary"] = summary.model_dump()
        
        # Add timestamps
        pack_dict["created_at"] = datetime.utcnow()
        pack_dict["updated_at"] = datetime.utcnow()
        pack_dict["deleted_at"] = None
        
        # For DB storage: use cell_id, remove embedded cell
        db_pack = pack_dict.copy()
        db_pack["cell_id"] = pack.cell_id
        del db_pack["cell"]
        
        # Insert into DB
        result = await db.packs.insert_one(db_pack)
        
        # Fetch created document
        created_pack = await db.packs.find_one({"_id": result.inserted_id})
        
        # Inject cell_config for response
        created_pack["cell"] = cell_config.model_dump()
        created_pack["_id"] = str(created_pack["_id"])
        
        return PackResponse(**created_pack)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating pack: {str(e)}") 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create pack: {str(e)}"
        )

@router.get("/", response_model=List[PackResponse])
async def get_packs(skip: int = 0, limit: int = 100, include_deleted: bool = False):
    """Get all pack configurations"""
    try:
        query = {} if include_deleted else {"deleted_at": None}
       
        cursor = db.packs.find(query).skip(skip).limit(limit).sort("created_at", -1)
        packs = await cursor.to_list(length=limit)
       
        # For each pack, fetch and inject cell_config
        for pack in packs:
            cell_doc = await db.cells.find_one({"_id": ObjectId(pack["cell_id"])})
            if cell_doc:
                pack["cell"] = (await extract_cell_config(cell_doc)).model_dump()
            pack["_id"] = str(pack["_id"])
       
        return [PackResponse(**pack) for pack in packs]
   
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch packs: {str(e)}"
        )

@router.get("/{pack_id}", response_model=PackResponse)
async def get_pack(pack_id: str):
    """Get a specific pack configuration"""
    try:
        if not ObjectId.is_valid(pack_id):
            raise HTTPException(status_code=400, detail="Invalid pack ID format")
        
        pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
       
        if not pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
        
        # Fetch and inject cell_config
        cell_doc = await db.cells.find_one({"_id": ObjectId(pack["cell_id"])})
        if not cell_doc:
            raise HTTPException(status_code=500, detail="Associated cell not found")
        
        pack["cell"] = (await extract_cell_config(cell_doc)).model_dump()
        pack["_id"] = str(pack["_id"])
        return PackResponse(**pack)
   
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid pack ID: {str(e)}"
        )

@router.put("/{pack_id}", response_model=PackResponse)
async def update_pack(pack_id: str, pack_update: PackUpdate):
    """Update a pack configuration"""
    try:
        if not ObjectId.is_valid(pack_id):
            raise HTTPException(status_code=400, detail="Invalid pack ID format")
        
        update_data = {k: v for k, v in pack_update.model_dump(exclude_unset=True).items() if v is not None}
       
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
       
        update_data["updated_at"] = datetime.utcnow()
       
        # Fetch existing pack
        existing_pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
        if not existing_pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        
        # Determine cell_id (updated or existing)
        cell_id = update_data.get("cell_id", existing_pack["cell_id"])
        
        # Fetch cell
        cell_doc = await db.cells.find_one({"_id": ObjectId(cell_id), "deleted_at": None})
        if not cell_doc:
            raise HTTPException(status_code=404, detail="Cell not found")
        
        cell_config = await extract_cell_config(cell_doc)
       
        # Merge data for summary calculation
        merged_data = {**existing_pack, **update_data}
        merged_data["cell"] = cell_config.model_dump()
       
        # Recalculate summary if relevant fields changed
        relevant_keys = ["cell_id", "layers", "connection_type", "r_s", "r_p", "cost_per_cell", "custom_parallel_groups"]
        if any(key in update_data for key in relevant_keys):
            summary = calculate_pack_summary(merged_data)
            update_data["summary"] = summary.model_dump()
       
        # Update in database (without embedded cell)
        result = await db.packs.update_one(
            {"_id": ObjectId(pack_id)},
            {"$set": update_data}
        )
       
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
       
        # Fetch updated document
        updated_pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
       
        # Inject cell for response
        updated_pack["cell"] = cell_config.model_dump()
        updated_pack["_id"] = str(updated_pack["_id"])
       
        return PackResponse(**updated_pack)
   
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update pack: {str(e)}"
        )

@router.delete("/{pack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pack(pack_id: str, hard_delete: bool = False):
    """Delete a pack configuration (soft delete by default)"""
    try:
        if hard_delete:
            result = await db.packs.delete_one({"_id": ObjectId(pack_id)})
        else:
            result = await db.packs.update_one(
                {"_id": ObjectId(pack_id)},
                {"$set": {"deleted_at": datetime.utcnow()}}
            )
       
        if result.matched_count == 0 and result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
   
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete pack: {str(e)}"
        )

@router.post("/{pack_id}/restore", response_model=PackResponse)
async def restore_pack(pack_id: str):
    """Restore a soft-deleted pack"""
    try:
        result = await db.packs.update_one(
            {"_id": ObjectId(pack_id)},
            {"$set": {"deleted_at": None, "updated_at": datetime.utcnow()}}
        )
       
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
       
        restored_pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
       
        # Fetch and inject cell_config
        cell_doc = await db.cells.find_one({"_id": ObjectId(restored_pack["cell_id"])})
        if not cell_doc:
            raise HTTPException(status_code=500, detail="Associated cell not found")
        
        restored_pack["cell"] = (await extract_cell_config(cell_doc)).model_dump()
        restored_pack["_id"] = str(restored_pack["_id"])
       
        return PackResponse(**restored_pack)
   
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to restore pack: {str(e)}"
        )
from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from app.models.pack import (
    PackCreate, PackUpdate, PackResponse, PackSummary,
    ElectricalMetrics, MechanicalMetrics, CommercialMetrics
)
from app.config import db
import math

router = APIRouter(prefix="/packs", tags=["packs"])

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
        radius_m = (dims.get("radius", 0) / 1000)
        height_m = (dims.get("height", 0) / 1000)
        cell_volume_m3 = math.pi * radius_m ** 2 * height_m
    else:  # prismatic
        length_m = (dims.get("length", 0) / 1000)
        width_m = (dims.get("width", 0) / 1000)
        height_m = (dims.get("height", 0) / 1000)
        cell_volume_m3 = length_m * width_m * height_m
    
    total_cell_volume = total_cells * cell_volume_m3
    total_pack_weight = total_cells * cell["m_cell"]
    
    # Approximate pack volume (this is simplified - actual implementation would calculate bbox)
    total_pack_volume = total_cell_volume * 1.5  # Assuming 50% overhead for packaging
    
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
        pack_dict = pack.model_dump()
        
        # Calculate summary
        summary = calculate_pack_summary(pack_dict)
        pack_dict["summary"] = summary.model_dump()
        
        # Add timestamps
        pack_dict["created_at"] = datetime.utcnow()
        pack_dict["updated_at"] = datetime.utcnow()
        pack_dict["deleted_at"] = None
        
        result = await db.packs.insert_one(pack_dict)
        
        created_pack = await db.packs.find_one({"_id": result.inserted_id})
        created_pack["_id"] = str(created_pack["_id"])
        
        return PackResponse(**created_pack)
    
    except Exception as e:
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
        
        for pack in packs:
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
        pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
        
        if not pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
        
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
        update_data = {k: v for k, v in pack_update.model_dump(exclude_unset=True).items() if v is not None}
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        update_data["updated_at"] = datetime.utcnow()
        
        # Recalculate summary if relevant fields changed
        if any(key in update_data for key in ["cell", "layers", "connection_type", "r_s", "r_p", "cost_per_cell"]):
            existing_pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
            if not existing_pack:
                raise HTTPException(status_code=404, detail="Pack not found")
            
            # Merge updates with existing data
            merged_data = {**existing_pack, **update_data}
            summary = calculate_pack_summary(merged_data)
            update_data["summary"] = summary.model_dump()
        
        result = await db.packs.update_one(
            {"_id": ObjectId(pack_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pack with id {pack_id} not found"
            )
        
        updated_pack = await db.packs.find_one({"_id": ObjectId(pack_id)})
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
        restored_pack["_id"] = str(restored_pack["_id"])
        
        return PackResponse(**restored_pack)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to restore pack: {str(e)}"
        )

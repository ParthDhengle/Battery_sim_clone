from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from datetime import datetime


class CellDimensions(BaseModel):
    """Cell physical dimensions"""
    radius: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: float

    model_config = ConfigDict(
        populate_by_name=True,
        extra='allow'
    )


class CellBase(BaseModel):
    """Base cell configuration"""
    name: str
    formFactor: Literal["cylindrical", "prismatic", "pouch", "coin"]
    dims: CellDimensions
    
    # Electrical parameters
    cell_nominal_voltage: float
    cell_upper_voltage_cutoff: float
    cell_lower_voltage_cutoff: float
    capacity: float

    max_charging_current_continuous: Optional[float] = 0.0
    max_charging_current_instantaneous: Optional[float] = 0.0
    max_discharging_current_continuous: Optional[float] = 0.0
    max_discharging_current_instantaneous: Optional[float] = 0.0
    max_charge_voltage: Optional[float] = 0.0
    columbic_efficiency: float = 1.0
    
    # Mechanical parameters
    cell_weight: float
    cell_volume: Optional[float] = 0.0
    
    # Commercial & Chemical
    cost_per_cell: float = 0.0
    anode_composition: str = ""
    cathode_composition: str = ""
    
    # RC parameters - store only the file path
    rc_pair_type: Optional[Literal["rc2", "rc3"]] = None
    rc_parameter_file_path: Optional[str] = None  # Path like "/uploads/rc-parameters/xxx.csv"
    
    model_config = ConfigDict(
        populate_by_name=True,
        extra='forbid'
    )


class CellCreate(CellBase):
    """Schema for creating cells"""
    pass


class Cell(CellBase):
    """Cell response model with computed fields"""
    id: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        extra="allow"  # Allow extra fields from DB
    )

class CellUpdate(BaseModel):
    """Partial update model — all fields optional so we don't overwrite data accidentally"""
    name: Optional[str] = None
    formFactor: Optional[Literal["cylindrical", "prismatic", "pouch", "coin"]] = None
    dims: Optional[CellDimensions] = None
    
    # Electrical
    cell_nominal_voltage: Optional[float] = None
    cell_upper_voltage_cutoff: Optional[float] = None
    cell_lower_voltage_cutoff: Optional[float] = None
    capacity: Optional[float] = None

    max_charging_current_continuous: Optional[float] = None
    max_charging_current_instantaneous: Optional[float] = None
    max_discharging_current_continuous: Optional[float] = None
    max_discharging_current_instantaneous: Optional[float] = None
    max_charge_voltage: Optional[float] = None
    columbic_efficiency: Optional[float] = None
    
    # Mechanical
    cell_weight: Optional[float] = None
    cell_volume: Optional[float] = None
    
    # Commercial & Chemical
    cost_per_cell: Optional[float] = None
    anode_composition: Optional[str] = None
    cathode_composition: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid"
    )
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
        extra='allow'  # Allow extra fields for flexibility
    )


class SOHFile(BaseModel):
    """State of Health file data"""
    name: str
    path: str  # File path where it's stored locally
    type: str
    rc_pair_type: Optional[Literal["rc2", "rc3"]] = None  # RC pair configuration


class CellBase(BaseModel):
    """Base cell configuration - matches frontend exactly"""
    name: str
    formFactor: Literal["cylindrical", "prismatic", "pouch", "coin"]
    dims: CellDimensions
    
    # Electrical parameters
    cell_nominal_voltage: float
    cell_upper_voltage_cutoff: float
    cell_lower_voltage_cutoff: float
    capacity: float

    max_charging_current_continuous: Optional[float] = None
    max_charging_current_instantaneous: Optional[float] = None
    max_discharging_current_continuous: Optional[float] = None
    max_discharging_current_instantaneous: Optional[float] = None
    max_charge_voltage: Optional[float] = None
    columbic_efficiency: float = 1.0
    
    # Mechanical parameters
    cell_weight: float
    cell_volume: Optional[float] = None
    
    # Commercial & Chemical
    cost_per_cell: float = 0.0
    anode_composition: str = ""
    cathode_composition: str = ""
    
    # RC pair type (separate field for easier access)
    rc_pair_type: Optional[Literal["rc2", "rc3"]] = None
    rc_parameter_file_path: Optional[str] = None  # stores path like "/uploads/xxx.csv"
    
    model_config = ConfigDict(
        populate_by_name=True,
        extra='forbid'  # Strict validation
    )


class CellCreate(CellBase):
    """Schema for creating cells"""
    pass


class CellInDB(CellBase):
    """Schema for database storage - uses snake_case internally"""
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        extra='allow'
    )


class Cell(CellBase):
    """Schema for API responses - uses camelCase for frontend"""
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )
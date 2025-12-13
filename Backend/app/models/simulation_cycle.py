from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

class DriveCycleDefinition(BaseModel):
    name: str = Field(..., min_length=1, description="Unique name of the composite drive cycle")
    subcycle_ids: List[str] = Field(..., description="Ordered list of SubCycle IDs")
    
    @validator('subcycle_ids')
    def validate_subcycle_ids(cls, v):
        if not v:
            raise ValueError("Drive Cycle must contain at least one sub-cycle")
        return v

class SimulationCycleBase(BaseModel):
    description: Optional[str] = None
    drive_cycles_metadata: List[DriveCycleDefinition] = Field(default=[], description="Definitions of composite drive cycles")
    calendar_assignments: List[Dict[str, Any]] = Field(default=[], description="List of Calendar Rules")
    simulation_table_path: Optional[str] = Field(default=None, description="Path to generated CSV file")
    
    # Metadata for frontend simulation logic
    total_days: int = Field(default=0)
    total_duration_seconds: float = Field(default=0.0)

class SimulationCycleCreate(SimulationCycleBase):
    pass

class SimulationCycle(SimulationCycleBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

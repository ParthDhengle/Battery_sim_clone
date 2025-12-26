# FILE: Backend/app/models/simulation_cycle.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from ..models.drive import DriveCycleMeta, CalendarRule # Import from drive.py
class DriveCycleDefinition(DriveCycleMeta):
    pass # Reuse full DriveCycleMeta for composition support
class SimulationCycleBase(BaseModel):
    name: Optional[str] = "New Simulation"
    description: Optional[str] = None
    subcycle_ids: List[str] = Field(default=[], description="List of Subcycle IDs available in this simulation")
    drive_cycles_metadata: List[DriveCycleDefinition] = Field(default=[], description="Full definitions of composite drive cycles with composition")
    calendar_assignments: List[CalendarRule] = Field(default=[], description="List of Calendar Rules")
    simulation_table_path: Optional[str] = Field(default=None, description="Relative path to generated CSV file")
 
    # Metadata for frontend simulation logic
    total_days: int = Field(default=0)
    total_duration_seconds: float = Field(default=0.0)
class SimulationCycleCreate(SimulationCycleBase):
    pass
class SimulationCycle(SimulationCycleBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
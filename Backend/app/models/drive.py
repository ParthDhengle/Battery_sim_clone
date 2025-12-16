from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
from .subcycle import Trigger # Reuse Trigger from subcycle.py
class CompositionRow(BaseModel):
    subcycleId: str = Field(..., description="Reference to sub-cycle ID")
    repetitions: int = Field(..., ge=1)
    ambientTemp: float = Field(..., ge=-50, le=100, description="Ambient temperature in °C")
    location: str = Field(default="", description="Optional location tag")
    triggers: List[Trigger] = Field(default=[], max_items=3)
class DriveCycleMeta(BaseModel):
    id: str = Field(..., description="Unique drive cycle ID")
    name: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = Field(default="", max_length=500)
    composition: List[CompositionRow] = Field(default=[])
class CalendarRule(BaseModel):
    id: str = Field(..., description="Unique rule ID")
    drivecycleId: str = Field(..., description="Reference to drive cycle")
    drivecycleName: str = Field(..., description="Name of the referenced drive cycle")
    months: List[int] = Field(..., description="Months 1-12")
    daysOfWeek: List[str] = Field(default=[], description="Mon-Sun")
    dates: List[int] = Field(default=[], description="Dates 1-31")
    notes: Optional[str] = Field(default="", max_length=300)
    @validator('months')
    def validate_months(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one month must be selected")
        for m in v:
            if not 1 <= m <= 12:
                raise ValueError("Months must be between 1 and 12")
        return v
    @validator('daysOfWeek')
    def validate_days(cls, v):
        valid_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for d in v:
            if d not in valid_days:
                raise ValueError(f"Invalid day: {d}")
        return v
    @validator('dates')
    def validate_dates(cls, v):
        for d in v:
            if not 1 <= d <= 31:
                raise ValueError("Dates must be between 1 and 31")
        return v
    @validator('daysOfWeek', 'dates')
    def at_least_one_filter(cls, v, values, field):
        if field.name == 'daysOfWeek' and len(v) == 0:
            if not values.get('dates'):
                raise ValueError("Either daysOfWeek or dates must be provided")
        if field.name == 'dates' and len(v) == 0:
            if not values.get('daysOfWeek'):
                raise ValueError("Either daysOfWeek or dates must be provided")
        return v
class SimulationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name of the simulation")
    subcycleIds: List[str] = Field(default=[], description="List of sub-cycle IDs used")
    driveCycles: List[DriveCycleMeta] = Field(default=[], description="List of drive cycles")
    calendarAssignments: List[CalendarRule] = Field(default=[], description="Calendar rules")
    simulationTablePath: Optional[str] = Field(default=None, description="Path to generated CSV file")
class SimulationCreate(SimulationBase):
    @validator('driveCycles')
    def validate_drive_cycles(cls, v):
        if len(v) == 0:
            raise ValueError("At least one drive cycle is required")
        return v
class Simulation(SimulationBase):
    id: str = Field(..., alias="_id")
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None
    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
# FILE: Backend/app/models/subcycle.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional
from datetime import datetime

# All possible trigger types (cell and pack level)
TRIGGER_TYPES = [
    "V_cell_high", "V_cell_low", "I_cell_high", "I_cell_low",
    "SOC_cell_high", "SOC_cell_low", "C_rate_cell_high", "C_rate_cell_low",
    "P_cell_high", "P_cell_low",
    "V_pack_high", "V_pack_low", "I_pack_high", "I_pack_low",
    "SOC_pack_high", "SOC_pack_low", "C_rate_pack_high", "C_rate_pack_low",
    "P_pack_high", "P_pack_low",
    "time_elapsed"  # Added common trigger
]

class Trigger(BaseModel):
    type: str = Field(..., description="Trigger type")
    value: float = Field(..., description="Threshold value for the trigger")

    @field_validator('type')  # V2
    @classmethod
    def validate_trigger_type(cls, v):
        if v not in TRIGGER_TYPES:
            raise ValueError(f"Invalid trigger type. Must be one of: {', '.join(TRIGGER_TYPES)}")
        return v

class Step(BaseModel):
    id: Optional[str] = None
    duration: float = Field(..., ge=0, description="Duration in seconds (0 allowed for trigger_only steps)")
    timestep: float = Field(..., gt=0, description="Timestep in seconds for data logging")
    valueType: str = Field(..., pattern="^(current|c_rate|voltage|power|resistance)$")
    value: float = Field(..., description="Target value (can be positive or negative)")
    unit: str = Field(..., description="Unit corresponding to valueType (A, C, V, W, Ω)")
    repetitions: int = Field(..., ge=1, description="Number of times to repeat this step")
    stepType: str = Field(..., pattern="^(fixed|fixed_with_triggers|trigger_only)$")
    triggers: List[Trigger] = Field(default=[], description="Triggers for this step (max 3)")
    label: str = Field(default="", description="Optional label for the step")

    class Config:
        from_attributes = True

class SubcycleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Unique name of the sub-cycle")
    description: Optional[str] = Field(default="", max_length=500)
    source: str = Field(..., pattern="^(manual|import|import_file)$", description="How the sub-cycle was created")
    steps: List[Step] = Field(default=[], description="List of steps in the sub-cycle")

class SubcycleCreate(SubcycleBase):
    @field_validator('name')  # V2
    @classmethod
    def strip_name(cls, v):
        return v.strip()

    @field_validator('steps')  # V2
    @classmethod
    def validate_steps(cls, steps):
        if not steps:
            raise ValueError("Sub-cycle must have at least one step")
        # Validate trigger_only steps have triggers and duration=0
        for step in steps:
            if step.stepType == "trigger_only":
                if len(step.triggers) == 0:
                    raise ValueError("trigger_only steps must have at least one trigger")
                if step.duration != 0:
                    raise ValueError("trigger_only steps must have duration=0")
            else:
                if step.duration <= 0:
                    raise ValueError("Non-trigger_only steps must have positive duration")
        return steps

class Subcycle(SubcycleBase):
    id: str = Field(..., alias="_id")
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    num_steps: Optional[int] = Field(default=None, description="Number of steps (for large imports)")
    total_duration: Optional[float] = Field(default=None, description="Total duration in seconds (for large imports)")

    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
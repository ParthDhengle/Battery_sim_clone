from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class VaryingCellsCondition(BaseModel):
    cell_ids: List[str]  # CHANGED: String IDs like ["R1C1L1", "R2C3L1"]
    temperature: float = 300.0
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0

class InitialConditions(BaseModel):
    temperature: float = 300.0
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0
    varying_conditions: List[VaryingCellsCondition] = []

class SimulationBase(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    pack_id: Optional[str] = None          # ← Already exists (good!)
    pack_name: Optional[str] = None         # ← ADD
    drive_cycle_id: Optional[str] = None    # ← ADD (for DB cycles)
    drive_cycle_name: Optional[str] = None  # ← ADD
    drive_cycle_file: Optional[str] = None
    status: str = "pending"
    initial_conditions: Optional[InitialConditions] = None
    metadata: Dict[str, Any] = {}

class SimulationInDB(SimulationBase):
    id: str
    created_at: datetime
    file_csv: Optional[str] = None
    error: Optional[str] = None
    updated_at: Optional[datetime] = None
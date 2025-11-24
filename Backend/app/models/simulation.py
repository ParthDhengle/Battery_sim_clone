from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class VaryingCellsCondition(BaseModel):
    cell_indices: List[int]  # Array of cell indices (0-based or 1-based as per your logic)
    temperature: float = 300.0
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0

class InitialConditions(BaseModel):
    temperature: float = 300.0
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0
    varying_conditions: List[VaryingCellsCondition] = []  # Renamed & array of indices

class SimulationBase(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    pack_id: Optional[str] = None
    status: str = "pending"
    initial_conditions: Optional[InitialConditions] = None
    metadata: Dict[str, Any] = {}

class SimulationInDB(SimulationBase):
    id: str
    created_at: datetime
    file_csv: Optional[str] = None
    error: Optional[str] = None
    updated_at: Optional[datetime] = None
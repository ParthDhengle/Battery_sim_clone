from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class SimulationBase(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    pack_id: Optional[str] = None
    status: str = "pending"
    metadata: Dict[str, Any] = {}

class SimulationInDB(SimulationBase):
    id: str
    created_at: datetime
    file_csv: Optional[str] = None
    error: Optional[str] = None
    updated_at: Optional[datetime] = None

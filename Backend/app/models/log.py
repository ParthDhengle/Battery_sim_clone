# FILE: Backend/app/models/log.py
from pydantic import BaseModel
from datetime import datetime
from typing import Dict
class Log(BaseModel):
    item_type:str
    item_data:Dict[str,any]
    deleted_at:datetime
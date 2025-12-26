# FILE: Backend/app/config.py
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from app.utils.storage import StorageManager

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
STORAGE_TYPE = os.getenv("STORAGE_TYPE", "local")
STORAGE_ROOT = os.getenv("STORAGE_ROOT", "storage")

# Centralized storage paths (relative paths)
SIMULATIONS_DIR = "simulations"
DRIVE_CYCLES_DIR = "drive_cycles"
CONTINUATIONS_DIR = "continuations"
RC_PARAMS_DIR = "rc-parameters"
SUBCYCLES_DIR = "subcycles"

# Global storage manager instance
storage_manager = StorageManager()

client = AsyncIOMotorClient(
    MONGO_URL,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=20000
)
db = client["Battery_sim_DB"]
print("MongoDB connected successfully")
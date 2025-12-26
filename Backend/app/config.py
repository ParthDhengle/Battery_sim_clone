# FILE: Backend/app/config.py
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL")

# Centralized storage paths
STORAGE_ROOT = os.getenv("STORAGE_ROOT", "storage")
SIMULATIONS_DIR = os.path.join(STORAGE_ROOT, "simulations")
DRIVE_CYCLES_DIR = os.path.join(STORAGE_ROOT, "drive_cycles")
CONTINUATIONS_DIR = os.path.join(STORAGE_ROOT, "continuations")
RC_PARAMS_DIR = os.path.join(STORAGE_ROOT, "rc-parameters")
SUBCYCLES_DIR = os.path.join(STORAGE_ROOT, "subcycles")

# Ensure directories exist
for dir_path in [STORAGE_ROOT, SIMULATIONS_DIR, DRIVE_CYCLES_DIR, CONTINUATIONS_DIR, RC_PARAMS_DIR, SUBCYCLES_DIR]:
    Path(dir_path).mkdir(parents=True, exist_ok=True)

client = AsyncIOMotorClient(
    MONGO_URL,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=20000
)
db = client["Battery_sim_DB"]
print("MongoDB connected successfully")
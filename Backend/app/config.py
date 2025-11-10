import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL")

client = AsyncIOMotorClient(
    MONGO_URL,
    tls=True,
    tlsCAFile=certifi.where(),   # <--- uses verified CA bundle
    serverSelectionTimeoutMS=20000
)
db = client["Battery_sim_DB"]

print("✅ MongoDB connected successfully")

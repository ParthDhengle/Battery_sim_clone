import os
import aiofiles
from app.config import SIM_CYCLE_DIR

async def save_csv_async(sim_id: str, csv_data: str) -> str:
    upload_dir = SIM_CYCLE_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{sim_id}.csv"
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(csv_data)
    return f"/uploads/simulation_cycle/{sim_id}.csv"
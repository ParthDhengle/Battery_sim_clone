# FILE: Backend/app/utils/file_utils.py
import os
import aiofiles
async def save_csv_async(sim_id: str, csv_data: str) -> str:
    upload_dir = os.getenv("UPLOAD_DIR", "app/uploads/simulation_cycle")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{sim_id}.csv"
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(csv_data)
    return f"/uploads/simulation_cycle/{sim_id}.csv"
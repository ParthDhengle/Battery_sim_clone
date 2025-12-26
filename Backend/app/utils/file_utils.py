from app.config import storage_manager, DRIVE_CYCLES_DIR

async def save_csv_async(sim_id: str, csv_data: str) -> str:
    rel_path = f"{DRIVE_CYCLES_DIR}/{sim_id}.csv"
    await storage_manager.save_file(rel_path, csv_data, is_text=True)
    return f"/uploads/simulation_cycle/{sim_id}.csv"
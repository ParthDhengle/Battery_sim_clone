# FILE: Backend/app/routers/drive_cycle/simulationcycles.py
from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from app.config import db
import os
import aiofiles
import json
from io import StringIO
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.simulation_generator import generate_simulation_cycle_csv  # Assuming utils has CSV gen

UPLOAD_SUBCYCLES_DIR = os.path.join(os.getenv("UPLOAD_DIR", "app/uploads"), "subcycles")

DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

async def load_subcycle_steps_if_needed(sc: Dict[str, Any]) -> Dict[str, Any]:
    """Load steps from file if source=import_file."""
    if sc.get("source") != "import_file" or sc.get("steps"):
        return sc
    rel_path = sc["_id"]
    file_id = os.path.basename(rel_path)
    abs_path = os.path.join(UPLOAD_SUBCYCLES_DIR, f"{file_id}")
    if not os.path.exists(abs_path):
        raise ValueError(f"Subcycle file missing: {abs_path}")
    async with aiofiles.open(abs_path, "r", encoding="utf-8") as f:
        content = await f.read()
    steps_data = json.loads(content)
    sc["steps"] = steps_data  # List of dicts, ready for use
    return sc

async def generate_simulation_cycle(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> List[Dict[str, Any]]:
    """
    Generates full 364-day simulation cycle from metadata.
    Uses 'calendar_assignments' (Rules) and 'drive_cycles_metadata'.
    """
    calendar_assignments = sim_doc.get("calendar_assignments", []) # List[Rule]
    drive_cycles_meta = sim_doc.get("drive_cycles_metadata", []) # List[DriveCycleDefinition]
    # Map definitions for easy lookup
    drive_cycle_map = {dc["id"]: dc for dc in drive_cycles_meta}
    # 1. Collect and Fetch SubCycles
    subcycle_ids = set()
    for dc in drive_cycles_meta:
        for row in dc.get("composition", []):
            subcycle_ids.add(row["subcycleId"])
    subcycles_cursor = db.subcycles.find({"_id": {"$in": list(subcycle_ids)}, "deleted_at": None})
    subcycles_map = {}
    async for sc in subcycles_cursor:
        sc = await load_subcycle_steps_if_needed(sc)  # Load if needed
        subcycles_map[sc["_id"]] = sc
    # Find default rule
    default_rule = next((r for r in calendar_assignments if r.get("id") == "DEFAULT_RULE"), None)
    default_drivecycle_id = default_rule["drivecycleId"] if default_rule else "DC_IDLE" # Using ID in new schema
    simulation_cycle = []
    for day_of_year in range(1, 365): # 1 to 364
        matched_rule = None
        for rule in calendar_assignments:
            if rule.get("id") == "DEFAULT_RULE":
                continue
            day_of_week_idx = (day_of_year - 1) % 7
            month_day = ((day_of_year - 1) % 30) + 1
            month = ((day_of_year - 1) // 30) + 1
            month_match = month in rule.get("months", [])
            day_match = False
            if rule.get("daysOfWeek"):
                day_match = DAYS_OF_WEEK[day_of_week_idx] in rule["daysOfWeek"]
            elif rule.get("dates"):
                day_match = month_day in rule["dates"]
            if month_match and day_match:
                matched_rule = rule
                break # First match wins
        target_dc_id = matched_rule["drivecycleId"] if matched_rule else default_drivecycle_id
   
        dc_def = drive_cycle_map.get(target_dc_id)
   
        day_steps = []
        if dc_def:
             for row in dc_def.get("composition", []):
                sc_id = row["subcycleId"]
                subcycle = subcycles_map.get(sc_id)
                if not subcycle: continue
                for rep in range(row["repetitions"]):
                    for step in subcycle.get("steps", []):
                        # Trigger logic (simplified for now, assuming subcycle steps have triggers)
                        triggers_str = (
                            "; ".join(f"{t['type']}:{t['value']}" for t in step.get("triggers", []))
                            if step.get("triggers") else ""
                        )
                   
                        day_steps.append({
                            "valueType": step["valueType"],
                            "value": step["value"],
                            "unit": step["unit"],
                            "duration": step["duration"],
                            "timestep": step["timestep"],
                            "stepType": step["stepType"],
                            "triggers": step.get("triggers", []),
                            "triggers_str": triggers_str,
                            "label": step.get("label", ""),
                            "subcycleId": sc_id,
                            "subcycleName": subcycle.get("name", ""),
                            "ambientTemp": row["ambientTemp"],
                            "location": row["location"],
                            "subcycleTriggers": (
                                "; ".join(f"{t['type']}:{t['value']}" for t in row.get("triggers", []))
                                if row.get("triggers") else ""
                            )
                        })
        simulation_cycle.append({
            "dayOfYear": day_of_year,
            "drivecycleId": target_dc_id,
            "drivecycleName": dc_def["name"] if dc_def else (default_rule["drivecycleName"] if default_rule else "DC_IDLE"),
            "steps": day_steps,
            "notes": matched_rule["notes"] if matched_rule else ("Default" if default_rule else "Idle")
        })
    return simulation_cycle

def generate_simulation_cycle_csv(simulation_cycle: List[Dict[str, Any]]) -> str:
    """
    Generates CSV matching frontend exactly: manual construction with trimmed, always-quoted values.
    """
    all_rows = []
    global_index = 1
    for day_data in simulation_cycle:
        day_num = day_data["dayOfYear"]
        dc_id = day_data["drivecycleId"]
   
        subcycle_step_idx = 1
        current_subcycle_id = None
   
        for step in day_data["steps"]:
            if step["subcycleId"] != current_subcycle_id:
                current_subcycle_id = step["subcycleId"]
                subcycle_step_idx = 1
       
            row = [
                global_index,
                day_num,
                dc_id,
                step["subcycleTriggers"],
                step.get("subcycleName", step["subcycleId"]),
                subcycle_step_idx,
                step["valueType"],
                step["value"],
                step["unit"],
                step["stepType"],
                step["duration"],
                step["timestep"],
                step["ambientTemp"],
                step["location"],
                step["triggers_str"],
                step["label"]
            ]
            all_rows.append(row)
            global_index += 1
            subcycle_step_idx += 1
    header = [
        "Global Step Index", "Day_of_year", "DriveCycle_ID", "drive cycle trigger",
        "Subcycle_ID", "Subcycle Step Index", "Value Type", "Value", "Unit",
        "Step Type", "Step Duration (s)", "Timestep (s)", "Ambient Temp (°C)",
        "Location", "step Trigger(s)", "Label"
    ]
    # Manual CSV construction to match frontend exactly
    def escape_csv_value(val):
        str_val = str(val).strip()
        if '"' in str_val:
            str_val = str_val.replace('"', '""')
        return f'"{str_val}"'
    csv_lines = [",".join(header)]
    for row in all_rows:
        csv_line = ",".join(escape_csv_value(cell) for cell in row)
        csv_lines.append(csv_line)
    return "\n".join(csv_lines)

async def save_csv_async(sim_id: str, csv_data: str) -> str:
    upload_dir = os.getenv("UPLOAD_DIR", "app/uploads/simulation_cycle")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{sim_id}.csv"
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(csv_data)
    return f"/uploads/simulation_cycle/{sim_id}.csv"

router = APIRouter(
    prefix="/simulation-cycles", # ← ADD THIS PREFIX
    tags=["Simulation Cycles Generate"], # Optional: for docs
)

@router.post("/{sim_id}/generate", response_model=Dict) # ← sim_id → sim_id (consistent)
async def generate_simulation_table(sim_id: str):
    """
    Generates full simulation cycle CSV using exact frontend logic
    and saves it to app/upload/simulation_cycle/{sim_id}.csv
    """
    sim = await db.simulation_cycles.find_one({"_id": sim_id, "deleted_at": None})
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    # Generate cycle
    simulation_cycle = await generate_simulation_cycle(sim, db)
    # Generate CSV
    csv_content = generate_simulation_cycle_csv(simulation_cycle)
    # Save
    relative_path = await save_csv_async(sim_id, csv_content)
    # Update DB
    await db.simulation_cycles.update_one(
        {"_id": sim_id, "deleted_at": None},
        {"$set": {"simulation_table_path": relative_path}}
    )
    # Stats
    total_days = len(sim.get("calendar_assignments", []))
    total_drive_cycles = len(sim.get("drive_cycles_metadata", []))
    return {
        "message": "Simulation cycle generated and saved successfully",
        "path": relative_path,
        "totalDaysAssigned": total_days,
        "totalDriveCycles": total_drive_cycles,
        "fileSizeBytes": len(csv_content.encode('utf-8'))
    }
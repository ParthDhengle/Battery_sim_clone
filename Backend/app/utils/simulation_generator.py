import csv
from io import StringIO
from typing import List, Dict, Any, Set
from motor.motor_asyncio import AsyncIOMotorDatabase

DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

async def generate_simulation_cycle(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> List[Dict[str, Any]]:
    """
    Generates full 364-day simulation cycle from metadata.
    Uses 'calendar_assignments' (Rules) and 'drive_cycles_metadata'.
    """
    calendar_assignments = sim_doc.get("calendar_assignments", []) # List[Rule]
    drive_cycles_meta = sim_doc.get("drive_cycles_metadata", [])   # List[DriveCycleDefinition]
    
    # Map definitions for easy lookup
    drive_cycle_map = {dc["name"]: dc for dc in drive_cycles_meta}

    # 1. Collect and Fetch SubCycles
    subcycle_ids = set()
    for dc in drive_cycles_meta:
        subcycle_ids.update(dc["subcycle_ids"])

    subcycles_cursor = db.subcycles.find({"_id": {"$in": list(subcycle_ids)}})
    subcycles_map = {sc["_id"]: sc async for sc in subcycles_cursor}

    # Find default rule
    default_rule = next((r for r in calendar_assignments if r.get("id") == "DEFAULT_RULE"), None)
    default_drivecycle_name = default_rule["drivecycleName"] if default_rule else "DC_IDLE" # Using Name in new schema

    simulation_cycle = []

    for day_of_year in range(1, 365):  # 1 to 364
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
                break  # First match wins 

        target_dc_name = matched_rule["drivecycleName"] if matched_rule else default_drivecycle_name
        
        dc_def = drive_cycle_map.get(target_dc_name)
        
        day_steps = []
        if dc_def:
             for sc_id in dc_def["subcycle_ids"]:
                subcycle = subcycles_map.get(sc_id)
                if not subcycle: continue

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
                        "subcycleName": subcycle.get("name", "")
                    })

        simulation_cycle.append({
            "dayOfYear": day_of_year,
            "drivecycleName": target_dc_name,
            "steps": day_steps,
            "notes": matched_rule["notes"] if matched_rule else ("Default" if default_rule else "Idle")
        })

    return simulation_cycle

async def generate_simulation_csv(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> str:
    """
    Generates full CSV.
    """
    simulation_cycle = await generate_simulation_cycle(sim_doc, db)

    all_rows = []
    global_index = 1
    
    for day_data in simulation_cycle:
        day_num = day_data["dayOfYear"]
        dc_name = day_data["drivecycleName"]
        
        subcycle_step_idx = 1
        current_subcycle_id = None
        
        for step in day_data["steps"]:
            if step["subcycleId"] != current_subcycle_id:
                current_subcycle_id = step["subcycleId"]
                subcycle_step_idx = 1
            
            row = {
                "Global Step Index": global_index,
                "Day_of_year": day_num,
                "DriveCycle_ID": dc_name,
                "drive cycle trigger": "", 
                "Subcycle_ID": step.get("subcycleName", step["subcycleId"]),
                "Subcycle Step Index": subcycle_step_idx,
                "Value Type": step["valueType"],
                "Value": step["value"],
                "Unit": step["unit"],
                "Step Type": step["stepType"],
                "Step Duration (s)": step["duration"],
                "Timestep (s)": step["timestep"],
                "Ambient Temp (°C)": 25,
                "Location": "Lab",
                "step Trigger(s)": step["triggers_str"],
                "Label": step["label"]
            }
            all_rows.append(row)
            global_index += 1
            subcycle_step_idx += 1

    header = [
        "Global Step Index", "Day_of_year", "DriveCycle_ID", "drive cycle trigger",
        "Subcycle_ID", "Subcycle Step Index", "Value Type", "Value", "Unit",
        "Step Type", "Step Duration (s)", "Timestep (s)", "Ambient Temp (°C)",
        "Location", "step Trigger(s)", "Label"
    ]

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=header)
    writer.writeheader()
    
    for row in all_rows:
        writer.writerow(row)

    return output.getvalue()
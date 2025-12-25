# FILE: Backend/app/utils/simulation_generator.py
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
    drive_cycles_meta = sim_doc.get("drive_cycles_metadata", []) # List[DriveCycleDefinition]
  
    # Map definitions for easy lookup
    drive_cycle_map = {dc["id"]: dc for dc in drive_cycles_meta}
    # 1. Collect and Fetch SubCycles
    subcycle_ids = set()
    for dc in drive_cycles_meta:
        for row in dc.get("composition", []):
            subcycle_ids.add(row["subcycleId"])
    subcycles_cursor = db.subcycles.find({"_id": {"$in": list(subcycle_ids)}, "deleted_at": None})
    subcycles_map = {sc["_id"]: sc async for sc in subcycles_cursor}
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
        total_dur = 0.0
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
                        total_dur += step["duration"]
        # NEW: Always append idle step at end of day to fill any remaining time (even if full, it will trigger immediately)
        # For unassigned days (dc_def=None), this will be the only step
        idle_step = {
            "valueType": "current",
            "value": 0,
            "unit": "A",
            "duration": 0,  # trigger_only requires 0
            "timestep": 1.0,  # Default timestep
            "stepType": "trigger_only",
            "triggers": [{"type": "time_elapsed", "value": None}],  # No specific value; defaults to 86400s in solver
            "triggers_str": "[time_elapsed] -",  # As per spec for CSV
            "label": "Default Idle cycle",
            "subcycleId": "idle",
            "subcycleName": "Default Idle",
            "ambientTemp": 25.0 if not dc_def else row["ambientTemp"],  # Fallback if no DC
            "location": "" if not dc_def else row["location"],
            "subcycleTriggers": ""
        }
        day_steps.append(idle_step)
        simulation_cycle.append({
            "dayOfYear": day_of_year,
            "drivecycleId": target_dc_id,
            "drivecycleName": dc_def["name"] if dc_def else (default_rule["drivecycleName"] if default_rule else "DC_IDLE"),
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
        dc_id = day_data["drivecycleId"]
      
        subcycle_step_idx = 1
        current_subcycle_id = None
      
        for step in day_data["steps"]:
            if step["subcycleId"] != current_subcycle_id:
                current_subcycle_id = step["subcycleId"]
                subcycle_step_idx = 1
          
            row = {
                "Global Step Index": global_index,
                "Day_of_year": day_num,
                "DriveCycle_ID": dc_id,
                "drive cycle trigger": step["subcycleTriggers"],
                "Subcycle_ID": step.get("subcycleName", step["subcycleId"]),
                "Subcycle Step Index": subcycle_step_idx,
                "Value Type": step["valueType"],
                "Value": step["value"],
                "Unit": step["unit"],
                "Step Type": step["stepType"],
                "Step Duration (s)": step["duration"],
                "Timestep (s)": step["timestep"],
                "Ambient Temp (°C)": step["ambientTemp"],
                "Location": step["location"],
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
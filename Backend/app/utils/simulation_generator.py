import csv
from io import StringIO
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.config import storage_manager
import json

DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
UPLOAD_SUBCYCLES_DIR = "subcycles"


async def load_subcycle_steps_if_needed(sc: Dict[str, Any]) -> Dict[str, Any]:
    """Load steps from file if source=import_file."""
    if sc.get("source") != "import_file" or sc.get("steps"):
        return sc
    
    rel_path = sc.get("steps_file", f"{sc['_id']}.json")
    full_path = f"{UPLOAD_SUBCYCLES_DIR}/{rel_path}"
    
    if not await storage_manager.exists(full_path):
        raise ValueError(f"Subcycle file missing: {full_path}")
    
    # FIX: Use await since load_file is async
    content_bytes = await storage_manager.load_file(full_path)
    content = content_bytes.decode('utf-8')
    steps_data = json.loads(content)
    sc["steps"] = steps_data
    
    print(f"Loaded subcycle {sc['_id']}: {len(steps_data)} steps from {full_path}")
    
    return sc


async def generate_simulation_cycle(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> List[Dict[str, Any]]:
    """Generate the full simulation cycle with all steps for 364 days."""
    
    calendar_assignments = sim_doc.get("calendar_assignments", [])
    drive_cycles_meta = sim_doc.get("drive_cycles_metadata", [])
    
    drive_cycle_map = {dc["id"]: dc for dc in drive_cycles_meta}
    
    # Collect all subcycle IDs
    subcycle_ids = set()
    for dc in drive_cycles_meta:
        for row in dc.get("composition", []):
            subcycle_ids.add(row["subcycleId"])
    
    if not subcycle_ids:
        print("WARNING: No subcycles found in drive cycles")
    
    # Fetch subcycles from database
    subcycles_cursor = db.subcycles.find({
        "_id": {"$in": list(subcycle_ids)},
        "deleted_at": None
    })
    
    # CRITICAL FIX: Load all subcycles AND their steps from files if needed
    subcycles_map = {}
    async for sc in subcycles_cursor:
        try:
            loaded_sc = await load_subcycle_steps_if_needed(sc)
            subcycles_map[loaded_sc["_id"]] = loaded_sc
            
            # Debug logging
            step_count = len(loaded_sc.get("steps", []))
            print(f"Subcycle {loaded_sc['_id']} ({loaded_sc.get('name')}): {step_count} steps, source={loaded_sc.get('source')}")
            
        except Exception as e:
            print(f"ERROR loading subcycle {sc.get('_id')}: {str(e)}")
            raise ValueError(f"Failed to load subcycle {sc.get('_id')}: {str(e)}")
    
    print(f"Total subcycles loaded: {len(subcycles_map)}")
    
    default_rule = next((r for r in calendar_assignments if r.get("id") == "DEFAULT_RULE"), None)
    default_drivecycle_id = default_rule["drivecycleId"] if default_rule else "DC_IDLE"
    
    simulation_cycle = []
    
    for day_of_year in range(1, 365):
        matched_rule = None
        
        # Find matching calendar rule
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
                break
        
        target_dc_id = matched_rule["drivecycleId"] if matched_rule else default_drivecycle_id
        dc_def = drive_cycle_map.get(target_dc_id)
        
        day_steps = []
        last_comp = dc_def["composition"][-1] if dc_def and dc_def.get("composition") else {
            "ambientTemp": 25.0, 
            "location": ""
        }
        
        # Build steps for this day
        if dc_def and dc_def.get("composition"):
            for row in dc_def["composition"]:
                sc_id = row["subcycleId"]
                subcycle = subcycles_map.get(sc_id)
                
                if not subcycle:
                    print(f"WARNING Day {day_of_year}: Subcycle {sc_id} not found in map")
                    continue
                
                # CRITICAL: Ensure steps are loaded
                subcycle_steps = subcycle.get("steps", [])
                if not subcycle_steps:
                    print(f"WARNING Day {day_of_year}: Subcycle {sc_id} has no steps!")
                    continue
                
                subcycle_triggers_str = (
                    "; ".join(f"{t['type']}:{t['value']}" for t in row.get("triggers", []))
                    if row.get("triggers")
                    else ""
                )
                
                # Add steps with repetitions
                for rep_idx in range(row.get("repetitions", 1)):
                    for step_idx, step in enumerate(subcycle_steps):
                        triggers_str = (
                            "; ".join(f"{t['type']}:{t['value']}" for t in step.get("triggers", []))
                            if step.get("triggers")
                            else ""
                        )
                        
                        day_steps.append({
                            "valueType": step.get("valueType", "current"),
                            "value": step.get("value", 0),
                            "unit": step.get("unit", "A"),
                            "duration": step.get("duration"),
                            "timestep": step.get("timestep"),
                            "stepType": step.get("stepType", ""),
                            "triggers": step.get("triggers", []),
                            "triggers_str": triggers_str,
                            "label": step.get("label", ""),
                            "subcycleId": sc_id,
                            "subcycleName": subcycle.get("name", sc_id),
                            "ambientTemp": row.get("ambientTemp"),
                            "location": row.get("location", ""),
                            "subcycleTriggers": subcycle_triggers_str,
                        })
        
        # Always append idle step at end of day
        idle_step = {
            "valueType": "current",
            "value": 0,
            "unit": "A",
            "duration": 0,
            "timestep": 1.0,
            "stepType": "trigger_only",
            "triggers": [{"type": "time_elapsed", "value": None}],
            "triggers_str": "[time_elapsed] -",
            "label": "Default Idle cycle",
            "subcycleId": "idle",
            "subcycleName": "Default Idle",
            "ambientTemp": last_comp.get("ambientTemp", 25.0),
            "location": last_comp.get("location", ""),
            "subcycleTriggers": "",
        }
        day_steps.append(idle_step)
        
        drivecycle_name = (
            dc_def["name"]
            if dc_def
            else default_rule.get("drivecycleName", "Idle") if default_rule else "Idle"
        )
        
        notes = (
            matched_rule.get("notes", "")
            if matched_rule
            else "Default drive cycle" if default_rule and not matched_rule else ""
        )
        
        simulation_cycle.append({
            "dayOfYear": day_of_year,
            "drivecycleId": target_dc_id,
            "drivecycleName": drivecycle_name,
            "notes": notes,
            "steps": day_steps,
        })
    
    return simulation_cycle


async def generate_simulation_csv(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> str:
    """Generate CSV string from simulation cycle."""
    
    simulation_cycle = await generate_simulation_cycle(sim_doc, db)
    
    all_rows = []
    global_index = 1
    
    for day_data in simulation_cycle:
        day_num = day_data["dayOfYear"]
        dc_id = day_data["drivecycleId"]
        
        current_subcycle_id = None
        subcycle_step_idx = 1
        
        for step in day_data["steps"]:
            # Reset subcycle step index when subcycle changes
            if step["subcycleId"] != current_subcycle_id:
                current_subcycle_id = step["subcycleId"]
                subcycle_step_idx = 1
            
            row = {
                "Global Step Index": global_index,
                "Day_of_year": day_num,
                "DriveCycle_ID": dc_id,
                "drive cycle trigger": step.get("subcycleTriggers", ""),
                "Subcycle_ID": step.get("subcycleName", step.get("subcycleId", "")),
                "Subcycle Step Index": subcycle_step_idx,
                "Value Type": step.get("valueType", ""),
                "Value": step.get("value", ""),
                "Unit": step.get("unit", ""),
                "Step Type": step.get("stepType", ""),
                "Step Duration (s)": step["duration"] if step.get("duration") is not None else "",
                "Timestep (s)": step["timestep"] if step.get("timestep") is not None else "",
                "Ambient Temp (°C)": step["ambientTemp"] if step.get("ambientTemp") is not None else "",
                "Location": step.get("location", ""),
                "step Trigger(s)": step.get("triggers_str", ""),
                "Label": step.get("label", ""),
            }
            all_rows.append(row)
            global_index += 1
            subcycle_step_idx += 1
    
    # Build CSV with proper escaping
    header = [
        "Global Step Index",
        "Day_of_year",
        "DriveCycle_ID",
        "drive cycle trigger",
        "Subcycle_ID",
        "Subcycle Step Index",
        "Value Type",
        "Value",
        "Unit",
        "Step Type",
        "Step Duration (s)",
        "Timestep (s)",
        "Ambient Temp (°C)",
        "Location",
        "step Trigger(s)",
        "Label"
    ]
    
    def escape_csv_value(val):
        """Escape CSV values properly."""
        str_val = str(val).strip()
        if '"' in str_val:
            str_val = str_val.replace('"', '""')
        return f'"{str_val}"'
    
    csv_lines = [",".join(escape_csv_value(h) for h in header)]
    for row in all_rows:
        csv_line = ",".join(escape_csv_value(row[field]) for field in header)
        csv_lines.append(csv_line)
    
    return "\n".join(csv_lines)
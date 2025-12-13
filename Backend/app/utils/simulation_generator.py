import csv
from io import StringIO
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

async def generate_simulation_cycle(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> List[Dict[str, Any]]:
    """
    Exact port of frontend generateSimulationCycle logic.
    Generates full 364-day simulation cycle from metadata.
    """
    calendar_assignments = sim_doc.get("calendarAssignments", [])
    drive_cycles = sim_doc.get("driveCycles", [])
    subcycle_ids = set()
    for dc in drive_cycles:
        for comp in dc.get("composition", []):
            subcycle_ids.add(comp["subcycleId"])

    # Fetch all subcycles in one query
    subcycles_cursor = db.subcycles.find({"_id": {"$in": list(subcycle_ids)}})
    subcycles = {sc["_id"]: sc async for sc in subcycles_cursor}

    # Find default rule
    default_rule = next((r for r in calendar_assignments if r["id"] == "DEFAULT_RULE"), None)
    default_drivecycle_id = default_rule["drivecycleId"] if default_rule else "DC_IDLE"

    simulation_cycle = []

    for day_of_year in range(1, 365):  # 1 to 364
        matched_rule = None
        for rule in calendar_assignments:
            if rule["id"] == "DEFAULT_RULE":
                continue

            day_of_week_idx = (day_of_year - 1) % 7
            month_day = ((day_of_year - 1) % 30) + 1
            month = ((day_of_year - 1) // 30) + 1

            month_match = month in rule["months"]
            day_match = False

            if rule.get("daysOfWeek"):
                day_match = DAYS_OF_WEEK[day_of_week_idx] in rule["daysOfWeek"]
            elif rule.get("dates"):
                day_match = month_day in rule["dates"]

            if month_match and day_match:
                matched_rule = rule
                break  # First match wins (later rules override earlier)

        drivecycle_id = matched_rule["drivecycleId"] if matched_rule else default_drivecycle_id
        drivecycle = next((dc for dc in drive_cycles if dc["id"] == drivecycle_id), None)

        steps = []
        if drivecycle and drivecycle.get("composition"):
            for comp in drivecycle["composition"]:
                subcycle = subcycles.get(comp["subcycleId"])
                if not subcycle:
                    continue

                drivecycle_row_triggers = comp.get("triggers", [])
                drivecycle_triggers_str = (
                    "; ".join(f"{t['type']}:{t['value']}" for t in drivecycle_row_triggers)
                    if drivecycle_row_triggers else ""
                )

                for _ in range(comp.get("repetitions", 1)):
                    for step in subcycle.get("steps", []):
                        steps.append({
                            "valueType": step["valueType"],
                            "value": step["value"],
                            "unit": step["unit"],
                            "duration": step["duration"],
                            "timestep": step.get("timestep", ""),
                            "stepType": step.get("stepType", ""),
                            "triggers": step.get("triggers", []),
                            "label": step.get("label", ""),
                            "subcycleId": comp["subcycleId"],
                            "ambientTemp": comp.get("ambientTemp"),
                            "location": comp.get("location", ""),
                            "drivecycleTriggers": drivecycle_triggers_str,
                        })

        simulation_cycle.append({
            "dayOfYear": day_of_year,
            "drivecycleId": drivecycle_id,
            "drivecycleName": drivecycle["name"] if drivecycle else (
                default_rule["drivecycleName"] if default_rule and not matched_rule else "Idle"
            ),
            "notes": matched_rule["notes"] if matched_rule else (
                "Default drive cycle" if default_rule and not matched_rule else ""
            ),
            "steps": steps
        })

    return simulation_cycle


async def generate_simulation_csv(
    sim_doc: Dict[str, Any],
    db: AsyncIOMotorDatabase
) -> str:
    """
    Generates full CSV with exact column order and formatting as frontend.
    """
    simulation_cycle = await generate_simulation_cycle(sim_doc, db)

    # Flatten steps with global indexing
    all_steps = []
    global_index = 1
    for day in simulation_cycle:
        subcycle_step_index = 1
        for step in day["steps"]:
            enriched = {
                **step,
                "dayOfYear": day["dayOfYear"],
                "drivecycleId": day["drivecycleId"],
                "drivecycleName": day["drivecycleName"],
                "globalIndex": global_index,
                "subcycleStepIndex": subcycle_step_index,
            }
            all_steps.append(enriched)
            global_index += 1
            subcycle_step_index += 1

    # Exact header order from frontend
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

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(header)

    for step in all_steps:
        triggers_str = (
            "; ".join(f"{t['type']}:{t['value']}" for t in step.get("triggers", []))
            if step.get("triggers") else ""
        )

        row = [
            step["globalIndex"],
            step["dayOfYear"],
            step["drivecycleId"],
            step.get("drivecycleTriggers", ""),
            step.get("subcycleId", ""),
            step["subcycleStepIndex"],
            step["valueType"],
            step["value"],
            step["unit"],
            step.get("stepType", ""),
            step.get("duration", ""),
            step.get("timestep", ""),
            step.get("ambientTemp", ""),
            step.get("location", ""),
            triggers_str,
            step.get("label", "")
        ]
        # Quote all values as in frontend
        writer.writerow([f'"{val}"' if val != "" else '""' for val in row])

    return output.getvalue()
# Testing_backend/drive_cycle.py (change default num_days to 1 for faster testing; revert to 365 for full run)
import numpy as np
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt
def flatten_drive_cycle(drive_config, start_date_str='2025-01-01', num_days=2, nominal_V=3.7, capacity=5.0, dynamic_dt=0.1):
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    sub_cycles = {sc['id']: sc for sc in drive_config['subCycles']}
    drive_cycles = {dc['id']: dc for dc in drive_config['driveCycles']}
    rules = drive_config['calendarRules']
    default_dc_id = drive_config['defaultDriveCycleId']
    if not default_dc_id or default_dc_id not in drive_cycles:
        default_dc_id = list(drive_cycles.keys())[0]
   
    global_time = 0.0
    time_arr = [0.0]
    current_arr = [0.0]
    warned_skipped_v = False
    warned_unknown_unit = False
   
    for day in range(num_days):
        current_date = start_date + timedelta(days=day)
        month = current_date.month
        weekday = current_date.strftime('%a').capitalize()
        date_day = current_date.day
        day_start_time = global_time
       
        matching_dc_id = default_dc_id
        for rule in rules:
            months = [int(m) for m in rule['months'].split(',')]
            if month not in months:
                continue
            days_or_dates = [d.strip().lower().capitalize() for d in rule['daysOrDates'].split(',')]
            if rule['filterType'] == 'weekday':
                if weekday in days_or_dates:
                    matching_dc_id = rule['driveCycleId'].strip()
                    break
            elif rule['filterType'] == 'date':
                dates = [int(d) for d in days_or_dates if d.isdigit()]
                if date_day in dates:
                    matching_dc_id = rule['driveCycleId'].strip()
                    break
       
        dc = drive_cycles.get(matching_dc_id)
        if not dc:
            print(f"Warning: No DC for day {current_date}, skipping.")
            continue
       
        for segment in dc['segments']:
            sub = sub_cycles.get(segment['subCycleId'])
            if not sub:
                continue
            for _ in range(segment['repetitions']):
                for step in sub['steps']:
                    unit = step['unit']
                    value = float(step['value'])
                    duration = step['duration']
                    repetitions = step.get('repetitions', 1)
                    total_duration = duration * repetitions
                    if total_duration == 0:
                        continue
                   
                    if unit == 'A':
                        I = value
                    elif unit == 'W':
                        I = value / nominal_V
                    elif unit == 'C':
                        I = value * capacity
                    elif unit == 'V':
                        if not warned_skipped_v:
                            print("Warning: Skipping constant V step (not supported). This warning will not repeat.")
                            warned_skipped_v = True
                        continue
                    else:
                        if not warned_unknown_unit:
                            print(f"Warning: Unknown unit {unit}, skipping. This warning will not repeat.")
                            warned_unknown_unit = True
                        continue
                   
                    if step['isDynamic']:
                        num_small_steps = int(total_duration / dynamic_dt)
                        for _ in range(num_small_steps):
                            global_time += dynamic_dt
                            time_arr.append(global_time)
                            current_arr.append(I)
                        remainder = total_duration % dynamic_dt
                        if remainder > 0:
                            global_time += remainder
                            time_arr.append(global_time)
                            current_arr.append(I)
                    else:
                        global_time += total_duration
                        time_arr.append(global_time)
                        current_arr.append(I)
       
        day_end_time = day_start_time + 86400
        idle_duration = day_end_time - global_time
        if idle_duration > 0:
            global_time += idle_duration
            time_arr.append(global_time)
            current_arr.append(0.0)
   
    df = pd.DataFrame({
    "Time": time_arr,
    "Current": current_arr
    })
    df=df.head(52000)
    
    choose=input("select Drive cycle: 1)drive_cycle1 \n 2)Test01 \n 3)7_HWFET_25deg\n 4)generated(frontend Data) \n")
    if choose=='1':
        df=pd.read_csv(r'drive_cycles\drive_cycle1new.csv')
        time_arr, current_arr=df["Time"], df["Current"]
    elif choose=='2':
        df=pd.read_csv(r'drive_cycles\drive_cycle2new.csv')
        time_arr, current_arr=df["Time"], df["Current"]
    elif choose=='3':  
        df=pd.read_csv(r'drive_cycles\drive_cycle3new.csv')
        time_arr, current_arr=df["Time"], df["Current"]
    elif choose=='4':
        df=pd.read_csv(r'drive_cycles\drive_cycle4new.csv')
        time_arr, current_arr=df["Time"], df["Current"]

    # -------- Plot 1: df --------
    plt.figure(figsize=(10, 5))
    plt.plot(df["Time"], df["Current"], color='b', linewidth=1.5)
    plt.title("Generated Data - Current vs Time")
    plt.xlabel("Time (s)")
    plt.ylabel("Current (A)")
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.tight_layout()
    plt.show()

    return np.array(time_arr), np.array(current_arr)


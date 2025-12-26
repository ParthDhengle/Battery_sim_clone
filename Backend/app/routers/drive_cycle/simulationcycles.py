from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict
from app.config import db, storage_manager,DRIVE_CYCLES_DIR
from app.utils.simulation_generator import generate_simulation_cycle, generate_simulation_csv
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/simulation-cycles",
    tags=["Simulation Cycles Generate"],
)


@router.post("/{sim_id}/generate", response_model=Dict)
async def generate_simulation_table(sim_id: str):
    """
    Generates full simulation cycle CSV and saves it.
    """
    try:
        sim = await db.simulation_cycles.find_one({"_id": sim_id, "deleted_at": None})
        if not sim:
            raise HTTPException(404, "Simulation not found")

        print(f"Starting generation for simulation: {sim_id}")

        # Generate cycle and CSV
        simulation_cycle = await generate_simulation_cycle(sim, db)
        csv_content = await generate_simulation_csv(sim, db)

        print(f"Generated {len(simulation_cycle)} days with total {sum(len(d['steps']) for d in simulation_cycle)} steps")
        print(f"CSV content size: {len(csv_content)} characters")

        rel_path = f"{DRIVE_CYCLES_DIR}/{sim_id}.csv"
        
        # Save to storage
        await storage_manager.save_file(rel_path, csv_content, is_text=True)
        
        # Verify file was saved
        if not await storage_manager.exists(rel_path):
            raise Exception(f"File was not saved successfully to {rel_path}")
        
        print(f"File saved successfully to: {rel_path}")
        
        # Store path in DB with /uploads/ prefix for URL access
        saved_path = f"/uploads/{rel_path}"

        # Calculate total steps
        total_steps = sum(len(day["steps"]) for day in simulation_cycle)

        # Update DB
        await db.simulation_cycles.update_one(
            {"_id": sim_id, "deleted_at": None},
            {
                "$set": {
                    "simulation_table_path": saved_path,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return {
            "message": "Simulation cycle generated and saved successfully",
            "path": saved_path,
            "total_days": len(simulation_cycle),
            "total_steps": total_steps,
            "file_size_bytes": len(csv_content.encode('utf-8'))
        }

    except ValueError as ve:
        print(f"Validation error: {str(ve)}")
        raise HTTPException(400, f"Validation error: {str(ve)}")
    except Exception as e:
        print(f"ERROR in generate_simulation_table: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to generate simulation table: {str(e)}")


@router.get("/{sim_id}/table")
async def get_simulation_cycle_table(sim_id: str):
    """
    Retrieve and stream the generated simulation cycle CSV file.
    """
    try:
        sim = await db.simulation_cycles.find_one({"_id": sim_id, "deleted_at": None})
        if not sim:
            raise HTTPException(404, "Simulation not found")

        simulation_table_path = sim.get("simulation_table_path")
        if not simulation_table_path:
            raise HTTPException(
                400, 
                "No simulation table generated yet. Generate it first using POST /{sim_id}/generate"
            )

        # CRITICAL FIX: Extract relative path correctly
        # Path in DB is like "/uploads/simulation_cycle/sim_id.csv"
        # We need just "simulation_cycle/sim_id.csv"
        if simulation_table_path.startswith('/uploads/'):
            rel_path = simulation_table_path[len('/uploads/'):]
        else:
            rel_path = simulation_table_path
        
        print(f"Attempting to load file from: {rel_path}")
        
        if not await storage_manager.exists(rel_path):
            print(f"File not found at: {rel_path}")
            raise HTTPException(404, "Simulation table file not found in storage")

        # Load file content
        content_bytes = await storage_manager.load_file(rel_path)
        content = content_bytes.decode('utf-8')
        
        print(f"Successfully loaded file, size: {len(content)} characters")

        def iterfile():
            yield content

        return StreamingResponse(
            iterfile(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={sim_id}_simulation_cycle.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in get_simulation_cycle_table: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to retrieve simulation table: {str(e)}")


@router.delete("/{sim_id}/table")
async def delete_simulation_table(sim_id: str):
    """
    Delete the generated simulation table file and clear the path from database.
    """
    try:
        sim = await db.simulation_cycles.find_one({"_id": sim_id, "deleted_at": None})
        if not sim:
            raise HTTPException(404, "Simulation not found")

        simulation_table_path = sim.get("simulation_table_path")
        if not simulation_table_path:
            return {"message": "No simulation table to delete"}

        # Extract relative path
        if simulation_table_path.startswith('/uploads/'):
            rel_path = simulation_table_path[len('/uploads/'):]
        else:
            rel_path = simulation_table_path
        
        # Delete file if it exists
        if await storage_manager.exists(rel_path):
            await storage_manager.delete_file(rel_path)

        # Update database to clear the path
        await db.simulation_cycles.update_one(
            {"_id": sim_id, "deleted_at": None},
            {
                "$unset": {"simulation_table_path": ""},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        return {
            "message": "Simulation table deleted successfully",
            "sim_id": sim_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete simulation table: {str(e)}")
# FILE: Backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import cells, packs, simulations, continuation
from app.routers.drive_cycle import subcycles, manager, simulationcycles # Import drive-cycle routers
from app.config import client, db
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
from fastapi.staticfiles import StaticFiles
app = FastAPI(
    title="Battery Simulation API",
    description="API for managing battery cell and pack configurations",
    version="1.0.0"
)
# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  
    allow_headers=["*"], 
    expose_headers=["*"],
    max_age=3600,
)
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")
# Scheduler for cleanup
scheduler = AsyncIOScheduler()
async def cleanup_deleted():
    """Delete cells and packs that have been soft-deleted for more than 30 days"""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    try:
        cells_result = await db.cells.delete_many({
            "deleted_at": {"$lt": thirty_days_ago, "$ne": None}
        })
        packs_result = await db.packs.delete_many({
            "deleted_at": {"$lt": thirty_days_ago, "$ne": None}
        })
        # Add simulation_cycles and subcycles cleanup
        sim_cycles_result = await db.simulation_cycles.delete_many({
            "deleted_at": {"$lt": thirty_days_ago, "$ne": None}
        })
        subcycles_result = await db.subcycles.delete_many({
            "deleted_at": {"$lt": thirty_days_ago, "$ne": None}
        })
        print(f"Cleaned up {cells_result.deleted_count} old deleted cells")
        print(f"Cleaned up {packs_result.deleted_count} old deleted packs")
        print(f"Cleaned up {sim_cycles_result.deleted_count} old deleted simulation cycles")
        print(f"Cleaned up {subcycles_result.deleted_count} old deleted subcycles")
    except Exception as e:
        print(f"Cleanup error: {e}")
@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    scheduler.add_job(cleanup_deleted, 'interval', days=1)
    scheduler.start()
    print("API started successfully")
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    client.close()
    scheduler.shutdown()
    print("Application shutdown complete")
# Include routers AFTER middleware
app.include_router(cells.router)
app.include_router(packs.router)
# In Backend/app/main.py
app.include_router(simulations.router, prefix="/simulations")
app.include_router(manager.router) # Simulation cycles manager
app.include_router(simulationcycles.router) # Simulation generation
app.include_router(simulations.router, prefix="/simulations")
app.include_router(continuation.router, prefix="/simulations")
@app.get("/")
async def root():
    return {
        "message": "Battery Simulation API",
        "version": "1.0.0",
        "status": "online",
        "endpoints": {
            "cells": "/cells",
            "packs": "/packs",
            "simulations": "/simulations",
            "subcycles": "/subcycles",
            "simulation-cycles": "/simulation-cycles",
            "docs": "/docs"
        }
    }
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
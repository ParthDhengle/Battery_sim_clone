// components/simulation/SimulationResultsContent.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultsDashboard } from "@/components/simulation/results-dashboard";

export function SimulationResultsContent() {
  const params = useParams();
  const router = useRouter();
  const simulationId = params.id as string;
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimulation = async () => {
      if (!simulationId) {
        setError("No simulation ID provided");
        setLoading(false);
        return;
      }
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_BASE}/simulations/${simulationId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch simulation: ${response.statusText}`);
        }
        const data = await response.json();
        setSimulation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load simulation");
      } finally {
        setLoading(false);
      }
    };
    fetchSimulation();
  }, [simulationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p>Loading simulation results...</p>
      </div>
    );
  }
  if (error || !simulation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-destructive">{error || "Simulation not found"}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-muted-foreground underline">
          Go Back
        </button>
      </div>
    );
  }
  const results = {
    simulation_id: simulation.simulation_id || simulationId,
    summary: simulation.metadata?.summary || null,
  };
  const handlePrevious = () => {
    router.push(`/simulation/${simulationId}`);
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Simulation Results</h1>
        <button onClick={handlePrevious} className="text-sm text-muted-foreground underline">
          ← Back to Simulation
        </button>
      </div>
      <ResultsDashboard results={results} onPrevious={handlePrevious} />
    </div>
  );
}
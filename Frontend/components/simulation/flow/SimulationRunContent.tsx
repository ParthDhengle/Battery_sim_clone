// components/simulation/SimulationRunContent.tsx
"use client";
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { SimulationRunner } from "@/components/simulation/flow/simulation-runner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SimulationRunContent() {
  const params = useParams();
  const simId = params.id as string;
  const { simulations } = useAppStore();
  const sim = simulations.find((s) => s.id === simId);
  const updateSimulation = useAppStore((state) => state.updateSimulation);
  if (!sim) {
    return <div>Simulation not found</div>;
  }
  const handlePause = () => {
    updateSimulation(simId, { status: 'draft' as const });
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Run Simulation: {simId}</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={handlePause}>Pause</Button>
          <Button>Stop</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <SimulationRunner
            packConfig={sim.config.packConfig}
            driveConfig={sim.config.driveConfig}
            simulationConfig={sim.config.simulationConfig}
            onPrevious={handlePause}
            onComplete={(results) => updateSimulation(simId, { results, status: 'completed' as const })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
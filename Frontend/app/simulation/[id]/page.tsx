// app/simulation/[id]/page.tsx
import { Suspense } from "react";
import { SimulationRunContent } from "@/components/simulation/flow/SimulationRunContent";

export default function SimulationRun() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading simulation...</div>}>
      <SimulationRunContent />
    </Suspense>
  );
}
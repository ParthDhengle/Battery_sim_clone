// app/simulation/[id]/results/page.tsx
import { Suspense } from "react";
import { SimulationResultsContent } from "@/components/simulation/SimulationResultsContent";

export default function SimulationResults() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading results...</div>}>
      <SimulationResultsContent />
    </Suspense>
  );
}
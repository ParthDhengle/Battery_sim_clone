// components/simulation/ExportResultsContent.tsx
"use client";
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportModal } from "./ExportModal";  // Assuming this is local; adjust if needed

export function ExportResultsContent() {
  const params = useParams();
  const simId = params.id as string;
  const { simulations } = useAppStore();
  const sim = simulations.find((s) => s.id === simId);
  if (!sim?.results) {
    return <div>No results to export</div>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Results</CardTitle>
      </CardHeader>
      <CardContent>
        <ExportModal data={sim.results.timeSeries} filename={`simulation-${simId}`} />
      </CardContent>
    </Card>
  );
}
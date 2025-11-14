// app/cell-builder/page.tsx
import { Suspense } from "react";
import CellBuilderContent from "@/components/cell/CellBuilderContent";  // New sub-component below

export default function CellBuilder() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading cell builder...</div>}>
      <CellBuilderContent />
    </Suspense>
  );
}

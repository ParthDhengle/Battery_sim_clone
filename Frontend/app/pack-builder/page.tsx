// app/pack-builder/page.tsx
import { Suspense } from "react";
import { PackBuilderContent } from "@/components/pack-builder/PackBuilderContent";

export default function PackBuilderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading pack builder...</div>}>
      <PackBuilderContent />
    </Suspense>
  );
}
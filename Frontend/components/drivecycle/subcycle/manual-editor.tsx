// components/drivecycle/subcycle/manual-editor.tsx

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import StepTable from "./step-table"
import { calculateTotalDuration, convertSecondsToHMS } from "./utils"
import { Step, Subcycle } from "./types"

interface ManualEditorProps {
  initialData?: Subcycle | null
  onSave: (data: { steps: Step[] }) => void
  onCancel: () => void
}

export default function ManualEditor({ initialData, onSave, onCancel }: ManualEditorProps) {
  const [steps, setSteps] = useState<Step[]>(initialData?.steps || [])

  return (
    <div className="space-y-6">
      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Steps</h3>
          <p className="text-sm font-medium">
            Total Duration:{" "}
            <span className="text-lg font-bold ml-2">
              {steps.some(s => s.stepType === "trigger_only")
                ? <span className="text-amber-600">Dynamic (trigger-only steps)</span>
                : convertSecondsToHMS(calculateTotalDuration(steps))}
            </span>
          </p>
        </div>
        <StepTable steps={steps} onStepsChange={setSteps} />
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => onSave({ steps })}
          disabled={steps.length === 0}
          className="flex-1"
        >
          {initialData ? "Update" : "Save"} Sub-cycle
        </Button>
      </div>
    </div>
  )
}
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import StepEditor from "./step-editor"
import { calculateTotalDuration } from "./subcycle-utils"

export default function SubcycleManualEditor({ initialData, onSave, onCancel }: any) {
  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [steps, setSteps] = useState(initialData?.steps || [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Highway Cruise" />
        </div>
        <div>
          <Label>Description (one line)</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., 100 km/h constant speed" />
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Steps</h3>
          <p className="text-sm font-medium">
            Total Duration: <span className="text-lg font-bold">{calculateTotalDuration(steps).toFixed(1)} s</span>
          </p>
        </div>
        <StepEditor steps={steps} onStepsChange={setSteps} />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={() => onSave({ name, description, steps })}
          disabled={!name.trim() || steps.length === 0}
          className="flex-1"
        >
          {initialData ? "Update" : "Save"} Sub-cycle
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}
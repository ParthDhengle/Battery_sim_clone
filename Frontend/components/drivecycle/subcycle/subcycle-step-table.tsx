"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import StepEditor from "./step-editor"
import {Input} from "@/components/ui/input"
interface Step {
  id: string
  duration: number
  timestep: number
  valueType: string
  value: number | string
  unit: string
  repetitions: number
  stepType: string
  triggers: Array<{ type: string; value: any }>
  label: string
}

interface SubcycleStepTableProps {
  steps: Step[]
  onStepsChange: (steps: Step[]) => void
}

export default function SubcycleStepTable({ steps, onStepsChange }: SubcycleStepTableProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const generateStepId = () => `STEP_${Date.now()}`

  const handleAddStep = (step: Omit<Step, "id">) => {
    onStepsChange([...steps, { ...step, id: generateStepId() }])
    setShowNew(false)
  }

  const handleEditStep = (id: string, step: Omit<Step, "id">) => {
    onStepsChange(steps.map((s) => (s.id === id ? { ...step, id } : s)))
    setEditing(null)
  }

  const handleDeleteStep = (id: string) => onStepsChange(steps.filter((s) => s.id !== id))

  // Live editing of a step (so total duration updates instantly)
  const handleLiveUpdate = (id: string, field: keyof Step, value: any) => {
    onStepsChange(
      steps.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  if (showNew) return <StepEditor onSubmit={handleAddStep} onCancel={() => setShowNew(false)} />
  if (editing) {
    const step = steps.find((s) => s.id === editing)
    if (step) return <StepEditor onSubmit={(newStep) => handleEditStep(editing, newStep)} onCancel={() => setEditing(null)} initialData={step} isEditing />
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      {steps.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No steps defined. Add a step to start building the sub-cycle.
        </Card>
      ) : (
        /* THIS IS THE BULLETPROOF SCROLL CONTAINER */
        <div className="w-full overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Index</TableHead>
                <TableHead className="whitespace-nowrap">Duration (s)</TableHead>
                <TableHead className="whitespace-nowrap">Timestep (s)</TableHead>
                <TableHead className="whitespace-nowrap">Value Type</TableHead>
                <TableHead className="whitespace-nowrap">Value</TableHead>
                <TableHead className="whitespace-nowrap">Repetitions</TableHead>
                <TableHead className="whitespace-nowrap">Step Type</TableHead>
                <TableHead className="whitespace-nowrap">Triggers</TableHead>
                <TableHead className="whitespace-nowrap">Label</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step, index) => (
                <TableRow key={step.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>

                  {/* Live editable duration */}
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      value={step.duration}
                      className="h-8 w-20"
                      onChange={(e) => handleLiveUpdate(step.id, "duration", Number(e.target.value) || 0)}
                    />
                  </TableCell>

                  <TableCell>{step.timestep}</TableCell>
                  <TableCell>{step.valueType}</TableCell>
                  <TableCell>{step.value} {step.unit}</TableCell>

                  {/* Live editable repetitions */}
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={step.repetitions}
                      className="h-8 w-16"
                      onChange={(e) => handleLiveUpdate(step.id, "repetitions", Number(e.target.value) || 1)}
                    />
                  </TableCell>

                  <TableCell>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{step.stepType}</span>
                  </TableCell>

                  <TableCell className="max-w-[180px] truncate">
                    {step.triggers.length > 0
                      ? step.triggers.map((t: any) => `${t.type}:${t.value}`).join(" | ")
                      : "-"}
                  </TableCell>

                  <TableCell className="max-w-[120px] truncate">{step.label || "-"}</TableCell>

                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(step.id)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteStep(step.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
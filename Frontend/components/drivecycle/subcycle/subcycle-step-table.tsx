"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import StepEditor from "./step-editor"

interface Step {
  id: string
  duration: number
  timestep: number
  valueType: "current" | "c_rate" | "voltage" | "power" | "resistance"
  value: number | string
  unit: string
  repetitions: number
  stepType: "fixed" | "trigger_only" | "fixed_with_triggers"
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

  const handleDeleteStep = (id: string) => {
    onStepsChange(steps.filter((s) => s.id !== id))
  }

  if (showNew) {
    return <StepEditor onSubmit={handleAddStep} onCancel={() => setShowNew(false)} />
  }

  if (editing) {
    const step = steps.find((s) => s.id === editing)
    if (step) {
      return (
        <StepEditor
          onSubmit={(newStep) => handleEditStep(editing, newStep)}
          onCancel={() => setEditing(null)}
          initialData={step}
          isEditing
        />
      )
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      {steps.length === 0 ? (
        <Card className="p-4 text-center text-muted-foreground">
          No steps defined. Add a step to start building the sub-cycle.
        </Card>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Index</TableHead>
                <TableHead>Duration (s)</TableHead>
                <TableHead>Timestep (s)</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Repetitions</TableHead>
                <TableHead>Step Type</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step, index) => (
                <TableRow key={step.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{(step.duration || step.repetitions * step.timestep).toFixed(1)}</TableCell>
                  <TableCell>{step.timestep}</TableCell>
                  <TableCell>{step.valueType}</TableCell>
                  <TableCell>
                    {step.value} {step.unit}
                  </TableCell>
                  <TableCell>{step.repetitions}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                      {step.stepType}
                    </span>
                  </TableCell>
                  <TableCell>{step.label}</TableCell>
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

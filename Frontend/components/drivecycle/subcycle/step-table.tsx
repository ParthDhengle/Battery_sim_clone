// FILE: Frontend/components/drivecycle/subcycle/step-table.tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit2, Trash2, Plus, X } from "lucide-react"
import StepEditor from "./step-editor"
import { Step, Trigger } from "./types"  // Import Trigger for typing
interface StepTableProps {
  steps: Step[]
  onStepsChange: (steps: Step[]) => void
}
export default function StepTable({ steps, onStepsChange }: StepTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const generateId = () => `STEP_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  const handleAdd = (newStep: Omit<Step, "id">) => {
    onStepsChange([...steps, { ...newStep, id: generateId() }])
    setShowNew(false)
  }
  const handleUpdate = (id: string, updatedStep: Omit<Step, "id">) => {
    onStepsChange(steps.map(s => s.id === id ? { ...updatedStep, id } : s))
    setEditingId(null)
  }
  const handleDelete = (id: string) => {
    onStepsChange(steps.filter(s => s.id !== id))
    if (editingId === id) setEditingId(null)
  }
  const isEditorOpen = showNew || editingId !== null
  const editingStep = editingId ? steps.find(s => s.id === editingId) : undefined
  const hasErrors = steps.some(s => 
    (s.stepType !== "trigger_only" && s.duration <= 0) || 
    s.timestep <= 0 || 
    (s.stepType === "trigger_only" && s.triggers.length === 0)
  )
  return (
    <div className="space-y-6">
      {isEditorOpen && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <div className="p-6">
            {showNew ? (
              <StepEditor
                onSubmit={handleAdd}
                onCancel={() => setShowNew(false)}
              />
            ) : editingStep ? (
              <StepEditor
                initialData={editingStep}
                isEditing
                onSubmit={(data) => handleUpdate(editingId!, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : null}
          </div>
        </Card>
      )}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Steps ({steps.length})</h3>
          {hasErrors && (
            <span className="text-sm text-destructive flex items-center gap-1">
              <X className="h-3 w-3" /> {hasErrors} validation error(s)
            </span>
          )}
          <Button
            onClick={() => setShowNew(true)}
            size="sm"
            disabled={isEditorOpen}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
        {steps.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground border-dashed">
            <p>No steps defined yet.</p>
            <p className="text-sm mt-2">Click "Add Step" to create your first step.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Duration (s)</TableHead>
                  <TableHead>Timestep (s)</TableHead>
                  <TableHead>Value Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Step Type</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step, index) => {
                  if (!step.id) return null;  // Skip if no id (shouldn't happen)
                  const isError = (step.stepType !== "trigger_only" && step.duration <= 0) || 
                                  step.timestep <= 0 || 
                                  (step.stepType === "trigger_only" && step.triggers.length === 0)
                  return (
                    <TableRow
                      key={step.id}
                      className={`${isError ? "border-l-4 border-destructive bg-destructive/10" : ""} ${editingId === step.id ? "bg-accent/70 text-accent-foreground font-medium" : ""}`}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className={isError ? "text-destructive" : ""}>
                        {step.duration === 0 ? "-" : step.duration}
                      </TableCell>
                      <TableCell className={isError ? "text-destructive" : ""}>{step.timestep}</TableCell>
                      <TableCell className="capitalize">{step.valueType}</TableCell>
                      <TableCell>{step.value} {step.unit}</TableCell>
                      <TableCell>{step.repetitions}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-secondary">
                          {step.stepType.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {step.triggers.length > 0 ? (
                          <div className="space-y-1 text-xs">
                            {step.triggers.map((t: Trigger, i: number) => (
                              <div key={i}>{t.type.replace(/_/g, " ")}: {t.value}</div>
                            ))}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="truncate max-w-[120px]">
                        {step.label || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingId(step.id)}  // Safe: id exists
                            disabled={isEditorOpen}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleDelete(step.id)}  // Safe: id exists
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
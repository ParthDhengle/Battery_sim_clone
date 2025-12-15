// FILE: Frontend/components/drivecycle/subcycle/step-editor.tsx (updated value to number for backend)
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
interface Trigger {
  type: string
  value: number
}
interface Step {
  id?: string
  duration: number
  timestep: number
  valueType: string
  value: number  // Changed to number for backend
  unit: string
  repetitions: number
  stepType: string
  triggers: Trigger[]
  label: string
}
interface StepEditorProps {
  onSubmit: (step: Omit<Step, "id">) => void
  onCancel: () => void
  initialData?: Step
  isEditing?: boolean
}
export default function StepEditor({ onSubmit, onCancel, initialData, isEditing = false }: StepEditorProps) {
  const MAX_TRIGGERS = 3
  const [step, setStep] = useState<Omit<Step, "id">>(
    initialData
      ? { ...initialData, value: Number(initialData.value) }  // Ensure number
      : {
          duration: 0,
          timestep: 1,
          valueType: "current",
          value: 0,
          unit: "A",
          repetitions: 1,
          stepType: "fixed",
          triggers: [],
          label: "",
        }
  )
  const unitMap: Record<string, string> = {
    current: "A",
    c_rate: "C",
    voltage: "V",
    power: "W",
    resistance: "Ω",
  }
  const handleValueTypeChange = (valueType: string) => {
    setStep({ ...step, valueType, unit: unitMap[valueType] || "A" })
  }
  const handleStepTypeChange = (stepType: string) => {
    setStep(prev => ({
      ...prev,
      stepType,
      triggers: (stepType === "fixed") ? [] : prev.triggers,
      duration: stepType === "trigger_only" ? 0 : prev.duration,  // Reset duration for trigger_only
    }))
  }
  const handleAddTrigger = () => {
    if (step.triggers.length >= MAX_TRIGGERS) return
    setStep({
      ...step,
      triggers: [...step.triggers, { type: "V_cell_high", value: 4.2 }],
    })
  }
  const handleRemoveTrigger = (index: number) => {
    setStep({
      ...step,
      triggers: step.triggers.filter((_: Trigger, i: number) => i !== index),
    })
  }
  const handleUpdateTrigger = (index: number, field: "type" | "value", value: string | number) => {
    const newTriggers = [...step.triggers]
    newTriggers[index] = { ...newTriggers[index], [field]: typeof value === 'number' ? value : Number(value) }
    setStep({ ...step, triggers: newTriggers })
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step.stepType === "trigger_only" && step.triggers.length === 0) {
      alert("Trigger-only steps must have at least one trigger")
      return
    }
    if (step.stepType !== "trigger_only" && step.duration <= 0) {
      alert("Fixed steps must have positive duration")
      return
    }
    if (step.timestep <= 0) {
      alert("Timestep must be positive")
      return
    }
    onSubmit(step)
  }
  const showDuration = step.stepType === "fixed" || step.stepType === "fixed_with_triggers"
  const showTriggers = step.stepType === "trigger_only" || step.stepType === "fixed_with_triggers"
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              value={step.label}
              onChange={(e) => setStep({ ...step, label: e.target.value })}
              placeholder="e.g., Charge Phase"
            />
          </div>
          <div>
            <Label htmlFor="stepType">Step Type *</Label>
            <Select value={step.stepType} onValueChange={handleStepTypeChange}>
              <SelectTrigger id="stepType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed Duration</SelectItem>
                <SelectItem value="fixed_with_triggers">Fixed Duration with Triggers</SelectItem>
                <SelectItem value="trigger_only">Trigger Only (No Fixed Duration)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showDuration && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (s) *</Label>
                <Input
                  id="duration"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={step.duration}
                  onChange={(e) => setStep({ ...step, duration: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="repetitions">Repetitions *</Label>
                <Input
                  id="repetitions"
                  type="number"
                  min="1"
                  value={step.repetitions}
                  onChange={(e) => setStep({ ...step, repetitions: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="timestep">Timestep (s) *</Label>
            <Input
              id="timestep"
              type="number"
              step="any"
              min="0.001"
              value={step.timestep}
              onChange={(e) => setStep({ ...step, timestep: parseFloat(e.target.value) || 1 })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Value Type *</Label>
              <Select value={step.valueType} onValueChange={handleValueTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current (A)</SelectItem>
                  <SelectItem value="c_rate">C-Rate (1/Hr)</SelectItem>
                  <SelectItem value="voltage">Voltage (V)</SelectItem>
                  <SelectItem value="power">Power (W)</SelectItem>
                  <SelectItem value="resistance">Resistance (Ω)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value *</Label>
              <Input
                type="number"
                step="any"
                value={step.value}
                onChange={(e) => setStep({ ...step, value: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 50 or -100"
                required
              />
            </div>
          </div>
          {showTriggers && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Triggers {step.stepType === "trigger_only" && "(Required)"}</Label>
                  <p className="text-xs text-muted-foreground">
                    Maximum {MAX_TRIGGERS} triggers allowed • {step.triggers.length}/{MAX_TRIGGERS} used
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddTrigger}
                  disabled={step.triggers.length >= MAX_TRIGGERS}
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Add Trigger
                </Button>
              </div>
              {step.triggers.length === 0 && step.stepType === "trigger_only" && (
                <p className="text-sm text-destructive">At least one trigger is required for Trigger Only steps</p>
              )}
              {step.triggers.length >= MAX_TRIGGERS && (
                <p className="text-sm text-amber-600">
                  Maximum of {MAX_TRIGGERS} triggers reached
                </p>
              )}
              {step.triggers.map((trigger: Trigger, index: number) => (
                <div key={index} className="flex gap-2 items-end">
                  <Select value={trigger.type} onValueChange={(val) => handleUpdateTrigger(index, "type", val)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Cell-Level Triggers</SelectLabel>
                        <SelectItem value="V_cell_high">V Cell High</SelectItem>
                        <SelectItem value="V_cell_low">V Cell Low</SelectItem>
                        <SelectItem value="I_cell_high">I Cell High</SelectItem>
                        <SelectItem value="I_cell_low">I Cell Low</SelectItem>
                        <SelectItem value="SOC_cell_high">SOC Cell High</SelectItem>
                        <SelectItem value="SOC_cell_low">SOC Cell Low</SelectItem>
                        <SelectItem value="C_rate_cell_high">C-rate Cell High</SelectItem>
                        <SelectItem value="C_rate_cell_low">C-rate Cell Low</SelectItem>
                        <SelectItem value="P_cell_high">Power Cell High</SelectItem>
                        <SelectItem value="P_cell_low">Power Cell Low</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Pack-Level Triggers</SelectLabel>
                        <SelectItem value="V_pack_high">V Pack High</SelectItem>
                        <SelectItem value="V_pack_low">V Pack Low</SelectItem>
                        <SelectItem value="I_pack_high">I Pack High</SelectItem>
                        <SelectItem value="I_pack_low">I Pack Low</SelectItem>
                        <SelectItem value="SOC_pack_high">SOC Pack High</SelectItem>
                        <SelectItem value="SOC_pack_low">SOC Pack Low</SelectItem>
                        <SelectItem value="C_rate_pack_high">C-rate Pack High</SelectItem>
                        <SelectItem value="C_rate_pack_low">C-rate Pack Low</SelectItem>
                        <SelectItem value="P_pack_high">Power Pack High</SelectItem>
                        <SelectItem value="P_pack_low">Power Pack Low</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    value={trigger.value}
                    onChange={(e) => handleUpdateTrigger(index, "value", parseFloat(e.target.value) || 0)}
                    className="flex-1"
                    placeholder="Threshold value"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveTrigger(index)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Step" : "Add Step"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
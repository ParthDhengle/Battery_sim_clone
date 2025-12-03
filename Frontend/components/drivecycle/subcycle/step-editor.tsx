"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface StepEditorProps {
  onSubmit: (step: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

export default function StepEditor({ onSubmit, onCancel, initialData, isEditing }: StepEditorProps) {
  const [step, setStep] = useState(
    initialData || {
      duration: 10,           // ← now user-defined
      timestep: 1,
      valueType: "current",
      value: 0,
      unit: "A",
      repetitions: 1,         // kept only for compatibility / future use
      stepType: "fixed",
      triggers: [],
      label: "",
    },
  )

  const unitMap: Record<string, string> = {
    current: "A",
    c_rate: "C",
    voltage: "V",
    power: "W",
    resistance: "Ω",
  }

  const handleValueTypeChange = (valueType: string) => {
    setStep({
      ...step,
      valueType,
      unit: unitMap[valueType] || "A",
    })
  }

  const handleAddTrigger = () => {
    setStep({
      ...step,
      triggers: [...step.triggers, { type: "voltage_low", value: 0 }],
    })
  }

  const handleRemoveTrigger = (index: number) => {
    setStep({
      ...step,
      triggers: step.triggers.filter((_, i) => i !== index),
    })
  }

  const handleUpdateTrigger = (index: number, type: string, value: any) => {
    const newTriggers = [...step.triggers]
    newTriggers[index] = { type, value }
    setStep({ ...step, triggers: newTriggers })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (step.stepType === "trigger_only" && step.triggers.length === 0) {
      alert("Trigger-only steps must have at least one trigger")
      return
    }


    onSubmit(step)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="duration">Duration (s) *</Label>
                <Input
                  id="duration"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={step.duration}
                  onChange={(e) => setStep({ ...step, duration: Number.parseFloat(e.target.value) || 0 })}
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
                onChange={(e) => {
                  const reps = Number.parseInt(e.target.value)
                  setStep({
                    ...step,
                    repetitions: reps,
                  })
                }}
                required
              />
            </div>

            <div>
              <Label htmlFor="timestep">Timestep (s) *</Label>
              <Input
                id="timestep"
                type="number"
                step="0.1"
                value={step.timestep}
                onChange={(e) => setStep({ ...step, timestep: Number.parseFloat(e.target.value) })}
                required
              />
            </div>

            
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valueType">Value Type *</Label>
              <Select value={step.valueType} onValueChange={handleValueTypeChange}>
                <SelectTrigger id="valueType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current (A)</SelectItem>
                  <SelectItem value="c_rate">C-Rate (C)</SelectItem>
                  <SelectItem value="voltage">Voltage (V)</SelectItem>
                  <SelectItem value="power">Power (W)</SelectItem>
                  <SelectItem value="resistance">Resistance (Ω)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="value">Value *</Label>
              <Input
                id="value"
                value={step.value}
                onChange={(e) => setStep({ ...step, value: e.target.value })}
                placeholder="e.g., 3.5 or 0.5*C_rate"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="stepType">Step Type *</Label>
            <Select value={step.stepType} onValueChange={(val) => setStep({ ...step, stepType: val })}>
              <SelectTrigger id="stepType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed Duration</SelectItem>
                <SelectItem value="trigger_only">Trigger Only</SelectItem>
                <SelectItem value="fixed_with_triggers">Fixed with Triggers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              value={step.label}
              onChange={(e) => setStep({ ...step, label: e.target.value })}
              placeholder="e.g., Charge Phase"
            />
          </div>

          {(step.stepType === "trigger_only" || step.stepType === "fixed_with_triggers") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Triggers</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddTrigger}
                  className="gap-2 bg-transparent"
                >
                  <Plus className="h-3 w-3" />
                  Add Trigger
                </Button>
              </div>

              {step.triggers.map((trigger, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <Select value={trigger.type} onValueChange={(val) => handleUpdateTrigger(index, val, trigger.value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voltage_low">Voltage Low</SelectItem>
                      <SelectItem value="voltage_high">Voltage High</SelectItem>
                      <SelectItem value="current_low">Current Low</SelectItem>
                      <SelectItem value="current_high">Current High</SelectItem>
                      <SelectItem value="soc_low">SOC Low</SelectItem>
                      <SelectItem value="soc_high">SOC High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.1"
                    value={trigger.value}
                    onChange={(e) => handleUpdateTrigger(index, trigger.type, Number.parseFloat(e.target.value))}
                    className="flex-1"
                    placeholder="Trigger value"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveTrigger(index)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Step" : "Add Step"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

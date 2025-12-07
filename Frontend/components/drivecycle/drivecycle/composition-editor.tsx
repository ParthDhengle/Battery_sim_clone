// components/drivecycle/composition-editor.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"

interface Trigger {
  type: string
  value: number
}

interface RowData {
  subcycleId: string
  subcycleName: string
  repetitions: number
  ambientTemp: number
  location: string
  triggers: Trigger[]
}

interface CompositionEditorProps {
  subcycles: any[]
  initialData?: RowData
  onSubmit: (data: RowData) => void
  onCancel: () => void
  isEditing?: boolean
}

const triggerOptions = [
  { label: "Cell Voltage High", value: "V_cell_high" },
  { label: "Cell Voltage Low", value: "V_cell_low" },
  { label: "Cell SOC High", value: "SOC_cell_high" },
  { label: "Cell SOC Low", value: "SOC_cell_low" },
  { label: "Cell Current High", value: "I_cell_high" },
  { label: "Pack Voltage High", value: "V_pack_high" },
  { label: "Pack Voltage Low", value: "V_pack_low" },
  { label: "Pack SOC High", value: "SOC_pack_high" },
  { label: "Pack Current High", value: "I_pack_high" },
]

export default function CompositionEditor({
  subcycles,
  initialData,
  onSubmit,
  onCancel,
  isEditing,
}: CompositionEditorProps) {
  const [row, setRow] = useState<RowData>(
    initialData || {
      subcycleId: "",
      subcycleName: "",
      repetitions: 1,
      ambientTemp: 20,
      location: "",
      triggers: [],
    }
  )

  const handleSelectSubcycle = (id: string) => {
    const sub = subcycles.find((s: any) => s.id === id)
    if (sub) {
      setRow({ ...row, subcycleId: id, subcycleName: sub.name })
    }
  }

  const addTrigger = () => {
    if (row.triggers.length >= 3) return
    setRow({
      ...row,
      triggers: [...row.triggers, { type: "V_cell_high", value: 4.2 }],
    })
  }

  const updateTrigger = (index: number, field: "type" | "value", value: string | number) => {
    const newTriggers = [...row.triggers]
    newTriggers[index] = { ...newTriggers[index], [field]: value }
    setRow({ ...row, triggers: newTriggers })
  }

  const removeTrigger = (index: number) => {
    setRow({
      ...row,
      triggers: row.triggers.filter((_: Trigger, i: number) => i !== index),
    })
  }

  const handleSave = () => {
    if (!row.subcycleId) {
      alert("Please select a sub-cycle")
      return
    }
    onSubmit(row)
  }

  return (
    <div className="space-y-6">
      {/* Sub-cycle Selection */}
      <div>
        <Label htmlFor="subcycle">Select Sub-cycle *</Label>
        <Select value={row.subcycleId} onValueChange={handleSelectSubcycle}>
          <SelectTrigger id="subcycle">
            <SelectValue placeholder="Choose a sub-cycle" />
          </SelectTrigger>
          <SelectContent>
            {subcycles.map((sc: any) => (
              <SelectItem key={sc.id} value={sc.id}>
                {sc.id} - {sc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Repetitions & Temp */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reps">Repetitions</Label>
          <Input
            id="reps"
            type="number"
            min="1"
            value={row.repetitions}
            onChange={(e) => setRow({ ...row, repetitions: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label htmlFor="temp">Ambient Temp (°C)</Label>
          <Input
            id="temp"
            type="number"
            step="0.1"
            value={row.ambientTemp}
            onChange={(e) => setRow({ ...row, ambientTemp: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          value={row.location}
          onChange={(e) => setRow({ ...row, location: e.target.value })}
          placeholder="e.g., Phoenix, Detroit"
        />
      </div>

      {/* Triggers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Triggers (max 3)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addTrigger}
            disabled={row.triggers.length >= 3}
            className="gap-2"
          >
            <Plus className="h-3 w-3" />
            Add Trigger
          </Button>
        </div>

        {row.triggers.map((trigger, index) => (
          <div key={index} className="flex gap-2 items-end">
            <Select
              value={trigger.type}
              onValueChange={(val) => updateTrigger(index, "type", val)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              step="0.01"
              value={trigger.value}
              onChange={(e) => updateTrigger(index, "value", Number(e.target.value))}
              className="flex-1"
              placeholder="Value"
            />

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => removeTrigger(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} className="flex-1">
          {isEditing ? "Update" : "Add"} Sub-cycle
        </Button>
      </div>
    </div>
  )
}
"use client"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react" 
interface CompositionEditorProps {
  subcycles: any[]
  onSubmit: (row: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
  preventFormWrap?: boolean   // ← ADD THIS
}
export default function CompositionEditor({
  subcycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
  preventFormWrap = false,   // ← default false
}: CompositionEditorProps) {
  const [row, setRow] = useState(
    initialData || {
      subcycleId: "",
      subcycleName: "",
      repetitions: 1,
      ambientTemp: 20,
      location: "Default",
      triggers: [],
    },
  )
  const handleSelectSubcycle = (subcycleId: string) => {
    const subcycle = subcycles.find((sc) => sc.id === subcycleId)
    if (subcycle) {
      setRow({
        ...row,
        subcycleId,
        subcycleName: subcycle.name,
      })
    }
  }
  const handleAddTrigger = () => {
    setRow({
      ...row,
      triggers: [...row.triggers, { type: "V_cell_high", value: 0 }],
    })
  }
  const handleRemoveTrigger = (index: number) => {
    setRow({
      ...row,
      triggers: row.triggers.filter((_: any, i: number) => i !== index),
    })
  }
  const handleUpdateTrigger = (index: number, type: string, value: number) => {
    const newTriggers = [...row.triggers]
    newTriggers[index] = { type, value }
    setRow({ ...row, triggers: newTriggers })
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!row.subcycleId) {
      alert("Please select a sub-cycle")
      return
    }
    onSubmit(row)
  }
  const content = (
    <div className="space-y-4">
      {/* ← ALL YOUR EXISTING JSX (Select, Inputs, Triggers, etc.) */}
      {/* ... exactly same as before ... */}
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {isEditing ? "Update" : "Add Sub-cycle"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancel
        </Button>
      </div>
    </div>
  )

  if (preventFormWrap) {
    return <Card><CardContent className="pt-6">{content}</CardContent></Card>
  }
  
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="subcycleId">Select Sub-cycle *</Label>
            <Select value={row.subcycleId} onValueChange={handleSelectSubcycle}>
              <SelectTrigger id="subcycleId">
                <SelectValue placeholder="Choose a sub-cycle" />
              </SelectTrigger>
              <SelectContent>
                {subcycles.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.id} - {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repetitions">Repetitions (≥1) *</Label>
              <Input
                id="repetitions"
                type="number"
                min="1"
                value={row.repetitions}
                onChange={(e) => setRow({ ...row, repetitions: Number.parseInt(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ambientTemp">Ambient Temperature (°C)</Label>
              <Input
                id="ambientTemp"
                type="number"
                step="0.1"
                value={row.ambientTemp}
                onChange={(e) => setRow({ ...row, ambientTemp: Number.parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={row.location}
              onChange={(e) => setRow({ ...row, location: e.target.value })}
              placeholder="e.g., Reno, Phoenix, Detroit"
            />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Triggers (Optional)</Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddTrigger} className="gap-2">
                <Plus className="h-3 w-3" />
                Add Trigger
              </Button>
            </div>
            {row.triggers.map((trigger: any, index: number) => (
              <div key={index} className="flex gap-2 items-end">
                <Select value={trigger.type} onValueChange={(val) => handleUpdateTrigger(index, val, trigger.value)}>
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
                  step="0.1"
                  value={trigger.value}
                  onChange={(e) => handleUpdateTrigger(index, trigger.type, parseFloat(e.target.value) || 0)}
                  className="flex-1"
                  placeholder="Trigger value"
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveTrigger(index)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update" : "Add Sub-cycle"}
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
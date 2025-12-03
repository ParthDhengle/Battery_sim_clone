"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CompositionEditorProps {
  subcycles: any[]
  onSubmit: (row: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

export default function CompositionEditor({
  subcycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!row.subcycleId) {
      alert("Please select a sub-cycle")
      return
    }
    onSubmit(row)
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

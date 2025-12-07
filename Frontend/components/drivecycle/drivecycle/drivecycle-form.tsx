// Frontend/components/drivecycle/drivecycle/drivecycle-form.tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import DrivecycleCompositionTable from "./drivecycle-composition-table"

interface DrivecycleFormProps {
  subcycles: any[]
  onSubmit: (drivecycle: { name: string; notes: string; composition: any[] }) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

function convertSecondsToHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ") || "0s"
}

export default function DrivecycleForm({
  subcycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
}: DrivecycleFormProps) {
  const [name, setName] = useState(initialData?.name || "")
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [composition, setComposition] = useState<any[]>(initialData?.composition || [])

  const totalDuration = composition.reduce((sum, row) => {
    const sub = subcycles.find((s: any) => s.id === row.subcycleId)
    const subDur = sub?.steps.reduce((a: number, s: any) => a + s.duration * s.repetitions, 0) || 0
    return sum + subDur * row.repetitions
  }, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return alert("Drive cycle name is required")
    if (composition.length === 0) return alert("Add at least one sub-cycle")
    if (totalDuration > 86400) return alert("Total duration exceeds 24 hours")

    onSubmit({ name, notes, composition })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Drive Cycle Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Urban Commute" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <strong>Total Duration:</strong> {convertSecondsToHMS(totalDuration)} / 24h
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Composition</h3>
            <DrivecycleCompositionTable
              composition={composition}
              onCompositionChange={setComposition}
              subcycles={subcycles}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? "Update" : "Create"} Drive Cycle
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
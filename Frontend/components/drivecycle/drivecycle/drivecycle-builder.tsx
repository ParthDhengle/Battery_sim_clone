"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download, Edit2, Trash2 } from "lucide-react"
import DrivecycleForm from "./drivecycle-form"
import DrivecycleCompositionTable from "./drivecycle-composition-table"

interface DrivecycleComposition {
  id: string
  subcycleId: string
  subcycleName: string
  repetitions: number
  ambientTemp: number
  location: string
  triggers: Array<{ type: string; value: any }>
}

interface Drivecycle {
  id: string
  name: string
  notes: string
  source: "manual" | "import"
  composition: DrivecycleComposition[]
}

interface DrivecycleBuilderProps {
  subcycles: any[]
  drivecycles: Drivecycle[]
  onDrivecyclesChange: (drivecycles: Drivecycle[]) => void
}

function convertSecondsToHMS(totalSeconds: number) {
  totalSeconds = Number(totalSeconds)
  const secondsInMonth = 30 * 24 * 3600
  const secondsInDay = 24 * 3600
  const secondsInHour = 3600
  const secondsInMinute = 60

  const months = Math.floor(totalSeconds / secondsInMonth)
  totalSeconds %= secondsInMonth
  const days = Math.floor(totalSeconds / secondsInDay)
  totalSeconds %= secondsInDay
  const hours = Math.floor(totalSeconds / secondsInHour)
  totalSeconds %= secondsInHour
  const minutes = Math.floor(totalSeconds / secondsInMinute)
  const seconds = Math.floor(totalSeconds % secondsInMinute)

  const parts = []
  if (months > 0) parts.push(`${months}mo`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

function getSubcycleDuration(subcycle: any) {
  return subcycle.steps.reduce((sum: number, s: any) => sum + (s.duration * s.repetitions), 0)
}

function computeDrivecycleDuration(dc: Drivecycle, subcycles: any[]) {
  return dc.composition.reduce((sum: number, row: DrivecycleComposition) => {
    const sub = subcycles.find((s: any) => s.id === row.subcycleId)
    return sum + (sub ? getSubcycleDuration(sub) * row.repetitions : 0)
  }, 0)
}

const exportDrivecycleJson = (drivecycle: Drivecycle) => {
  const data = JSON.stringify(drivecycle, null, 2)
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${drivecycle.id}_${drivecycle.name.replace(/\s+/g, "_")}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const exportDrivecycleCsv = (drivecycle: Drivecycle) => {
  if (drivecycle.composition.length === 0) return
  const headers = ["Subcycle_ID", "Subcycle_Name", "Repetitions", "Ambient_Temp", "Location", "Triggers"]
  const rows = drivecycle.composition.map((r) => [
    r.subcycleId,
    r.subcycleName,
    r.repetitions,
    r.ambientTemp,
    r.location,
    r.triggers.map((t) => `${t.type}:${t.value}`).join(";") || ""
  ])
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${drivecycle.id}_${drivecycle.name.replace(/\s+/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DriveCycleBuilder({ subcycles, drivecycles, onDrivecyclesChange }: DrivecycleBuilderProps) {
  const [editingDrivecycle, setEditingDrivecycle] = useState<Drivecycle | null>(null)
  const [showForm, setShowForm] = useState(false)

  const generateId = () => `DC${String(drivecycles.length + 1).padStart(3, "0")}`

  const handleAddDrivecycle = (drivecycle: Omit<Drivecycle, "id" | "source">) => {
    const newDrivecycle: Drivecycle = {
      ...drivecycle,
      id: generateId(),
      source: "manual",
    }
    onDrivecyclesChange([...drivecycles, newDrivecycle])
    setShowForm(false)
  }

  const handleEditDrivecycle = (id: string, drivecycle: Omit<Drivecycle, "id" | "source">) => {
    const existingDrivecycle = drivecycles.find(dc => dc.id === id)
    onDrivecyclesChange(drivecycles.map((dc) => (
      dc.id === id ? { ...drivecycle, id, source: existingDrivecycle?.source || "manual" } : dc
    )))
    setEditingDrivecycle(null)
  }

  const handleDeleteDrivecycle = (id: string) => {
    onDrivecyclesChange(drivecycles.filter((dc) => dc.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drive cycle Library</h1>
          <p className="text-muted-foreground">Combine sub-cycles to create complete drive cycles (max 86400 seconds per day)</p>
        </div>
        {!showForm && !editingDrivecycle && (
          <>
            <Button onClick={() => setShowForm(true)} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Create New Drive Cycle
            </Button>
          </>
        )}
      </div>


      {showForm && (
        <DrivecycleForm subcycles={subcycles} onSubmit={handleAddDrivecycle} onCancel={() => setShowForm(false)} />
      )}

      {editingDrivecycle && (
        <DrivecycleForm
          subcycles={subcycles}
          onSubmit={(drivecycle) => handleEditDrivecycle(editingDrivecycle.id, drivecycle)}
          onCancel={() => setEditingDrivecycle(null)}
          initialData={editingDrivecycle}
          isEditing
        />
      )}

      <div className="grid gap-4">
        {drivecycles.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center">
              <p className="text-muted-foreground">No drive cycles created yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          drivecycles.map((drivecycle) => {
            const duration = computeDrivecycleDuration(drivecycle, subcycles)
            return (
              <Card key={drivecycle.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {drivecycle.id} - {drivecycle.name}
                      </CardTitle>
                      <CardDescription>
                        {drivecycle.notes || "No description"} • Duration: {convertSecondsToHMS(duration)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => exportDrivecycleJson(drivecycle)}>
                        <Download className="h-4 w-4" />
                        Json
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => exportDrivecycleCsv(drivecycle)}>
                        <Download className="h-4 w-4" />
                        Csv
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDrivecycle(drivecycle)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteDrivecycle(drivecycle.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <div className="px-6 pb-6">
                  <DrivecycleCompositionTable
                    composition={drivecycle.composition}
                    onCompositionChange={(composition) =>
                      handleEditDrivecycle(drivecycle.id, {
                        ...drivecycle,
                        composition,
                      })
                    }
                    subcycles={subcycles}
                  />
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2 } from "lucide-react"
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
  maxDuration: number
}

interface DrivecycleBuilderProps {
  subcycles: any[]
  drivecycles: Drivecycle[]
  onDrivecyclesChange: (drivecycles: Drivecycle[]) => void
}

export default function DriveCycleBuilder({ subcycles, drivecycles, onDrivecyclesChange }: DrivecycleBuilderProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDrivecycle, setEditingDrivecycle] = useState<Drivecycle | null>(null)

  const generateId = () => `DC${String(drivecycles.length + 1).padStart(3, "0")}`

  const handleAddDrivecycle = (drivecycle: Omit<Drivecycle, "id">) => {
    const newDrivecycle = {
      ...drivecycle,
      id: generateId(),
    }
    onDrivecyclesChange([...drivecycles, newDrivecycle])
    setShowForm(false)
  }

  const handleEditDrivecycle = (id: string, drivecycle: Omit<Drivecycle, "id">) => {
    onDrivecyclesChange(drivecycles.map((dc) => (dc.id === id ? { ...drivecycle, id } : dc)))
    setEditingDrivecycle(null)
  }

  const handleDeleteDrivecycle = (id: string) => {
    onDrivecyclesChange(drivecycles.filter((dc) => dc.id !== id))
  }

  return (
    <div className="space-y-6">
      {!showForm && !editingDrivecycle && (
        <Button onClick={() => setShowForm(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Create New Drive Cycle
        </Button>
      )}

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
          drivecycles.map((drivecycle) => (
            <Card key={drivecycle.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {drivecycle.id} - {drivecycle.name}
                    </CardTitle>
                    <CardDescription>
                      {drivecycle.notes || "No description"} • Max Duration: {drivecycle.maxDuration}s
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingDrivecycle(drivecycle)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteDrivecycle(drivecycle.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

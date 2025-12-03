"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2 } from "lucide-react"
import SubcycleForm from "./subcycle-form"
import SubcycleStepTable from "./subcycle-step-table"

interface Subcycle {
  id: string
  name: string
  notes: string
  source: "manual" | "import"
  steps: any[]
}

interface SubcycleLibraryProps {
  subcycles: Subcycle[]
  onSubcyclesChange: (subcycles: Subcycle[]) => void
}

export default function SubcycleLibrary({ subcycles, onSubcyclesChange }: SubcycleLibraryProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSubcycle, setEditingSubcycle] = useState<Subcycle | null>(null)

  const generateId = () => `SC${String(subcycles.length + 1).padStart(3, "0")}`

  const handleAddSubcycle = (subcycle: Omit<Subcycle, "id">) => {
    const newSubcycle = {
      ...subcycle,
      id: generateId(),
    }
    onSubcyclesChange([...subcycles, newSubcycle])
    setShowForm(false)
  }

  const handleEditSubcycle = (id: string, subcycle: Omit<Subcycle, "id">) => {
    onSubcyclesChange(subcycles.map((sc) => (sc.id === id ? { ...subcycle, id } : sc)))
    setEditingSubcycle(null)
  }

  const handleDeleteSubcycle = (id: string) => {
    onSubcyclesChange(subcycles.filter((sc) => sc.id !== id))
  }

  return (
    <div className="space-y-6">
      {!showForm && !editingSubcycle && (
        <Button onClick={() => setShowForm(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Create New Sub-cycle
        </Button>
      )}

      {showForm && <SubcycleForm onSubmit={handleAddSubcycle} onCancel={() => setShowForm(false)} />}

      {editingSubcycle && (
        <SubcycleForm
          onSubmit={(subcycle) => handleEditSubcycle(editingSubcycle.id, subcycle)}
          onCancel={() => setEditingSubcycle(null)}
          initialData={editingSubcycle}
          isEditing
        />
      )}

      <div className="grid gap-4">
        {subcycles.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center">
              <p className="text-muted-foreground">No sub-cycles created yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          subcycles.map((subcycle) => (
            <Card key={subcycle.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {subcycle.id} - {subcycle.name}
                    </CardTitle>
                    <CardDescription>{subcycle.notes || "No description"}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingSubcycle(subcycle)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteSubcycle(subcycle.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SubcycleStepTable
                  steps={subcycle.steps}
                  onStepsChange={(steps) => handleEditSubcycle(subcycle.id, { ...subcycle, steps })}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

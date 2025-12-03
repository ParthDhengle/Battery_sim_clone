"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import CompositionEditor from "./composition-editor"

interface CompositionRow {
  id: string
  subcycleId: string
  subcycleName: string
  repetitions: number
  ambientTemp: number
  location: string
  triggers: Array<{ type: string; value: any }>
}

interface DrivecycleCompositionTableProps {
  composition: CompositionRow[]
  onCompositionChange: (composition: CompositionRow[]) => void
  subcycles: any[]
}

export default function DrivecycleCompositionTable({
  composition,
  onCompositionChange,
  subcycles,
}: DrivecycleCompositionTableProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const generateId = () => `ROW_${Date.now()}`

  const handleAddComposition = (row: Omit<CompositionRow, "id">) => {
    onCompositionChange([...composition, { ...row, id: generateId() }])
    setShowNew(false)
  }

  const handleEditComposition = (id: string, row: Omit<CompositionRow, "id">) => {
    onCompositionChange(composition.map((c) => (c.id === id ? { ...row, id } : c)))
    setEditing(null)
  }

  const handleDeleteComposition = (id: string) => {
    onCompositionChange(composition.filter((c) => c.id !== id))
  }

  if (showNew) {
    return (
      <CompositionEditor subcycles={subcycles} onSubmit={handleAddComposition} onCancel={() => setShowNew(false)} />
    )
  }

  if (editing) {
    const row = composition.find((c) => c.id === editing)
    if (row) {
      return (
        <CompositionEditor
          subcycles={subcycles}
          onSubmit={(newRow) => handleEditComposition(editing, newRow)}
          onCancel={() => setEditing(null)}
          initialData={row}
          isEditing
        />
      )
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Sub-cycle
      </Button>

      {composition.length === 0 ? (
        <Card className="p-4 text-center text-muted-foreground">
          No sub-cycles in composition. Add one to start building the drive cycle.
        </Card>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sr. No.</TableHead>
                <TableHead>Sub-cycle ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Repetitions</TableHead>
                <TableHead>Ambient Temp (°C)</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {composition.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{row.subcycleId}</TableCell>
                  <TableCell>{row.subcycleName}</TableCell>
                  <TableCell>{row.repetitions}</TableCell>
                  <TableCell>{row.ambientTemp}</TableCell>
                  <TableCell>{row.location}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row.id)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteComposition(row.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

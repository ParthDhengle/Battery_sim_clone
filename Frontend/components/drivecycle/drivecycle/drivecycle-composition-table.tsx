// components/drivecycle/drivecycle-composition-table.tsx

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, Edit2 } from "lucide-react"
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

function getSubcycleDuration(subcycle: any) {
  return subcycle.steps.reduce((sum: number, s: any) => sum + (s.duration * s.repetitions), 0)
}

export default function DrivecycleCompositionTable({
  composition,
  onCompositionChange,
  subcycles,
}: DrivecycleCompositionTableProps) {
  const [editingRow, setEditingRow] = useState<CompositionRow | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)

  const handleSave = (data: any) => {
    if (isAddingNew) {
      onCompositionChange([...composition, { ...data, id: `ROW_${Date.now()}` }])
    } else if (editingRow) {
      onCompositionChange(composition.map(c => c.id === editingRow.id ? { ...c, ...data } : c))
    }
    setIsAddingNew(false)
    setEditingRow(null)
  }

  const handleCancel = () => {
    setIsAddingNew(false)
    setEditingRow(null)
  }

  const startEdit = (row: CompositionRow) => {
    setEditingRow(row)
    setIsAddingNew(false)
  }

  const startAdd = () => {
    setIsAddingNew(true)
    setEditingRow(null)
  }

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Drive Cycle Composition</h3>
        <Button
          onClick={startAdd}
          size="sm"
          disabled={isAddingNew || !!editingRow}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Sub-cycle
        </Button>
      </div>

      {/* Table */}
      {composition.length === 0 && !isAddingNew && !editingRow ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-lg">
            No sub-cycles added yet. Click "Add Sub-cycle" to build your drive cycle.
          </p>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Sr.</TableHead>
                  <TableHead>Sub-cycle</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Temp (°C)</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {composition.map((row, index) => {
                  const subcycle = subcycles.find((sc: any) => sc.id === row.subcycleId)
                  const duration = subcycle ? getSubcycleDuration(subcycle) * row.repetitions : 0

                  return (
                    <TableRow key={row.id} className="h-14">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{row.subcycleId}</TableCell>
                      <TableCell className="font-medium">{row.subcycleName}</TableCell>
                      <TableCell>{row.repetitions}</TableCell>
                      <TableCell>{row.ambientTemp}</TableCell>
                      <TableCell>{row.location || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {row.triggers.length > 0
                          ? row.triggers.map(t => `${t.type}: ${t.value}`).join(" • ")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(row)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onCompositionChange(composition.filter(c => c.id !== row.id))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Editor Form — Outside the Table (Clean & Beautiful) */}
      {(isAddingNew || editingRow) && (
        <Card className="border-2 border-primary/20 bg-primary/2 shadow-lg">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {isAddingNew ? "Add New Sub-cycle" : "Edit Sub-cycle"}
            </h3>
            <CompositionEditor
              subcycles={subcycles}
              initialData={editingRow || undefined}
              onSubmit={handleSave}
              onCancel={handleCancel}
              isEditing={!!editingRow}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
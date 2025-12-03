"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Download, Edit2, Trash2 } from "lucide-react"
import SubcycleManualEditor from "./subcycle-manual-editor"
import SubcycleImportTab from "./subcycle-import-tab"
import { calculateTotalDuration, exportSubcycleCsv, exportSubcycleJson } from "./subcycle-utils"

interface Subcycle {
  id: string
  name: string
  description: string
  source: "manual" | "import"
  steps: any[]
}

interface SubcycleLibraryProps {
  subcycles: Subcycle[]
  onSubcyclesChange: (subcycles: Subcycle[]) => void
}

export default function SubcycleLibrary({ subcycles, onSubcyclesChange }: SubcycleLibraryProps) {
  const [showCreator, setShowCreator] = useState(false)
  const [editingSubcycle, setEditingSubcycle] = useState<Subcycle | null>(null)

  const generateId = () => `SC${String(subcycles.length + 1).padStart(3, "0")}`

  const handleSave = (data: { name: string; description: string; steps: any[] }, source: "manual" | "import") => {
    if (editingSubcycle) {
      onSubcyclesChange(subcycles.map(sc => sc.id === editingSubcycle.id ? { ...editingSubcycle, ...data } : sc))
      setEditingSubcycle(null)
    } else {
      const newSubcycle: Subcycle = {
        id: generateId(),
        name: data.name,
        description: data.description,
        source,
        steps: data.steps,
      }
      onSubcyclesChange([...subcycles, newSubcycle])
    }
    setShowCreator(false)
  }

  const handleDelete = (id: string) => {
    onSubcyclesChange(subcycles.filter(sc => sc.id !== id))
  }

  const handleEdit = (subcycle: Subcycle) => {
    setEditingSubcycle(subcycle)
    setShowCreator(true)
  }

  if (showCreator || editingSubcycle) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingSubcycle ? "Edit" : "Create New"} Sub-cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="manual">Add Steps Manually</TabsTrigger>
                <TabsTrigger value="import">Import from File</TabsTrigger>
              </TabsList>

              <TabsContent value="manual">
                <SubcycleManualEditor
                  initialData={editingSubcycle}
                  onSave={(data) => handleSave(data, "manual")}
                  onCancel={() => {
                    setShowCreator(false)
                    setEditingSubcycle(null)
                  }}
                />
              </TabsContent>

              <TabsContent value="import">
                <SubcycleImportTab
                  onSave={(data) => handleSave(data, "import")}
                  onCancel={() => {
                    setShowCreator(false)
                    setEditingSubcycle(null)
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sub-cycle Library</h1>
          <p className="text-muted-foreground">Create and manage reusable drive cycle segments</p>
        </div>
        <Button onClick={() => setShowCreator(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Create New Sub-cycle
        </Button>
      </div>

      {subcycles.length === 0 ? (
        <Card>
          <CardContent className="pt-16 text-center">
            <p className="text-muted-foreground text-lg">No sub-cycles yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {subcycles.map((subcycle) => (
            <Card key={subcycle.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{subcycle.id} - {subcycle.name}</CardTitle>
                    <CardDescription>{subcycle.description || "No description"}</CardDescription>
                    <p className="text-sm font-medium text-foreground">
                      Total Duration: {calculateTotalDuration(subcycle.steps).toFixed(1)} s
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subcycle.steps.length} step{subcycle.steps.length !== 1 ? "s" : ""} • {subcycle.source}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportSubcycleJson(subcycle)}>
                    <Download className="h-4 w-4 mr-1" /> JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportSubcycleCsv(subcycle)}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(subcycle)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(subcycle.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
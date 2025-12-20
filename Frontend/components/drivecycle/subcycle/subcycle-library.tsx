// FILE: Frontend/components/drivecycle/subcycle/subcycle-library.tsx
"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Plus, Download, Edit2, Trash2, X, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ManualEditor from "./manual-editor"
import ImportTab from "./import-tab"
import { exportSubcycleJson, exportSubcycleCsv, convertSecondsToHMS, getStepCount, getTotalDuration } from "./utils"
import { Subcycle, LightSubcycle, SubcycleLibraryProps, Step } from "./types"
import { updateSimulationSubcycles, getLightSubcycles, createSubcycle, updateSubcycle, getSubcycle } from "@/lib/api/drive-cycle"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SubcycleLibrary({ subcycles, onSubcyclesChange, simId, simName }: SubcycleLibraryProps & { simName?: string }) {
  const [isCreating, setIsCreating] = useState(false)
  const [isAddingExisting, setIsAddingExisting] = useState(false)
  const [editingSubcycle, setEditingSubcycle] = useState<Subcycle | null>(null)
  const [viewingTableId, setViewingTableId] = useState<string | null>(null)
  const [fullSubcycle, setFullSubcycle] = useState<Subcycle | null>(null)  // For full view
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [nameError, setNameError] = useState("")
  const [globalLightSubcycles, setGlobalLightSubcycles] = useState<LightSubcycle[]>([])  // Light for add-from-library
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false) // Separate saving state for UX

  useEffect(() => {
    if (editingSubcycle) {
      setName(editingSubcycle.name)
      setDescription(editingSubcycle.description || "")
    } else if (isCreating) {
      setName("")
      setDescription("")
    }
    setNameError("")
  }, [editingSubcycle, isCreating])

  useEffect(() => {
    const fetchGlobalLight = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getLightSubcycles()  // Use light endpoint for fast load
        setGlobalLightSubcycles(data)
      } catch (err: any) {
        setError("Failed to load subcycles: " + err.message)
        console.error("Failed to load light subcycles from backend", err)
      } finally {
        setLoading(false)
      }
    }
    if (simId) fetchGlobalLight()
  }, [simId])

  const isEditorOpen = isCreating || !!editingSubcycle

  const startCreating = () => {
    setIsAddingExisting(false)
    setIsCreating(true)
    setEditingSubcycle(null)
  }

  const startAdding = () => {
    setIsCreating(false)
    setEditingSubcycle(null)
    setIsAddingExisting(true)
    setSelectedToAdd([])
  }

  const startEditing = (subcycle: Subcycle) => {
    setEditingSubcycle(subcycle)
    setIsCreating(false)
  }

  const cancelEditor = () => {
    setIsCreating(false)
    setIsAddingExisting(false)
    setEditingSubcycle(null)
    setName("")
    setDescription("")
    setNameError("")
  }

  const handleAddExisting = async () => {
    if (!simId || selectedToAdd.length === 0) return
    try {
      setLoading(true)
      setError(null)
      const currentIds = subcycles.map(s => s.id)
      const newIds = Array.from(new Set([...currentIds, ...selectedToAdd]))
      await updateSimulationSubcycles(simId, newIds)
      // Fetch full details only for added ones (on-demand)
      const addedFull = await Promise.all(selectedToAdd.map(id => getSubcycle(id)))
      onSubcyclesChange([...subcycles.filter(s => !selectedToAdd.includes(s.id)), ...addedFull])
      setSelectedToAdd([])
      setIsAddingExisting(false)
    } catch (err: any) {
      const message = err?.message || String(err)
      setError("Failed to add subcycles: " + message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (steps: Step[], source: "manual" | "import") => {
    // Pre-validate name uniqueness (frontend-side, using light list)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }
    if (steps.length === 0) {
      setNameError("At least one step is required")
      return
    }
    const isDuplicate = globalLightSubcycles.some(sc => sc.name.toLowerCase() === trimmedName.toLowerCase() && (!editingSubcycle || sc.id !== editingSubcycle.id))
    if (isDuplicate) {
      setNameError("A subcycle with this name already exists. Please choose a unique name.")
      return
    }
    const payload = {
      name: trimmedName,
      description: description.trim(),
      source,
      steps: steps.map(s => ({ ...s, value: Number(s.value) })) // Ensure numbers for backend
    }
    try {
      setSaving(true)
      setError(null)
      setNameError("")
      let savedSubcycle: Subcycle
      if (editingSubcycle) {
        savedSubcycle = await updateSubcycle(editingSubcycle.id, payload) // Types match now
        // Update light list with new metadata
        setGlobalLightSubcycles(prev =>
          prev.map(sc => sc.id === editingSubcycle.id ? { ...sc, name: savedSubcycle.name, description: savedSubcycle.description } : sc)
        )
        onSubcyclesChange(subcycles.map(s => s.id === savedSubcycle.id ? savedSubcycle : s))
      } else {
        // Updated logic: Always fetch after create to ensure full, consistent data and valid ID
        const createdSubcycle = await createSubcycle(payload, simName) // Pass simName
        if (!createdSubcycle || !createdSubcycle.id || typeof createdSubcycle.id !== 'string') {
          throw new Error("Failed to create subcycle: invalid or missing ID in server response")
        }
        savedSubcycle = await getSubcycle(createdSubcycle.id)
        // Add light version to global list
        setGlobalLightSubcycles(prev => [...prev, { id: savedSubcycle.id, name: savedSubcycle.name, description: savedSubcycle.description, source: savedSubcycle.source, num_steps: savedSubcycle.num_steps, total_duration: savedSubcycle.total_duration }])
        if (simId) {
          const currentIds = subcycles.map(s => s.id).filter(id => typeof id === 'string') // Safety filter
          const newIds = [...currentIds, savedSubcycle.id]
          await updateSimulationSubcycles(simId, newIds)
          onSubcyclesChange([...subcycles, savedSubcycle])
        }
      }
      cancelEditor()
    } catch (err: any) {
      const message = err?.message || String(err)
      // Specific handling for common errors
      if (message.includes("already exists")) {
        setNameError("A subcycle with this name already exists. Please choose a unique name.")
      } else {
        setNameError("Failed to save: " + message)
        setError("Failed to save subcycle: " + message)
      }
      console.error("Save error details:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleViewTable = async (id: string) => {
    try {
      setLoading(true)
      const full = await getSubcycle(id)
      setFullSubcycle(full)
      setViewingTableId(id)
    } catch (err: any) {
      alert("Failed to load full subcycle: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!simId) return
    if (!confirm("Remove this sub-cycle from CURRENT simulation? (It will remain in the database)")) return
    try {
      setLoading(true)
      const newIds = subcycles.filter(s => s.id !== id).map(s => s.id)
      await updateSimulationSubcycles(simId, newIds)
      onSubcyclesChange(subcycles.filter(s => s.id !== id))
    } catch (err: any) {
      setError("Failed to remove subcycle: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !globalLightSubcycles.length) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading subcycles...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sub-cycle Library</h1>
          <p className="text-muted-foreground">Manage sub-cycles for current simulation</p>
        </div>
        {!isEditorOpen && !isAddingExisting && (
          <div className="flex gap-2">
            <Button onClick={startAdding} variant="outline" size="lg" className="gap-2" disabled={loading}>
              <Plus className="h-5 w-5" /> Add From Library
            </Button>
            <Button onClick={startCreating} size="lg" className="gap-2" disabled={loading}>
              <Plus className="h-5 w-5" /> Create New
            </Button>
          </div>
        )}
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isAddingExisting && (
        <Card className="border-2 border-primary/30 bg-primary/2 shadow-xl">
          <CardHeader>
            <h2 className="text-2xl font-bold">Add Sub-cycles from Global Library</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-h-[300px] overflow-y-auto border rounded-md p-2 bg-background space-y-2">
              {globalLightSubcycles.filter(g => !subcycles.find(l => l.id === g.id)).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No other subcycles available. Create some first!</p>
              ) : (
                globalLightSubcycles.filter(g => !subcycles.find(l => l.id === g.id)).map(sc => (
                  <div key={sc.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                    <Checkbox
                      id={sc.id}
                      checked={selectedToAdd.includes(sc.id)}
                      onCheckedChange={(checked) => {
                        setSelectedToAdd(prev =>
                          checked
                            ? [...prev, sc.id]
                            : prev.filter(id => id !== sc.id)
                        )
                      }}
                      disabled={loading}
                    />
                    <label htmlFor={sc.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{sc.name} <span className="text-xs text-muted-foreground ml-2">({sc.id})</span></div>
                      <div className="text-xs text-muted-foreground">{sc.description || "No description"} • {getStepCount(sc as any)} steps</div> {/* Cast for utils */}
                    </label>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelEditor} disabled={loading}>Cancel</Button>
              <Button onClick={handleAddExisting} disabled={selectedToAdd.length === 0 || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add {selectedToAdd.length} Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isEditorOpen && (
        <Card className="border-2 border-primary/30 bg-primary/2 shadow-xl">
          <CardHeader>
            <h2 className="text-2xl font-bold">
              {editingSubcycle ? "Edit Sub-cycle" : "Create New Sub-cycle"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError("") }}
                  placeholder="e.g., Highway Cruise"
                  className={nameError ? "border-destructive" : ""}
                  disabled={saving}
                />
                {nameError && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {nameError}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., 100 km/h constant speed with regen"
                  disabled={saving}
                />
              </div>
            </div>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="import">Import CSV</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="mt-6">
                <ManualEditor
                  initialData={editingSubcycle}
                  onSave={(d) => handleSave(d.steps, "manual")}
                  onCancel={cancelEditor}
                />
              </TabsContent>
              <TabsContent value="import" className="mt-6">
                <ImportTab onSave={(d) => handleSave(d.steps, "import")} onCancel={cancelEditor} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      <div className={isEditorOpen ? "opacity-70 pointer-events-none select-none" : ""}>
        <h2 className="text-2xl mb-6">Your Sub-cycles ({subcycles.length})</h2>
        {subcycles.length === 0 ? (
          <Card className="py-16 text-center">
            <CardContent>
              <p className="text-lg text-muted-foreground">No sub-cycles created yet.</p>
              <Button onClick={startCreating} className="mt-6" disabled={isEditorOpen || loading}>
                <Plus className="h-4 w-4 mr-2" /> Create Your First Sub-cycle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {subcycles.map((subcycle) => {
              const stepCount = getStepCount(subcycle)
              const totalSec = getTotalDuration(subcycle)
              const hasTriggerOnly = subcycle.steps.some((s: Step) => s.stepType === "trigger_only")
              const durationText = hasTriggerOnly ? "Dynamic (triggers)" : convertSecondsToHMS(totalSec)
              const isLargeImport = subcycle.source === "import_file" || (subcycle.source === "import" && stepCount > 1000)
              return (
                <Card key={subcycle.id} className={`overflow-hidden transition-all ${editingSubcycle?.id === subcycle.id ? "ring-2 ring-primary shadow-lg" : ""}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold"> {subcycle.name}</h3>
                          {editingSubcycle?.id === subcycle.id && (
                            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">Editing</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{subcycle.description || "No description"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div>Duration: <strong className={hasTriggerOnly ? "text-amber-600" : ""}>{durationText}</strong></div>
                        <div>Steps: <strong>{stepCount}</strong> {isLargeImport ? "(Large file)" : ""}</div>
                        <div>Source: <strong className="capitalize">{subcycle.source}</strong></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => exportSubcycleJson(subcycle)} disabled={loading}>
                          <Download className="h-4 w-4 mr-1" /> JSON
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => exportSubcycleCsv(subcycle)} disabled={loading}>
                          <Download className="h-4 w-4 mr-1" /> CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(subcycle)}
                          disabled={subcycle.source !== "manual" || loading || isEditorOpen}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(subcycle.id)} disabled={loading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {stepCount > 0 && (
                    <CardContent className="p-0">
                      <div className="flex justify-end p-6 pt-3">
                        <Button size="sm" variant="outline" onClick={() => handleViewTable(subcycle.id)} disabled={loading}>
                          View Full Table →
                        </Button>
                      </div>
                      {subcycle.steps.length > 0 ? (
                        <div className="overflow-x-auto -mx-6">
                          <div className="rounded-lg border bg-card mx-6">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">No.</TableHead>
                                  <TableHead>Duration (s)</TableHead>
                                  <TableHead>Timestep</TableHead>
                                  <TableHead>Value Type</TableHead>
                                  <TableHead>Value</TableHead>
                                  <TableHead>Reps</TableHead>
                                  <TableHead>Step Type</TableHead>
                                  <TableHead>Triggers</TableHead>
                                  <TableHead>Label</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {subcycle.steps.slice(0, 5).map((step: Step, i: number) => (
                                  <TableRow key={step.id ?? i}>
                                    <TableCell>{i + 1}</TableCell>
                                    <TableCell>{step.stepType === "trigger_only" ? "-" : step.duration}</TableCell>
                                    <TableCell>{step.timestep}</TableCell>
                                    <TableCell className="capitalize">{step.valueType}</TableCell>
                                    <TableCell>{step.value} {step.unit}</TableCell>
                                    <TableCell>{step.repetitions}</TableCell>
                                    <TableCell>
                                      <span className="text-xs px-2 py-1 bg-secondary rounded">
                                        {step.stepType.replace(/_/g, " ")}
                                      </span>
                                    </TableCell>
                                    <TableCell className="max-w-[180px]">
                                      {step.triggers.length > 0 ? (
                                        <div className="space-y-1 text-xs">
                                          {step.triggers.map((t, i: number) => (
                                            <div key={i}>{t.type.replace(/_/g, " ")}: {t.value}</div>
                                          ))}
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell className="truncate max-w-[120px]">{step.label || "-"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {subcycle.steps.length > 5 && (
                              <div className="text-center text-xs text-muted-foreground py-3 border-t bg-muted/20">
                                Showing first 5 of {stepCount} steps
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground">
                          Large import file ({stepCount} steps). Use "View Full Table" to see details.
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
      {viewingTableId && fullSubcycle && (
        <FullTable subcycle={fullSubcycle} onClose={() => { setViewingTableId(null); setFullSubcycle(null) }} />
      )}
    </div>
  )
}

function FullTable({ subcycle, onClose }: { subcycle: Subcycle; onClose: () => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const ROWS_PER_PAGE = 100
  const totalSteps = subcycle.steps.length
  const totalPages = Math.ceil(totalSteps / ROWS_PER_PAGE)
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE
  const currentSteps = subcycle.steps.slice(startIndex, startIndex + ROWS_PER_PAGE)
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">{subcycle.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {subcycle.steps.length} steps • {convertSecondsToHMS(subcycle.steps.reduce((sum: number, s: Step) => sum + s.duration * s.repetitions, 0))} total
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-auto p-6 flex-1">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Duration (s)</TableHead>
                  <TableHead>Timestep</TableHead>
                  <TableHead>Value Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Step Type</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSteps.map((step: Step, i: number) => (
                  <TableRow key={step.id ?? i}> {/* Fallback key */}
                    <TableCell>{startIndex + i + 1}</TableCell>
                    <TableCell>{step.stepType === "trigger_only" ? "-" : step.duration}</TableCell>
                    <TableCell>{step.timestep}</TableCell>
                    <TableCell className="capitalize">{step.valueType}</TableCell>
                    <TableCell>{step.value} {step.unit}</TableCell>
                    <TableCell>{step.repetitions}</TableCell>
                    <TableCell><span className="text-xs px-2 py-1 bg-secondary rounded">{step.stepType.replace(/_/g, " ")}</span></TableCell>
                    <TableCell className="text-xs">
                      {step.triggers.length > 0 ? step.triggers.map((t) => `${t.type.replace(/_/g, " ")}: ${t.value}`).join(" | ") : "-"}
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]">{step.label || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-6 border-t bg-muted/30">
            <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
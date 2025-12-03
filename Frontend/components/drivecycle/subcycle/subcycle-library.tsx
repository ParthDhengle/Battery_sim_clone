"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Download, Edit2, Trash2, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"

interface Step {
  id: string
  duration: number
  timestep: number
  valueType: string
  value: string
  unit: string
  repetitions: number
  stepType: string
  triggers: Array<{ type: string; value: number }>
  label: string
}

interface Subcycle {
  id: string
  name: string
  description: string
  source: "manual" | "import"
  steps: Step[]
}

interface SubcycleLibraryProps {
  subcycles: Subcycle[]
  onSubcyclesChange: (subcycles: Subcycle[]) => void
}

// Utility Functions
const calculateTotalDuration = (steps: Step[]) =>
  steps.reduce((sum, s) => sum + (s.duration * s.repetitions), 0)

const exportSubcycleJson = (subcycle: Subcycle) => {
  const data = JSON.stringify(subcycle, null, 2)
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${subcycle.id}_${subcycle.name.replace(/\s+/g, "_")}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const exportSubcycleCsv = (subcycle: Subcycle) => {
  if (subcycle.steps.length === 0) return
  const headers = ["Index", "Duration(s)", "Timestep(s)", "ValueType", "Value", "Unit", "Repetitions", "StepType", "Label", "Triggers"]
  const rows = subcycle.steps.map((s, i) => [
    i + 1, s.duration, s.timestep, s.valueType, s.value, s.unit, s.repetitions, s.stepType, s.label || "",
    s.triggers.map((t) => `${t.type}:${t.value}`).join(";") || ""
  ])
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${subcycle.id}_${subcycle.name.replace(/\s+/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const downloadTemplate = () => {
  const csvContent = 
`Index,Duration(s),Timestep(s),ValueType,Value,Unit,Repetitions,StepType,Label,Triggers
1,300,1,current,50,A,1,fixed,Highway Cruise,
2,60,1,current,-100,A,1,fixed,Regenerative Braking,
3,10,0.1,voltage,3.0,V,1,fixed_with_triggers,Charge Pulse,"voltage_high:4.2"
4,3600,1,current,0,A,1,fixed,Rest Period,
`
  const blob = new Blob([csvContent], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "subcycle_template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// Step Editor Component
function StepEditor({ onSubmit, onCancel, initialData, isEditing }: any) {
  const [step, setStep] = useState(
    initialData || {
      duration: 10,
      timestep: 1,
      valueType: "current",
      value: "0",
      unit: "A",
      repetitions: 1,
      stepType: "fixed",
      triggers: [],
      label: "",
    }
  )

  const unitMap: Record<string, string> = {
    current: "A",
    c_rate: "C",
    voltage: "V",
    power: "W",
    resistance: "Ω",
  }

  const handleValueTypeChange = (valueType: string) => {
    setStep({ ...step, valueType, unit: unitMap[valueType] || "A" })
  }

  const handleAddTrigger = () => {
    setStep({
      ...step,
      triggers: [...step.triggers, { type: "voltage_low", value: 0 }],
    })
  }

  const handleRemoveTrigger = (index: number) => {
    setStep({
      ...step,
      triggers: step.triggers.filter((_: any, i: number) => i !== index),
    })
  }

  const handleUpdateTrigger = (index: number, type: string, value: number) => {
    const newTriggers = [...step.triggers]
    newTriggers[index] = { type, value }
    setStep({ ...step, triggers: newTriggers })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (step.stepType === "trigger_only" && step.triggers.length === 0) {
      alert("Trigger-only steps must have at least one trigger")
      return
    }

    onSubmit(step)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              value={step.label}
              onChange={(e) => setStep({ ...step, label: e.target.value })}
              placeholder="e.g., Charge Phase"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration (s) *</Label>
              <Input
                id="duration"
                step="0.1"
                min="0.1"
                value={step.duration}
                onChange={(e) => setStep({ ...step, duration: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="repetitions">Repetitions *</Label>
              <Input
                id="repetitions"
                min="1"
                value={step.repetitions}
                onChange={(e) => setStep({ ...step, repetitions: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="timestep">Timestep (s) *</Label>
            <Input
              id="timestep"
              type="number"
              step="0.1"
              value={step.timestep}
              onChange={(e) => setStep({ ...step, timestep: parseFloat(e.target.value) || 1 })}
              required
            />
          </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valueType">Value Type *</Label>
              <Select value={step.valueType} onValueChange={handleValueTypeChange}>
                <SelectTrigger id="valueType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current (A)</SelectItem>
                  <SelectItem value="c_rate">C-Rate (C)</SelectItem>
                  <SelectItem value="voltage">Voltage (V)</SelectItem>
                  <SelectItem value="power">Power (W)</SelectItem>
                  <SelectItem value="resistance">Resistance (Ω)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="value">Value *</Label>
              <Input
                id="value"
                value={step.value}
                onChange={(e) => setStep({ ...step, value: e.target.value })}
                placeholder="e.g., 3.5 or 0.5*C_rate"
                required
              />
            </div>
          </div>
          <div>
              <Label htmlFor="stepType">Step Type *</Label>
              <Select value={step.stepType} onValueChange={(val) => setStep({ ...step, stepType: val })}>
                <SelectTrigger id="stepType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Duration</SelectItem>
                  <SelectItem value="trigger_only">Trigger Only</SelectItem>
                  <SelectItem value="fixed_with_triggers">Fixed with Triggers</SelectItem>
                </SelectContent>
              </Select>
            </div>

          

          {(step.stepType === "trigger_only" || step.stepType === "fixed_with_triggers") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Triggers</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleAddTrigger} className="gap-2">
                  <Plus className="h-3 w-3" />
                  Add Trigger
                </Button>
              </div>

              {step.triggers.map((trigger: any, index: number) => (
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

                    {/* Pack-Level Triggers */}
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
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Step" : "Add Step"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function convertSecondsToHMS(totalSeconds) {
  totalSeconds = Number(totalSeconds);

  const secondsInMonth = 30 * 24 * 3600; // 30 days
  const secondsInDay = 24 * 3600;
  const secondsInHour = 3600;
  const secondsInMinute = 60;

  const months = Math.floor(totalSeconds / secondsInMonth);
  totalSeconds %= secondsInMonth;

  const days = Math.floor(totalSeconds / secondsInDay);
  totalSeconds %= secondsInDay;

  const hours = Math.floor(totalSeconds / secondsInHour);
  totalSeconds %= secondsInHour;

  const minutes = Math.floor(totalSeconds / secondsInMinute);
  const seconds = Math.floor(totalSeconds % secondsInMinute);

  const parts = [];
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}


// Step Table Component
function StepTable({ steps, onStepsChange }: { steps: Step[], onStepsChange: (steps: Step[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const generateStepId = () => `STEP_${Date.now()}`

  const handleAddStep = (step: Omit<Step, "id">) => {
    onStepsChange([...steps, { ...step, id: generateStepId() }])
    setShowNew(false)
  }

  const handleEditStep = (id: string, step: Omit<Step, "id">) => {
    onStepsChange(steps.map((s) => (s.id === id ? { ...step, id } : s)))
    setEditing(null)
  }

  const handleDeleteStep = (id: string) => onStepsChange(steps.filter((s) => s.id !== id))

  const handleLiveUpdate = (id: string, field: keyof Step, value: any) => {
    onStepsChange(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  if (showNew) return <StepEditor onSubmit={handleAddStep} onCancel={() => setShowNew(false)} />
  
  if (editing) {
    const step = steps.find((s) => s.id === editing)
    if (step) {
      return (
        <StepEditor
          onSubmit={(newStep: any) => handleEditStep(editing, newStep)}
          onCancel={() => setEditing(null)}
          initialData={step}
          isEditing
        />
      )
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      {steps.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No steps defined. Add a step to start building the sub-cycle.
        </Card>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">#</TableHead>
                <TableHead className="whitespace-nowrap">Duration (s)</TableHead>
                <TableHead className="whitespace-nowrap">Timestep (s)</TableHead>
                <TableHead className="whitespace-nowrap">Value Type</TableHead>
                <TableHead className="whitespace-nowrap">Value</TableHead>
                <TableHead className="whitespace-nowrap">Reps</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Triggers</TableHead>
                <TableHead className="whitespace-nowrap">Label</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step, index) => (
                <TableRow key={step.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {step.duration}
                    
                  </TableCell>
                  <TableCell>{step.timestep}</TableCell>
                  <TableCell>{step.valueType}</TableCell>
                  <TableCell>{step.value} {step.unit}</TableCell>
                  <TableCell>
                    {step.repetitions}
                    
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{step.stepType}</span>
                  </TableCell>
                  <TableCell className="max-w-[180px] whitespace-normal">
                    {step.triggers.length > 0 ? (
                      <div className="flex flex-col">
                        {step.triggers.map((t, i) => (
                          <span key={i}>{t.type}: {t.value}</span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate">{step.label || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(step.id)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteStep(step.id)}>
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

// Manual Editor Component
function ManualEditor({ initialData, onSave, onCancel }: any) {
  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [steps, setSteps] = useState<Step[]>(initialData?.steps || [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Highway Cruise" />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., 100 km/h constant speed" />
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Steps</h3>
          <p className="text-sm font-medium">
            Total Duration: 
            <span className="text-lg font-bold">
              {convertSecondsToHMS(calculateTotalDuration(steps))}
            </span>
            </p>
        </div>
        <StepTable steps={steps} onStepsChange={setSteps} />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={() => onSave({ name, description, steps })}
          disabled={!name.trim() || steps.length === 0}
          className="flex-1"
        >
          {initialData ? "Update" : "Save"} Sub-cycle
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}

// Import Tab Component
function ImportTab({ onSave, onCancel }: any) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const handleImport = () => {
    if (!file || !name) return alert("Name and file required")
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        let steps: Step[] = []
        
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text)
          steps = data.steps || []
        } else if (file.name.endsWith(".csv")) {
          const lines = text.trim().split("\n")
          if (lines.length < 2) throw new Error("CSV too short")

          const headers = lines[0].toLowerCase().split(",")
          const required = ["duration(s)", "timestep(s)", "valuetype", "value"]
          if (!required.every(h => headers.includes(h))) {
            throw new Error("Missing required columns. Use the template!")
          }

          steps = lines.slice(1).map((line, i) => {
            const vals = line.split(",")
            const triggersStr = vals[9] || ""
            const triggers = triggersStr
              .split(";")
              .map(t => t.trim())
              .filter(Boolean)
              .map(t => {
                const [type, valueStr] = t.split(":")
                const value = parseFloat(valueStr)
                if (isNaN(value)) throw new Error(`Invalid trigger value at row ${i + 2}`)
                return { type: type.trim(), value }
              })

            return {
              id: `STEP_${Date.now()}_${i}`,
              duration: parseFloat(vals[1]) || 0,
              timestep: parseFloat(vals[2]) || 1,
              valueType: vals[3].trim(),
              value: vals[4].trim(),
              unit: vals[5]?.trim() || "A",
              repetitions: parseInt(vals[6]) || 1,
              stepType: vals[7]?.trim() || "fixed",
              label: vals[8]?.trim() || "",
              triggers,
            }
          })
        }
        
        onSave({ name, description, steps })
      } catch (err: any) {
        alert("Import failed: " + err.message + "\n\nDownload the template to see correct format.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" /> Download Template
        </Button>

        <label className="block">
          <input
            type="file"
            accept=".csv,.json"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/10">
            <div className="text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm">Upload CSV or JSON</p>
              {file && <p className="text-xs text-green-600">{file.name}</p>}
            </div>
          </div>
        </label>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleImport} disabled={!name || !file} className="flex-1">
          Import & Save
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}

// Main Library Component
export default function SubcycleLibrary({ subcycles, onSubcyclesChange }: SubcycleLibraryProps) {
  const [showCreator, setShowCreator] = useState(false)
  const [editingSubcycle, setEditingSubcycle] = useState<Subcycle | null>(null)

  const generateId = () => `SC${String(subcycles.length + 1).padStart(3, "0")}`

  const handleSave = (data: { name: string; description: string; steps: Step[] }, source: "manual" | "import") => {
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
    if (confirm("Delete this sub-cycle?")) {
      onSubcyclesChange(subcycles.filter(sc => sc.id !== id))
    }
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
                <ManualEditor
                  initialData={editingSubcycle}
                  onSave={(data: any) => handleSave(data, "manual")}
                  onCancel={() => {
                    setShowCreator(false)
                    setEditingSubcycle(null)
                  }}
                />
              </TabsContent>

              <TabsContent value="import">
                <ImportTab
                  onSave={(data: any) => handleSave(data, "import")}
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
          <CardContent className="pt-16 pb-16 text-center">
            <p className="text-muted-foreground text-lg">No sub-cycles yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {subcycles.map((subcycle) => (
            <Card key={subcycle.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{subcycle.id} - {subcycle.name}</CardTitle>
                    <CardDescription>{subcycle.description || "No description"}</CardDescription>
                    <p className="text-sm font-medium text-foreground">
                    Total Duration: 
                    <span className="text-lg font-bold">
                      {convertSecondsToHMS(calculateTotalDuration(subcycle.steps).toFixed(1))}
                    </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subcycle.steps.length} step{subcycle.steps.length !== 1 ? "s" : ""} • {subcycle.source}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
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
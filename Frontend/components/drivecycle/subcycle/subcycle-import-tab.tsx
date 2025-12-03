"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download } from "lucide-react"

export default function SubcycleImportTab({ onSave, onCancel }: any) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const handleImport = () => {
    if (!file || !name) return alert("Name and file required")
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        let steps = []
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text)
          steps = data.steps || []
        } else {
          // CSV logic (same as before)
          const lines = text.trim().split("\n")
          steps = lines.slice(1).map((l, i) => {
            const v = l.split(",")
            return {
              id: `STEP_${Date.now()}_${i}`,
              duration: Number(v[1]) || 0,
              timestep: Number(v[2]) || 1,
              valueType: v[3],
              value: v[4],
              unit: v[5] || "A",
              repetitions: Number(v[6]) || 1,
              stepType: v[7] || "fixed",
              label: v[8] || "",
              triggers: (v[9] || "").split(";").filter(Boolean).map(t => {
                const [type, val] = t.split(":")
                return { type, value: Number(val) }
              })
            }
          })
        }
        onSave({ name, description, steps })
      } catch (err) {
        alert("Invalid file")
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
        <Button variant="outline" size="sm" onClick={() => {
          const a = document.createElement("a")
          a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(`Index,Duration(s),Timestep(s),ValueType,Value,Unit,Repetitions,StepType,Label,Triggers\n1,300,1,current,100,A,300,fixed,Highway,\n2,60,1,current,-80,A,60,fixed,Braking,`)
          a.download = "subcycle_template.csv"
          a.click()
        }}>
          <Download className="h-4 w-4 mr-2" /> Download Template
        </Button>

        <label className="block">
          <input type="file" accept=".csv,.json" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
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
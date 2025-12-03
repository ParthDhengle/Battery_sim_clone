"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Upload } from "lucide-react"

interface ImportDrivecycleProps {
  subcycles: any[]
  onSubmit: (drivecycle: any) => void
  onCancel: () => void
}

const downloadTemplate = () => {
  const csvContent = 
`Subcycle_ID,Subcycle_Name,Repetitions,Ambient_Temp,Location,Triggers
SC001,Morning Warmup,1,20,Reno,
SC004,Commute to Work,2,20,Reno,V_pack_high:4.2;SOC_pack_high:100
`
  const blob = new Blob([csvContent], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "drivecycle_template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportDrivecycle({ subcycles, onSubmit, onCancel }: ImportDrivecycleProps) {
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const handleImport = () => {
    if (!file || !name) return alert("Name and file required")
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        let composition: any[] = []
        
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text)
          setName(data.name || name)
          setNotes(data.notes || notes)
          composition = data.composition.map((r: any) => ({
            ...r,
            id: `ROW_${Date.now()}`,
            subcycleName: subcycles.find((s: any) => s.id === r.subcycleId)?.name || r.subcycleName,
          })) || []
        } else if (file.name.endsWith(".csv")) {
          const lines = text.trim().split("\n")
          if (lines.length < 2) throw new Error("CSV too short")

          const headers = lines[0].toLowerCase().split(",")
          composition = lines.slice(1).map((line, i) => {
            const vals = line.split(",")
            const subcycleId = vals[0].trim()
            const subcycleName = vals[1]?.trim() || ""
            const repetitions = parseInt(vals[2]) || 1
            const ambientTemp = parseFloat(vals[3]) || 20
            const location = vals[4]?.trim() || "Default"
            const triggersStr = vals[5] || ""
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
              id: `ROW_${Date.now() + i}`,
              subcycleId,
              subcycleName: subcycles.find((s: any) => s.id === subcycleId)?.name || subcycleName,
              repetitions,
              ambientTemp,
              location,
              triggers,
            }
          })
        }

        const missing = composition.filter(r => !subcycles.some(s => s.id === r.subcycleId))
        if (missing.length > 0) {
          alert("Missing sub-cycles: " + missing.map(r => r.subcycleId).join(", "))
          return
        }

        onSubmit({ name, notes, source: "import", composition })
      } catch (err: any) {
        alert("Import failed: " + err.message + "\n\nDownload the template to see correct format.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
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
      </CardContent>
    </Card>
  )
}
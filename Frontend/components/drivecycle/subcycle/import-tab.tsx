// components/drivecycle/subcycle/import-tab.tsx

"use client"
import { useState} from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload } from "lucide-react"
import { Step } from "./types"

interface ImportTabProps {
  onSave: (data: { steps: Step[] }) => void
  onCancel: () => void
}

export default function ImportTab({ onSave, onCancel }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null)

  const handleImport = () => {
    if (!file ) return alert("file required")

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.trim().split("\n")
        
        if (lines.length < 3) throw new Error("CSV must have at least 2 data rows (header + 2 rows minimum)")

        // Parse headers - case insensitive
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase())
        const timeIdx = headers.findIndex(h => h === "time")
        const currentIdx = headers.findIndex(h => h === "current")

        if (timeIdx === -1 || currentIdx === -1) {
          throw new Error("CSV must contain 'Time' and 'Current' columns")
        }

        // Parse data rows
        const dataRows = lines.slice(1).map((line, i) => {
          const vals = line.split(",").map(v => v.trim())
          const time = parseFloat(vals[timeIdx])
          const current = parseFloat(vals[currentIdx])

          if (isNaN(time)) throw new Error(`Invalid Time value at row ${i + 2}`)
          if (isNaN(current)) throw new Error(`Invalid Current value at row ${i + 2}`)

          return { time, current }
        })

        // Validate: Check if times are in ascending order
        for (let i = 1; i < dataRows.length; i++) {
          if (dataRows[i].time <= dataRows[i - 1].time) {
            throw new Error(`Time values must be in ascending order. Error at row ${i + 2}`)
          }
        }

        // Validate: Check if last time is less than 24 hours (86400 seconds)
        const lastTime = dataRows[dataRows.length - 1].time
        if (lastTime >= 86400) {
          throw new Error(`Total duration must be less than 24 hours (86400 seconds). Current: ${lastTime}s`)
        }

        // Convert to steps (ignore last row as per requirement)
        const steps: Step[] = []
        for (let i = 0; i < dataRows.length - 1; i++) {
          const duration = dataRows[i + 1].time - dataRows[i].time
          
          steps.push({
            id: `STEP_${Date.now()}_${i}`,
            duration: duration,
            timestep: duration,
            valueType: "current",
            value: dataRows[i].current.toString(),
            unit: "A",
            repetitions: 1,
            stepType: "fixed",
            label: "-",
            triggers: [],
          })
        }

        onSave({ steps })
      } catch (err: any) {
        alert("Import failed: " + err.message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-2">CSV Format Requirements:</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Required columns: <strong>Time</strong> (in seconds) and <strong>Current</strong> (in Amperes)</li>
            <li>• Time values must be in ascending order</li>
            <li>• Total duration must be less than 24 hours (86400 seconds)</li>
            <li>• Last row will be ignored for duration calculation</li>
          </ul>
        </div>

        <label className="block">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/10 transition">
            <div className="text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm">Upload CSV File</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: Time (seconds), Current (A)</p>
              {file && <p className="text-xs text-green-600 mt-1">{file.name}</p>}
            </div>
          </div>
        </label>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!file} className="flex-1">
          Import & Save
        </Button>
        
      </div>
    </div>
  )
}
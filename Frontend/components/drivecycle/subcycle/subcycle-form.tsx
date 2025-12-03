"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Upload } from "lucide-react"
import SubcycleTemplateDownloader from "./SubcycleTemplateDownloader"

export default function SubcycleForm({ onSubmit, onCancel, initialData, isEditing }: any) {
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      notes: "",
      source: "manual" as const,
      steps: [],
    }
  )

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string

      try {
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text)
          if (!data.name || !Array.isArray(data.steps)) throw new Error("Invalid JSON")
          setFormData({ ...data, source: "import" })
          alert("JSON imported successfully!")
        } 
        else if (file.name.endsWith(".csv")) {
          const lines = text.trim().split("\n")
          if (lines.length < 2) throw new Error("CSV too short")

          const headers = lines[0].toLowerCase().split(",")
          const required = ["duration(s)", "timestep(s)", "valuetype", "value"]
          if (!required.every(h => headers.includes(h))) {
            throw new Error("Missing required columns. Use the template!")
          }

          const steps = lines.slice(1).map((line, i) => {
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

          setFormData(prev => ({ ...prev, steps, source: "import" }))
          alert(`CSV imported: ${steps.length} steps loaded!`)
        }
      } catch (err: any) {
        alert("Import failed: " + err.message + "\n\nDownload the template to see correct format.")
      }
    }
    reader.readAsText(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return alert("Name is required")
    if (formData.steps.length === 0) return alert("Add at least one step")
    onSubmit(formData)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <Label>Sub-cycle Name *</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Urban Commute"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {!isEditing && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Import Sub-cycle</h3>
                <SubcycleTemplateDownloader />
              </div>

              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-secondary/10 hover:bg-secondary/20">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Click to upload JSON or CSV</p>
                <input type="file" className="hidden" accept=".json,.csv" onChange={handleFileImport} />
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update" : "Create"} Sub-cycle
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
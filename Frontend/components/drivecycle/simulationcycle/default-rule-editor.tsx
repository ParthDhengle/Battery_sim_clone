// FILE: Frontend/components/drivecycle/simulationcycle/default-rule-editor.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarRule } from "./calendar-types"
import { useState } from "react"
interface DefaultRuleEditorProps {
  drivecycles: any[]
  onSubmit: (id: string, name: string) => void
  onCancel: () => void
  initialData?: CalendarRule
  isEditing?: boolean
}

export default function DefaultRuleEditor({ 
  drivecycles, 
  onSubmit, 
  onCancel, 
  initialData, 
  isEditing 
}: DefaultRuleEditorProps) {
  const [value, setValue] = useState(initialData?.drivecycleId || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value) return alert("Select a drive cycle")
    const dc = drivecycles.find(d => d.id === value)
    if (dc) onSubmit(dc.id, dc.name)
  }

  return (
    <Card className="border-2 border-primary">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-2">{isEditing ? "Change" : "Set"} Default Drive Cycle</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select value={value} onChange={e => setValue(e.target.value)} className="w-full p-2 border rounded-md bg-background">
            <option value="">Choose drive cycle</option>
            {drivecycles.map(dc => (
              <option key={dc.id} value={dc.id}>{dc.id} - {dc.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{isEditing ? "Update" : "Set"} Default</Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
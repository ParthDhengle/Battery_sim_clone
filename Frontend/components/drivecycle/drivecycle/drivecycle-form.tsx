"use client"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
interface DrivecycleFormProps {
  subcycles: any[]
  onSubmit: (drivecycle: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0")
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function convertSecondsToHMS(totalSeconds: number) {
  totalSeconds = Number(totalSeconds);
  const secondsInMonth = 30 * 24 * 3600;
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

function getSubcycleDuration(subcycle: any) {
  return subcycle.steps.reduce((sum: number, s: any) => sum + (s.duration * s.repetitions), 0)
}

export default function DrivecycleForm({ subcycles, onSubmit, onCancel, initialData, isEditing }: DrivecycleFormProps) {
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      notes: "",
      composition: [],
    },
  )
  const [selectedSubcycle, setSelectedSubcycle] = useState("")
  const [repetitions, setRepetitions] = useState(1)
  const [ambientTemp, setAmbientTemp] = useState(20)
  const [location, setLocation] = useState("Default")
  const [triggers, setTriggers] = useState([])

  const totalDuration = formData.composition.reduce((sum: number, row: any) => {
    const sub = subcycles.find((sc: any) => sc.id === row.subcycleId)
    return sum + (sub ? getSubcycleDuration(sub) * row.repetitions : 0)
  }, 0)

  const handleAddToComposition = () => {
    if (!selectedSubcycle) {
      alert("Please select a sub-cycle")
      return
    }
    const subcycle = subcycles.find((sc) => sc.id === selectedSubcycle)
    if (!subcycle) return
    const newRow = {
      id: `ROW_${Date.now()}`,
      subcycleId: selectedSubcycle,
      subcycleName: subcycle.name,
      repetitions,
      ambientTemp,
      location,
      triggers,
    }
    setFormData({
      ...formData,
      composition: [...formData.composition, newRow],
    })
    // Reset form
    setSelectedSubcycle("")
    setRepetitions(1)
    setAmbientTemp(20)
    setLocation("Default")
    setTriggers([])
  }
  const handleRemoveFromComposition = (id: string) => {
    setFormData({
      ...formData,
      composition: formData.composition.filter((c: any) => c.id !== id),
    })
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert("Drive cycle name is required")
      return
    }
    if (formData.composition.length === 0) {
      alert("Add at least one sub-cycle to the composition")
      return
    }
    if (totalDuration > 86400) {
      alert("The worst-case total duration exceeds 24 hours. Please reduce repetitions or remove sub-cycles.")
      return
    }
    onSubmit(formData)
  }
  let currentTime = 0
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Drive Cycle Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Daily EV Commuting Cycle"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes/Description</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional description of this drive cycle"
              rows={3}
            />
          </div>
          <div className="bg-secondary/50 border border-secondary p-3 rounded text-sm">
            <p className="font-semibold mb-1">Estimated Total Duration: {convertSecondsToHMS(totalDuration)} / 24h</p>
            <p className="text-muted-foreground">
              One drive cycle = one full logical simulation day (cannot exceed 86400 seconds)
            </p>
          </div>
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Compose Drive Cycle</h3>
            <div className="space-y-4 bg-secondary/30 p-4 rounded-lg border border-secondary/50">
              <div>
                <Label htmlFor="subcycleSelect">Select Sub-cycle to Add *</Label>
                <Select value={selectedSubcycle} onValueChange={setSelectedSubcycle}>
                  <SelectTrigger id="subcycleSelect">
                    <SelectValue placeholder="Choose a sub-cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcycles.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No sub-cycles available
                      </SelectItem>
                    ) : (
                      subcycles.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.id} - {sc.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="reps">Repetitions</Label>
                  <Input
                    id="reps"
                    type="number"
                    min="1"
                    value={repetitions}
                    onChange={(e) => setRepetitions(Math.max(1, Number.parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <Label htmlFor="temp">Ambient Temp (°C)</Label>
                  <Input
                    id="temp"
                    type="number"
                    step="0.1"
                    value={ambientTemp}
                    onChange={(e) => setAmbientTemp(Number.parseFloat(e.target.value) || 20)}
                  />
                </div>
                <div>
                  <Label htmlFor="loc">Location</Label>
                  <Input
                    id="loc"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Reno"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAddToComposition}
                disabled={!selectedSubcycle || subcycles.length === 0}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add to Composition
              </Button>
            </div>
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Composition Preview:</h4>
              {formData.composition.length === 0 ? (
                <Card className="p-4 text-center text-muted-foreground text-sm">
                  No sub-cycles added yet. Add one above to build this drive cycle.
                </Card>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sr.</TableHead>
                        <TableHead>Sub-cycle ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Reps</TableHead>
                        <TableHead>Ambient Temp</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Time Range</TableHead>
                        <TableHead>Triggers</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.composition.map((row: any, idx: number) => {
                        const sub = subcycles.find((sc: any) => sc.id === row.subcycleId)
                        const dur = sub ? getSubcycleDuration(sub) * row.repetitions : 0
                        const startStr = formatTime(currentTime)
                        currentTime += dur
                        const endStr = formatTime(currentTime)
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{row.subcycleId}</TableCell>
                            <TableCell>{row.subcycleName}</TableCell>
                            <TableCell>{row.repetitions}</TableCell>
                            <TableCell>{row.ambientTemp}°C</TableCell>
                            <TableCell>{row.location}</TableCell>
                            <TableCell>{startStr} - {endStr}</TableCell>
                            <TableCell>{row.triggers.map((t: any) => `${t.type}:${t.value}`).join(", ") || "-"}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFromComposition(row.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Drive Cycle" : "Create Drive Cycle"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
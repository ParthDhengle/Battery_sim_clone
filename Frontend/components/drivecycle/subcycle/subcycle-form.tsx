"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

interface SubcycleFormProps {
  onSubmit: (subcycle: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

export default function SubcycleForm({ onSubmit, onCancel, initialData, isEditing }: SubcycleFormProps) {
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      notes: "",
      source: "manual" as const,
      steps: [],
    },
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert("Sub-cycle name is required")
      return
    }
    onSubmit(formData)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Sub-cycle Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Morning Warmup"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes/Description</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional description of this sub-cycle"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Sub-cycle" : "Create Sub-cycle"}
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

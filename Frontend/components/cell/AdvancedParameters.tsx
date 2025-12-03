"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Props = {
  formData: any
  setFormData: (data: any) => void
  sohFile: any
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function AdvancedParameters({ formData, setFormData, sohFile, handleFileUpload }: Props) {
  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  // Helper to calculate volume (used in CellBuilderContent already, but safe to reuse logic)
  return (
    <div className="space-y-6">
      {/* Electrical – Charging */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Charging</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <Label>Cell Max Charging Current — Continuous</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_charging_current_continuous || ""}
                onChange={(e) => updateField("max_charging_current_continuous", e.target.value)}
                placeholder="e.g., 2.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                A
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Cell Max Charging Current — Instantaneous</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_charging_current_instantaneous || ""}
                onChange={(e) => updateField("max_charging_current_instantaneous", e.target.value)}
                placeholder="e.g., 5.0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                A
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Cell Max Charge Voltage</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_charge_voltage || ""}
                onChange={(e) => updateField("max_charge_voltage", e.target.value)}
                placeholder="e.g., 4.2"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                V
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Electrical – Discharging */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Discharging</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Cell Max Discharging Current — Continuous</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_discharging_current_continuous || ""}
                onChange={(e) => updateField("max_discharging_current_continuous", e.target.value)}
                placeholder="e.g., 10.0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                A
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Cell Max Discharging Current — Instantaneous</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_discharging_current_instantaneous || ""}
                onChange={(e) => updateField("max_discharging_current_instantaneous", e.target.value)}
                placeholder="e.g., 20.0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                A
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Coulombic Efficiency (0–1)</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.columbic_efficiency || ""}
              onChange={(e) => updateField("columbic_efficiency", e.target.value)}
              placeholder="Default: 1.0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              —
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Commercial */}
      <Card>
        <CardHeader>
          <CardTitle>Commercial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Cost per Cell</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.cost_per_cell || ""}
              onChange={(e) => updateField("cost_per_cell", e.target.value)}
              placeholder="e.g., 5.50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              $
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Chemical Composition */}
      <Card>
        <CardHeader>
          <CardTitle>Chemical Composition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Anode Composition</Label>
            <Input
              type="text"
              value={formData.anode_composition || ""}
              onChange={(e) => updateField("anode_composition", e.target.value)}
              placeholder="e.g., Graphite, Silicon composite"
            />
          </div>
          <div className="space-y-3">
            <Label>Cathode Composition</Label>
            <Input
              type="text"
              value={formData.cathode_composition || ""}
              onChange={(e) => updateField("cathode_composition", e.target.value)}
              placeholder="e.g., NCA, LFP"
            />
          </div>
        </CardContent>
      </Card>

      {/* SOH File */}
      <Card>
        <CardHeader>
          <CardTitle>SOH File (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,.json,.mat" onChange={handleFileUpload} />
          {sohFile && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-md">{sohFile.name}</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Upload SOH (State of Health) data file in CSV, JSON, or MAT format
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
// components/AdvancedParameters.tsx
"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import RCParameterUpload from "./RCParameterUpload"

type Props = {
  formData: any
  setFormData: (data: any) => void
  sohFile: File | null
  handleFileUpload: (file: File | null) => void
}

export default function AdvancedParameters({ formData, setFormData, sohFile, handleFileUpload }: Props) {
  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <div className="space-y-6">
      {/* === Electrical – Charging === */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Charging</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Cell Max Charging Current — Continuous</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 2.5"
                value={formData.max_charging_current_continuous || ""}
                onChange={(e) => updateField("max_charging_current_continuous", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">A</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cell Max Charging Current — Instantaneous</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 5.0"
                value={formData.max_charging_current_instantaneous || ""}
                onChange={(e) => updateField("max_charging_current_instantaneous", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">A</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cell Max Charge Voltage</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 4.2"
                value={formData.max_charge_voltage || ""}
                onChange={(e) => updateField("max_charge_voltage", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">V</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Electrical – Discharging === */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Discharging</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Cell Max Discharging Current — Continuous</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 10.0"
                value={formData.max_discharging_current_continuous || ""}
                onChange={(e) => updateField("max_discharging_current_continuous", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">A</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cell Max Discharging Current — Instantaneous</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 20.0"
                value={formData.max_discharging_current_instantaneous || ""}
                onChange={(e) => updateField("max_discharging_current_instantaneous", e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">A</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Performance Metrics === */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Coulombic Efficiency (0–1)</Label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.01"
            placeholder="Default: 1.0"
            value={formData.columbic_efficiency || ""}
            onChange={(e) => updateField("columbic_efficiency", e.target.value)}
          />
        </CardContent>
      </Card>

      {/* === Commercial === */}
      <Card>
        <CardHeader>
          <CardTitle>Commercial</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Cost per Cell</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5.50"
              value={formData.cost_per_cell || ""}
              onChange={(e) => updateField("cost_per_cell", e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          </div>
        </CardContent>
      </Card>

      {/* === Chemical Composition === */}
      <Card>
        <CardHeader>
          <CardTitle>Chemical Composition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Anode Composition</Label>
            <Input
              placeholder="e.g., Graphite, Silicon composite"
              value={formData.anode_composition || ""}
              onChange={(e) => updateField("anode_composition", e.target.value)}
            />
          </div>
          <div>
            <Label>Cathode Composition</Label>
            <Input
              placeholder="e.g., NCA, LFP"
              value={formData.cathode_composition || ""}
              onChange={(e) => updateField("cathode_composition", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* === RC Parameter Upload (Child Component) === */}
      <RCParameterUpload
        formData={formData}
        setFormData={setFormData}
        uploadedFile={sohFile}
        onFileChange={handleFileUpload}
      />
    </div>
  )
}
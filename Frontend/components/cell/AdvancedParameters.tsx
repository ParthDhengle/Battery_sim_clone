// New file: Frontend/components/cell/AdvancedParameters.tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  return (
    <div className="space-y-6">
      {/* Electrical – Charging */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Charging</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <Label>Cell Max Charging Current — Continuous (A)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_charging_current_continuous}
              onChange={(e) => updateField("max_charging_current_continuous", e.target.value)}
              placeholder="e.g., 2.5"
            />
          </div>
          <div className="space-y-3">
            <Label>Cell Max Charging Current — Instantaneous (A)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_charging_current_instantaneous}
              onChange={(e) => updateField("max_charging_current_instantaneous", e.target.value)}
              placeholder="e.g., 5.0"
            />
          </div>
          <div className="space-y-3">
            <Label>Cell Max Charge Voltage (V)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_charge_voltage}
              onChange={(e) => updateField("max_charge_voltage", e.target.value)}
              placeholder="e.g., 4.2"
            />
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
            <Label>Cell Max Discharging Current — Continuous (A)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_discharging_current_continuous}
              onChange={(e) => updateField("max_discharging_current_continuous", e.target.value)}
              placeholder="e.g., 10.0"
            />
          </div>
          <div className="space-y-3">
            <Label>Cell Max Discharging Current — Instantaneous (A)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_discharging_current_instantaneous}
              onChange={(e) => updateField("max_discharging_current_instantaneous", e.target.value)}
              placeholder="e.g., 20.0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Electrical – Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical – Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Coulombic Efficiency (0-1)</Label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={formData.columbic_efficiency}
            onChange={(e) => updateField("columbic_efficiency", e.target.value)}
            placeholder="Default: 1.0"
          />
        </CardContent>
      </Card>

      {/* Mechanical – Physical Specs */}
      <Card>
        <CardHeader>
          <CardTitle>Mechanical – Physical Specs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Cell Volume (mm³)</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.cell_volume}
            onChange={(e) => updateField("cell_volume", e.target.value)}
            placeholder="Auto-calculated from dimensions"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-calculated as π × (d/2)² × h for cylindrical/coin or L × W × H for others. Override if needed.
          </p>
        </CardContent>
      </Card>

      {/* Commercial */}
      <Card>
        <CardHeader>
          <CardTitle>Commercial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Cost per Cell ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.cost_per_cell}
            onChange={(e) => updateField("cost_per_cell", e.target.value)}
            placeholder="e.g., 5.50"
          />
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
              value={formData.anode_composition}
              onChange={(e) => updateField("anode_composition", e.target.value)}
              placeholder="e.g., Graphite, Silicon composite"
            />
          </div>
          <div className="space-y-3">
            <Label>Cathode Composition</Label>
            <Input
              type="text"
              value={formData.cathode_composition}
              onChange={(e) => updateField("cathode_composition", e.target.value)}
              placeholder="e.g., LiCoO2, NCA, LFP"
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
          <Input type="file" accept=".csv,.json,.mat" onChange={handleFileUpload} className="flex-1" />
          {sohFile && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-xs">{sohFile.name}</span>
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
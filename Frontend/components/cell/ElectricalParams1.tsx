// components/cell/ElectricalParams1.tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  formData: any
  setFormData: (data: any) => void
  errors: Record<string, string>
}

export default function ElectricalParams1({ formData, setFormData, errors }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Electrical Parameters - Part 1</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className={errors.cell_nominal_voltage ? "text-red-500" : ""}>Cell Nominal Voltage (V) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.cell_nominal_voltage}
              onChange={(e) => setFormData({ ...formData, cell_nominal_voltage: e.target.value })}
              placeholder="e.g., 3.7"
            />
          </div>
          <div className="space-y-3">
            <Label className={errors.cell_upper_voltage_cutoff ? "text-red-500" : ""}>Upper Voltage Cut-off (V) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.cell_upper_voltage_cutoff}
              onChange={(e) => setFormData({ ...formData, cell_upper_voltage_cutoff: e.target.value })}
              placeholder="e.g., 4.2"
            />
          </div>
          <div className="space-y-3">
            <Label className={errors.cell_lower_voltage_cutoff ? "text-red-500" : ""}>Lower Voltage Cut-off (V) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.cell_lower_voltage_cutoff}
              onChange={(e) => setFormData({ ...formData, cell_lower_voltage_cutoff: e.target.value })}
              placeholder="e.g., 2.5"
            />
          </div>
          <div className="space-y-3">
            <Label className={errors.capacity ? "text-red-500" : ""}>Capacity (Ah) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 5.0"
            />
          </div>
          <div className="space-y-3">
            <Label>Max Charge Voltage (V)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.max_charge_voltage}
              onChange={(e) => setFormData({ ...formData, max_charge_voltage: e.target.value })}
              placeholder="e.g., 4.2"
            />
          </div>
          <div className="space-y-3">
            <Label>Coulombic Efficiency (0-1)</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.columbic_efficiency}
              onChange={(e) => setFormData({ ...formData, columbic_efficiency: e.target.value })}
              placeholder="Default: 1.0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
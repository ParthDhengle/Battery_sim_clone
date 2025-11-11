// components/cell/ElectricalParams2AndMechanical.tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  formData: any
  setFormData: (data: any) => void
  errors: Record<string, string>
}

export default function ElectricalParams2AndMechanical({ formData, setFormData, errors }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Electrical Parameters - Part 2 & Mechanical</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Charging Currents (A)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Max Charging - Continuous</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.max_charging_current_continuous}
                  onChange={(e) => setFormData({ ...formData, max_charging_current_continuous: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label>Max Charging - Instantaneous</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.max_charging_current_instantaneous}
                  onChange={(e) => setFormData({ ...formData, max_charging_current_instantaneous: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Discharging Currents (A)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Max Discharging - Continuous</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.max_discharging_current_continuous}
                  onChange={(e) => setFormData({ ...formData, max_discharging_current_continuous: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label>Max Discharging - Instantaneous</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.max_discharging_current_instantaneous}
                  onChange={(e) => setFormData({ ...formData, max_discharging_current_instantaneous: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Mechanical Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className={errors.cell_weight ? "text-red-500" : ""}>Cell Weight (kg) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={formData.cell_weight}
                  onChange={(e) => setFormData({ ...formData, cell_weight: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label>Cell Volume (mm³)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.cell_volume}
                  onChange={(e) => setFormData({ ...formData, cell_volume: e.target.value })}
                  placeholder="Calculated from dimensions"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
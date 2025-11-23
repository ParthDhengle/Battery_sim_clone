"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  formData: any
  setFormData: (data: any) => void
  errors: Record<string, string>
}

export default function BasicParameters({ formData, setFormData, errors }: Props) {
  const handleFormFactorChange = (value: string) => {
    setFormData((prev: any) => {
      const newData = { ...prev, formFactor: value }
      if (["cylindrical", "coin"].includes(value)) {
        newData.length = ""
        newData.width = ""
      } else {
        newData.diameter = ""
      }
      return newData
    })
  }

  const isCylindricalOrCoin = formData.formFactor === "cylindrical" || formData.formFactor === "coin"

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <div className="space-y-6">
      {/* Cell Name */}
      <Card>
        <CardHeader>
          <CardTitle>Cell Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className={errors.name ? "text-red-500" : ""}>
            Cell Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g., Samsung 21700-50E"
          />
        </CardContent>
      </Card>

      {/* Electrical Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Electrical Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className={errors.cell_nominal_voltage ? "text-red-500" : ""}>
                Cell Nominal Voltage <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.cell_nominal_voltage}
                  onChange={(e) => updateField("cell_nominal_voltage", e.target.value)}
                  placeholder="e.g., 3.7"
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  V
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <Label className={errors.cell_upper_voltage_cutoff ? "text-red-500" : ""}>
                Cell Upper Voltage Cut-off <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.cell_upper_voltage_cutoff}
                onChange={(e) => updateField("cell_upper_voltage_cutoff", e.target.value)}
                placeholder="e.g., 4.2"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                V
              </span>
              </div>
            </div>
            <div className="space-y-3">
              <Label className={errors.cell_lower_voltage_cutoff ? "text-red-500" : ""}>
                Cell Lower Voltage Cut-off <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.cell_lower_voltage_cutoff}
                onChange={(e) => updateField("cell_lower_voltage_cutoff", e.target.value)}
                placeholder="e.g., 2.5"
              />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  V
                </span>
              </div>
              
            </div>
            <div className="space-y-3">
              <Label className={errors.capacity ? "text-red-500" : ""}>
                Cell Capacity <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.capacity}
                onChange={(e) => updateField("capacity", e.target.value)}
                placeholder="e.g., 5.0"
              />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  Ah
                </span>
              </div>
              
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mechanical Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Mechanical Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>
              Form Factor <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.formFactor} onValueChange={handleFormFactorChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cylindrical">Cylindrical</SelectItem>
                <SelectItem value="prismatic">Prismatic</SelectItem>
                <SelectItem value="pouch">Pouch</SelectItem>
                <SelectItem value="coin">Coin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className={errors.cell_weight ? "text-red-500" : ""}>
              Cell Weight <span className="text-red-500">*</span>
            </Label>
            <div className="relative"> 
              <Input
              type="number"
              min="0"
              step="0.001"
              value={formData.cell_weight}
              onChange={(e) => updateField("cell_weight", e.target.value)}
              placeholder="e.g., 0.050"
            />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  Kg
                </span>
            </div>
            
          </div>
          <div className="space-y-3">
            <Label>Dimensions (mm)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!isCylindricalOrCoin && (
                <>
                  <div className="space-y-3">
                    <Label className={errors.length ? "text-red-500" : ""}>
                      Cell Length<span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.length}
                      onChange={(e) => updateField("length", e.target.value)}
                      placeholder="e.g., 65"
                    />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        mm
                      </span>
                    </div>
                    
                  </div>
                  <div className="space-y-3">
                    <Label className={errors.width ? "text-red-500" : ""}>
                      Cell Width <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.width}
                      onChange={(e) => updateField("width", e.target.value)}
                      placeholder="e.g., 18"
                    />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">  
                        mm
                      </span>
                    </div>
                    
                  </div>
                </>
              )}
              {isCylindricalOrCoin && (
                <div className="space-y-3">
                  <Label className={errors.diameter ? "text-red-500" : ""}>
                    Cell Diameter <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.diameter}
                    onChange={(e) => updateField("diameter", e.target.value)}
                    placeholder="e.g., 21"
                  />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">  
                      mm
                    </span> 
                  </div>
                  
                </div>
              )}
              <div className="space-y-3">
                <Label className={errors.height ? "text-red-500" : ""}>
                  Cell Height <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  placeholder="e.g., 70"
                />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">  
                    mm
                  </span>
                </div>
                
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

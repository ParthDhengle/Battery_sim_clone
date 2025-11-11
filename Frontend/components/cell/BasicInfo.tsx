// components/cell/BasicInfo.tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import CellPreview3D from "@/components/3D_preview/cell_3d"

type Props = {
  formData: any
  setFormData: (data: any) => void
  errors: Record<string, string>
}

export default function BasicInfo({ formData, setFormData, errors }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className={errors.name ? "text-red-500" : ""}>Cell Name <span className="text-red-500">*</span></Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Samsung 21700-50E"
          />
        </div>

        <div className="space-y-3">
          <Label>Form Factor <span className="text-red-500">*</span></Label>
          <Select
            value={formData.formFactor}
            onValueChange={(v) => setFormData({ ...formData, formFactor: v })}
          >
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
          <Label>Dimensions</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formData.formFactor === "cylindrical" || formData.formFactor === "coin" ? (
              <div className="space-y-3">
                <Label className={errors.diameter ? "text-red-500" : ""}>Diameter (mm) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.diameter}
                  onChange={(e) => setFormData({ ...formData, diameter: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label className={errors.length ? "text-red-500" : ""}>Length (mm) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <Label className={errors.width ? "text-red-500" : ""}>Width (mm) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="space-y-3">
              <Label className={errors.height ? "text-red-500" : ""}>Height (mm) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* <div className="h-64 bg-gray-100 rounded-md overflow-hidden">
          <CellPreview3D
            formFactor={formData.formFactor}
            dims={{
              diameter: Number.parseFloat(formData.diameter) || 0,
              length: Number.parseFloat(formData.length) || 0,
              width: Number.parseFloat(formData.width) || 0,
              height: Number.parseFloat(formData.height) || 0,
            }}
          />
        </div> */}
      </CardContent>
    </Card>
  )
}
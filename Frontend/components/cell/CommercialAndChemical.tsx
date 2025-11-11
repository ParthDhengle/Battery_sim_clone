// components/cell/CommercialAndChemical.tsx
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

export default function CommercialAndChemical({ formData, setFormData, sohFile, handleFileUpload }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commercial & Chemical Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-3">
            <Label>Cost per Cell ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.cost_per_cell}
              onChange={(e) => setFormData({ ...formData, cost_per_cell: e.target.value })}
              placeholder="e.g., 5.50"
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Chemical Composition</h4>
            <div className="space-y-3">
              <Label>Anode Composition</Label>
              <Input
                type="text"
                value={formData.anode_composition}
                onChange={(e) => setFormData({ ...formData, anode_composition: e.target.value })}
                placeholder="e.g., Graphite, Silicon composite"
              />
            </div>
            <div className="space-y-3 mt-4">
              <Label>Cathode Composition</Label>
              <Input
                type="text"
                value={formData.cathode_composition}
                onChange={(e) => setFormData({ ...formData, cathode_composition: e.target.value })}
                placeholder="e.g., LiCoO2, NCA, LFP"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>SOH File (Optional)</Label>
            <div className="flex items-center gap-4 mt-3">
              <Input type="file" accept=".csv,.json,.mat" onChange={handleFileUpload} className="flex-1" />
              {sohFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-xs">{sohFile.name}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Upload SOH (State of Health) data file in CSV, JSON, or MAT format
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
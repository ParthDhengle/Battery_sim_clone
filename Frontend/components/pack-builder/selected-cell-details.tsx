// Frontend/components/pack-builder/selected-cell-details.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
// import { CellPreview3D } from "@/components/3D_preview/cell_3d"

interface SelectedCellDetailsProps {
  formFactor: "cylindrical" | "prismatic"
  dims: { radius?: number; length?: number; width?: number; height: number }
  capacity: number
  columbicEfficiency: number
  mCell: number
  mJellyroll: number
  cellUpperVoltage: number
  cellLowerVoltage: number
  costPerCell: string
  setCostPerCell: (value: string) => void
  allowOverlap: boolean
  setAllowOverlap: (value: boolean) => void
  useIndexPitch: boolean
  zPitch: string
  setZPitch: (value: string) => void
}

export function SelectedCellDetails({
  formFactor,
  dims,
  capacity,
  columbicEfficiency,
  mCell,
  mJellyroll,
  cellUpperVoltage,
  cellLowerVoltage,
  costPerCell,
  setCostPerCell,
  allowOverlap,
  setAllowOverlap,
  useIndexPitch,
  zPitch,
  setZPitch,
}: SelectedCellDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Selected Cell Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Cell Form Factor</Label>
          <p className="text-sm font-medium">{formFactor}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {formFactor === "cylindrical" ? (
            <>
              <div className="space-y-3">
                <Label>Radius (mm)</Label>
                <p className="text-sm font-medium">{dims.radius ?? "N/A"}</p>
              </div>
              <div className="space-y-3">
                <Label>Height (mm)</Label>
                <p className="text-sm font-medium">{dims.height ?? "N/A"}</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Length (mm)</Label>
                <p className="text-sm font-medium">{dims.length ?? "N/A"}</p>
              </div>
              <div className="space-y-3">
                <Label>Width (mm)</Label>
                <p className="text-sm font-medium">{dims.width ?? "N/A"}</p>
              </div>
              <div className="space-y-3">
                <Label>Height (mm)</Label>
                <p className="text-sm font-medium">{dims.height ?? "N/A"}</p>
              </div>
            </>
          )}
        </div>
        {/* <CellPreview3D formFactor={formFactor} dims={dims} /> */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Capacity (Ah)</Label>
            <p className="text-sm font-medium">{capacity}</p>
          </div>
          <div className="space-y-3">
            <Label>Columbic Efficiency</Label>
            <p className="text-sm font-medium">{columbicEfficiency}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Cell Mass (g)</Label>
            <p className="text-sm font-medium">{mCell * 1000}</p>
          </div>
          <div className="space-y-3">
            <Label>Jellyroll Mass (g)</Label>
            <p className="text-sm font-medium">{mJellyroll * 1000}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Cell Voltage Upper Limit (V)</Label>
            <p className="text-sm font-medium">{cellUpperVoltage}</p>
          </div>
          <div className="space-y-3">
            <Label>Cell Voltage Lower Limit (V)</Label>
            <p className="text-sm font-medium">{cellLowerVoltage}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Label>Cost per Cell (USD)</Label>
          <Input type="number" value={costPerCell} onChange={(e) => setCostPerCell(e.target.value)} />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allow-overlap"
            checked={allowOverlap}
            onCheckedChange={(checked) => setAllowOverlap(checked as boolean)}
          />
          <Label htmlFor="allow-overlap">Allow cell overlap (for testing only)</Label>
        </div>
        {useIndexPitch && (
          <div className="space-y-3">
            <Label>Z Pitch (mm)</Label>
            <Input type="number" value={zPitch} onChange={(e) => setZPitch(e.target.value)} />
            <p className="text-sm text-muted-foreground">Vertical spacing between layers for index_pitch mode</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

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
        <CardTitle>Cell Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Physical Properties */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Physical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Form Factor</Label>
              <p className="text-sm font-medium">{formFactor}</p>
            </div>
            {formFactor === "cylindrical" ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Radius (mm)</Label>
                  <p className="text-sm font-medium">{dims.radius ?? "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Height (mm)</Label>
                  <p className="text-sm font-medium">{dims.height ?? "N/A"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Length (mm)</Label>
                  <p className="text-sm font-medium">{dims.length ?? "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Width (mm)</Label>
                  <p className="text-sm font-medium">{dims.width ?? "N/A"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Height (mm)</Label>
                  <p className="text-sm font-medium">{dims.height ?? "N/A"}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Electrical Properties */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Electrical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Capacity (Ah)</Label>
              <p className="text-sm font-medium">{capacity}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Upper Voltage (V)</Label>
              <p className="text-sm font-medium">{cellUpperVoltage}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Lower Voltage (V)</Label>
              <p className="text-sm font-medium">{cellLowerVoltage}</p>
            </div>
            {/* <div className="space-y-2">
              <Label className="text-xs">Efficiency</Label>
              <p className="text-sm font-medium">{columbicEfficiency}</p>
            </div> */}
          </div>
        </div>

        {/* Mass Properties */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Mass Properties</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Cell Mass (g)</Label>
              <p className="text-sm font-medium">{(mCell * 1000).toFixed(2)}</p>
            </div>
            {/* <div className="space-y-2">
              <Label className="text-xs">Jellyroll Mass (g)</Label>
              <p className="text-sm font-medium">{(mJellyroll * 1000).toFixed(2)}</p>
            </div> */}
          </div>
        </div>

        {/* Configuration Options */}
        {/* <div className="border-t pt-6 space-y-3">
          <h3 className="font-semibold text-sm">Pack Configuration</h3>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="costPerCell">
                Cost per Cell (USD) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="costPerCell"
                type="number"
                step="0.01"
                value={costPerCell}
                onChange={(e) => setCostPerCell(e.target.value)}
                placeholder="3.0"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allowOverlap"
                checked={allowOverlap}
                onCheckedChange={(checked) => setAllowOverlap(checked as boolean)}
              />
              <Label htmlFor="allowOverlap" className="font-normal">
                Allow cell overlap (testing only)
              </Label>
            </div>

            {useIndexPitch && (
              <div className="space-y-3">
                <Label htmlFor="zPitch">Z Pitch (mm)</Label>
                <Input
                  id="zPitch"
                  type="number"
                  value={zPitch}
                  onChange={(e) => setZPitch(e.target.value)}
                  placeholder="80"
                />
                <p className="text-xs text-muted-foreground">Vertical spacing between layers</p>
              </div>
            )}
          </div>
        </div> */}
      </CardContent>
    </Card>
  )
}
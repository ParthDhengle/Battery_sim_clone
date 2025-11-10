"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { VaryingCell } from "./pack-builder/use-varying-cells"

interface InitialCellConditionsProps {
  initialTemperature: string
  setInitialTemperature: (value: string) => void
  initialSOC: string
  setInitialSOC: (value: string) => void
  initialSOH: string
  setInitialSOH: (value: string) => void
  initialDCIR: string
  setInitialDCIR: (value: string) => void
  varyingCells: VaryingCell[]
  onAddVaryingCell: () => void
  onRemoveVaryingCell: (id: number) => void
  onUpdateVaryingCell: (id: number, field: string, value: string) => void
}

export function InitialCellConditions({
  initialTemperature,
  setInitialTemperature,
  initialSOC,
  setInitialSOC,
  initialSOH,
  setInitialSOH,
  initialDCIR,
  setInitialDCIR,
  varyingCells,
  onAddVaryingCell,
  onRemoveVaryingCell,
  onUpdateVaryingCell,
}: InitialCellConditionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Initial Cell Conditions</CardTitle>
        <CardDescription>Define initial conditions for all cells and specific cells if needed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Initial Temperature (K)</Label>
            <Input type="number" value={initialTemperature} onChange={(e) => setInitialTemperature(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Initial SOC (%)</Label>
            <Input type="number" min="0" max="100" value={initialSOC} onChange={(e) => setInitialSOC(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Initial SOH</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={initialSOH}
              onChange={(e) => setInitialSOH(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <Label>Initial DCIR Aging Factor</Label>
            <Input type="number" min="0" value={initialDCIR} onChange={(e) => setInitialDCIR(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Varying Cell Conditions</Label>
            <Button onClick={onAddVaryingCell}>Add Varying Cell</Button>
          </div>
          {varyingCells.length === 0 && (
            <p className="text-center text-muted-foreground">No varying conditions added yet</p>
          )}
          {varyingCells.map((vc) => (
            <div key={vc.id} className="space-y-4 border-b pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Cell {vc.id}</h3>
                <Button variant="destructive" size="sm" onClick={() => onRemoveVaryingCell(vc.id)}>
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Cell Index (1-based)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={vc.cellIndex}
                    onChange={(e) => onUpdateVaryingCell(vc.id, "cellIndex", e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>Temperature (K)</Label>
                  <Input
                    type="number"
                    value={vc.temp}
                    onChange={(e) => onUpdateVaryingCell(vc.id, "temp", e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>SOC (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={vc.soc}
                    onChange={(e) => onUpdateVaryingCell(vc.id, "soc", e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>SOH</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={vc.soh}
                    onChange={(e) => onUpdateVaryingCell(vc.id, "soh", e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>DCIR Aging Factor</Label>
                  <Input
                    type="number"
                    min="0"
                    value={vc.dcir}
                    onChange={(e) => onUpdateVaryingCell(vc.id, "dcir", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Frontend/components/pack-builder/pack-summary-display.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackSummary } from "./use-pack-builder"

interface PackSummaryDisplayProps {
  summary: PackSummary | null | undefined  // Allow null/undefined
}

export function PackSummaryDisplay({ summary }: PackSummaryDisplayProps) {
  // Guard: Don't render if summary is missing/incomplete
  if (!summary || !summary.electrical || !summary.mechanical || !summary.commercial) {
    return null;  // Or render a loading/skeleton state
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pack Summary</CardTitle>
        <CardDescription>Calculated electrical, mechanical, and commercial metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Electrical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Series Cells</p>
              <p className="font-medium">{summary.electrical.nSeries ?? 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Parallel Cells</p>
              <p className="font-medium">{summary.electrical.nParallel ?? 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Cells</p>
              <p className="font-medium">{summary.electrical.nTotal ?? 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cell Nominal Voltage</p>
              <p className="font-medium">{summary.electrical.vCellNominal?.toFixed(2) ?? 'N/A'} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Nominal Voltage</p>
              <p className="font-medium">{summary.electrical.packNominalVoltage?.toFixed(2) ?? 'N/A'} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Max Voltage</p>
              <p className="font-medium">{summary.electrical.packMaxVoltage?.toFixed(2) ?? 'N/A'} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Min Voltage</p>
              <p className="font-medium">{summary.electrical.packMinVoltage?.toFixed(2) ?? 'N/A'} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Capacity</p>
              <p className="font-medium">{summary.electrical.packCapacity?.toFixed(2) ?? 'N/A'} Ah</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Energy</p>
              <p className="font-medium">{summary.electrical.packEnergyWh?.toFixed(2) ?? 'N/A'} Wh</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Energy (Adjusted)</p>
              <p className="font-medium">{summary.electrical.adjustedPackEnergyWh?.toFixed(2) ?? 'N/A'} Wh</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Busbar Resistance</p>
              <p className="font-medium">{summary.electrical.busbarTotalResistance?.toFixed(6) ?? 'N/A'} Ω</p>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Mechanical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Cells</p>
              <p className="font-medium">{summary.mechanical.totalCells ?? 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Weight</p>
              <p className="font-medium">{summary.mechanical.totalPackWeight?.toFixed(3) ?? 'N/A'} kg</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cell Volume</p>
              <p className="font-medium">{((summary.mechanical.totalCellVolume ?? 0) * 1e6)?.toFixed(2) ?? 'N/A'} mm³</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pack Volume</p>
              <p className="font-medium">{summary.mechanical.totalPackVolume?.toFixed(6) ?? 'N/A'} m³</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gravimetric Density</p>
              <p className="font-medium">{summary.mechanical.energyDensityGravimetric?.toFixed(2) ?? 'N/A'} Wh/kg</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Volumetric Density</p>
              <p className="font-medium">{summary.mechanical.energyDensityVolumetric?.toFixed(2) ?? 'N/A'} Wh/L</p>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Commercial Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="font-medium">${summary.commercial.totalPackCost?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cost per kWh</p>
              <p className="font-medium">${summary.commercial.costPerKwh?.toFixed(2) ?? 'N/A'}/kWh</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackSummary } from "./use-pack-builder"

interface PackSummaryDisplayProps {
  summary: PackSummary | null | undefined
}

export function PackSummaryDisplay({ summary }: PackSummaryDisplayProps) {
  if (!summary || !summary.electrical || !summary.mechanical || !summary.commercial) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pack Summary</CardTitle>
        <CardDescription>Calculated electrical, mechanical, and commercial metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Electrical Properties */}
        <div>
          <h3 className="font-semibold mb-4 text-sm">Electrical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Series Cells</p>
              <p className="font-medium text-sm">{summary.electrical.nSeries ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Parallel Cells</p>
              <p className="font-medium text-sm">{summary.electrical.nParallel ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Cells</p>
              <p className="font-medium text-sm">{summary.electrical.nTotal ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Voltage (Nominal)</p>
              <p className="font-medium text-sm">{summary.electrical.packNominalVoltage?.toFixed(2) ?? "N/A"} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Voltage (Max)</p>
              <p className="font-medium text-sm">{summary.electrical.packMaxVoltage?.toFixed(2) ?? "N/A"} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Voltage (Min)</p>
              <p className="font-medium text-sm">{summary.electrical.packMinVoltage?.toFixed(2) ?? "N/A"} V</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Capacity</p>
              <p className="font-medium text-sm">{summary.electrical.packCapacity?.toFixed(2) ?? "N/A"} Ah</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Energy</p>
              <p className="font-medium text-sm">{summary.electrical.packEnergyWh?.toFixed(2) ?? "N/A"} Wh</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Energy (Adjusted)</p>
              <p className="font-medium text-sm">{summary.electrical.adjustedPackEnergyWh?.toFixed(2) ?? "N/A"} Wh</p>
            </div>
          </div>
        </div>

        {/* Mechanical Properties */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4 text-sm">Mechanical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Cells</p>
              <p className="font-medium text-sm">{summary.mechanical.totalCells ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Weight</p>
              <p className="font-medium text-sm">{summary.mechanical.totalPackWeight?.toFixed(3) ?? "N/A"} kg</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Pack Volume</p>
              <p className="font-medium text-sm">{summary.mechanical.totalPackVolume?.toFixed(6) ?? "N/A"} m³</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Energy Density (Wh/kg)</p>
              <p className="font-medium text-sm">{summary.mechanical.energyDensityGravimetric?.toFixed(2) ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Energy Density (Wh/L)</p>
              <p className="font-medium text-sm">{summary.mechanical.energyDensityVolumetric?.toFixed(2) ?? "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Commercial Properties */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4 text-sm">Commercial Properties</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="font-medium text-sm">${summary.commercial.totalPackCost?.toFixed(2) ?? "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cost per kWh</p>
              <p className="font-medium text-sm">${summary.commercial.costPerKwh?.toFixed(2) ?? "N/A"}/kWh</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// src/components/ConfigReviewDisplay.tsx

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Battery, Car, Cpu, Calendar, Power } from "lucide-react"

// Props for the display component
interface ConfigReviewDisplayProps {
  packConfig: any;
  driveConfig: any;
  simulationConfig: any;
}

// Helper component for consistent styling
const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center text-sm py-2 border-b last:border-0">
    <p className="text-muted-foreground">{label}</p>
    <p className="font-medium text-right break-all">{value}</p>
  </div>
);

export function ConfigReviewDisplay({ packConfig, driveConfig, simulationConfig }: ConfigReviewDisplayProps) {
  if (!packConfig || !driveConfig || !simulationConfig) {
    return <p className="text-sm text-destructive">One or more configurations are missing.</p>;
  }

  // Helper to find the name of the default drive cycle
  const defaultCycleName = 
    driveConfig.driveCycles.find((dc: any) => dc.id === driveConfig.defaultDriveCycleId)?.name || "Not Found";

  return (
    <div className="space-y-4 my-6 p-4 border bg-background rounded-lg">
      <h3 className="text-lg font-semibold text-center mb-4">Full Configuration Review</h3>

      {/* Pack Configuration Card */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Battery size={20} />Pack Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-2 pb-4">
          <InfoItem label="Cell Form Factor" value={packConfig.meta.formFactor} />
          <InfoItem label="Total Cells" value={packConfig.cells.length} />
          <InfoItem label="Connection Type" value={packConfig.connection_type.replace(/_/g, ' ')} />
          <InfoItem label="Total Pack Mass" value={`${(packConfig.cells.length * packConfig.masses.cell).toFixed(3)} kg`} />
        </CardContent>
      </Card>

      {/* Drive Cycle Configuration Card */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Car size={20} />Drive Cycle Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-2 pb-4">
          <InfoItem label="Starting SOC" value={`${driveConfig.startingSoc}%`} />
          <InfoItem label="Defined Sub-Cycles" value={driveConfig.subCycles.length} />
          <InfoItem label="Defined Drive Cycles" value={driveConfig.driveCycles.length} />
          <InfoItem label="Calendar Rules" value={driveConfig.calendarRules.length} />
          <InfoItem label="Default Cycle" value={`${defaultCycleName} (${driveConfig.defaultDriveCycleId})`} />
        </CardContent>
      </Card>
      
      {/* Simulation Models Configuration Card */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Cpu size={20} />Simulation Models</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-2 pb-4">
          <InfoItem label="Complexity" value={<Badge variant="secondary">{simulationConfig.complexityLevel}</Badge>} />
          <InfoItem label="Est. Compute Time" value={<Badge variant="secondary">{simulationConfig.estimatedComputeTime}</Badge>} />
          <InfoItem label="Electrical Model" value={simulationConfig.electrical.details.name} />
          <InfoItem 
            label="Thermal Model" 
            value={simulationConfig.thermal.enabled 
              ? `${simulationConfig.thermal.model} / ${simulationConfig.thermal.cooling}`
              : "Disabled"
            } 
          />
          <InfoItem label="Life Model" value={simulationConfig.life.enabled ? "Enabled" : "Disabled"} />
          <InfoItem 
            label="Busbar Model" 
            value={simulationConfig.busbar.enabled 
              ? `Enabled (${simulationConfig.busbar.material})`
              : "Disabled"
            } 
          />
        </CardContent>
      </Card>
    </div>
  )
}
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import type { CustomParallelGroup } from "./use-custom-parallel-groups"

interface ElectricalConfigurationProps {
  connectionType: "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  setConnectionType: (value: "row_series_column_parallel" | "row_parallel_column_series" | "custom") => void
  rP: number
  setRP: (value: number) => void
  rS: number
  setRS: (value: number) => void
  moduleUpperVoltage: string
  setModuleUpperVoltage: (value: string) => void
  moduleLowerVoltage: string
  setModuleLowerVoltage: (value: string) => void
  customParallelGroups: CustomParallelGroup[]
  customConnectionError: string
  onAddGroup: () => void
  onRemoveGroup: (id: number) => void
  onUpdateGroup: (id: number, cellIds: string) => void
}

export function ElectricalConfiguration({
  connectionType,
  setConnectionType,
  rP,
  setRP,
  rS,
  setRS,
  moduleUpperVoltage,
  setModuleUpperVoltage,
  moduleLowerVoltage,
  setModuleLowerVoltage,
  customParallelGroups,
  customConnectionError,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
}: ElectricalConfigurationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Electrical Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Type */}
        <div className="space-y-3">
          <Label htmlFor="connType">
            Connection Type <span className="text-red-500">*</span>
          </Label>
          <Select value={connectionType} onValueChange={(value) => setConnectionType(value as any)}>
            <SelectTrigger id="connType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="row_series_column_parallel">Column Parallel (Series Columns)</SelectItem>
              <SelectItem value="row_parallel_column_series">Row Parallel (Series Rows)</SelectItem>
              <SelectItem value="custom">Custom Connection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Parallel Groups */}
        {connectionType === "custom" && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between items-center">
              <Label>Custom Parallel Groups</Label>
              <Button onClick={onAddGroup} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </div>

            {customConnectionError && (
              <Alert className="border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive text-sm">{customConnectionError}</AlertDescription>
              </Alert>
            )}

            {customParallelGroups.map((group, idx) => (
              <div key={group.id} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex justify-between items-center">
                  <Label className="font-medium">Group {idx + 1}</Label>
                  <Button
                    onClick={() => onRemoveGroup(group.id)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  placeholder="e.g., R1C1L1, R1C2L1, R2C1L1"
                  value={group.cellIds}
                  onChange={(e) => onUpdateGroup(group.id, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Comma-separated cell labels</p>
              </div>
            ))}
          </div>
        )}

        {/* Resistance Configuration */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="font-semibold text-sm">Resistance Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="rp">
                Parallel Resistance (R_p) <span className="text-red-500">*</span>
              </Label>
                <div className="relative">
                  <Input
                    id="rp"
                    type="number"
                    step="0.0001"
                    value={rP}
                    onChange={(e) => setRP(Number.parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    Ω
                  </span>
                </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="rs">
                Series Resistance (R_s)  <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
              <Input
                id="rs"
                type="number"
                step="0.0001"
                value={rS}
                onChange={(e) => setRS(Number.parseFloat(e.target.value) || 0)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                Ω
              </span>
              </div>
            </div>
          </div>
        </div>

        {/* Voltage Limits */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="font-semibold text-sm">Module Voltage Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="upperVolt">
                Upper Limit (V) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
              <Input
                id="upperVolt"
                type="number"
                value={moduleUpperVoltage}
                onChange={(e) => setModuleUpperVoltage(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                V
              </span>
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="lowerVolt">
                Lower Limit (V) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
              <Input
                id="lowerVolt"
                type="number"
                value={moduleLowerVoltage}
                onChange={(e) => setModuleLowerVoltage(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                V
              </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

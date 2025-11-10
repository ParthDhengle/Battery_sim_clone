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
        <div className="space-y-3">
          <Label>Connection Type</Label>
          <Select value={connectionType} onValueChange={(value) => setConnectionType(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="row_series_column_parallel">Row Series, Column Parallel</SelectItem>
              <SelectItem value="row_parallel_column_series">Row Parallel, Column Series</SelectItem>
              <SelectItem value="custom">Custom Connection</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                <AlertDescription className="text-destructive">{customConnectionError}</AlertDescription>
              </Alert>
            )}

            {customParallelGroups.map((group, idx) => (
              <div key={group.id} className="space-y-2 p-3 border rounded">
                <div className="flex justify-between items-center">
                  <Label>Parallel Group {idx + 1}</Label>
                  <Button
                    onClick={() => onRemoveGroup(group.id)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  placeholder="e.g., R1C1L1, R1C2L1, R2C1L1"
                  value={group.cellIds}
                  onChange={(e) => onUpdateGroup(group.id, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter comma-separated cell labels</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>R_p (Ohms) - Parallel Connection Resistance</Label>
            <Input type="number" value={rP} onChange={(e) => setRP(Number.parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-3">
            <Label>R_s (Ohms) - Series Connection Resistance</Label>
            <Input type="number" value={rS} onChange={(e) => setRS(Number.parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Module Voltage Upper Limit (V)</Label>
            <Input type="number" value={moduleUpperVoltage} onChange={(e) => setModuleUpperVoltage(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Module Voltage Lower Limit (V)</Label>
            <Input type="number" value={moduleLowerVoltage} onChange={(e) => setModuleLowerVoltage(e.target.value)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Layer } from "./use-layers"
import { CellPlot } from "./cell-plot"
import { CellDataTable } from "./cell-data-table"

interface LayersConfigurationProps {
  formFactor: "cylindrical" | "prismatic"
  dims: { radius?: number; length?: number; width?: number; height: number }
  layers: Layer[]
  zPitch: string
  labelSchema: string
  connectionType: "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  customParallelGroups?: { id: number; cellIds: string }[]
  onAddLayer: (minPitchX: number, minPitchY: number, height: number, zPitch: string) => void
  onRemoveLayer: (id: number) => void
  onUpdateLayer: (id: number, field: keyof Layer, value: string, minPitchY: number) => void
}

export function LayersConfiguration({
  formFactor,
  dims,
  layers,
  zPitch,
  labelSchema,
  connectionType,
  customParallelGroups,
  onAddLayer,
  onRemoveLayer,
  onUpdateLayer,
}: LayersConfigurationProps) {
  const getMinPitchX = () => {
    if (formFactor === "cylindrical") return 2 * (dims.radius ?? 0)
    if (formFactor === "prismatic") return dims.length ?? 0
    return 0
  }

  const getMinPitchY = () => {
    if (formFactor === "cylindrical") return 2 * (dims.radius ?? 0)
    if (formFactor === "prismatic") return dims.width ?? 0
    return 0
  }

  const getPitchXCondition = () => {
    if (formFactor === "cylindrical") return "greater than 2x radius"
    if (formFactor === "prismatic") return "greater than length"
    return ""
  }

  const getPitchYCondition = () => {
    if (formFactor === "cylindrical") return "greater than 2x radius"
    if (formFactor === "prismatic") return "greater than width"
    return ""
  }

  const gridTypes =
    formFactor === "cylindrical"
      ? ["rectangular", "brick_row_stagger", "brick_col_stagger", "hex_flat", "hex_pointy", "diagonal"]
      : ["rectangular", "brick_row_stagger", "brick_col_stagger", "diagonal"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layer Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {layers.map((layer, idx) => (
          <div key={layer.id} className="space-y-4 pb-4 border-b last:border-0 last:pb-0">
            <h3 className="font-semibold">Layer {idx + 1}</h3>

            {/* Grid Type */}
            <div className="space-y-3">
              <Label htmlFor={`gridType-${layer.id}`}>
                Grid Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={layer.gridType}
                onValueChange={(v) => onUpdateLayer(layer.id, "gridType", v, getMinPitchY())}
              >
                <SelectTrigger id={`gridType-${layer.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gridTypes.map((gt) => (
                    <SelectItem key={gt} value={gt}>
                      {gt.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor={`nRows-${layer.id}`}>
                  Number of Rows <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`nRows-${layer.id}`}
                  type="number"
                  min="1"
                  value={layer.nRows}
                  onChange={(e) => onUpdateLayer(layer.id, "nRows", e.target.value, getMinPitchY())}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor={`nCols-${layer.id}`}>
                  Number of Columns <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`nCols-${layer.id}`}
                  type="number"
                  min="1"
                  value={layer.nCols}
                  onChange={(e) => onUpdateLayer(layer.id, "nCols", e.target.value, getMinPitchY())}
                />
              </div>
            </div>

            {/* Pitch Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor={`pitchX-${layer.id}`}>
                  Pitch X [{getPitchXCondition()}] <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id={`pitchX-${layer.id}`}
                    type="number"
                    step="0.1"
                    value={layer.pitchX}
                    onChange={(e) => onUpdateLayer(layer.id, "pitchX", e.target.value, getMinPitchY())}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    mm
                  </span> 
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor={`pitchY-${layer.id}`}>
                  Pitch Y [{getPitchYCondition()}] <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                <Input
                  id={`pitchY-${layer.id}`}
                  type="number"
                  step="0.1"
                  value={layer.pitchY}
                  onChange={(e) => onUpdateLayer(layer.id, "pitchY", e.target.value, getMinPitchY())}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  mm
                </span>
                </div>
              </div>
            </div>

            {/* Visualization Tabs */}
            <Tabs defaultValue="plot" className="w-full mt-6 border-t pt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="plot">Pack Arrangement</TabsTrigger>
                <TabsTrigger value="table">Pack Arrangement Details (Tabular)</TabsTrigger>
              </TabsList>

              <TabsContent value="plot">
                <CellPlot
                  layer={layer}
                  formFactor={formFactor}
                  dims={dims}
                  labelSchema={labelSchema}
                  connectionType={connectionType}
                  customParallelGroups={customParallelGroups}
                />
              </TabsContent>

              <TabsContent value="table">
                <CellDataTable
                  layer={layer}
                  formFactor={formFactor}
                  dims={dims}
                  labelSchema={labelSchema}
                  connectionType={connectionType}
                  customParallelGroups={customParallelGroups}
                />
              </TabsContent>
            </Tabs>
          </div>
        ))}

        {layers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Select a cell above to create your first layer</p>
        )}
      </CardContent>
    </Card>
  )
}
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Layer } from "./use-layers"
import { CellPlot } from "./cell_plot"
import { CellDataTable } from "./cell_data_table"

interface LayersConfigurationProps {
  formFactor: "cylindrical" | "prismatic"
  dims: { radius?: number; length?: number; width?: number; height: number }
  layers: Layer[]
  zPitch: string
  labelSchema: string
  connectionType: "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  customParallelGroups?: { id: number; cellIds: string }[]
  onAddLayer: (
    minPitchX: number,
    minPitchY: number,
    height: number,
    zPitch: string
  ) => void
  onRemoveLayer: (id: number) => void
  onUpdateLayer: (
    id: number,
    field: keyof Layer,
    value: string,
    minPitchY: number
  ) => void
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
    if (formFactor === "cylindrical") return "greater than diameter"
    if (formFactor === "prismatic") return "greater than length"
    return ""
  }
  const getPitchYCondition = () => {
    if (formFactor === "cylindrical") return "greater than diameter"
    if (formFactor === "prismatic") return "greater than width"
    return ""
  }
  const gridTypes =
    formFactor === "cylindrical"
      ? [
          "rectangular",
          "brick_row_stagger",
          "brick_col_stagger",
          "hex_flat",
          "hex_pointy",
          "diagonal",
        ]
      : ["rectangular", "brick_row_stagger", "brick_col_stagger", "diagonal"]
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Layers</CardTitle>
          {/* <Button
            onClick={() =>
              onAddLayer(getMinPitchX(), getMinPitchY(), dims.height, zPitch)
            }
          >
            Add Layer
          </Button> */}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            className="space-y-4 pb-4 border-b last:border-0 last:pb-0"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Layer {idx + 1}</h3>
              {layers.length > 1 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemoveLayer(layer.id)}
                >
                  Remove
                </Button>
              )}
            </div>
            {/* ---------- INPUT GRID ---------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Grid Type<span className="text-red-500">*</span></Label>
                <Select
                  value={layer.gridType}
                  onValueChange={(v) =>
                    onUpdateLayer(layer.id, "gridType", v, getMinPitchY())
                  }
                >
                  <SelectTrigger>
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
              <div className="space-y-3">
                <Label>Number of Rows<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={layer.nRows}
                  onChange={(e) =>
                    onUpdateLayer(
                      layer.id,
                      "nRows",
                      e.target.value,
                      getMinPitchY()
                    )
                  }
                />
              </div>
              <div className="space-y-3">
                <Label>Number of Columns<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={layer.nCols}
                  onChange={(e) =>
                    onUpdateLayer(
                      layer.id,
                      "nCols",
                      e.target.value,
                      getMinPitchY()
                    )
                  }
                />
              </div>
              <div className="space-y-3">
                <Label>Pitch X (mm) [{getPitchXCondition()}]<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={layer.pitchX}
                  onChange={(e) =>
                    onUpdateLayer(
                      layer.id,
                      "pitchX",
                      e.target.value,
                      getMinPitchY()
                    )
                  }
                />
              </div>
              <div className="space-y-3">
                <Label>Pitch Y (mm) [{getPitchYCondition()}]<span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={layer.pitchY}
                  onChange={(e) =>
                    onUpdateLayer(
                      layer.id,
                      "pitchY",
                      e.target.value,
                      getMinPitchY()
                    )
                  }
                />
              </div>
              <div className="space-y-3">
                <Label>Z Mode<span className="text-red-500">*</span></Label>
                <Select
                  value={layer.zMode}
                  onValueChange={(v) =>
                    onUpdateLayer(
                      layer.id,
                      "zMode",
                      v as "index_pitch" | "explicit",
                      getMinPitchY()
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index_pitch">Index Pitch</SelectItem>
                    <SelectItem value="explicit">Explicit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {layer.zMode === "explicit" && (
                <div className="space-y-3">
                  <Label>Z Center (mm)<span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={layer.zCenter}
                    onChange={(e) =>
                      onUpdateLayer(
                        layer.id,
                        "zCenter",
                        e.target.value,
                        getMinPitchY()
                      )
                    }
                  />
                </div>
              )}
            </div>
            {/* ---------- PLOT SECTION ---------- */}
            <Tabs defaultValue="plot" className="w-full">
              <TabsList>
                <TabsTrigger value="plot">Cell Plot</TabsTrigger>
                <TabsTrigger value="table">Cell Data Table</TabsTrigger>
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
          <p className="text-center text-muted-foreground">
            No layers added yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}
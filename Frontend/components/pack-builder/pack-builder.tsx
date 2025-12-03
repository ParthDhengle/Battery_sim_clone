// Frontend/components/pack-builder/pack-builder.tsx
"use client"
import { useState, useEffect } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Battery } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePackBuilder } from "./use-pack-builder"
import { useLayers, type Layer } from "./use-layers"
import { useVaryingCells } from "./use-varying-cells"
import { useCustomParallelGroups } from "./use-custom-parallel-groups"
import { PackBasicInfo } from "./pack-basic-info"
import { SelectedCellDetails } from "./selected-cell-details"
import { ElectricalConfiguration } from "./electrical-configuration"
import { AdvancedOptions } from "./advanced-options"
import { LayersConfiguration } from "./layers-configuration"
import { PackSummaryDisplay } from "./pack-summary-display"
import { validateAndGenerateConfig } from "./pack-validation"

export function PackBuilder() {
  const {
    packId,
    cells,
    selectedCellId,
    setSelectedCellId,
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
    allowOverlap,
    setAllowOverlap,
    computeNeighbors,
    setComputeNeighbors,
    labelSchema,
    setLabelSchema,
    maxWeight,
    setMaxWeight,
    maxVolume,
    setMaxVolume,
    zPitch,
    setZPitch,
    packName,
    setPackName,
    packDescription,
    setPackDescription,
    error,
    setError,
    packSummary,
    setPackSummary,
    handleSelectCell,
    handleSave,
    loadPack,
  } = usePackBuilder()

  const { layers, addLayer, removeLayer, updateLayer, initializeLayers } = useLayers([])
  const { varyingCells, addVaryingCell, removeVaryingCell, updateVaryingCell } = useVaryingCells([])
  const {
    customParallelGroups,
    customConnectionError,
    addCustomParallelGroup,
    removeCustomParallelGroup,
    updateCustomParallelGroup,
    initializeGroups,
  } = useCustomParallelGroups([])

  const [previewCells, setPreviewCells] = useState<any[]>([])

  // Auto-add default layer when creating new pack
  useEffect(() => {
    if (layers.length === 0 && selectedCellId && !packId) {
      const minPitchX = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.length ?? 80)
      const minPitchY = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.width ?? 60)
      addLayer(minPitchX + 2, minPitchY + 2, dims.height ?? 70, zPitch)
    }
  }, [selectedCellId, formFactor, dims, layers.length, packId, addLayer, zPitch])

  // Load layers & custom groups when editing
  useEffect(() => {
    if (!packId) return

    const initFromPack = async () => {
      const data = await loadPack()
      if (!data) return

      // Initialize layers
      const loadedLayers: Layer[] = (data.layers || []).map((l: any, idx: number) => ({
        id: idx + 1,
        gridType: l.grid_type || "rectangular",
        nRows: l.n_rows || 3,
        nCols: l.n_cols || 3,
        pitchX: l.pitch_x || 40,
        pitchY: l.pitch_y || 40,
        zMode: l.z_mode || "explicit",
        zCenter: l.z_center?.toString() || "0",
      }))

      initializeLayers(loadedLayers)

      // Initialize custom parallel groups
      if (data.custom_parallel_groups?.length > 0) {
        const groups = data.custom_parallel_groups.map((g: any, idx: number) => ({
          id: idx + 1,
          cellIds: g.cell_ids?.join(", ") || "",
        }))
        initializeGroups(groups)
      }

      // Update zPitch if saved
      if (data.z_pitch) {
        setZPitch(data.z_pitch.toString())
      }
    }

    initFromPack()
  }, [packId, loadPack, initializeLayers, initializeGroups, setZPitch])

  // Update preview/summary
  useEffect(() => {
    const config = validateAndGenerateConfig({
      formFactor,
      dims,
      layers,
      zPitch,
      allowOverlap,
      computeNeighbors,
      labelSchema,
      connectionType,
      customParallelGroups,
      mCell,
      mJellyroll,
      cellUpperVoltage,
      cellLowerVoltage,
      moduleUpperVoltage,
      moduleLowerVoltage,
      columbicEfficiency,
      capacity,
      rP,
      rS,
      costPerCell,
      maxWeight,
      maxVolume,
      varyingCells,
      isPreview: true,
    })

    setPreviewCells(config?.cells || [])
    setPackSummary(config?.summary || null)
  }, [
    formFactor, dims, layers, zPitch, allowOverlap, computeNeighbors,
    labelSchema, connectionType, customParallelGroups, mCell, capacity,
    cellUpperVoltage, cellLowerVoltage, rP, rS
  ])

  const handleSaveClick = async () => {
    const config = validateAndGenerateConfig({
      formFactor,
      dims,
      layers,
      zPitch,
      allowOverlap,
      computeNeighbors,
      labelSchema,
      connectionType,
      customParallelGroups,
      mCell,
      mJellyroll,
      cellUpperVoltage,
      cellLowerVoltage,
      moduleUpperVoltage,
      moduleLowerVoltage,
      columbicEfficiency,
      capacity,
      rP,
      rS,
      costPerCell,
      maxWeight,
      maxVolume,
      varyingCells,
      selectedCellId,
      isPreview: false,
    })

    if (config) await handleSave(config)
  }

  const useIndexPitch = layers.some(l => l.zMode === "index_pitch")
  const hasLargePack = layers.reduce((sum, l) => sum + (Number(l.nRows) || 0) * (Number(l.nCols) || 0), 0) > 1000

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="pb-6 border-b mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Battery className="w-6 h-6" />
          {packId ? "Edit Pack" : "Create Pack"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define your battery pack geometry and electrical configuration
        </p>
      </div>

      <PackBasicInfo
        packName={packName}
        setPackName={setPackName}
        packDescription={packDescription}
        setPackDescription={setPackDescription}
        cells={cells}
        selectedCellId={selectedCellId}
        onSelectCell={handleSelectCell}
      />

      <SelectedCellDetails
        formFactor={formFactor}
        dims={dims}
        capacity={capacity}
        columbicEfficiency={columbicEfficiency}
        mCell={mCell}
        mJellyroll={mJellyroll}
        cellUpperVoltage={cellUpperVoltage}
        cellLowerVoltage={cellLowerVoltage}
        costPerCell={costPerCell}
        setCostPerCell={setCostPerCell}
        allowOverlap={allowOverlap}
        setAllowOverlap={setAllowOverlap}
        useIndexPitch={useIndexPitch}
        zPitch={zPitch}
        setZPitch={setZPitch}
      />

      <ElectricalConfiguration
        connectionType={connectionType}
        setConnectionType={setConnectionType}
        rP={rP}
        setRP={setRP}
        rS={rS}
        setRS={setRS}
        moduleUpperVoltage={moduleUpperVoltage}
        setModuleUpperVoltage={setModuleUpperVoltage}
        moduleLowerVoltage={moduleLowerVoltage}
        setModuleLowerVoltage={setModuleLowerVoltage}
        customParallelGroups={customParallelGroups}
        customConnectionError={customConnectionError}
        onAddGroup={addCustomParallelGroup}
        onRemoveGroup={removeCustomParallelGroup}
        onUpdateGroup={updateCustomParallelGroup}
      />

      <LayersConfiguration
        formFactor={formFactor}
        dims={dims}
        layers={layers}
        zPitch={zPitch}
        labelSchema={labelSchema}
        connectionType={connectionType}
        customParallelGroups={customParallelGroups}
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onUpdateLayer={updateLayer}
      />

      <AdvancedOptions
        computeNeighbors={computeNeighbors}
        setComputeNeighbors={setComputeNeighbors}
        labelSchema={labelSchema}
        setLabelSchema={setLabelSchema}
      />

      {packSummary && <PackSummaryDisplay summary={packSummary} />}

      {hasLargePack && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Warning: Large packs may cause longer simulation times.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleSaveClick}
          disabled={layers.length === 0 || !packName || !selectedCellId}
          className="min-w-40"
        >
          {packId ? "Update Pack" : "Save Pack"} Configuration
        </Button>
      </div>
    </div>
  )
}
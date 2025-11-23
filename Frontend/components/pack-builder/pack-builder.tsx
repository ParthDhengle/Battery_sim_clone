"use client"
import { useState, useEffect } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Battery } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePackBuilder } from "./use-pack-builder"
import { useLayers } from "./use-layers"
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
    initialTemperature,
    setInitialTemperature,
    initialSOC,
    setInitialSOC,
    initialSOH,
    setInitialSOH,
    initialDCIR,
    setInitialDCIR,
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
  } = usePackBuilder()

  const { layers, addLayer, removeLayer, updateLayer, initializeLayers } = useLayers([])
  const { varyingCells, addVaryingCell, removeVaryingCell, updateVaryingCell, initializeVaryingCells } =
    useVaryingCells([])
  const {
    customParallelGroups,
    customConnectionError,
    addCustomParallelGroup,
    removeCustomParallelGroup,
    updateCustomParallelGroup,
    initializeGroups,
  } = useCustomParallelGroups([])

  // Initialize default single layer when cell is selected
  useEffect(() => {
    if (layers.length === 0 && selectedCellId && !packId) {
      const minPitchX = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.length ?? 80)
      const minPitchY = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.width ?? 60)
      addLayer(minPitchX + 2, minPitchY + 2, dims.height ?? 70, zPitch)
    }
  }, [selectedCellId, formFactor, dims, layers.length, packId, addLayer, zPitch])

  // Update pack summary on configuration changes
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
    if (config?.summary) {
      setPackSummary(config.summary)
    } else {
      setPackSummary(null)
    }
  }, [
    formFactor,
    dims,
    layers,
    zPitch,
    allowOverlap,
    computeNeighbors,
    labelSchema,
    connectionType,
    customParallelGroups,
  ])

  const [previewCells, setPreviewCells] = useState<any[]>([])

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
      initialTemperature,
      initialSOC,
      initialSOH,
      initialDCIR,
      isPreview: false,
    })

    if (config) {
      await handleSave(config)
    }
  }

  const useIndexPitch = layers.some((l) => l.zMode === "index_pitch")
  const hasWarnings = layers.some((layer) => {
    const total = layers.reduce(
      (sum, l) => sum + (Number.parseInt(String(l.nRows)) || 0) * (Number.parseInt(String(l.nCols)) || 0),
      0,
    )
    return total > 1000
  })

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-5 h-5" />
            {packId ? "Edit Pack" : "Create Pack"}
          </CardTitle>
          <CardDescription>Define your battery pack geometry and electrical configuration</CardDescription>
        </CardHeader>
      </Card>

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

      {hasWarnings && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Warning: Large pack configurations may result in longer simulation times or unrealistic setups.
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

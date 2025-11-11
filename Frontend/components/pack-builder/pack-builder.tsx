"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Battery } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
// import { PackLayout3D } from "@/components/3D_preview/pack-layout-3d"
import { usePackBuilder } from "./use-pack-builder"
import { useLayers } from "./use-layers"
import { useVaryingCells } from "./use-varying-cells"
import { useCustomParallelGroups } from "./use-custom-parallel-groups"
import { PackBasicInfo } from "./pack-basic-info"
import { SelectedCellDetails } from "./selected-cell-details"
import { ElectricalConfiguration } from "./electrical-configuration"
import { AdvancedOptions } from "./advanced-options"
import { DesignConstraints } from "./design-constraints"
import { LayersConfiguration } from "./layers-configuration"
import { PackSummaryDisplay } from "./pack-summary-display"
import { validateAndGenerateConfig } from "./pack-validation"

export function PackBuilder() {
  const {
    packId,
    cells,
    selectedCellName,
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
    packSummary,
    setPackSummary,
    handleSelectCell,
    handleSave,
  } = usePackBuilder()

  const { layers, addLayer, removeLayer, updateLayer } = useLayers([])
  const { varyingCells, addVaryingCell, removeVaryingCell, updateVaryingCell } = useVaryingCells([])
  const {
    customParallelGroups,
    customConnectionError,
    addCustomParallelGroup,
    removeCustomParallelGroup,
    updateCustomParallelGroup,
    validateCustomConnection,
  } = useCustomParallelGroups([])

  const [previewCells, setPreviewCells] = useState<any[]>([])

  const useIndexPitch = layers.some((l) => l.zMode === "index_pitch")

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
    if (config?.summary && config.summary.electrical && config.summary.mechanical && config.summary.commercial) {
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
      selectedCellName,
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

  const hasWarnings = layers.some((layer) => {
    const total = layers.reduce((sum, l) => sum + l.nRows * l.nCols, 0)
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
          <CardDescription>Define your battery pack geometry</CardDescription>
        </CardHeader>
      </Card>

      <PackBasicInfo
        packName={packName}
        setPackName={setPackName}
        packDescription={packDescription}
        setPackDescription={setPackDescription}
        cells={cells}
        selectedCellName={selectedCellName}
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

      <AdvancedOptions
        computeNeighbors={computeNeighbors}
        setComputeNeighbors={setComputeNeighbors}
        labelSchema={labelSchema}
        setLabelSchema={setLabelSchema}
      />

      <DesignConstraints
        maxWeight={maxWeight}
        setMaxWeight={setMaxWeight}
        maxVolume={maxVolume}
        setMaxVolume={setMaxVolume}
      />
      <LayersConfiguration
        formFactor={formFactor}
        dims={dims}
        layers={layers}
        zPitch={zPitch}
        labelSchema={labelSchema} 
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onUpdateLayer={updateLayer}
      />

      {/* <Card>
        <CardHeader>
          <CardTitle>Pack 3D Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <PackLayout3D cells={previewCells} formFactor={formFactor} />
        </CardContent>
      </Card> */}

      {packSummary && <PackSummaryDisplay summary={packSummary} />}

      {hasWarnings && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Warning: Large pack configurations may result in longer simulation times or unrealistic setups.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSaveClick} disabled={layers.length === 0 || !packName} className="min-w-32">
          {packId ? "Update Pack" : "Save Pack"} Configuration
        </Button>
      </div>
    </div>
  )
}

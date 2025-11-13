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
import { getPack } from "@/lib/api/packs" // Added import for getPack

export function PackBuilder() {
  const {
    packId,
    cells,
    selectedCellId,
    setSelectedCellId,
    formFactor,
    setFormFactor,
    dims,
    setDims,
    capacity,
    setCapacity,
    columbicEfficiency,
    setColumbicEfficiency,
    mCell,
    setMCell,
    mJellyroll,
    setMJellyroll,
    cellUpperVoltage,
    setCellUpperVoltage,
    cellLowerVoltage,
    setCellLowerVoltage,
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
  const { varyingCells, addVaryingCell, removeVaryingCell, updateVaryingCell, initializeVaryingCells } = useVaryingCells([])
  const {
    customParallelGroups,
    customConnectionError,
    addCustomParallelGroup,
    removeCustomParallelGroup,
    updateCustomParallelGroup,
    validateCustomConnection,
    initializeGroups,
  } = useCustomParallelGroups([])
  // Initialize default single layer for new packs when cell is selected
  useEffect(() => {
    if (layers.length === 0 && selectedCellId && !packId) {
      const minPitchX = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.length ?? 80); // Default radius 18mm for cyl, length 80mm for prism
      const minPitchY = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.width ?? 60); // Default width 60mm for prism
      addLayer(minPitchX + 2, minPitchY + 2, dims.height ?? 70, zPitch);
    }
  }, [selectedCellId, formFactor, dims, layers.length, packId, addLayer, zPitch]);
  // Load pack data including layers for edit mode
  useEffect(() => {
    if (packId && packId !== "undefined") {
      getPack(packId).then((pack: any) => {
        // ... (other sets as before)
        setPackName(pack.name);
        setPackDescription(pack.description || "");
        setSelectedCellId(pack.cell_id);
        setFormFactor(pack.cell.form_factor);
        setDims({
          radius: pack.cell.dims.radius,
          length: pack.cell.dims.length,
          width: pack.cell.dims.width,
          height: pack.cell.dims.height,
        });
        setCapacity(pack.cell.capacity);
        setColumbicEfficiency(pack.cell.columbic_efficiency);
        setMCell(pack.cell.m_cell);
        setMJellyroll(pack.cell.m_jellyroll);
        setCellUpperVoltage(pack.cell.cell_voltage_upper_limit);
        setCellLowerVoltage(pack.cell.cell_voltage_lower_limit);
        setCostPerCell(pack.cost_per_cell.toString());
        setConnectionType(pack.connection_type);
        setRP(pack.r_p);
        setRS(pack.r_s);
        setModuleUpperVoltage(pack.voltage_limits.module_upper?.toString() || "60");
        setModuleLowerVoltage(pack.voltage_limits.module_lower?.toString() || "40");
        setAllowOverlap(pack.options.allow_overlap);
        setComputeNeighbors(pack.options.compute_neighbors);
        setLabelSchema(pack.options.label_schema);
        setMaxWeight(pack.constraints.max_weight?.toString() || "10");
        setMaxVolume(pack.constraints.max_volume?.toString() || "0.01");
        setZPitch(pack.z_pitch ? pack.z_pitch.toString() : "80");
        setInitialTemperature(pack.initial_conditions.temperature.toString());
        setInitialSOC((pack.initial_conditions.soc * 100).toString());
        setInitialSOH(pack.initial_conditions.soh.toString());
        setInitialDCIR(pack.initial_conditions.dcir_aging_factor.toString());
        setPackSummary(pack.summary);

        // Initialize layers from loaded pack
        if (pack.layers && pack.layers.length > 0) {
          const loadedLayers = pack.layers.map((l: any, idx: number) => ({
            id: idx + 1,
            gridType: l.grid_type,
            nRows: l.n_rows,
            nCols: l.n_cols,
            pitchX: l.pitch_x,
            pitchY: l.pitch_y,
            zMode: l.z_mode as "index_pitch" | "explicit",
            zCenter: l.z_center ? l.z_center.toString() : "0",
          }));
          initializeLayers(loadedLayers);
        } else {
          // Fallback to default single layer if no layers in pack
          const minPitchX = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.length ?? 80);
          const minPitchY = formFactor === "cylindrical" ? 2 * (dims.radius ?? 18) : (dims.width ?? 60);
          addLayer(minPitchX + 2, minPitchY + 2, dims.height ?? 70, zPitch);
        }

        // Initialize custom parallel groups
        if (pack.custom_parallel_groups) {
          const loadedGroups = pack.custom_parallel_groups.map((g: any, idx: number) => ({
            id: idx + 1,
            cellIds: g.cell_ids,
          }));
          initializeGroups(loadedGroups);
        }

        // Initialize varying cells
        if (pack.initial_conditions.varying_cells) {
          const loadedVarying = pack.initial_conditions.varying_cells.map((vc: any, idx: number) => ({
            id: idx + 1,
            cellIndex: vc.cell_index.toString(),
            temp: vc.temperature.toString(),
            soc: (vc.soc * 100).toString(),
            soh: vc.soh.toString(),
            dcir: vc.dcir_aging_factor.toString(),
          }));
          initializeVaryingCells(loadedVarying);
        }
      }).catch((e: any) => {
        console.error("Failed to load pack", e);
        setError(e.message || "Failed to load pack");
      });
    }
  }, [packId]);
  const [previewCells, setPreviewCells] = useState<any[]>([])
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
    // ... other deps
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
  const useIndexPitch = layers.some((l) => l.zMode === "index_pitch")
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
        connectionType={connectionType}
        customParallelGroups={customParallelGroups}
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
        <Button onClick={handleSaveClick} disabled={layers.length === 0 || !packName || !selectedCellId} className="min-w-32">
          {packId ? "Update Pack" : "Save Pack"} Configuration
        </Button>
      </div>
    </div>
  )
}
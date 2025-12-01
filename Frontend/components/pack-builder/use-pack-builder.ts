"use client"
import { useState, useEffect, useCallback  } from "react"
import { getPack, createPack, updatePack } from "@/lib/api/packs"
import { getCells } from "@/lib/api/cells"
import { useRouter, useSearchParams } from "next/navigation"

export interface Layer {
  id: number
  gridType: string
  nRows: number
  nCols: number
  pitchX: number
  pitchY: number
  zMode: "index_pitch" | "explicit"
  zCenter: string
}

export interface PackSummary {
  electrical: {
    nSeries: number
    nParallel: number
    nTotal: number
    vCellNominal: number
    packNominalVoltage: number
    packMaxVoltage: number
    packMinVoltage: number
    packCapacity: number
    packEnergyWh: number
    packEnergyKwh: number
    adjustedPackEnergyWh: number
    busbarTotalResistance: number
  }
  mechanical: {
    totalCells: number
    totalPackWeight: number
    totalCellVolume: number
    totalPackVolume: number
    energyDensityGravimetric: number
    energyDensityVolumetric: number
  }
  commercial: {
    totalPackCost: number
    costPerKwh: number
  }
}

export function usePackBuilder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const packId = searchParams.get("id")
  const [cells, setCells] = useState<any[]>([])
  const [selectedCellId, setSelectedCellId] = useState("")
  const [formFactor, setFormFactor] = useState<"cylindrical" | "prismatic">("cylindrical")
  const [dims, setDims] = useState<{ radius?: number; length?: number; width?: number; height: number }>({ height: 70 })
  const [capacity, setCapacity] = useState(5)
  const [columbicEfficiency, setColumbicEfficiency] = useState(1.0)
  const [mCell, setMCell] = useState(0.06725)
  const [mJellyroll, setMJellyroll] = useState(0.05708)
  const [cellUpperVoltage, setCellUpperVoltage] = useState(4.2)
  const [cellLowerVoltage, setCellLowerVoltage] = useState(2.5)
  const [costPerCell, setCostPerCell] = useState("3.0")
  const [connectionType, setConnectionType] = useState<
    "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  >("row_series_column_parallel")
  const [rP, setRP] = useState(0.001)
  const [rS, setRS] = useState(0.001)
  const [moduleUpperVoltage, setModuleUpperVoltage] = useState("60")
  const [moduleLowerVoltage, setModuleLowerVoltage] = useState("40")
  const [allowOverlap, setAllowOverlap] = useState(false)
  const [computeNeighbors, setComputeNeighbors] = useState(true)
  const [labelSchema, setLabelSchema] = useState("R{row}C{col}L{layer}")
  const [maxWeight, setMaxWeight] = useState("10")
  const [maxVolume, setMaxVolume] = useState("0.01")
  const [zPitch, setZPitch] = useState("80")
  const [initialTemperature, setInitialTemperature] = useState("300")
  const [initialSOC, setInitialSOC] = useState("100")
  const [initialSOH, setInitialSOH] = useState("1.0")
  const [initialDCIR, setInitialDCIR] = useState("1.0")
  const [packName, setPackName] = useState("")
  const [packDescription, setPackDescription] = useState("")
  const [error, setError] = useState<string>("")
  const [packSummary, setPackSummary] = useState<PackSummary | null>(null)
  useEffect(() => {
  async function fetchCells() {
    try {
      const data = await getCells()
      setCells(data)
      // Removed auto-selection - let user choose manually
    } catch (e: any) {
      const errMsg =
        e.message || "Failed to fetch cells. Check if the backend is running and connected to the database."
      console.error("Failed to fetch cells", e)
      setError(errMsg)
    }
  }
  fetchCells()
}, [])

  const handleSelectCell = useCallback((id: string) => {
  setSelectedCellId(id)
  const cell = cells.find((c) => c.id === id)
  if (cell) {
    setFormFactor(cell.formFactor)
    setDims({
      radius: cell.dims.radius ?? undefined,
      length: cell.dims.length ?? undefined,
      width: cell.dims.width ?? undefined,
      height: cell.dims.height ?? undefined,
    })
    setCapacity(cell.capacity)
    setColumbicEfficiency(cell.columbicEfficiency ?? cell.columbic_efficiency ?? 1.0)
    setMCell(cell.cell_weight)
    setCellUpperVoltage(cell.cell_upper_voltage_cutoff)
    setCellLowerVoltage(cell.cell_lower_voltage_cutoff)
  }
}, [cells])

  const loadPack = async () => {
    if (!packId || packId === "undefined") {
      return;
    }
    try {
      const pack: any = await getPack(packId)
      setPackName(pack.name)
      setPackDescription(pack.description || "")
      setSelectedCellId(pack.cell_id)
      setFormFactor(pack.cell.form_factor)
      setDims({
        radius: pack.cell.dims.radius ?? undefined,
        length: pack.cell.dims.length ?? undefined,
        width: pack.cell.dims.width ?? undefined,
        height: pack.cell.dims.height,
      })
      setCapacity(pack.cell.capacity)
      setColumbicEfficiency(pack.cell.columbic_efficiency)
      setMCell(pack.cell.m_cell)
      setMJellyroll(pack.cell.m_jellyroll)
      setCellUpperVoltage(pack.cell.cell_voltage_upper_limit)
      setCellLowerVoltage(pack.cell.cell_voltage_lower_limit)
      setCostPerCell(pack.cost_per_cell.toString())
      setConnectionType(pack.connection_type)
      setRP(pack.r_p)
      setRS(pack.r_s)
      setModuleUpperVoltage(pack.voltage_limits.module_upper?.toString() || "60")
      setModuleLowerVoltage(pack.voltage_limits.module_lower?.toString() || "40")
      setAllowOverlap(pack.options.allow_overlap)
      setComputeNeighbors(pack.options.compute_neighbors)
      setLabelSchema(pack.options.label_schema)
      setMaxWeight(pack.constraints.max_weight?.toString() || "10")
      setMaxVolume(pack.constraints.max_volume?.toString() || "0.01")
      
      
      setPackSummary(pack.summary)
    } catch (e: any) {
      const errMsg = e.message || "Failed to load pack. Check backend connection.";
      console.error("Failed to load pack", e);
      setError(errMsg);
      setTimeout(() => router.push("/library/packs"), 2000); // Redirect on load failure
    }
  }
  useEffect(() => {
    if (packId && packId !== "undefined") {
      loadPack();
    }
  }, [packId]);
  const handleSave = async (config: any) => {
    if (!packName) {
      setError("Please enter a pack name")
      return
    }
    if (!config) {
      setError("Invalid pack configuration")
      return
    }
    const packData = {
      ...config,
      name: packName,
      description: packDescription || null,
    }
    try {
      if (packId) {
        await updatePack(packId, packData)
      } else {
        await createPack(packData)
      }
      router.push("/library/packs")
    } catch (e: any) {
      setError(e.message || "Failed to save pack")
    }
  }
  return {
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
  }
}
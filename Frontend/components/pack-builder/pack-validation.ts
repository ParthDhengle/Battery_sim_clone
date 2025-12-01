import type { Layer } from "./use-layers"
import type { VaryingCell } from "./use-varying-cells"
import type { CustomParallelGroup } from "./use-custom-parallel-groups"
import type { PackSummary } from "./use-pack-builder"

interface ValidateConfig {
  formFactor: "cylindrical" | "prismatic"
  dims: { radius?: number; length?: number; width?: number; height: number }
  layers: Layer[]
  zPitch: string
  allowOverlap: boolean
  computeNeighbors: boolean
  labelSchema: string
  connectionType: "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  customParallelGroups: CustomParallelGroup[]
  mCell: number
  mJellyroll: number
  cellUpperVoltage: number
  cellLowerVoltage: number
  columbicEfficiency: number
  capacity: number
  rP: number
  rS: number
  costPerCell: string
  maxWeight: string
  maxVolume: string
  varyingCells: VaryingCell[]
  selectedCellId?: string
  isPreview: boolean
  moduleUpperVoltage?: string
  moduleLowerVoltage?: string
  initialTemperature?: string
  initialSOC?: string
  initialSOH?: string
  initialDCIR?: string
}

export function validateAndGenerateConfig(config: ValidateConfig) {
  const {
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
    columbicEfficiency,
    capacity,
    rP,
    rS,
    costPerCell,
    maxWeight,
    maxVolume,
    varyingCells,
    selectedCellId,
    isPreview,
    moduleUpperVoltage,
    moduleLowerVoltage,
    initialTemperature,
    initialSOC,
    initialSOH,
    initialDCIR,
  } = config
  const realDims: { radius?: number; length?: number; width?: number; height: number } = {
    height: dims.height || 0,
  }
  if (formFactor === "cylindrical") {
    if (!dims.radius || !dims.height || dims.height <= 0 || dims.radius <= 0) {
      if (!isPreview) alert("Invalid dimensions for cylindrical cells")
      return null
    }
    realDims.radius = dims.radius
  } else {
    if (!dims.length || dims.length <= 0 || !dims.width || dims.width <= 0 || !dims.height || dims.height <= 0) {
      if (!isPreview) alert("Invalid dimensions for prismatic cells")
      return null
    }
    realDims.length = dims.length
    realDims.width = dims.width
  }
  if (layers.length === 0) {
    if (!isPreview) alert("Add at least one layer")
    return null
  }
  let realZPitch = 0
  const useIndexPitch = layers.some((l) => l.zMode === "index_pitch")
  if (useIndexPitch) {
    realZPitch = Number.parseFloat(zPitch)
    if (isNaN(realZPitch) || realZPitch <= 0) {
      if (!isPreview) alert("Invalid z pitch")
      return null
    }
  }
  const zCenters: number[] = []
  for (let li = 0; li < layers.length; li++) {
    const l = li + 1
    const layer = layers[li]
    let z: number
    if (layer.zMode === "index_pitch") {
      z = (l - 1) * realZPitch
    } else {
      z = Number.parseFloat(layer.zCenter)
      if (isNaN(z)) {
        if (!isPreview) alert(`Invalid z center for layer ${l}`)
        return null
      }
    }
    zCenters.push(z)
  }
  const shift = zCenters[0]
  zCenters.forEach((_, i) => (zCenters[i] -= shift))
  const cells: any[] = []
  const indexMap = new Map<string, number>()
  let globalIndex = 1
  const layerConfigs: any[] = []
  try {
    for (let li = 0; li < layers.length; li++) {
      const l = li + 1
      const layer = layers[li]
      const grid_type = layer.gridType
      const n_rows = Number.parseInt(layer.nRows.toString())
      const n_cols = Number.parseInt(layer.nCols.toString())
      const pitch_x = Number.parseFloat(layer.pitchX.toString())
      const pitch_y = Number.parseFloat(layer.pitchY.toString())
      if (
        isNaN(n_rows) ||
        n_rows <= 0 ||
        isNaN(n_cols) ||
        n_cols <= 0 ||
        isNaN(pitch_x) ||
        pitch_x <= 0 ||
        isNaN(pitch_y) ||
        pitch_y <= 0
      ) {
        throw new Error(`Invalid parameters for layer ${l}`)
      }
      if (!allowOverlap) {
        if (formFactor === "prismatic") {
          if (pitch_x < realDims.length! || pitch_y < realDims.width!) {
            throw new Error(`Pitch too small for prismatic cells in layer ${l}`)
          }
        } else {
          const d = 2 * realDims.radius!
          let min_dist = Number.POSITIVE_INFINITY
          if (grid_type === "rectangular") {
            min_dist = Math.min(pitch_x, pitch_y)
          } else if (grid_type === "brick_row_stagger" || grid_type === "hex_flat") {
            const diag = Math.sqrt((0.5 * pitch_x) ** 2 + pitch_y ** 2)
            min_dist = Math.min(pitch_x, diag)
          } else if (grid_type === "brick_col_stagger") {
            const diag = Math.sqrt((0.5 * pitch_y) ** 2 + pitch_x ** 2)
            min_dist = Math.min(pitch_y, diag)
          } else if (grid_type === "hex_pointy") {
            const diag = Math.sqrt((0.5 * pitch_y) ** 2 + pitch_x ** 2)
            min_dist = Math.min(pitch_y, diag)
          } else if (grid_type === "diagonal") {
            const diag = Math.sqrt((0.5 * pitch_x) ** 2 + (0.5 * pitch_y) ** 2)
            min_dist = Math.min(pitch_x, pitch_y, diag)
          }
          if (min_dist < d) {
            throw new Error(`Pitch settings would cause cell overlap in layer ${l}`)
          }
        }
      }
      const z = zCenters[li] / 1000
      layerConfigs.push({
        grid_type,
        n_rows,
        n_cols,
        pitch_x: pitch_x / 1000,
        pitch_y: pitch_y / 1000,
        z_center: z,
        z_mode: layer.zMode,
      })
      for (let r = 1; r <= n_rows; r++) {
        for (let c = 1; c <= n_cols; c++) {
          let x = 0
          let y = 0
          const j = r - 1
          const i = c - 1
          const internal_pitch_x = pitch_x / 1000 // meters
          const internal_pitch_y = pitch_y / 1000 // meters
          if (grid_type === "rectangular") {
            x = i * internal_pitch_x
            y = j * internal_pitch_y
          } else if (grid_type === "brick_row_stagger") {
            x = i * internal_pitch_x + (j % 2) * (internal_pitch_x / 2)
            y = j * internal_pitch_y
          } else if (grid_type === "brick_col_stagger") {
            x = i * internal_pitch_x
            y = j * internal_pitch_y + (i % 2) * (internal_pitch_y / 2)
          } else if (grid_type === "hex_flat") {
            x = i * internal_pitch_x + (j % 2) * (internal_pitch_x / 2)
            y = j * internal_pitch_y * (Math.sqrt(3) / 2)
          } else if (grid_type === "hex_pointy") {
            x = i * internal_pitch_x * (Math.sqrt(3) / 2)
            y = j * internal_pitch_y + (i % 2) * (internal_pitch_y / 2)
          } else if (grid_type === "diagonal") {
            x = (i + j) * (internal_pitch_x / 2)
            y = (j - i) * (internal_pitch_y / 2)
          }
          const position = [x, y, z]
          let half_x = 0
          let half_y = 0
          if (formFactor === "cylindrical") {
            half_x = (realDims.radius! ) / 1000
            half_y = (realDims.radius!) / 1000
          } else {
            half_x = (realDims.length! / 2) / 1000
            half_y = (realDims.width! / 2) / 1000
          }
          const bbox_2d = {
            xmin: x - half_x,
            xmax: x + half_x,
            ymin: y - half_y,
            ymax: y + half_y,
          }
          const defaultLabel = `R${r}C${c}L${l}`
          let label = defaultLabel
          if (labelSchema) {
            label = labelSchema
              .replace("{row}", r.toString())
              .replace("{col}", c.toString())
              .replace("{layer}", l.toString())
          }
          const cell = {
            global_index: globalIndex,
            layer_index: l,
            row_index: r,
            col_index: c,
            position,
            dims: {
              ...realDims,
              height: realDims.height / 1000,
              radius: realDims.radius ? realDims.radius / 1000 : undefined,
              length: realDims.length ? realDims.length / 1000 : undefined,
              width: realDims.width ? realDims.width / 1000 : undefined,
            },
            bbox_2d,
            neighbors_same_layer: [],
            label,
          }
          cells.push(cell)
          indexMap.set(`${l}-${r}-${c}`, globalIndex)
          globalIndex++
        }
      }
    }
    if (computeNeighbors) {
      for (const cell of cells) {
        const l = cell.layer_index
        const r = cell.row_index
        const c = cell.col_index
        const layerConfig = layerConfigs[l - 1]
        const grid_type = layerConfig.grid_type
        const n_rows = layerConfig.n_rows
        const n_cols = layerConfig.n_cols
        let dirs: [number, number][] = []
        const is_hex = grid_type === "hex_flat" || grid_type === "hex_pointy"
        if (is_hex) {
          const is_pointy = grid_type === "hex_pointy"
          const odd = is_pointy ? c % 2 === 1 : r % 2 === 1
          dirs = [
            [0, -1],
            [0, 1],
          ]
          if (odd) {
            dirs = dirs.concat([
              [-1, 0],
              [-1, 1],
              [1, 0],
              [1, 1],
            ])
          } else {
            dirs = dirs.concat([
              [-1, -1],
              [-1, 0],
              [1, -1],
              [1, 0],
            ])
          }
        } else {
          dirs = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]
        }
        const neighbors: number[] = []
        for (const [dr, dc] of dirs) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 1 && nr <= n_rows && nc >= 1 && nc <= n_cols) {
            const nid = indexMap.get(`${l}-${nr}-${nc}`)
            if (nid) {
              neighbors.push(nid)
            }
          }
        }
        cell.neighbors_same_layer = neighbors
      }
    }
    let xmin = Number.POSITIVE_INFINITY,
      xmax = Number.NEGATIVE_INFINITY,
      ymin = Number.POSITIVE_INFINITY,
      ymax = Number.NEGATIVE_INFINITY,
      zmin = Number.POSITIVE_INFINITY,
      zmax = Number.NEGATIVE_INFINITY
     const half_h = (realDims.height || 0) / 2000
    for (const cell of cells) {
      xmin = Math.min(xmin, cell.bbox_2d.xmin)
      xmax = Math.max(xmax, cell.bbox_2d.xmax)
      ymin = Math.min(ymin, cell.bbox_2d.ymin)
      ymax = Math.max(ymax, cell.bbox_2d.ymax)
      const cz = cell.position[2]
      zmin = Math.min(zmin, cz - half_h)
      zmax = Math.max(zmax, cz + half_h)
    }
    const volume = (xmax - xmin) * (ymax - ymin) * (zmax - zmin)
    const weight = cells.length * mCell
    const constraintWarnings: string[] = []
    const parsedMaxVolume = Number.parseFloat(maxVolume)
    const parsedMaxWeight = Number.parseFloat(maxWeight)
    if (!isNaN(parsedMaxVolume) && volume > parsedMaxVolume) {
      constraintWarnings.push(`Pack volume ${volume.toFixed(6)} m³ exceeds maximum ${maxVolume} m³`)
    }
    if (!isNaN(parsedMaxWeight) && weight > parsedMaxWeight) {
      constraintWarnings.push(`Pack weight ${weight.toFixed(3)} kg exceeds maximum ${maxWeight} kg`)
    }
    for (const vc of varyingCells) {
      if (!vc.cellIndex || Number.parseInt(vc.cellIndex) < 1 || Number.parseInt(vc.cellIndex) > cells.length) {
        if (!isPreview) alert(`Invalid cell index ${vc.cellIndex} in varying conditions`)
        return null
      }
    }
    let nSeries = 0
    let nParallel = 0
    const firstLayer = layers[0]
    const firstLayerNRows = Number.parseInt(firstLayer.nRows.toString())
    const firstLayerNCols = Number.parseInt(firstLayer.nCols.toString())
    if (connectionType === "row_series_column_parallel") {
      nParallel = firstLayerNRows
      nSeries = firstLayerNCols
    } else if (connectionType === "row_parallel_column_series") {
      nParallel = firstLayerNCols
      nSeries = firstLayerNRows
    } else if (connectionType === "custom") {
      // Validation happens in the custom connection component
      nSeries = customParallelGroups.length
      const cellsPerGroup = customParallelGroups[0]?.cellIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id)||[]
      nParallel = cellsPerGroup.length
    }
    const cellVolumeM3 = calculateCellVolume(formFactor, {
      ...realDims,
      height: realDims.height / 1000,
      radius: realDims.radius ? realDims.radius / 1000 : undefined,
      length: realDims.length ? realDims.length / 1000 : undefined,
      width: realDims.width ? realDims.width / 1000 : undefined,
    })
    const vCellNominal = (cellUpperVoltage + cellLowerVoltage) / 2
    const packNominalVoltage = nSeries * vCellNominal
    const packMaxVoltage = nSeries * cellUpperVoltage
    const packMinVoltage = nSeries * cellLowerVoltage
    const packCapacity = nParallel * capacity
    const packEnergyWh = packCapacity * packNominalVoltage
    const packEnergyKwh = packEnergyWh / 1000
    const adjustedPackEnergyWh = packEnergyWh * columbicEfficiency
    const busbarTotalResistance = (nSeries - 1) * rS
    const totalCells = cells.length
    const totalPackWeight = totalCells * mCell
    const totalCellVolume = totalCells * cellVolumeM3
    const totalPackVolume = volume
    const energyDensityGravimetric = totalPackWeight > 0 ? packEnergyWh / totalPackWeight : 0
    const energyDensityVolumetric = totalPackVolume > 0 ? packEnergyWh / (totalPackVolume * 1000) : 0
    const costPerCellNum = Number.parseFloat(costPerCell) || 0
    const totalPackCost = totalCells * costPerCellNum
    const costPerKwh = packEnergyKwh > 0 ? totalPackCost / packEnergyKwh : 0
    const summary: PackSummary = {
      electrical: {
        nSeries,
        nParallel,
        nTotal: totalCells,
        vCellNominal,
        packNominalVoltage,
        packMaxVoltage,
        packMinVoltage,
        packCapacity,
        packEnergyWh,
        packEnergyKwh,
        adjustedPackEnergyWh,
        busbarTotalResistance,
      },
      mechanical: {
        totalCells,
        totalPackWeight,
        totalCellVolume,
        totalPackVolume,
        energyDensityGravimetric,
        energyDensityVolumetric,
      },
      commercial: {
        totalPackCost,
        costPerKwh,
      },
    }
    if (!isPreview && constraintWarnings.length > 0) {
      alert("Design Constraint Warnings:\n" + constraintWarnings.join("\n"))
    }
    if (isPreview) {
      return { cells, summary }
    } else {
      const packConfig: any = {
        cell_id: selectedCellId,
        connection_type: connectionType,
        r_p: rP,
        r_s: rS,
        voltage_limits: {
          module_upper: Number.parseFloat(moduleUpperVoltage || "0") || null,
          module_lower: Number.parseFloat(moduleLowerVoltage || "0") || null,
        },
        options: {
          allow_overlap: allowOverlap,
          compute_neighbors: computeNeighbors,
          label_schema: labelSchema,
        },
        constraints: {
           max_weight: isNaN(parsedMaxWeight) ? null : parsedMaxWeight,
          max_volume: isNaN(parsedMaxVolume) ? null : parsedMaxVolume,
        },
        z_pitch: useIndexPitch ? Number.parseFloat(zPitch) : undefined,
        layers: layers.map((l) => ({
          grid_type: l.gridType,
          n_rows: l.nRows,
          n_cols: l.nCols,
          pitch_x: l.pitchX,
          pitch_y: l.pitchY,
          z_mode: l.zMode,
          z_center: Number(l.zCenter),
        })),
        
        cost_per_cell: costPerCellNum,
      }
      if (connectionType === "custom") {
        packConfig.custom_parallel_groups = customParallelGroups.map((g) => ({ cell_ids: g.cellIds }))
      }
      return packConfig
    }
  } catch (e: any) {
    if (!isPreview) alert(e.message)
    return null
  }
}

function calculateCellVolume(
  formFactor: "cylindrical" | "prismatic",
  dims: { radius?: number; length?: number; width?: number; height: number },
): number {
  if (formFactor === "cylindrical") {
    const radius = dims.radius ?? 0
    const height = dims.height ?? 0
    return Math.PI * radius * radius * height / 1e9 // mm^3 to m^3
  } else {
    const length = dims.length ?? 0
    const width = dims.width ?? 0
    const height = dims.height ?? 0
    return length * width * height / 1e9 // mm^3 to m^3
  }
}
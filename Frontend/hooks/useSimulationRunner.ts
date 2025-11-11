"use client"

import { useState, useCallback, useRef } from "react"

interface SimulationRequest {
  packId: string
  cycleId: string
  simulationConfig: Record<string, any>
}

interface SimulationDataPoint {
  time: number
  voltage?: number
  current?: number
  soc?: number
  temp?: number
  qgen?: number
  [key: string]: any
}

interface SimulationDataResponse {
  time_range: string
  total_points: number
  sampled_points: number
  sampling_ratio: number
  data: SimulationDataPoint[]
}

interface SimulationResults {
  simulation_id?: string
  id?: string  // Backend returns 'id' field
  summary?: {
    end_soc: number
    max_temp: number
    capacity_fade: number
  }
  status: "running" | "completed" | "failed"
  error?: string
}

import { getSimulationData as apiGetSimulationData, getSimulationStatus as apiGetSimulationStatus, runSimulation as apiRunSimulation } from "@/lib/api/simulations"
import { getPack } from "@/lib/api/packs"

/**
 * Transform pack from database format to simulation format
 * Database format uses snake_case (form_factor, r_p, r_s)
 * Simulation format uses camelCase (formFactor) and uppercase (R_p, R_s)
 */
function transformPackForSimulation(pack: any): any {
  if (!pack) {
    throw new Error("Pack data is required")
  }
  
  // Deep clone to avoid mutating original
  const transformed = JSON.parse(JSON.stringify(pack))
  
  // Validate required fields
  if (!transformed.cell) {
    throw new Error("Pack must have a cell configuration")
  }
  
  // Transform cell.form_factor to cell.formFactor (for geometry.py)
  const formFactor = transformed.cell?.formFactor || transformed.cell?.form_factor
  if (!formFactor) {
    throw new Error("Cell must have formFactor or form_factor")
  }
  transformed.cell.formFactor = formFactor
  
  // Transform r_p and r_s to R_p and R_s (uppercase) - required by simulation
  if (transformed.r_p === undefined && transformed.R_p === undefined) {
    throw new Error("Pack must have r_p or R_p")
  }
  transformed.R_p = transformed.R_p ?? transformed.r_p ?? 0.001
  
  if (transformed.r_s === undefined && transformed.R_s === undefined) {
    throw new Error("Pack must have r_s or R_s")
  }
  transformed.R_s = transformed.R_s ?? transformed.r_s ?? 0.001
  
  // Add meta object with formFactor (for NEW_data_processor.py line 21)
  if (!transformed.meta) {
    transformed.meta = {}
  }
  transformed.meta.formFactor = formFactor
  
  // Ensure z_pitch is null if undefined (simulation expects null, not undefined)
  if (transformed.z_pitch === undefined) {
    transformed.z_pitch = null
  }
  
  // Ensure constraints have proper null handling (geometry.py expects null for NaN)
  if (!transformed.constraints) {
    transformed.constraints = {}
  }
  if (transformed.constraints.max_weight === undefined) {
    transformed.constraints.max_weight = null
  }
  if (transformed.constraints.max_volume === undefined) {
    transformed.constraints.max_volume = null
  }
  
  // Ensure voltage_limits have proper null handling
  if (!transformed.voltage_limits) {
    transformed.voltage_limits = {}
  }
  if (transformed.voltage_limits.module_upper === undefined) {
    transformed.voltage_limits.module_upper = null
  }
  if (transformed.voltage_limits.module_lower === undefined) {
    transformed.voltage_limits.module_lower = null
  }
  
  // Ensure options object exists (required by geometry.py)
  if (!transformed.options) {
    transformed.options = {
      allow_overlap: false,
      compute_neighbors: true,
      label_schema: "R{row}C{col}L{layer}"
    }
  }
  
  // Ensure layers array exists and is valid
  if (!Array.isArray(transformed.layers) || transformed.layers.length === 0) {
    throw new Error("Pack must have at least one layer")
  }
  
  // Ensure initial_conditions exists
  if (!transformed.initial_conditions) {
    transformed.initial_conditions = {
      temperature: 300,
      soc: 1.0,
      soh: 1.0,
      dcir_aging_factor: 1.0,
      varying_cells: []
    }
  }
  
  // Ensure cell has all required fields
  if (!transformed.cell.capacity) {
    throw new Error("Cell must have capacity")
  }
  if (transformed.cell.columbic_efficiency === undefined) {
    transformed.cell.columbic_efficiency = 1.0
  }
  if (transformed.cell.m_cell === undefined) {
    throw new Error("Cell must have m_cell")
  }
  if (transformed.cell.m_jellyroll === undefined) {
    transformed.cell.m_jellyroll = transformed.cell.m_cell * 0.85 // Default estimate
  }
  if (transformed.cell.cell_voltage_upper_limit === undefined) {
    throw new Error("Cell must have cell_voltage_upper_limit")
  }
  if (transformed.cell.cell_voltage_lower_limit === undefined) {
    throw new Error("Cell must have cell_voltage_lower_limit")
  }
  
  // Ensure cell.dims exists
  if (!transformed.cell.dims) {
    throw new Error("Cell must have dims")
  }
  
  return transformed
}

export function useSimulationRunner() {
  const [simulationResults, setSimulationResults] = useState<SimulationResults | null>(null)
  const [simulationData, setSimulationData] = useState<SimulationDataResponse | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch simulation data with adaptive sampling
  const fetchSimulationData = useCallback(
    async (simulationId: string, timeRange?: { start: number; end: number }, maxPoints = 5000) => {
      try {

        const data: SimulationDataResponse = await apiGetSimulationData(simulationId, {
          max_points: maxPoints,
          time_range: timeRange ? `${timeRange.start}-${timeRange.end}` : undefined,
        })
        console.log("[v0] Simulation data received:", {
          total_points: data.total_points,
          sampled_points: data.sampled_points,
          sampling_ratio: data.sampling_ratio,
        })

        setSimulationData(data)
        setError(null)
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error fetching simulation data"
        console.error("[v0] Error fetching simulation data:", errorMsg)
        setError(errorMsg)
        return null
      }
    },
    [],
  )

  // Poll simulation status until completion
  const pollSimulationStatus = useCallback(
    async (simulationId: string): Promise<SimulationResults | null> => {
      try {
        console.log("[v0] Polling simulation status:", simulationId)

        const result: SimulationResults = await apiGetSimulationStatus(simulationId)
        console.log("[v0] Simulation status:", result.status)

        if (result.status === "completed") {
          // Ensure simulation_id is set from id if not present
          const simId = result.simulation_id || result.id || simulationId
          await fetchSimulationData(simId)
          // Normalize the result to always have simulation_id
          const normalizedResult = {
            ...result,
            simulation_id: simId
          }
          setSimulationResults(normalizedResult)
          setError(null)
          return normalizedResult
        } else if (result.status === "failed") {
          setError(result.error || "Simulation failed")
          setIsRunning(false)
          return result
        }

        return null
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error polling simulation"
        console.error("[v0] Error polling simulation:", errorMsg)
        setError(errorMsg)
        setIsRunning(false)
        return null
      }
    },
    [fetchSimulationData],
  )

  // Run simulation
  const runSimulation = useCallback(
    async (request: SimulationRequest): Promise<SimulationResults | null> => {
      try {
        console.log("[v0] Starting simulation with config:", request)
        setIsRunning(true)
        setError(null)
        setSimulationResults(null)
        setSimulationData(null)

        // Build payload expected by backend
        // 1) Get pack config from backend and transform it to simulation format
        let packConfig: any
        try {
          const pack = await getPack(request.packId)
          packConfig = transformPackForSimulation(pack)
          console.log("[v0] Pack transformed successfully:", {
            hasFormFactor: !!packConfig.cell?.formFactor,
            hasMeta: !!packConfig.meta?.formFactor,
            hasR_p: packConfig.R_p !== undefined,
            hasR_s: packConfig.R_s !== undefined,
          })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to load or transform pack"
          console.error("[v0] Pack transformation error:", errorMsg, err)
          throw new Error(`Pack configuration error: ${errorMsg}`)
        }
        // 2) Map simulation config to modelConfig as-is for now
        const modelConfig = request.simulationConfig
        // 3) Try to get drive cycle CSV; handle both stored configs and uploaded CSV files
        let driveCycleCsv = "Time,Current\n0,0\n1,0\n"
        if (typeof window !== "undefined") {
          try {
            // If cycleId ends with .csv, it's an uploaded file - read from sessionStorage
            if (request.cycleId.endsWith(".csv")) {
              const csvContent = sessionStorage.getItem(`csv:${request.cycleId}`)
              if (csvContent) {
                driveCycleCsv = csvContent
              } else {
                console.warn("[v0] CSV file not found in sessionStorage, using fallback")
              }
            } else if (window.storage && request.cycleId) {
              // Otherwise, try to get from window.storage (stored drive cycle config)
              const dc = await window.storage.get(`drivecycle:${request.cycleId}`)
              if (dc?.value) {
                const cfg = JSON.parse(dc.value)
                // If a flat driveCycles array with steps is present, serialize a simple CSV
                if (Array.isArray(cfg?.driveCycles)) {
                  const rows: Array<{ Time: number; Current: number }> = []
                  cfg.driveCycles.forEach((dcItem: any) => {
                    const steps = dcItem?.steps || []
                    let t = 0
                    steps.forEach((s: any) => {
                      const duration = Number(s?.duration ?? 0)
                      const value = Number(s?.value ?? 0)
                      rows.push({ Time: t, Current: value })
                      t += duration
                    })
                  })
                  if (rows.length > 0) {
                    const header = "Time,Current"
                    const lines = rows.map(r => `${r.Time},${r.Current}`)
                    driveCycleCsv = [header, ...lines].join("\n")
                  }
                }
              }
            }
          } catch (err) {
            console.error("[v0] Error loading drive cycle:", err)
          }
        }

        // Ensure payload includes required fields 'name' and 'type' expected by RunSimulationPayload
        const payload = {
          name: `${request.packId}-${request.cycleId}`,
          type: "simulation",
          packConfig,
          modelConfig,
          driveCycleCsv,
        }
        const { simulation_id } = await apiRunSimulation(payload)

        // Poll every 2 seconds for completion
        let completed = false
        let attempts = 0
        const maxAttempts = 1800 // 1 hour max (2s * 1800 = 3600s)

        while (!completed && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds

          const result = await pollSimulationStatus(simulation_id)
          if (result) {
            completed = true
            setIsRunning(false)
            return result
          }

          attempts++
        }

        if (!completed) {
          throw new Error("Simulation polling timeout after 1 hour")
        }

        return null
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error running simulation"
        console.error("[v0] Error running simulation:", errorMsg)
        setError(errorMsg)
        setIsRunning(false)
        return null
      }
    },
    [pollSimulationStatus],
  )

  // Stop polling (for cleanup)
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  return {
    simulationResults,
    simulationData,
    isRunning,
    error,
    runSimulation,
    fetchSimulationData,
    stopPolling,
    setSimulationData, // Allow external updates to data (e.g., after zoom)
  }
}

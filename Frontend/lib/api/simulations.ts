const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface RunSimulationPayload {
  name: string
  type: string
  packConfig: any
  modelConfig: any
  driveCycleCsv: string
}

export async function runSimulation(payload: RunSimulationPayload) {
  const res = await fetch(`${API_BASE}/simulations/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to start simulation: ${text}`)
  }
  return res.json() as Promise<{ simulation_id: string; status: string }>
}

export async function getSimulationStatus(simulationId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simulationId}`, { cache: "no-store" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to get simulation status: ${text}`)
  }
  return res.json()
}

export interface SimulationDataResponse {
  simulation_id: string
  cell_id: number
  time_range: string
  total_points: number
  sampled_points: number
  sampling_ratio: number
  data: Array<{
    time: number
    voltage: number
    soc: number
    current: number
    qgen: number
    temp: number
  }>
  summary?: {
    end_soc?: number
    max_temp?: number
    capacity_fade?: number
    is_partial?: boolean
  }
}

export async function getSimulationData(
  simulationId: string,
  params: { time_range?: string; max_points?: number } = {},
): Promise<SimulationDataResponse> {
  const usp = new URLSearchParams()
  if (params.time_range) usp.append("time_range", params.time_range)
  if (params.max_points != null) usp.append("max_points", String(params.max_points))
  const res = await fetch(`${API_BASE}/simulations/${simulationId}/data?${usp.toString()}`, { cache: "no-store" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to get simulation data: ${text}`)
  }
  return res.json()
}

export async function getAllSimulations() {
  const res = await fetch(`${API_BASE}/simulations/all`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to fetch simulations: ${await res.text()}`)
  return res.json()
}
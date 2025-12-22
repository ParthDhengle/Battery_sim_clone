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
export async function getSimulationData(
  simulationId: string,
  params: { time_range?: string; max_points?: number } = {},
) {
  const usp = new URLSearchParams()
  if (params.time_range) usp.append("time_range", params.time_range)
  if (params.max_points != null) usp.append("max_points", String(params.max_points))
  const res = await fetch(`${API_BASE}/simulations/${simulationId}/data?${usp.toString()}`)
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

// NEW/UPDATED: Pause
export async function pauseSimulation(simulationId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simulationId}/pause`, { method: "POST" })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// UPDATED: Resume with optional ZIP File
export async function resumeSimulation(simulationId: string, zipFile?: File) {
  const formData = new FormData()
  if (zipFile) formData.append("zip_file", zipFile)
  const res = await fetch(`${API_BASE}/simulations/${simulationId}/resume`, {
    method: "POST",
    body: formData
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// UPDATED: Download Continuation ZIP
export async function downloadContinuation(simulationId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/simulations/${simulationId}/download-continuation`)
  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}
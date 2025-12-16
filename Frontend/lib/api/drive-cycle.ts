// FILE: Frontend/lib/api/drive-cycle.ts (updated for ID normalization and new endpoints)
const API_BASE = "http://localhost:8000";
export interface Trigger {
  type: string;
  value: number;
}
export interface Step {
  id?: string;
  duration: number;
  timestep: number;
  valueType: string;
  value: number; // Number for backend
  unit: string;
  repetitions: number;
  stepType: string;
  triggers: Trigger[];
  label: string;
}
export interface Subcycle {
  id: string;
  name: string;
  description: string;
  source: "manual" | "import";
  steps: Step[];
  createdAt?: string;
  updatedAt?: string;
}
// Helper to normalize subcycle responses (handles _id vs id)
const normalizeSubcycle = (obj: any): Subcycle => {
  if (!obj) throw new Error("Empty response");
  const normalized = { ...obj };
  if (!normalized.id && normalized._id && typeof normalized._id === 'string') {
    normalized.id = normalized._id;
    delete normalized._id; // Clean up
  }
  if (!normalized.id || typeof normalized.id !== 'string') {
    throw new Error("Invalid or missing ID in response");
  }
  // Ensure datetimes are strings (isoformat)
  if (normalized.createdAt && typeof normalized.createdAt !== 'string') {
    normalized.createdAt = new Date(normalized.createdAt).toISOString();
  }
  if (normalized.updatedAt && typeof normalized.updatedAt !== 'string') {
    normalized.updatedAt = new Date(normalized.updatedAt).toISOString();
  }
  return normalized as Subcycle;
};
// Helper to parse FastAPI errors (handles 422 detail array)
const parseApiError = async (res: Response): Promise<string> => {
  const data = await res.json().catch(() => ({}));
  let detail = data.detail || "Unknown error";
  if (Array.isArray(detail)) {
    detail = detail.map((e: any) => e.msg || e).join('; ');
  }
  return detail as string;
};
// Subcycle CRUD
export const getSubcycles = async (): Promise<Subcycle[]> => {
  const res = await fetch(`${API_BASE}/subcycles/`);
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  const data = await res.json();
  return Array.isArray(data) ? data.map(normalizeSubcycle) : [];
};
export const getSubcycle = async (id: string): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`);
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  const data = await res.json();
  return normalizeSubcycle(data);
};
export const createSubcycle = async (data: Omit<Subcycle, "id" | "createdAt" | "updatedAt">, simName?: string): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/?sim_name=${encodeURIComponent(simName || "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  const rawData = await res.json();
  return normalizeSubcycle(rawData);
};
export const updateSubcycle = async (id: string, data: Omit<Subcycle, "id" | "createdAt" | "updatedAt">): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  const rawData = await res.json();
  return normalizeSubcycle(rawData);
};
export const deleteSubcycle = async (id: string) => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
};
// Simulation Cycle Management
export const get_simulation_cycle = async (id: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${id}`);
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
};
export const createSimulationCycle = async (data: { name: string; description?: string } = { name: "New Simulation" }): Promise<{ id: string }> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  const sim = await res.json();
  const simId = sim.id || sim._id;
  if (!simId || typeof simId !== 'string') {
    throw new Error("Invalid simulation ID in response");
  }
  return { id: simId };
}
export const updateSimulationSubcycles = async (simId: string, subcycleIds: string[]): Promise<any> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/subcycles`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subcycle_ids: subcycleIds }), // Object for model
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
}
export const saveDriveCycles = async (simId: string, definitions: any[]): Promise<any> => {
  // No expansion, send full composition
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/drive-cycles`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(definitions)
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
}
// Calendar Assignment
export const saveCalendarAssignments = async (simId: string, assignments: any[]) => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/calendar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendar_assignments: assignments }),
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
};
// Generate
export const generateSimulationTable = async (simId: string): Promise<{ path: string; size_bytes: number }> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
};
export const list_simulation_cycles = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/`);
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
};
export const delete_simulation_cycle = async (id: string) => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
};
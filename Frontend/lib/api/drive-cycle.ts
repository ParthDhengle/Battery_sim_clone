// FILE: Frontend/lib/api/drive-cycle.ts
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
  return res.json();
};

export const getSubcycle = async (id: string): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`);
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
};

export const createSubcycle = async (data: Omit<Subcycle, "id" | "createdAt" | "updatedAt">): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
  return res.json();
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
  return res.json();
};

export const deleteSubcycle = async (id: string) => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await parseApiError(res);
    throw new Error(detail);
  }
};

// Simulation Cycle Management
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
  return { id: sim.id || sim._id }; // Handle alias
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
  // Expand repetitions to flat subcycle_ids list
  const expandedPayload = definitions.map(d => {
    const ids: string[] = [];
    d.composition.forEach((comp: any) => {
      for (let i = 0; i < comp.repetitions; i++) {
        ids.push(comp.subcycleId);
      }
    });
    return {
      name: d.name,
      subcycle_ids: ids
    };
  });
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/drive-cycles`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expandedPayload)
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
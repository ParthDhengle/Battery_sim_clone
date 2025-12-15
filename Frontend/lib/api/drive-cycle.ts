// FILE: Frontend/lib/api/drive-cycle.ts (added list_simulation_cycles + fixes)
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
  value: number;  // Number for backend
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
// Subcycle CRUD
export const getSubcycles = async (): Promise<Subcycle[]> => {
  const res = await fetch(`${API_BASE}/subcycles/`);
  if (!res.ok) throw new Error("Failed to fetch subcycles");
  return res.json();
};
export const createSubcycle = async (data: Omit<Subcycle, "id" | "createdAt" | "updatedAt">): Promise<Subcycle> => {
  const res = await fetch(`${API_BASE}/subcycles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create subcycle");
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
    const err = await res.json();
    throw new Error(err.detail || "Failed to update subcycle");
  }
  return res.json();
};
export const deleteSubcycle = async (id: string) => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
};
// Simulation Cycle Management
export const createSimulationCycle = async (data: { name: string; description?: string } = { name: "New Simulation" }): Promise<{ id: string }> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create simulation cycle");
  }
  const sim = await res.json();
  return { id: sim.id || sim._id };  // Handle alias
}
export const updateSimulationSubcycles = async (simId: string, subcycleIds: string[]): Promise<any> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/subcycles`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subcycleIds),  // Direct array
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update simulation subcycles");
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
    const err = await res.json();
    throw new Error(err.detail || "Failed to save drive cycles");
  }
  return res.json();
}
// Calendar Assignment
export const saveCalendarAssignments = async (simId: string, assignments: any[]) => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/calendar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignments),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to save calendar assignments");
  }
  return res.json();
};
// Generate
export const generateSimulationTable = async (simId: string): Promise<{ path: string; size_bytes: number }> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Failed to generate simulation table");
  }
  return res.json();
};
export const list_simulation_cycles = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/`);
  if (!res.ok) throw new Error("Failed to fetch simulation cycles");
  return res.json();
};
// Frontend/lib/api/drive-cycle.ts

const API_BASE = "/api/v1/drive-cycle";

export interface Trigger {
  type: string;
  value: number;
}

export interface Step {
  id?: string;
  duration: number;
  timestep: number;
  valueType: string;
  value: string;
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
}

// Subcycle CRUD
export const getSubcycles = async (): Promise<Subcycle[]> => {
  const res = await fetch(`${API_BASE}/subcycles`);
  if (!res.ok) throw new Error("Failed to fetch subcycles");
  return res.json();
};

export const createSubcycle = async (data: Omit<Subcycle, "id" | "createdAt">, csvText?: string): Promise<Subcycle> => {
  const body = csvText ? { ...data, csvText } : data;
  const res = await fetch(`${API_BASE}/subcycles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create subcycle");
  }
  return res.json();
};

export const updateSubcycle = async (id: string, data: Omit<Subcycle, "id" | "createdAt">, csvText?: string): Promise<Subcycle> => {
  const body = csvText ? { ...data, csvText } : data;
  const res = await fetch(`${API_BASE}/subcycles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update");
  return res.json();
};

export const deleteSubcycle = async (id: string) => {
  const res = await fetch(`${API_BASE}/subcycles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
};

// Simulation & Drive Cycle
export const createDriveCycle = async (
  drivecycle: any,
  simId?: string
): Promise<{ simId: string }> => {
  const res = await fetch(`${API_BASE}/drivecycles${simId ? `?sim_id=${simId}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(drivecycle),
  });
  if (!res.ok) throw new Error("Failed to save drive cycle");
  return res.json();
};

// Calendar rules
export const saveCalendarRules = async (simId: string, rules: any[]) => {
  const res = await fetch(`${API_BASE}/calendar/${simId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error("Failed to save calendar rules");
  return res.json();
};

// Generate simulation table
export const generateSimulationTable = async (simId: string): Promise<{ path: string }> => {
  const res = await fetch(`${API_BASE}/simulation-cycle/${simId}/generate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate simulation table");
  return res.json();
};

export const getSimulation = async (simId: string) => {
  const res = await fetch(`${API_BASE}/simulations/${simId}`);
  if (!res.ok) throw new Error("Failed to fetch simulation");
  return res.json();
};
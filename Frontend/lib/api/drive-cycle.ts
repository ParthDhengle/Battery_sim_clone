// Frontend/lib/api/drive-cycle.ts

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
  value: string; // Backend expects float but frontend might send string? keeping as is for now
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
  const res = await fetch(`${API_BASE}/subcycles/`);
  if (!res.ok) throw new Error("Failed to fetch subcycles");
  return res.json();
};

export const createSubcycle = async (data: Omit<Subcycle, "id" | "createdAt">, csvText?: string): Promise<Subcycle> => {
  const body = csvText ? { ...data, csvText } : data;
  const res = await fetch(`${API_BASE}/subcycles/`, {
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

// Simulation Cycle Management

export const createSimulationCycle = async (data: any = {}): Promise<any> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to create simulation cycle");
  return res.json();
}

export const saveDriveCycles = async (simId: string, definitions: any[]): Promise<any> => {
  // Transform frontend Drivecycle structure to backend DriveCycleDefinition if needed
  // Backend expects: { name: string, subcycle_ids: string[] }
  const payload = definitions.map(d => ({
    name: d.name,
    subcycle_ids: d.composition.map((c: any) => c.subcycleId)
    // Note: repeated subcycles in frontend composition need to be flattened?
    // Wait, composition row has 'repetitions'.
    // Backend 'subcycle_ids' is an ordered list of IDs.
    // If row 1 is SubA x 2, backend list needs [SubA, SubA].
    // I need to expand this here.
  }));

  // Expansion logic
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
  if (!res.ok) throw new Error("Failed to save drive cycles");
  return res.json();
}

// Calendar Assignment
export const saveCalendarAssignments = async (simId: string, assignments: any[]) => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/calendar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignments),
  });
  if (!res.ok) throw new Error("Failed to save calendar assignments");
  return res.json();
};

// Generate
export const generateSimulationTable = async (simId: string): Promise<{ path: string }> => {
  const res = await fetch(`${API_BASE}/simulation-cycles/${simId}/generate`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Failed to generate simulation table");
  }
  return res.json();
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PackCreateData {
  name: string;
  description?: string;
  cell_id: string;
  connection_type: "row_series_column_parallel" | "row_parallel_column_series" | "custom";
  custom_parallel_groups?: Array<{ cell_ids: string }>;
  r_p: number;
  r_s: number;
  voltage_limits: {
    module_upper?: number;
    module_lower?: number;
  };
  options: {
    allow_overlap: boolean;
    compute_neighbors: boolean;
    label_schema: string;
  };
  constraints: {
    max_weight?: number;
    max_volume?: number;
  };
  z_pitch?: number;
  layers: any[];
  initial_conditions: any;
  cost_per_cell: number;
}

export async function getPacks(includeDeleted = false) {
  const params = new URLSearchParams();
  if (includeDeleted) params.append("include_deleted", "true");
 
  const res = await fetch(`${API_BASE}/packs/?${params.toString()}`, {
    cache: 'no-store'
  });
 
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch packs: ${error}`);
  }
  return await res.json();
}

export async function getPack(id: string) {
  if (!id || id === "undefined" || id.trim() === "") {
    throw new Error("Invalid pack ID provided");
  }
  const res = await fetch(`${API_BASE}/packs/${id}`, {
    cache: 'no-store'
  });
 
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch pack: ${error}`);
  }
  return await res.json();
}

export async function createPack(data: PackCreateData) {
  const res = await fetch(`${API_BASE}/packs/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
 
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to create pack");
  }
  return await res.json();
}

export async function updatePack(id: string, data: Partial<PackCreateData>) {
  const res = await fetch(`${API_BASE}/packs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
 
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update pack");
  }
  return await res.json();
}

export async function deletePack(id: string, hardDelete = false) {
  const params = new URLSearchParams();
  if (hardDelete) params.append("hard_delete", "true");
 
  const res = await fetch(`${API_BASE}/packs/${id}?${params.toString()}`, {
    method: "DELETE"
  });
 
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to delete pack");
  }
}

export async function restorePack(id: string) {
  const res = await fetch(`${API_BASE}/packs/${id}/restore`, {
    method: "POST"
  });
 
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to restore pack");
  }
  return await res.json();
}
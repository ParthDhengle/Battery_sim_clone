const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getCells() {
  const res = await fetch(`${API_BASE}/cells/`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch cells: ${error}`);
  }
  return await res.json();
}

export async function createCell(data: any) {
  const res = await fetch(`${API_BASE}/cells/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
     body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    // Add this console.error to see the specific Pydantic error
    console.error("Validation Error:", error.detail); 
  throw new Error(error.detail || "Failed to create cell");
 }
 return await res.json();
}
export async function updateCell(id: string, data: any) {
  const res = await fetch(`${API_BASE}/cells/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update cell");
  }
  return await res.json();
}

export async function deleteCell(id: string) {
  const res = await fetch(`${API_BASE}/cells/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to delete cell");
  }
}

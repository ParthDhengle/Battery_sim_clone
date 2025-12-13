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

export async function getCell(id: string) {
  const res = await fetch(`${API_BASE}/cells/${id}`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch cell: ${error}`);
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
    console.error("Validation Error:", error.detail); 
    throw new Error(error.detail || "Failed to create cell");
  }
  return await res.json();
}

/**
 * Create cell with RC parameter file upload
 * @param formData - FormData object containing all cell data and optional file
 */
export async function createCellWithRCFile(formData: FormData) {
  console.log("📤 API: Sending cell creation request with RC file...")
  
  try {
    const res = await fetch(`${API_BASE}/cells/with-rc-file`, {
      method: "POST",
      body: formData,
      // DO NOT set Content-Type - browser sets it with multipart boundary
    });

    console.log("📡 API: Response status:", res.status)

    const responseText = await res.text();
    console.log("📡 API: Response body:", responseText)

    if (!res.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { detail: responseText || `Server error: ${res.status}` };
      }
      console.error("❌ API: Server error:", error);
      throw new Error(error.detail || "Failed to create cell with RC file");
    }

    const result = JSON.parse(responseText);
    console.log("✅ API: Cell created successfully:", result.id);
    return result;
  } catch (error: any) {
    console.error("❌ API: Request failed:", error.message);
    throw error;
  }
}

export async function uploadRCFile(cellId: string, file: File, rcPairType: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("rc_pair_type", rcPairType);

  const res = await fetch(`${API_BASE}/cells/upload-rc-file/${cellId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to upload RC file");
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

export async function getRCParameterFile(filePath: string): Promise<File> {
  const url = `${API_BASE}${filePath}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to fetch RC parameter file");
  }

  const blob = await res.blob();
  const filename = filePath.split("/").pop() || "rc_parameters.csv";
  return new File([blob], filename, { type: blob.type || "text/csv" });
}
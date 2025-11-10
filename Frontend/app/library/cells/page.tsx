"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCells, createCell, updateCell, deleteCell } from "@/lib/api/cells"
declare global {
  interface Window {
    storage: {
      list(prefix: string): Promise<{ keys: string[] }>
      get(key: string): Promise<{ value: string } | null>
      set(key: string, value: string): Promise<void>
      delete(key: string): Promise<void>
    }
  }
}
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Download, Battery, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"

type CellConfig = {
  id: string
  name: string
  formFactor: "cylindrical" | "prismatic" | "pouch" | "coin"
  dims: { radius?: number; diameter?: number; length?: number; width?: number; height: number }
  cell_nominal_voltage: number
  cell_upper_voltage_cutoff: number
  cell_lower_voltage_cutoff: number
  capacity: number
  max_charging_current_continuous: number
  max_charging_current_instantaneous: number
  max_discharging_current_continuous: number
  max_discharging_current_instantaneous: number
  max_charge_voltage: number
  columbic_efficiency: number
  cell_weight: number
  cell_volume: number
  cost_per_cell: number
  anode_composition: string
  cathode_composition: string
  soh_file?: { name: string; data: string; type: string }
  created_at: string
}

export default function Cells() {
  const [cells, setCells] = useState<CellConfig[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<CellConfig | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [formData, setFormData] = useState({
    name: "",
    formFactor: "cylindrical" as "cylindrical" | "prismatic" | "pouch" | "coin",
    // Dimensions
    radius: "",
    diameter: "",
    length: "",
    width: "",
    height: "",
    // Electrical Page 1
    cell_nominal_voltage: "3.7",
    cell_upper_voltage_cutoff: "4.2",
    cell_lower_voltage_cutoff: "2.5",
    capacity: "",
    max_charge_voltage: "4.2",
    columbic_efficiency: "1.0",
    // Electrical Page 1 (continued)
    max_charging_current_continuous: "",
    max_charging_current_instantaneous: "",
    max_discharging_current_continuous: "",
    max_discharging_current_instantaneous: "",
    // Mechanical Page 2
    cell_weight: "",
    cell_volume: "",
    // Commercial & Chemical Page 3
    cost_per_cell: "",
    anode_composition: "",
    cathode_composition: "",
  })
  const [sohFile, setSohFile] = useState<{ name: string; data: string; type: string } | null>(null)
  const [error, setError] = useState("")

  const resetForm = () => {
    setFormData({
      name: "",
      formFactor: "cylindrical",
      radius: "",
      diameter: "",
      length: "",
      width: "",
      height: "",
      cell_nominal_voltage: "3.7",
      cell_upper_voltage_cutoff: "4.2",
      cell_lower_voltage_cutoff: "2.5",
      capacity: "",
      max_charge_voltage: "4.2",
      columbic_efficiency: "1.0",
      max_charging_current_continuous: "",
      max_charging_current_instantaneous: "",
      max_discharging_current_continuous: "",
      max_discharging_current_instantaneous: "",
      cell_weight: "",
      cell_volume: "",
      cost_per_cell: "",
      anode_composition: "",
      cathode_composition: "",
    })
    setSohFile(null)
    setError("")
    setEditingCell(null)
    setCurrentPage(0)
  }

  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }
const handleEdit = (cell: CellConfig) => {
  setEditingCell(cell)
  setFormData({
    name: cell.name || "",
    formFactor: cell.formFactor || "cylindrical",
    radius: cell.dims.radius != null ? cell.dims.radius.toString() : "",
    diameter: cell.dims.diameter != null ? cell.dims.diameter.toString() : "",
    length: cell.dims.length != null ? cell.dims.length.toString() : "",
    width: cell.dims.width != null ? cell.dims.width.toString() : "",
    height: cell.dims.height != null ? cell.dims.height.toString() : "",
    cell_nominal_voltage: cell.cell_nominal_voltage != null ? cell.cell_nominal_voltage.toString() : "",
    cell_upper_voltage_cutoff: cell.cell_upper_voltage_cutoff != null ? cell.cell_upper_voltage_cutoff.toString() : "",
    cell_lower_voltage_cutoff: cell.cell_lower_voltage_cutoff != null ? cell.cell_lower_voltage_cutoff.toString() : "",
    capacity: cell.capacity != null ? cell.capacity.toString() : "",
    max_charge_voltage: cell.max_charge_voltage != null ? cell.max_charge_voltage.toString() : "",
    columbic_efficiency: cell.columbic_efficiency != null ? cell.columbic_efficiency.toString() : "",
    max_charging_current_continuous: cell.max_charging_current_continuous != null
      ? cell.max_charging_current_continuous.toString()
      : "",
    max_charging_current_instantaneous: cell.max_charging_current_instantaneous != null
      ? cell.max_charging_current_instantaneous.toString()
      : "",
    max_discharging_current_continuous: cell.max_discharging_current_continuous != null
      ? cell.max_discharging_current_continuous.toString()
      : "",
    max_discharging_current_instantaneous: cell.max_discharging_current_instantaneous != null
      ? cell.max_discharging_current_instantaneous.toString()
      : "",
    cell_weight: cell.cell_weight != null ? cell.cell_weight.toString() : "",
    cell_volume: cell.cell_volume != null ? cell.cell_volume.toString() : "",
    cost_per_cell: cell.cost_per_cell != null ? cell.cost_per_cell.toString() : "",
    anode_composition: cell.anode_composition || "",
    cathode_composition: cell.cathode_composition || "",
  })
  setSohFile(cell.soh_file || null)
  setCurrentPage(0)
  setIsDialogOpen(true)
}


  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cell?")) return
    try {
      await deleteCell(id)
      await fetchCells()
    } catch (err) {
      setError("Failed to delete cell")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = [".csv", ".json", ".mat"]
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase()

    if (!validTypes.includes(fileExt)) {
      setError(`Invalid file type. Please upload ${validTypes.join(", ")} files only.`)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target?.result as string
      setSohFile({
        name: file.name,
        data: data,
        type: file.type || "application/octet-stream",
      })
      setError("")
    }
    reader.readAsDataURL(file)
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Cell name is required")
      return false
    }

    if (formData.formFactor === "cylindrical" || formData.formFactor === "coin") {
      if (!formData.diameter || Number.parseFloat(formData.diameter) <= 0) {
        setError("Valid diameter is required for cylindrical/coin cells")
        return false
      }
    } else if (formData.formFactor === "prismatic" || formData.formFactor === "pouch") {
      if (
        !formData.length ||
        Number.parseFloat(formData.length) <= 0 ||
        !formData.width ||
        Number.parseFloat(formData.width) <= 0
      ) {
        setError("Valid length and width are required for prismatic/pouch cells")
        return false
      }
    }

    if (!formData.height || Number.parseFloat(formData.height) <= 0) {
      setError("Valid height is required")
      return false
    }

    if (!formData.capacity || Number.parseFloat(formData.capacity) <= 0) {
      setError("Valid capacity is required")
      return false
    }

    if (!formData.cell_weight || Number.parseFloat(formData.cell_weight) <= 0) {
      setError("Valid cell weight is required")
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    const dims: any = { height: Number.parseFloat(formData.height) }

    if (formData.formFactor === "cylindrical" || formData.formFactor === "coin") {
      dims.diameter = Number.parseFloat(formData.diameter)
    } else {
      dims.length = Number.parseFloat(formData.length)
      dims.width = Number.parseFloat(formData.width)
    }

    const payload = {
      name: formData.name,
      formFactor: formData.formFactor,
      dims,
      cell_nominal_voltage: Number.parseFloat(formData.cell_nominal_voltage),
      cell_upper_voltage_cutoff: Number.parseFloat(formData.cell_upper_voltage_cutoff),
      cell_lower_voltage_cutoff: Number.parseFloat(formData.cell_lower_voltage_cutoff),
      capacity: Number.parseFloat(formData.capacity),
      max_charging_current_continuous: Number.parseFloat(formData.max_charging_current_continuous),
      max_charging_current_instantaneous: Number.parseFloat(formData.max_charging_current_instantaneous),
      max_discharging_current_continuous: Number.parseFloat(formData.max_discharging_current_continuous),
      max_discharging_current_instantaneous: Number.parseFloat(formData.max_discharging_current_instantaneous),
      max_charge_voltage: Number.parseFloat(formData.max_charge_voltage),
      columbic_efficiency: Number.parseFloat(formData.columbic_efficiency),
      cell_weight: Number.parseFloat(formData.cell_weight),
      cell_volume: Number.parseFloat(formData.cell_volume),
      cost_per_cell: Number.parseFloat(formData.cost_per_cell) || 0,
      anode_composition: formData.anode_composition,
      cathode_composition: formData.cathode_composition,
      soh_file: sohFile,
    }

    try {
      if (editingCell) {
        await updateCell(editingCell.id, payload)
      } else {
        await createCell(payload)
      }
      await fetchCells()
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      setError("Failed to save cell")
    }
  }

  const exportCell = (cell: CellConfig) => {
    const dataStr = JSON.stringify(cell, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${cell.name.replace(/\s+/g, "_")}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchCells()
  }, [])

  const fetchCells = async () => {
    try {
      const data = await getCells()
      setCells(data)
    } catch (err) {
      console.error(err)
      setError("Failed to fetch cells")
    }
  }

  const renderPage1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Electrical Parameters - Page 1</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label>Cell Nominal Voltage (V) *</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.cell_nominal_voltage}
            onChange={(e) => setFormData({ ...formData, cell_nominal_voltage: e.target.value })}
            placeholder="e.g., 3.7"
          />
        </div>
        <div className="space-y-3">
          <Label>Upper Voltage Cut-off (V) *</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.cell_upper_voltage_cutoff}
            onChange={(e) => setFormData({ ...formData, cell_upper_voltage_cutoff: e.target.value })}
            placeholder="e.g., 4.2"
          />
        </div>
        <div className="space-y-3">
          <Label>Lower Voltage Cut-off (V) *</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.cell_lower_voltage_cutoff}
            onChange={(e) => setFormData({ ...formData, cell_lower_voltage_cutoff: e.target.value })}
            placeholder="e.g., 2.5"
          />
        </div>
        <div className="space-y-3">
          <Label>Capacity (Ah) *</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            placeholder="e.g., 5.0"
          />
        </div>
        <div className="space-y-3">
          <Label>Max Charge Voltage (V)</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={formData.max_charge_voltage}
            onChange={(e) => setFormData({ ...formData, max_charge_voltage: e.target.value })}
            placeholder="e.g., 4.2"
          />
        </div>
        <div className="space-y-3">
          <Label>Coulombic Efficiency (0-1)</Label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={formData.columbic_efficiency}
            onChange={(e) => setFormData({ ...formData, columbic_efficiency: e.target.value })}
            placeholder="Default: 1.0"
          />
        </div>
      </div>
    </div>
  )

  const renderPage2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Electrical Parameters - Page 2 & Mechanical</h3>

      <div className="space-y-4">
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Charging Currents (A)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Max Charging - Continuous</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_charging_current_continuous}
                onChange={(e) => setFormData({ ...formData, max_charging_current_continuous: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label>Max Charging - Instantaneous</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_charging_current_instantaneous}
                onChange={(e) => setFormData({ ...formData, max_charging_current_instantaneous: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Discharging Currents (A)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Max Discharging - Continuous</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_discharging_current_continuous}
                onChange={(e) => setFormData({ ...formData, max_discharging_current_continuous: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label>Max Discharging - Instantaneous</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.max_discharging_current_instantaneous}
                onChange={(e) => setFormData({ ...formData, max_discharging_current_instantaneous: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Mechanical Parameters</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Cell Weight (kg) *</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={formData.cell_weight}
                onChange={(e) => setFormData({ ...formData, cell_weight: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label>Cell Volume (mm³)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.cell_volume}
                onChange={(e) => setFormData({ ...formData, cell_volume: e.target.value })}
                placeholder="Calculated from dimensions"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPage3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Commercial & Chemical Parameters</h3>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-3">
          <Label>Cost per Cell ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.cost_per_cell}
            onChange={(e) => setFormData({ ...formData, cost_per_cell: e.target.value })}
            placeholder="e.g., 5.50"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Chemical Composition</h4>
          <div className="space-y-3">
            <Label>Anode Composition</Label>
            <Input
              type="text"
              value={formData.anode_composition}
              onChange={(e) => setFormData({ ...formData, anode_composition: e.target.value })}
              placeholder="e.g., Graphite, Silicon composite"
            />
          </div>
          <div className="space-y-3 mt-4">
            <Label>Cathode Composition</Label>
            <Input
              type="text"
              value={formData.cathode_composition}
              onChange={(e) => setFormData({ ...formData, cathode_composition: e.target.value })}
              placeholder="e.g., LiCoO2, NCA, LFP"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <Label>SOH File (Optional)</Label>
          <div className="flex items-center gap-4 mt-3">
            <Input type="file" accept=".csv,.json,.mat" onChange={handleFileUpload} className="flex-1" />
            {sohFile && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <FileText className="w-4 h-4" />
                <span className="truncate max-w-xs">{sohFile.name}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Upload SOH (State of Health) data file in CSV, JSON, or MAT format
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Battery className="w-8 h-8" />
            Cell Library
          </h1>
          <p className="text-muted-foreground">Manage battery cell configurations</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Cell
        </Button>
      </div>

      {cells.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved Cells</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No cells saved yet. Create your first cell to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cells.map((cell) => (
            <Card key={cell.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{cell.name}</span>
                  <Battery className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardTitle>
                <CardDescription>
                  {cell.formFactor === "cylindrical"
                    ? "Cylindrical"
                    : cell.formFactor.charAt(0).toUpperCase() + cell.formFactor.slice(1)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Capacity:</span>
                    <p className="font-medium">{cell.capacity} Ah</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mass:</span>
                    <p className="font-medium">{cell.cell_weight} kg</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Voltage:</span>
                    <p className="font-medium">{cell.cell_nominal_voltage}V</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>
                    <p className="font-medium">${cell.cost_per_cell.toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Range:</span>
                    <p className="font-medium">
                      {cell.cell_lower_voltage_cutoff}V - {cell.cell_upper_voltage_cutoff}V
                    </p>
                  </div>
                  {cell.soh_file && (
                    <div className="col-span-2 flex items-center gap-2 text-green-600">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs truncate">{cell.soh_file.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={() => handleEdit(cell)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportCell(cell)}>
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(cell.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-5">
          <Card className="w-full max-w-3xl my-8">
            <CardHeader>
              <CardTitle>{editingCell ? "Edit Cell" : "Add New Cell"}</CardTitle>
              <CardDescription>
                Define battery cell specifications and properties (Page {currentPage + 1} of 3)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {currentPage === 0 && (
                <>
                  <div className="space-y-3">
                    <Label>Cell Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Samsung 21700-50E"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Form Factor *</Label>
                    <Select
                      value={formData.formFactor}
                      onValueChange={(v) => setFormData({ ...formData, formFactor: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cylindrical">Cylindrical</SelectItem>
                        <SelectItem value="prismatic">Prismatic</SelectItem>
                        <SelectItem value="pouch">Pouch</SelectItem>
                        <SelectItem value="coin">Coin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Dimensions</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {formData.formFactor === "cylindrical" || formData.formFactor === "coin" ? (
                        <div className="space-y-3">
                          <Label>Diameter (mm) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.diameter}
                            onChange={(e) => setFormData({ ...formData, diameter: e.target.value })}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            <Label>Length (mm) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={formData.length}
                              onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label>Width (mm) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={formData.width}
                              onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-3">
                        <Label>Height (mm) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-64 bg-gray-100 rounded-md overflow-hidden">
                    <CellPreview3D
                      formFactor={formData.formFactor}
                      dims={{
                        diameter: Number.parseFloat(formData.diameter) || 0,
                        length: Number.parseFloat(formData.length) || 0,
                        width: Number.parseFloat(formData.width) || 0,
                        height: Number.parseFloat(formData.height) || 0,
                      }}
                    />
                  </div>

                  {renderPage1()}
                </>
              )}

              {currentPage === 1 && renderPage2()}
              {currentPage === 2 && renderPage3()}

              <div className="flex gap-3 pt-4">
                {currentPage > 0 && (
                  <Button variant="outline" onClick={() => setCurrentPage(currentPage - 1)} className="flex-1">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                )}
                {currentPage < 2 && (
                  <Button onClick={() => setCurrentPage(currentPage + 1)} className="flex-1">
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
                {currentPage === 2 && (
                  <Button onClick={handleSave} className="flex-1">
                    {editingCell ? "Update Cell" : "Save Cell"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function CellPreview3D({
  formFactor,
  dims,
}: {
  formFactor: "cylindrical" | "prismatic" | "pouch" | "coin"
  dims: { diameter?: number; length?: number; width?: number; height: number }
}) {
  const realHeight = (dims.height || 0) / 1000

  if (realHeight === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <p>Enter dimensions to preview</p>
      </div>
    )
  }

  let geometry

  if (formFactor === "cylindrical" || formFactor === "coin") {
    const realDiameter = (dims.diameter || 0) / 1000
    if (realDiameter === 0)
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p>Enter diameter</p>
        </div>
      )
    geometry = <cylinderGeometry args={[realDiameter / 2, realDiameter / 2, realHeight, 32]} />
  } else {
    const realLength = (dims.length || 0) / 1000
    const realWidth = (dims.width || 0) / 1000
    if (realLength === 0 || realWidth === 0)
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p>Enter dimensions</p>
        </div>
      )
    geometry = <boxGeometry args={[realLength, realWidth, realHeight]} />
  }

  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 0.5]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[1, 1, 1]} />
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {geometry}
        <meshStandardMaterial color="steelblue" />
      </mesh>
      <OrbitControls />
    </Canvas>
  )
}

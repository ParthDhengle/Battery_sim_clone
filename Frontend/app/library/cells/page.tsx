"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCells, deleteCell } from "@/lib/api/cells"
import CellDetailsView from "@/components/cell/CellDetailsView"
import { Pencil, Trash2, Download, Battery, FileText, Zap } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

type CellConfig = {
  id: string
  name: string
  formFactor: "cylindrical" | "prismatic" | "pouch" | "coin"
  dims: { radius?: number; length?: number; width?: number; height: number }
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
  rc_pair_type?: "rc2" | "rc3" | null
  rc_parameter_file_path?: string | null
  created_at: string
}

export default function Cells() {
  const [cells, setCells] = useState<CellConfig[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)  // ← NEW

  useEffect(() => {
    fetchCells()
  }, [])

  const fetchCells = async () => {
    try {
      setIsLoading(true)  // ← Start loading
      const data = await getCells()
      setCells(data)
      setError("")
    } catch (err) {
      console.error(err)
      setError("Failed to fetch cells")
    } finally {
      setIsLoading(false)  // ← Always stop loading
    }
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
        <Link href="/add-cells">
          <Button>
            <Pencil className="w-4 h-4 mr-2" />
            Add Cell
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ← NEW: Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-12">Loading cells...</p>
          </CardContent>
        </Card>
      ) : cells.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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

                  {/* RC File Indicator */}
                  {cell.rc_parameter_file_path ? (
                    <div className="col-span-2 flex items-center gap-2 text-green-600 text-xs">
                      <FileText className="w-4 h-4" />
                      <span className="truncate max-w-[180px]">
                        RC parameters uploaded ({cell.rc_pair_type})
                      </span>
                    </div>
                  ) : cell.rc_pair_type ? (
                    <div className="col-span-2 text-amber-600 text-xs flex items-center gap-1">
                      Warning: RC type set but no file uploaded
                    </div>
                  ) : null}

                </div>

                <div className="flex gap-2 pt-2">
                  <CellDetailsView cell={cell} />
                  <Link href={`/cell-builder?id=${cell.id}`}>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
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
    </div>
  )
}
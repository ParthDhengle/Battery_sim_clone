"use client"
import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCell, createCell, updateCell } from "@/lib/api/cells"
import BasicInfo from "@/components/cell/BasicInfo"
import ElectricalParams1 from "@/components/cell/ElectricalParams1"
import ElectricalParams2AndMechanical from "@/components/cell/ElectricalParams2AndMechanical"
import CommercialAndChemical from "@/components/cell/CommercialAndChemical"
import { AlertCircle, Battery } from "lucide-react"

type FormFactor = "cylindrical" | "prismatic" | "pouch" | "coin"

type FormData = {
  name: string
  formFactor: FormFactor
  radius: string
  diameter: string
  length: string
  width: string
  height: string
  cell_nominal_voltage: string
  cell_upper_voltage_cutoff: string
  cell_lower_voltage_cutoff: string
  capacity: string
  max_charge_voltage: string
  columbic_efficiency: string
  max_charging_current_continuous: string
  max_charging_current_instantaneous: string
  max_discharging_current_continuous: string
  max_discharging_current_instantaneous: string
  cell_weight: string
  cell_volume: string
  cost_per_cell: string
  anode_composition: string
  cathode_composition: string
}

type SohFile = { name: string; data: string; type: string } | null

export default function CellBuilder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') || undefined

  const [formData, setFormData] = useState<FormData>({
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
  const [sohFile, setSohFile] = useState<SohFile>(null)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(!!id)

  useEffect(() => {
    if (id) {
      fetchCell(id)
    }
  }, [id])

  const fetchCell = async (cellId: string) => {
    try {
      const cell = await getCell(cellId)
      if (cell) {
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
        setIsEditing(true)
      }
    } catch (err) {
      setError("Failed to fetch cell")
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
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Cell name is required"
    }

    if (!formData.cell_nominal_voltage || Number.parseFloat(formData.cell_nominal_voltage) <= 0) {
      newErrors.cell_nominal_voltage = "Valid nominal voltage is required"
    }

    if (!formData.cell_upper_voltage_cutoff || Number.parseFloat(formData.cell_upper_voltage_cutoff) <= 0) {
      newErrors.cell_upper_voltage_cutoff = "Valid upper voltage cut-off is required"
    }

    if (!formData.cell_lower_voltage_cutoff || Number.parseFloat(formData.cell_lower_voltage_cutoff) <= 0) {
      newErrors.cell_lower_voltage_cutoff = "Valid lower voltage cut-off is required"
    }

    if (formData.formFactor === "cylindrical" || formData.formFactor === "coin") {
      if (!formData.diameter || Number.parseFloat(formData.diameter) <= 0) {
        newErrors.diameter = "Valid diameter is required for cylindrical/coin cells"
      }
    } else if (formData.formFactor === "prismatic" || formData.formFactor === "pouch") {
      if (!formData.length || Number.parseFloat(formData.length) <= 0) {
        newErrors.length = "Valid length is required for prismatic/pouch cells"
      }
      if (!formData.width || Number.parseFloat(formData.width) <= 0) {
        newErrors.width = "Valid width is required for prismatic/pouch cells"
      }
    }

    if (!formData.height || Number.parseFloat(formData.height) <= 0) {
      newErrors.height = "Valid height is required"
    }

    if (!formData.capacity || Number.parseFloat(formData.capacity) <= 0) {
      newErrors.capacity = "Valid capacity is required"
    }

    if (!formData.cell_weight || Number.parseFloat(formData.cell_weight) <= 0) {
      newErrors.cell_weight = "Valid cell weight is required"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setError("Please fill in the required fields highlighted in red.")
      return false
    }

    setErrors({})
    setError("")
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
      max_charging_current_continuous: Number.parseFloat(formData.max_charging_current_continuous) || 0,
      max_charging_current_instantaneous: Number.parseFloat(formData.max_charging_current_instantaneous) || 0,
      max_discharging_current_continuous: Number.parseFloat(formData.max_discharging_current_continuous) || 0,
      max_discharging_current_instantaneous: Number.parseFloat(formData.max_discharging_current_instantaneous) || 0,
      max_charge_voltage: Number.parseFloat(formData.max_charge_voltage),
      columbic_efficiency: Number.parseFloat(formData.columbic_efficiency),
      cell_weight: Number.parseFloat(formData.cell_weight),
      cell_volume: Number.parseFloat(formData.cell_volume) || 0,
      cost_per_cell: Number.parseFloat(formData.cost_per_cell) || 0,
      anode_composition: formData.anode_composition,
      cathode_composition: formData.cathode_composition,
      soh_file: sohFile,
    }

    try {
      if (isEditing && id) {
        await updateCell(id, payload)
      } else {
        await createCell(payload)
      }
      router.push("library/cells")
    } catch (err) {
      setError("Failed to save cell")
    }
  }

  return (
    <div className="space-y-6 p-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-5 h-5" />
            {isEditing ? "Edit Cell" : "Create Cell"}
          </CardTitle>
          <CardDescription>Define your battery cell specifications</CardDescription>
        </CardHeader>
      </Card>

      <BasicInfo
        formData={formData}
        setFormData={setFormData}
        errors={errors}
      />

      <ElectricalParams1
        formData={formData}
        setFormData={setFormData}
        errors={errors}
      />

      <ElectricalParams2AndMechanical
        formData={formData}
        setFormData={setFormData}
        errors={errors}
      />

      <CommercialAndChemical
        formData={formData}
        setFormData={setFormData}
        sohFile={sohFile}
        handleFileUpload={handleFileUpload}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} className="min-w-32">
          {isEditing ? "Update Cell" : "Save Cell"}
        </Button>
      </div>
    </div>
  )
}
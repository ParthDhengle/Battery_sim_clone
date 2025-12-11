"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCell, createCell, updateCell } from "@/lib/api/cells"
import BasicParameters from "@/components/cell/BasicParameters"
import AdvancedParameters from "@/components/cell/AdvancedParameters"
import { AlertCircle, Battery, ArrowLeft } from "lucide-react"

export default function CellBuilderContent() {
  type FormFactor = "cylindrical" | "prismatic" | "pouch" | "coin"
  type FormData = {
    name: string
    formFactor: FormFactor
    radius: string
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
    rc_pair_type: "rc2" | "rc3" | ""
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || undefined

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    name: "",
    formFactor: "cylindrical",
    radius: "",
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
    rc_pair_type: "",
  })

  const [sohFile, setSohFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(!!id)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [rcPairType, setRcPairType] = useState<"rc2" | "rc3" | "">("")

  useEffect(() => {
    if (id) {
      fetchCell(id)
    }
  }, [id])

  useEffect(() => {
    const r = Number.parseFloat(formData.radius) || 0
    const l = Number.parseFloat(formData.length) || 0
    const w = Number.parseFloat(formData.width) || 0
    const h = Number.parseFloat(formData.height) || 0

    let vol = 0
    if (["cylindrical", "coin"].includes(formData.formFactor)) {
      vol = Math.PI * r * r * h
    } else {
      vol = l * w * h
    }

    setFormData((prev) => ({
      ...prev,
      cell_volume: vol > 0 ? vol.toString() : prev.cell_volume,
    }))
  }, [formData.formFactor, formData.radius, formData.length, formData.width, formData.height])

  const fetchCell = async (cellId: string) => {
    try {
      const cell = await getCell(cellId)
      if (cell) {
        const newFormData = {
          name: cell.name || "",
          formFactor: cell.formFactor || "cylindrical",
          radius: cell.dims.radius != null ? cell.dims.radius.toString() : "",
          length: cell.dims.length != null ? cell.dims.length.toString() : "",
          width: cell.dims.width != null ? cell.dims.width.toString() : "",
          height: cell.dims.height != null ? cell.dims.height.toString() : "",
          cell_nominal_voltage: cell.cell_nominal_voltage != null ? cell.cell_nominal_voltage.toString() : "",
          cell_upper_voltage_cutoff:
            cell.cell_upper_voltage_cutoff != null ? cell.cell_upper_voltage_cutoff.toString() : "",
          cell_lower_voltage_cutoff:
            cell.cell_lower_voltage_cutoff != null ? cell.cell_lower_voltage_cutoff.toString() : "",
          capacity: cell.capacity != null ? cell.capacity.toString() : "",
          max_charge_voltage: cell.max_charge_voltage != null ? cell.max_charge_voltage.toString() : "",
          columbic_efficiency: cell.columbic_efficiency != null ? cell.columbic_efficiency.toString() : "",
          max_charging_current_continuous:
            cell.max_charging_current_continuous != null ? cell.max_charging_current_continuous.toString() : "",
          max_charging_current_instantaneous:
            cell.max_charging_current_instantaneous != null ? cell.max_charging_current_instantaneous.toString() : "",
          max_discharging_current_continuous:
            cell.max_discharging_current_continuous != null ? cell.max_discharging_current_continuous.toString() : "",
          max_discharging_current_instantaneous:
            cell.max_discharging_current_instantaneous != null
              ? cell.max_discharging_current_instantaneous.toString()
              : "",
          cell_weight: cell.cell_weight != null ? cell.cell_weight.toString() : "",
          cost_per_cell: cell.cost_per_cell != null ? cell.cost_per_cell.toString() : "",
          anode_composition: cell.anode_composition || "",
          cathode_composition: cell.cathode_composition || "",
          rc_pair_type: cell.rc_pair_type || "",
          cell_volume: "",
        }
        setFormData(newFormData)
        
        // Handle soh_file conversion if needed
        if (cell.soh_file) {
          // If the API returns the file in a different format, convert it to File object
          // For now, assuming it's already a File or null
          setSohFile(cell.soh_file)
        }
        
        setIsEditing(true)
      }
    } catch (err) {
      setError("Failed to fetch cell")
    }
  }

  const handleFileUpload = (file: File | null) => {
    setUploadedFile(file)
    if (file) setError("")
  }

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Cell name is required"
    }

    if (!formData.cell_nominal_voltage) {
      newErrors.cell_nominal_voltage = "Valid nominal voltage is required"
    }

    if (!formData.cell_upper_voltage_cutoff) {
      newErrors.cell_upper_voltage_cutoff = "Valid upper voltage cut-off is required"
    }

    if (!formData.cell_lower_voltage_cutoff) {
      newErrors.cell_lower_voltage_cutoff = "Valid lower voltage cut-off is required"
    }

    if (formData.formFactor === "cylindrical" || formData.formFactor === "coin") {
      if (!formData.radius || Number.parseFloat(formData.radius) <= 0) {
        newErrors.radius = "Valid radius is required for cylindrical/coin cells"
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
      setError("Please fill in all required fields in Step 1 before proceeding.")
      return false
    }

    setErrors({})
    setError("")
    return true
  }

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
    setError("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSave = async () => {
  const dims: any = { height: Number.parseFloat(formData.height) }
  if (["cylindrical", "coin"].includes(formData.formFactor)) {
    if (!formData.radius || Number(formData.radius) <= 0) {
      setError("Radius is required for cylindrical/coin cells")
      return
    }
    dims.radius = Number(formData.radius)
  } else {
    if (!formData.length || Number(formData.length) <= 0) {
      setError("Length is required")
      return
    }
    if (!formData.width || Number(formData.width) <= 0) {
      setError("Width is required")
      return
    }
    dims.length = Number(formData.length)
    dims.width = Number(formData.width)
  }

  const payload = new FormData()
  payload.append("name", formData.name)
  payload.append("formFactor", formData.formFactor)
  payload.append("height", formData.height)

  if (dims.radius) payload.append("radius", dims.radius.toString())
  if (dims.length) payload.append("length", dims.length.toString())
  if (dims.width) payload.append("width", dims.width.toString())

  payload.append("cell_nominal_voltage", formData.cell_nominal_voltage)
  payload.append("cell_upper_voltage_cutoff", formData.cell_upper_voltage_cutoff)
  payload.append("cell_lower_voltage_cutoff", formData.cell_lower_voltage_cutoff)
  payload.append("capacity", formData.capacity)
  payload.append("cell_weight", formData.cell_weight)

  // Optional fields
  const optionalFields = [
    "max_charging_current_continuous",
    "max_charging_current_instantaneous",
    "max_discharging_current_continuous",
    "max_discharging_current_instantaneous",
    "max_charge_voltage",
    "columbic_efficiency",
    "cost_per_cell",
    "anode_composition",
    "cathode_composition",
    "cell_volume",
  ]

  optionalFields.forEach(field => {
    const value = (formData as any)[field]
    if (value !== undefined && value !== "") {
      payload.append(field, value)
    }
  })

  // RC File Upload
  if (uploadedFile) {
    if (!rcPairType) {
      setError("Please select RC pair type (2RC or 3RC)")
      return
    }
    payload.append("rc_pair_type", rcPairType)
    payload.append("rc_parameter_file", uploadedFile)
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/cells/with-rc-file`
    const res = await fetch(url, {
      method: "POST",
      body: payload,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to save cell")
    }

    router.push("/library/cells")
  } catch (err: any) {
    setError(err.message || "Failed to save cell")
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

      <div className="pb-6 border-b mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Battery className="w-6 h-6" />
          {isEditing ? "Edit Cell" : "Create Cell"}
        </h2>
      </div>

      {currentStep === 1 ? (
        <>
          <div className="text-2xl font-semibold mb-4">Step 1: Basic Parameters</div>
          <BasicParameters formData={formData} setFormData={setFormData} errors={errors} />
          <div className="flex justify-end">
            <Button onClick={handleNext} className="min-w-32">
              Next
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold mb-4">Step 2: Advanced Parameters</div>
          <AdvancedParameters
            formData={formData}
            setFormData={setFormData}
            sohFile={sohFile}
            handleFileUpload={handleFileUpload}
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            rcPairType={rcPairType}
            setRcPairType={setRcPairType}
          />
          <div className="flex justify-between">
            <Button onClick={handleBack} variant="outline" className="min-w-32">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSave} className="min-w-32">
              {isEditing ? "Update Cell" : "Save Cell"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
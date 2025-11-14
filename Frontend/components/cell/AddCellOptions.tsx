// Updated: components/cells/AddCellOptions.tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Pencil, Upload, FileText } from "lucide-react"
import { createCell } from "@/lib/api/cells"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ValidationError = {
  row: number
  message: string
}

type ParsedPayload = any // Matches the payload shape for createCell

const expectedHeaders = [
  "name",
  "formFactor",
  "diameter",
  "length",
  "width",
  "height",
  "cell_nominal_voltage",
  "cell_upper_voltage_cutoff",
  "cell_lower_voltage_cutoff",
  "capacity",
  "max_charging_current_continuous",
  "max_charging_current_instantaneous",
  "max_discharging_current_continuous",
  "max_discharging_current_instantaneous",
  "max_charge_voltage",
  "columbic_efficiency",
  "cell_weight",
  "cell_volume",
  "cost_per_cell",
  "anode_composition",
  "cathode_composition"
] as const

const requiredDescriptions: Record<string, { isRequired: boolean; note: string }> = {
  name: { isRequired: true, note: "required" },
  formFactor: { isRequired: true, note: "required" },
  diameter: { isRequired: false, note: "required for cylindrical/coin" },
  length: { isRequired: false, note: "required for prismatic/pouch" },
  width: { isRequired: false, note: "required for prismatic/pouch" },
  height: { isRequired: true, note: "required" },
  cell_nominal_voltage: { isRequired: true, note: "required" },
  cell_upper_voltage_cutoff: { isRequired: true, note: "required" },
  cell_lower_voltage_cutoff: { isRequired: true, note: "required" },
  capacity: { isRequired: true, note: "required" },
  max_charging_current_continuous: { isRequired: false, note: "optional" },
  max_charging_current_instantaneous: { isRequired: false, note: "optional" },
  max_discharging_current_continuous: { isRequired: false, note: "optional" },
  max_discharging_current_instantaneous: { isRequired: false, note: "optional" },
  max_charge_voltage: { isRequired: false, note: "optional" },
  columbic_efficiency: { isRequired: false, note: "optional" },
  cell_weight: { isRequired: true, note: "required" },
  cell_volume: { isRequired: false, note: "optional" },
  cost_per_cell: { isRequired: false, note: "optional" },
  anode_composition: { isRequired: false, note: "optional" },
  cathode_composition: { isRequired: false, note: "optional" }
}

const exampleRow = [
  "Example Cell",
  "cylindrical",
  "21",
  "",
  "",
  "70",
  "3.7",
  "4.2",
  "2.5",
  "5",
  "2.5",
  "5",
  "10",
  "20",
  "4.2",
  "1.0",
  "0.05",
  "",
  "5.5",
  "Graphite",
  "NCA"
]

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let field = ""
  let quoted = false
  let i = 0
  while (i < line.length) {
    const char = line[i]
    if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
      quoted = !quoted
      i++
      continue
    }
    if (char === "," && !quoted) {
      result.push(field)
      field = ""
      i++
      continue
    }
    field += char
    i++
  }
  result.push(field)
  return result
}

function validateRow(data: Record<string, string>): string[] {
  const errs: string[] = []

  if (!data.name?.trim()) errs.push("name is required")

  const ff = data.formFactor?.trim().toLowerCase() || ""
  if (!ff) errs.push("formFactor is required")
  else if (!["cylindrical", "prismatic", "pouch", "coin"].includes(ff)) {
    errs.push("formFactor must be one of: cylindrical, prismatic, pouch, coin")
  }

  const parseNumSafe = (val: string): number => {
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }

  const requiredNums = [
    { key: "cell_nominal_voltage", val: data.cell_nominal_voltage },
    { key: "cell_upper_voltage_cutoff", val: data.cell_upper_voltage_cutoff },
    { key: "cell_lower_voltage_cutoff", val: data.cell_lower_voltage_cutoff },
    { key: "capacity", val: data.capacity },
    { key: "cell_weight", val: data.cell_weight }
  ]

  requiredNums.forEach(({ key, val }) => {
    const n = parseNumSafe(val)
    if (n <= 0) errs.push(`${key} must be a positive number`)
  })

  const height = parseNumSafe(data.height)
  if (height <= 0) errs.push("height must be a positive number")

  if (ff === "cylindrical" || ff === "coin") {
    const diam = parseNumSafe(data.diameter)
    if (diam <= 0) errs.push("diameter must be a positive number for cylindrical/coin")
  } else if (ff === "prismatic" || ff === "pouch") {
    const len = parseNumSafe(data.length)
    if (len <= 0) errs.push("length must be a positive number for prismatic/pouch")
    const wid = parseNumSafe(data.width)
    if (wid <= 0) errs.push("width must be a positive number for prismatic/pouch")
  }

  return errs
}

function buildPayload(data: Record<string, string>, formFactor: string): ParsedPayload {
  const parseNumSafe = (val: string): number => Number(val) || 0
  const dims: any = { height: parseNumSafe(data.height) }

  if (formFactor === "cylindrical" || formFactor === "coin") {
    dims.diameter = parseNumSafe(data.diameter)
  } else {
    dims.length = parseNumSafe(data.length)
    dims.width = parseNumSafe(data.width)
  }

  return {
    name: data.name?.trim() || "",
    formFactor: formFactor as any,
    dims,
    cell_nominal_voltage: parseNumSafe(data.cell_nominal_voltage),
    cell_upper_voltage_cutoff: parseNumSafe(data.cell_upper_voltage_cutoff),
    cell_lower_voltage_cutoff: parseNumSafe(data.cell_lower_voltage_cutoff),
    capacity: parseNumSafe(data.capacity),
    max_charging_current_continuous: parseNumSafe(data.max_charging_current_continuous),
    max_charging_current_instantaneous: parseNumSafe(data.max_charging_current_instantaneous),
    max_discharging_current_continuous: parseNumSafe(data.max_discharging_current_continuous),
    max_discharging_current_instantaneous: parseNumSafe(data.max_discharging_current_instantaneous),
    max_charge_voltage: parseNumSafe(data.max_charge_voltage),
    columbic_efficiency: parseNumSafe(data.columbic_efficiency),
    cell_weight: parseNumSafe(data.cell_weight),
    cell_volume: parseNumSafe(data.cell_volume),
    cost_per_cell: parseNumSafe(data.cost_per_cell),
    anode_composition: data.anode_composition?.trim() || "",
    cathode_composition: data.cathode_composition?.trim() || ""
  }
}

export default function AddCellOptions() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState("")
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [parsedPayloads, setParsedPayloads] = useState<ParsedPayload[]>([])
  const [uploadError, setUploadError] = useState("")
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const templateHeaders = expectedHeaders.map(
    (field) => `${field} (${requiredDescriptions[field as keyof typeof requiredDescriptions].note})`
  ).join(",")

  const downloadTemplate = () => {
    const csvContent = `${templateHeaders}\n${exampleRow.join(",")}\n`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "cell_template.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please select a valid CSV file.")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string
        const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

        if (lines.length < 1) {
          throw new Error("CSV file is empty.")
        }

        const rawHeaders = parseCSVLine(lines[0])
        const headers = rawHeaders.map((h) =>
          h.replace(/^"|"$/g, "").replace(/\s*\([^)]*\)\s*$/i, "").trim()
        )

        if (
          headers.length !== expectedHeaders.length ||
          headers.some((h, i) => h !== expectedHeaders[i])
        ) {
          throw new Error(
            "Invalid CSV format. The columns do not match the template. Please download and use the template CSV."
          )
        }

        // Skip the example row if present
        let startIdx = 1
        if (lines[1] && parseCSVLine(lines[1])[0]?.includes("Example")) {
          startIdx = 2
        }

        const dataRows = lines.slice(startIdx).map(parseCSVLine)

        if (dataRows.length === 0) {
          throw new Error("No data rows found in CSV. Remove the example row and add your data.")
        }

        const rowErrors: { row: number; errors: string[] }[] = []
        dataRows.forEach((row, idx) => {
          if (row.length !== headers.length) {
            rowErrors.push({ row: idx + 1, errors: ["Incorrect number of columns"] })
            return
          }
          const rowData = headers.reduce((acc: Record<string, string>, h, i) => {
            acc[h] = row[i] || ""
            return acc
          }, {})
          const errs = validateRow(rowData)
          if (errs.length > 0) {
            rowErrors.push({ row: idx + 1, errors: errs })
          }
        })

        if (rowErrors.length > 0) {
          setValidationErrors(
            rowErrors.map((re) => ({
              row: re.row,
              message: `Missing or invalid fields: ${re.errors.join("; ")}`
            }))
          )
          setParsedPayloads([])
        } else {
          const payloads = dataRows.map((row) => {
            const rowData = headers.reduce((acc: Record<string, string>, h, i) => {
              acc[h] = row[i] || ""
              return acc
            }, {})
            const ff = rowData.formFactor.trim().toLowerCase()
            return buildPayload(rowData, ff)
          })
          setParsedPayloads(payloads)
          setValidationErrors([])
        }

        setParseError("")
        setSelectedFile(file)
      } catch (err: any) {
        setParseError(err.message || "Failed to parse CSV file.")
        setValidationErrors([])
        setParsedPayloads([])
      }
    }
    reader.readAsText(file)
  }

  const handleUpload = async () => {
    if (parsedPayloads.length === 0) return

    setIsUploading(true)
    setUploadError("")
    let successCount = 0
    const errors: string[] = []

    for (const payload of parsedPayloads) {
      try {
        await createCell(payload)
        successCount++
      } catch (err: any) {
        errors.push(`Cell "${payload.name}": ${err.message || "Validation failed"}`)
      }
    }

    setUploadSuccessCount(successCount)
    if (errors.length > 0) {
      setUploadError(errors.join("\n"))
    }

    setIsUploading(false)

    // Redirect after 2 seconds
    setTimeout(() => {
      router.push("library/cells")
    }, 2000)
  }

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Pencil className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Add Cells</h1>
      </div>

      {parseError && (
        <Alert variant="destructive">
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {uploadError && (
        <Alert variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {uploadSuccessCount > 0 && (
        <Alert>
          <AlertDescription>
            Successfully added {uploadSuccessCount} cell{uploadSuccessCount !== 1 ? "s" : ""}. Redirecting...
          </AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="space-y-1">
              <strong>Validation errors found:</strong>
              <ul className="list-disc pl-5 mt-2">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual Add Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Add Manually
            </CardTitle>
            <CardDescription>
              Build your cell configuration step by step using the interactive form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/cell-builder">
              <Button className="w-full">
                Open Cell Builder
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* CSV Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Bulk Upload (CSV)
            </CardTitle>
            <CardDescription>
              Upload multiple cells at once. Download the template to see the exact format, including required (*) and optional fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Template CSV
            </Button>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              placeholder="Select CSV file"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>
            )}
            {parsedPayloads.length > 0 && validationErrors.length === 0 && (
              <div className="p-3 bg-green-50 rounded-md">
                <p className="text-sm font-medium text-green-800">
                  Validated successfully! Ready to upload {parsedPayloads.length} cell{parsedPayloads.length !== 1 ? "s" : ""}.
                </p>
                <Button onClick={handleUpload} disabled={isUploading} className="mt-2 w-full">
                  {isUploading ? "Uploading..." : "Upload Cells"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CSV Template Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            CSV Template Preview
          </CardTitle>
          <CardDescription>
            Below is a preview of the CSV template structure. Required fields are highlighted in red. Download the full template for the example row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {expectedHeaders.map((header) => {
                    const desc = requiredDescriptions[header as keyof typeof requiredDescriptions]
                    const isRequired = desc.isRequired
                    return (
                      <TableHead key={header} className={isRequired ? "text-red-600 font-semibold" : "text-gray-600"}>
                        {header} <span className={isRequired ? "text-red-500" : "text-gray-500"}>({desc.note})</span>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {exampleRow.map((cell, idx) => (
                    <TableCell key={idx}>{cell}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Remove the example row before adding your data. For conditional fields (e.g., diameter), fill based on formFactor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
// components/RCParameterUpload.tsx
"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Info, Download, AlertCircle, Upload, X, Loader2, CheckCircle2, Image } from "lucide-react"
import { Label } from "@/components/ui/label"
import RCParameterPlots from "./RCParameterPlots"

type Props = {
  formData: any
  setFormData: (data: any) => void
  uploadedFile: File | null
  onFileChange: (file: File | null) => void
  rcPairType: "rc2" | "rc3" | ""
  setRcPairType: (type: "rc2" | "rc3" | "") => void
}

export default function RCParameterUpload({ 
  formData, 
  setFormData, 
  uploadedFile, 
  onFileChange,
  rcPairType,      // Use prop directly
  setRcPairType    // Use prop directly
}: Props) {
  // REMOVED: const [rcPairType, setRcPairType] = useState<"rc2" | "rc3" | "">(...)
  
  const [fileError, setFileError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPlots, setShowPlots] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleRcPairChange = (value: "rc2" | "rc3") => {
    setRcPairType(value)  // This now updates parent state
    updateField("rc_pair_type", value)
    console.log("✅ RC Pair Type selected:", value)  // Debug log
  }

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFileError(null)
    updateField("rc_parameter_file", null)
    onFileChange(null)
  }

  const downloadTemplate = () => {
    if (!rcPairType) return

    const path =
      rcPairType === "rc2"
        ? "/templates/2RCpair_parameter_file.csv"
        : "/templates/3RCpair_parameter_file.csv"

    const name = rcPairType === "rc2" ? "2RC_Parameter_Template.csv" : "3RC_Parameter_Template.csv"

    const link = document.createElement("a")
    link.href = path
    link.download = name
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const validateRCFile = (rows: string[][], type: "rc2" | "rc3"): string | null => {
    if (rows.length < 2) {
      return "File Error: The file must contain at least a header row and one data row."
    }

    const headers = rows[0].map((h) => h.trim())
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""))

    if (dataRows.length === 0) {
      return "Data Error: No valid data rows found in the file. Please ensure you have data below the header row."
    }

    const expectedVars =
      type === "rc2"
        ? ["soc", "ocv", "r0", "r1", "r2", "c1", "c2"]
        : ["soc", "ocv", "r0", "r1", "r2", "r3", "c1", "c2", "c3"]

    const blocks = new Map<string, string[]>()

    headers.forEach((h) => {
      const match = h.match(/^(CHARGE|DISCHARGE)_T(-?\d+)_(.+)$/i)
      if (match) {
        const prefix = `${match[1]}_T${match[2]}`.toUpperCase()
        const variable = match[3].toLowerCase()
        if (!blocks.has(prefix)) blocks.set(prefix, [])
        blocks.get(prefix)!.push(variable)
      }
    })

    if (blocks.size === 0) {
      return (
        `Column Format Error: No valid temperature blocks found.\n\n` +
        `Expected format: CHARGE_T25_soc, DISCHARGE_T05_r0, etc.\n` +
        `• Temperature must be in format: T05, T15, T25, etc.\n` +
        `• Each block needs ${expectedVars.length} columns: ${expectedVars.join(", ")}`
      )
    }

    const errors: string[] = []

    for (const [blockName, variables] of blocks.entries()) {
      if (variables.length !== expectedVars.length) {
        errors.push(
          `Block "${blockName}":\n   Found ${variables.length} columns, expected ${expectedVars.length}\n   Required: ${expectedVars.join(", ")}`
        )
        continue
      }

      const missingVars = expectedVars.filter((v) => !variables.includes(v))
      if (missingVars.length > 0) {
        errors.push(
          `Block "${blockName}":\n   Missing variables: ${missingVars.join(", ")}\n   Found: ${variables.join(", ")}`
        )
      }

      const incorrectOrder = variables.some((v, i) => v !== expectedVars[i])
      if (incorrectOrder) {
        errors.push(
          `Block "${blockName}":\n   Variables not in correct order\n   Expected: ${expectedVars.join(", ")}\n   Found: ${variables.join(", ")}`
        )
      }
    }

    if (errors.length > 0) return errors.join("\n\n")

    // SOC validation
    const socErrors: string[] = []
    let referenceSocValues: number[] | null = null

    for (const [blockName] of blocks.entries()) {
      const socColName = headers.find((h) => h.toUpperCase() === `${blockName}_SOC`)
      if (!socColName) continue

      const socColIndex = headers.indexOf(socColName)
      const socValues = dataRows
        .map((r) => parseFloat(r[socColIndex]?.trim() || ""))
        .filter((v) => !isNaN(v))

      if (socValues.length === 0) {
        socErrors.push(`Block "${blockName}": SOC column has no valid numeric data`)
        continue
      }

      if (Math.abs(socValues[0]) > 0.01) {
        socErrors.push(`Block "${blockName}": SOC must start at 0.0 (found ${socValues[0].toFixed(4)})`)
      }
      if (Math.abs(socValues[socValues.length - 1] - 1.0) > 0.01) {
        socErrors.push(`Block "${blockName}": SOC must end at 1.0 (found ${socValues[socValues.length - 1].toFixed(4)})`)
      }

      if (referenceSocValues === null) {
        referenceSocValues = socValues
      } else if (
        socValues.length !== referenceSocValues.length ||
        socValues.some((v, i) => Math.abs(v - referenceSocValues![i]) > 0.001)
      ) {
        socErrors.push(`Block "${blockName}": SOC values must be identical across all temperature blocks`)
      }

      if (socValues.some((v, i) => i > 0 && v <= socValues[i - 1])) {
        socErrors.push(`Block "${blockName}": SOC values must be strictly increasing`)
      }
    }

    if (socErrors.length > 0) return socErrors.join("\n\n")

    return null
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!rcPairType) {
      setFileError("Please select RC pair type (2RC or 3RC) before uploading a file.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setIsProcessing(true)
    setFileError(null)

    try {
      const text = await file.text()
      const rows = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l)
        .map((l) => l.split(","))

      const error = validateRCFile(rows, rcPairType)
      if (error) throw new Error(error)

      updateField("rc_parameter_file", file)
      onFileChange(file)
      console.log("✅ File uploaded successfully:", file.name)  // Debug log
    } catch (err: any) {
      setFileError(err.message)
      updateField("rc_parameter_file", null)
      onFileChange(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          RC Parameter File Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Upload equivalent circuit model parameters for battery characterization
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <Label className="text-base font-semibold">Select RC Pair Configuration</Label>
          </div>
          <Select value={rcPairType} onValueChange={handleRcPairChange}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choose your equivalent circuit model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rc2">2 RC Pairs Model</SelectItem>
              <SelectItem value="rc3">3 RC Pairs Model</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rcPairType && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-dashed" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  2
                </div>
                <Label className="text-base font-semibold">Download Template</Label>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <Button variant="outline" onClick={downloadTemplate} className="w-full h-11 gap-2 border-2">
                  <Download className="w-4 h-4" />
                  Download {rcPairType === "rc2" ? "2RC" : "3RC"} Template CSV
                </Button>
              </div>
            </div>

            {/* Step 3: Upload + Generate Plots */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
                <Label className="text-base font-semibold">Upload & Visualize</Label>
              </div>

              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

              {!uploadedFile ? (
                <Button
                  variant="outline"
                  className="w-full h-24 border-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium">Validating file...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-center">
                        <div className="text-sm font-medium">Click to upload CSV file</div>
                        <div className="text-xs text-muted-foreground mt-1">File will be validated automatically</div>
                      </div>
                    </div>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100 truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Valid {rcPairType.toUpperCase()} parameter file • {(uploadedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearFile}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  {/* Generate Plots Button */}
                  <Button
                    onClick={() => setShowPlots(true)}
                    className="w-full h-12 gap-2"
                    size="lg"
                  >
                    <Image className="w-5 h-5" />
                    Generate Parameter Plots ({rcPairType === "rc2" ? "12" : "16"} plots)
                  </Button>

                  {/* Plots Viewer */}
                  {showPlots && uploadedFile && (
                    <RCParameterPlots
                      file={uploadedFile}
                      rcType={rcPairType}
                      onClose={() => setShowPlots(false)}
                    />
                  )}
                </div>
              )}

              {fileError && (
                <Alert variant="destructive" className="border-2">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="font-semibold text-base">File Validation Failed</AlertTitle>
                  <AlertDescription className="mt-3 space-y-3">
                    <div className="text-sm whitespace-pre-line font-mono bg-destructive/10 p-3 rounded border border-destructive/20">
                      {fileError}
                    </div>
                    <div className="bg-background p-3 rounded border">
                      <p className="font-semibold text-sm mb-2">How to Fix:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>Download the template and fill your data into it</li>
                        <li>Do not rename, reorder, or remove any columns</li>
                        <li>Ensure SOC starts at 0.0 and ends at 1.0</li>
                        <li>All SOC columns must be identical</li>
                        <li>Each block needs {rcPairType === "rc2" ? "7" : "9"} columns</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm space-y-2">
                <p className="font-semibold text-blue-900 dark:text-blue-100">File Format Requirements:</p>
                <ul className="list-disc pl-5 space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Column format: CHARGE_T25_soc, DISCHARGE_T05_r0, etc.</li>
                  <li>Temperature: T05, T15, T25, T35, etc.</li>
                  <li>Parameters: {rcPairType === "rc2" ? "soc, ocv, r0, r1, r2, c1, c2" : "soc, ocv, r0–r3, c1–c3"}</li>
                  <li>Both CHARGE and DISCHARGE blocks required per temperature</li>
                </ul>
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  )
}
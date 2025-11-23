"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, X, FileText, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DriveOption {
  value: string
  label: string
  specs?: Record<string, string | number>
}

export interface DriveCycleSelectorProps {
  value: string
  onValueChange: (value: string) => void
}

async function getDriveCyclesFromStorage(): Promise<DriveOption[]> {
  if (typeof window === "undefined") return []
  
  try {
    if (window.storage && typeof window.storage.list === "function") {
      const result = await window.storage.list("drivecycle:")
      const keys = result?.keys ?? []
      const items = await Promise.all(
        keys.map(async (key: string) => {
          const dc = await window.storage.get(key)
          return dc ? { key, data: JSON.parse(dc.value) } : null
        })
      )
      const cycles = items.filter(Boolean) as Array<{ key: string; data: any }>
      return cycles.map(({ key, data: cycle }) => ({
        value: String(cycle.id ?? cycle.name ?? key),
        label: cycle.name ?? `Drive Cycle ${cycle.id ?? ''}`,
        specs: {
          duration: cycle.duration ?? cycle.totalDuration ?? "",
          avgSpeed: cycle.avgSpeed ?? "",
        },
      }))
    }
    throw new Error("No drive cycle storage available")
  } catch (error) {
    console.error("Failed to fetch drive cycles:", error)
    return [
      { 
        value: "urban-dynamometer", 
        label: "Urban Dynamometer Cycle", 
        specs: { duration: "1200s", avgSpeed: "32kmh" } 
      },
      {
        value: "highway-fuel-economy",
        label: "Highway Fuel Economy Cycle",
        specs: { duration: "765s", avgSpeed: "77kmh" },
      },
    ]
  }
}

export function DriveCycleSelector({ value, onValueChange }: DriveCycleSelectorProps) {
  const [cycles, setCycles] = useState<DriveOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCycles()
  }, [])

  const loadCycles = async () => {
    setLoading(true)
    try {
      const storedCycles = await getDriveCyclesFromStorage()
      setCycles(storedCycles)
    } finally {
      setLoading(false)
    }
  }

  const isDbCycleSelected = value && !value.endsWith(".csv")
  const isCsvUploaded = value && value.endsWith(".csv")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear previous upload if exists
    if (isCsvUploaded) {
      sessionStorage.removeItem(`csv:${value}`)
    }

    setUploadError(null)
    setIsProcessing(true)

    try {
      // Validate file type
      if (!file.name.endsWith(".csv")) {
        throw new Error("Please upload a CSV file")
      }

      // Read and validate CSV content
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((line) => line.trim())

      if (lines.length < 2) {
        throw new Error("CSV file must contain at least a header and one data row")
      }

      // Validate header
      const header = lines[0].toLowerCase()
      if (!header.includes("time") || !header.includes("current")) {
        throw new Error("CSV must have 'Time' and 'Current' columns")
      }

      // Validate data rows
      let validRows = 0
      for (let i = 1; i < Math.min(lines.length, 10); i++) {
        const [time, current] = lines[i].split(",")
        if (isNaN(Number(time)) || isNaN(Number(current))) {
          throw new Error(`Invalid data format at row ${i + 1}. Expected numeric values for Time and Current`)
        }
        validRows++
      }

      if (validRows === 0) {
        throw new Error("No valid data rows found in CSV")
      }

      // Store CSV content in sessionStorage
      sessionStorage.setItem(`csv:${file.name}`, text)

      // Update state
      setUploadedFile(file)
      onValueChange(file.name)
      setUploadError(null)
    } catch (err: any) {
      setUploadError(err.message || "Failed to process CSV file")
      setUploadedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveCsv = () => {
    if (value && value.endsWith(".csv")) {
      sessionStorage.removeItem(`csv:${value}`)
    }
    setUploadedFile(null)
    setUploadError(null)
    onValueChange("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveDbSelection = () => {
    onValueChange("")
  }

  const handleDbCycleSelect = (selectedValue: string) => {
    // Remove any uploaded CSV first
    if (isCsvUploaded) {
      handleRemoveCsv()
    }
    onValueChange(selectedValue)
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading drive cycles...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          📊 Drive Cycle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Selection */}
        <div className="space-y-2">
          <Label htmlFor="cycle-select" className="text-sm font-medium">
            Select from Database
          </Label>
          <div className="flex gap-2">
            <Select
              value={isDbCycleSelected ? value : ""}
              onValueChange={handleDbCycleSelect}
              disabled={isCsvUploaded || isProcessing}
            >
              <SelectTrigger
                id="cycle-select"
                className={isCsvUploaded ? "opacity-50" : ""}
              >
                <SelectValue placeholder="Choose a drive cycle..." />
              </SelectTrigger>
              <SelectContent>
                {cycles.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No drive cycles available
                  </div>
                ) : (
                  cycles.map((cycle) => (
                    <SelectItem key={cycle.value} value={cycle.value}>
                      <div className="flex flex-col">
                        <span>{cycle.label}</span>
                        {cycle.specs && Object.keys(cycle.specs).length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Object.entries(cycle.specs)
                              .filter(([_, v]) => v)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {isDbCycleSelected && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRemoveDbSelection}
                className="flex-shrink-0"
                title="Remove selection"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isDbCycleSelected && (
            <p className="text-xs text-muted-foreground">
              ✓ Drive cycle selected from database
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="space-y-2">
          <Label htmlFor="csv-upload" className="text-sm font-medium">
            Upload CSV File
          </Label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isDbCycleSelected || isProcessing}
              className="hidden"
            />
            
            {!isCsvUploaded ? (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDbCycleSelected || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Drive Cycle CSV
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                <FileText className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm font-medium truncate">
                  {value}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveCsv}
                  className="flex-shrink-0 h-8 w-8"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* CSV Format Info */}
            {!isCsvUploaded && !isDbCycleSelected && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-xs space-y-1">
                  <p className="font-medium">CSV Format Required:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    <li>Header row: <code className="text-xs bg-background px-1 py-0.5 rounded">Time,Current</code></li>
                    <li>Time values in seconds (numeric)</li>
                    <li>Current values in Amperes (numeric)</li>
                  </ul>
                  <p className="text-muted-foreground mt-1">Example:</p>
                  <pre className="text-xs bg-background p-2 rounded mt-1">
{`Time,Current
0,10
1,15
2,20`}
                  </pre>
                </AlertDescription>
              </Alert>
            )}

            {uploadError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{uploadError}</AlertDescription>
              </Alert>
            )}

            {isCsvUploaded && (
              <p className="text-xs text-muted-foreground">
                ✓ CSV file uploaded successfully
              </p>
            )}
          </div>
        </div>

        {isDbCycleSelected && (
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertDescription className="text-xs">
              CSV upload is disabled while a database cycle is selected. Remove the selection to upload a CSV file.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export { getDriveCyclesFromStorage }
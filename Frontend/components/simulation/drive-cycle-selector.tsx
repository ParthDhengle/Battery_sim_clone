"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      { value: "urban-dynamometer", label: "Urban Dynamometer Cycle", specs: { duration: "1200s", avgSpeed: "32kmh" } },
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

  useEffect(() => {
    setLoading(true)
    getDriveCyclesFromStorage()
      .then(setCycles)
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      console.log(`--- CSV File Content (${file.name}) ---`)
      console.log(content)
      
      // Store CSV content in sessionStorage with the filename as key
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`csv:${file.name}`, content)
      }
      
      onValueChange(file.name)
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">⏳ Loading cycles...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Drive Cycle</label>
        <Select value={value.endsWith(".csv") ? "" : value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a drive cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.value} value={cycle.value}>
                <div className="flex flex-col">
                  <span>{cycle.label}</span>
                  {cycle.specs && (
                    <span className="text-xs text-muted-foreground">
                      {Object.entries(cycle.specs)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="csv-upload" className="text-sm font-medium text-foreground">
          Upload Custom CSV
        </Label>
        <Input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="file:text-primary file:font-medium"
        />
        {value.endsWith(".csv") && <p className="text-sm text-muted-foreground">Selected file: {value}</p>}
      </div>
    </div>
  )
}

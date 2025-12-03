"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"

interface SimulationCycleViewerProps {
  calendarAssignment: any[]
  drivecycles: any[]
  subcycles: any[]
  onSimulationCycleGenerate: (cycle: any[]) => void
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function SimulationCycleViewer({
  calendarAssignment,
  drivecycles,
  subcycles,
  onSimulationCycleGenerate,
}: SimulationCycleViewerProps) {
  const [expanded, setExpanded] = useState<number[]>([])

  const simulationCycle = useMemo(() => {
    return generateSimulationCycle(calendarAssignment, drivecycles, subcycles)
  }, [calendarAssignment, drivecycles, subcycles])

  const toggleExpanded = (dayOfYear: number) => {
    setExpanded((prev) => (prev.includes(dayOfYear) ? prev.filter((d) => d !== dayOfYear) : [...prev, dayOfYear]))
  }

  const handleExport = () => {
    onSimulationCycleGenerate(simulationCycle)
    const json = JSON.stringify(simulationCycle, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "simulation-cycle-table.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (simulationCycle.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 text-center">
          <p className="text-muted-foreground">
            Complete the previous steps (Sub-cycles, Drive Cycles, Calendar Assignment) to generate the Simulation Cycle
            Table.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalSteps = simulationCycle.reduce((sum, day) => sum + (day.steps?.length || 0), 0)
  const totalDuration = simulationCycle.reduce((sum, day) => {
    return sum + (day.steps?.reduce((s: number, step: any) => s + (step.duration || 0), 0) || 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Days Mapped</p>
            <p className="text-2xl font-bold">{simulationCycle.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Steps</p>
            <p className="text-2xl font-bold">{totalSteps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Duration (s)</p>
            <p className="text-2xl font-bold">{totalDuration.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleExport} className="gap-2">
        <Download className="h-4 w-4" />
        Export Simulation Cycle (JSON)
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Cycle Table - First 20 Days Preview</CardTitle>
          <CardDescription>
            Full table with all steps is ready for export. Click rows to expand/collapse step details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {simulationCycle.slice(0, 20).map((day) => (
              <div key={day.dayOfYear} className="border rounded-lg">
                <button
                  onClick={() => toggleExpanded(day.dayOfYear)}
                  className="w-full p-4 text-left hover:bg-secondary/50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      Day {day.dayOfYear} ({DAYS_OF_WEEK[(day.dayOfYear - 1) % 7]}) - {day.drivecycleName}
                    </p>
                    <p className="text-sm text-muted-foreground">{day.steps?.length || 0} steps</p>
                  </div>
                  <span className="text-muted-foreground">{expanded.includes(day.dayOfYear) ? "▼" : "▶"}</span>
                </button>

                {expanded.includes(day.dayOfYear) && day.steps && (
                  <div className="border-t p-4 bg-secondary/20">
                    <div className="overflow-x-auto">
                      <Table className="text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Step Index</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Value</TableHead>
                            <TableHead className="text-xs">Unit</TableHead>
                            <TableHead className="text-xs">Duration (s)</TableHead>
                            <TableHead className="text-xs">Label</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.steps.map((step: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs">{idx + 1}</TableCell>
                              <TableCell className="text-xs">{step.valueType}</TableCell>
                              <TableCell className="text-xs">{step.value}</TableCell>
                              <TableCell className="text-xs">{step.unit}</TableCell>
                              <TableCell className="text-xs">{step.duration || "N/A"}</TableCell>
                              <TableCell className="text-xs">{step.label || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function generateSimulationCycle(calendarAssignment: any[], drivecycles: any[], subcycles: any[]) {
  if (calendarAssignment.length === 0 || drivecycles.length === 0) {
    return []
  }

  const simulationCycle = []

  // Generate 364 days
  for (let dayOfYear = 1; dayOfYear <= 364; dayOfYear++) {
    // Find matching calendar rule (rules are in order, later override earlier)
    let matchedRule = null
    for (const rule of calendarAssignment) {
      const dayOfWeek = (dayOfYear - 1) % 7
      const monthDay = ((dayOfYear - 1) % 30) + 1
      const month = Math.floor((dayOfYear - 1) / 30) + 1

      const monthMatch = rule.months.includes(month)
      let dayMatch = false

      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        dayMatch = rule.daysOfWeek.includes(DAYS_OF_WEEK[dayOfWeek])
      } else if (rule.dates && rule.dates.length > 0) {
        dayMatch = rule.dates.includes(monthDay)
      }

      if (monthMatch && dayMatch) {
        matchedRule = rule
      }
    }

    // Find drive cycle
    const drivecycleId = matchedRule?.drivecycleId || "DC_IDLE"
    const drivecycle = drivecycles.find((dc) => dc.id === drivecycleId)

    if (!drivecycle && drivecycleId !== "DC_IDLE") continue

    // Expand steps
    const steps: any[] = []

    if (drivecycle && drivecycle.composition) {
      for (const compositionRow of drivecycle.composition) {
        const subcycle = subcycles.find((sc) => sc.id === compositionRow.subcycleId)
        if (!subcycle) continue

        // Repeat sub-cycle
        for (let rep = 0; rep < compositionRow.repetitions; rep++) {
          if (subcycle.steps) {
            for (const step of subcycle.steps) {
              steps.push({
                index: steps.length + 1,
                valueType: step.valueType,
                value: step.value,
                unit: step.unit,
                duration: step.duration,                
                stepType: step.stepType,
                triggers: step.triggers,
                label: step.label,
                subcycleId: compositionRow.subcycleId,
                ambientTemp: compositionRow.ambientTemp,
                location: compositionRow.location,
              })
            }
          }
        }
      }
    }

    simulationCycle.push({
      dayOfYear,
      drivecycleId,
      drivecycleName: drivecycle?.name || "Idle",
      notes: matchedRule?.notes || "",
      steps,
    })
  }

  return simulationCycle
}

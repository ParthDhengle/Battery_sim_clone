// components/drivecycle/simulationcycle/simulation-cycle-viewer.tsx
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, ChevronDown, ChevronRight, X } from "lucide-react"

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
  const [showFullTable, setShowFullTable] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const ROWS_PER_PAGE = 100

  const simulationCycle = useMemo(() => {
    return generateSimulationCycle(calendarAssignment, drivecycles, subcycles)
  }, [calendarAssignment, drivecycles, subcycles])

  const toggleExpanded = (dayOfYear: number) => {
    setExpanded(prev =>
      prev.includes(dayOfYear) ? prev.filter(d => d !== dayOfYear) : [...prev, dayOfYear]
    )
  }

  // Flatten all steps once
  const allSteps = useMemo(() => {
    return simulationCycle.flatMap(day =>
      (day.steps || []).map((step: any, index: number) => ({
        ...step,
        dayOfYear: day.dayOfYear,
        drivecycleName: day.drivecycleName,
        globalIndex: index + 1,
      }))
    )
  }, [simulationCycle])

  // Compute totals ONCE
  const totalSteps = allSteps.length
  const totalDuration = allSteps.reduce((sum, step) => sum + (step.duration || 0), 0)

  const totalPages = Math.ceil(totalSteps / ROWS_PER_PAGE)
  const paginatedSteps = allSteps.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  )

  const handleExport = (format: "json" | "csv") => {
    onSimulationCycleGenerate(simulationCycle)
    if (format === "json") {
      const json = JSON.stringify(simulationCycle, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "simulation-cycle.json"
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const csv = generateSimulationCycleCSV(simulationCycle)
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "simulation-cycle.csv"
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (simulationCycle.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 text-center">
          <p className="text-muted-foreground">
            Complete the previous steps to generate the Simulation Cycle Table.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
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
            <p className="text-2xl font-bold">{totalSteps.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Duration</p>
            <p className="text-2xl font-bold">{formatDuration(totalDuration)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export & View Full */}
      <div className="flex gap-3">
        <Button onClick={() => handleExport("json")} className="gap-2">
          <Download className="h-4 w-4" /> Export JSON
        </Button>
        <Button onClick={() => handleExport("csv")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button onClick={() => { setShowFullTable(true); setCurrentPage(1) }} variant="secondary">
          View Full Table ({totalSteps.toLocaleString()} steps)
        </Button>
      </div>

      {/* Preview - First 20 Days */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Cycle Preview - First 20 Days</CardTitle>
          <CardDescription>Click a day to expand steps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {simulationCycle.slice(0, 20).map(day => (
              <div key={day.dayOfYear} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpanded(day.dayOfYear)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      Day {day.dayOfYear} ({DAYS_OF_WEEK[(day.dayOfYear - 1) % 7]}) — {day.drivecycleName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {day.steps?.length || 0} steps • {day.notes || "No notes"}
                    </p>
                  </div>
                  {expanded.includes(day.dayOfYear) ? <ChevronDown /> : <ChevronRight />}
                </button>

                {expanded.includes(day.dayOfYear) && day.steps && (
                  <div className="border-t bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground mb-2">
                      Showing {day.steps.length} steps
                    </div>
                    <div className="text-xs font-mono space-y-1">
                      {day.steps.slice(0, 10).map((s: any, i: number) => (
                        <div key={i}>
                          {i + 1}. {s.valueType} = {s.value} {s.unit} ({s.duration}s)
                        </div>
                      ))}
                      {day.steps.length > 10 && (
                        <div className="text-muted-foreground italic">
                          ... and {day.steps.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Table Modal */}
      {showFullTable && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowFullTable(false)}>
          <div
            className="bg-background rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold">Full Simulation Cycle</h2>
                <p className="text-sm text-muted-foreground">
                  {totalSteps.toLocaleString()} steps • {formatDuration(totalDuration)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowFullTable(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Step</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Drive Cycle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Duration (s)</TableHead>
                      <TableHead>Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSteps.map((step: any, i: number) => (
                      <TableRow key={`${step.dayOfYear}-${i}`}>
                        <TableCell className="font-mono">
                          {(currentPage - 1) * ROWS_PER_PAGE + i + 1}
                        </TableCell>
                        <TableCell>{step.dayOfYear}</TableCell>
                        <TableCell className="text-xs">{step.drivecycleName}</TableCell>
                        <TableCell>{step.valueType}</TableCell>
                        <TableCell>{step.value}</TableCell>
                        <TableCell>{step.unit}</TableCell>
                        <TableCell>{step.duration || "-"}</TableCell>
                        <TableCell className="truncate max-w-32">{step.label || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} • Steps {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, totalSteps)} of {totalSteps}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    First
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                    Last
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper: Format duration
function formatDuration(seconds: number): string {
  const y = Math.floor(seconds / (365 * 86400))
  const d = Math.floor((seconds % (365 * 86400)) / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  return [y && `${y}y`, d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`]
    .filter(Boolean)
    .join(" ") || "0s"
}

// CSV Export
function generateSimulationCycleCSV(simulationCycle: any[]) {
  let csv = "Day of Year,Drive Cycle ID,Drive Cycle Name,Notes,Step Index,Value Type,Value,Unit,Duration (s),Label,Subcycle ID,Ambient Temp,Location\n"
  simulationCycle.forEach(day => {
    const base = `${day.dayOfYear},${day.drivecycleId},"${(day.drivecycleName || "").replace(/"/g, '""')}","${(day.notes || "").replace(/"/g, '""')}"`
    if (day.steps && day.steps.length > 0) {
      day.steps.forEach((step: any, i: number) => {
        csv += `${base},${i + 1},${step.valueType},${step.value},${step.unit},${step.duration || ""},"${(step.label || "").replace(/"/g, '""')}",${step.subcycleId || ""},${step.ambientTemp || ""},${step.location || ""}\n`
      })
    } else {
      csv += `${base},,,,,,,,\n`
    }
  })
  return csv
}

function generateSimulationCycle(calendarAssignment: any[], drivecycles: any[], subcycles: any[]) {
  if (calendarAssignment.length === 0 || drivecycles.length === 0) {
    return []
  }

  // Find default rule
  const defaultRule = calendarAssignment.find(rule => rule.id === 'DEFAULT_RULE')
  const defaultDrivecycleId = defaultRule?.drivecycleId || "DC_IDLE"

  const simulationCycle = []

  // Generate 364 days
  for (let dayOfYear = 1; dayOfYear <= 364; dayOfYear++) {
    // Find matching calendar rule (rules are in order, later override earlier)
    let matchedRule = null
    for (const rule of calendarAssignment) {
      // Skip default rule in matching logic
      if (rule.id === 'DEFAULT_RULE') continue
      
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

    // Use matched rule or default
    const drivecycleId = matchedRule?.drivecycleId || defaultDrivecycleId
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
      drivecycleName: drivecycle?.name || (defaultRule ? defaultRule.drivecycleName : "Idle"),
      notes: matchedRule?.notes || (defaultRule && !matchedRule ? "Default drive cycle" : ""),
      steps,
    })
  }

  return simulationCycle
}
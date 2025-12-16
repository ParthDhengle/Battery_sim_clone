// FILE: Frontend/components/drivecycle/simulationcycle/simulation-cycle-viewer.tsx
"use client"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, ChevronDown, ChevronRight, X } from "lucide-react"
import { generateSimulationTable } from "@/lib/api/drive-cycle"
interface SimulationCycleViewerProps {
  calendarAssignment: any[]
  drivecycles: any[]
  subcycles: any[]
  simId: string
}
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export default function SimulationCycleViewer({
  calendarAssignment,
  drivecycles,
  subcycles,
  simId,
}: SimulationCycleViewerProps) {
  const [expanded, setExpanded] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [csvUrl, setCsvUrl] = useState<string | null>(null)
  const [showFullTable, setShowFullTable] = useState(false)
  const [tableData, setTableData] = useState<any[]>([])
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
  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await generateSimulationTable(simId)
      setCsvUrl(result.path)
      // Removed setStats: properties don't exist in backend response; stats computed client-side
      // Fetch CSV content for preview
      const response = await fetch(result.path)
      const csvText = await response.text()
      const rows = csvText.trim().split("\n").slice(1).map(line => {
        const values = line.match(/(".*?")|([^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"')) || []
        return {
          globalIndex: values[0],
          dayOfYear: values[1],
          drivecycleId: values[2],
          subcycleTriggers: values[3],
          subcycleId: values[4],
          subcycleStepIndex: values[5],
          valueType: values[6],
          value: values[7],
          unit: values[8],
          stepType: values[9],
          duration: values[10],
          timestep: values[11],
          ambientTemp: values[12],
          location: values[13],
          triggers: values[14],
          label: values[15]
        }
      })
      setTableData(rows)
      alert("Simulation table generated successfully!")
    } catch (err) {
      alert("Failed to generate simulation table")
    } finally {
      setLoading(false)
    }
  }
  // Flatten all steps with global index and subcycle step index
  const allSteps = useMemo(() => {
    let globalIndex = 1
    return simulationCycle.flatMap(day => {
      let dayStepIndex = 1
      return (day.steps || []).map((step: any) => {
        const enrichedStep = {
          ...step,
          dayOfYear: day.dayOfYear,
          drivecycleId: day.drivecycleId,
          drivecycleName: day.drivecycleName,
          globalIndex: globalIndex++,
          subcycleStepIndex: dayStepIndex++,
          subcycleTriggers: step.subcycleTriggers || "", 
        }
        return enrichedStep
      })
    })
  }, [simulationCycle])
  const totalSteps = allSteps.length
  const round1 = (value: number) => Math.round(value * 10) / 10

  const totalDuration = round1(
    allSteps.reduce((sum, step) => sum + (step.duration || 0), 0)
  )

  const totalPages = Math.ceil(totalSteps / ROWS_PER_PAGE)
  const paginatedSteps = allSteps.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  )
  const handleExport = (format: "json" | "csv") => {
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
      const csv = generateSimulationCycleCSV(allSteps)
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
            <p className="text-lg sm:text-xl font-bold truncate">{totalDuration} s</p>
          </CardContent>
        </Card>
      </div>
      {/* Export & View Full */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Button onClick={() => handleExport("csv")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button onClick={handleGenerate} disabled={loading} variant="secondary">
          {loading ? "Generating..." : "Generate & Save Table"}
        </Button>
        <Button onClick={() => { setShowFullTable(true); setCurrentPage(1) }} variant="secondary">
          View Full Table
        </Button>
      </div>
      {csvUrl && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Generated File: <a href={csvUrl} className="text-blue-500 underline">{csvUrl}</a></p>
          </CardContent>
        </Card>
      )}
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
      {/* Full Table Modal - Exact column order as requested */}
      {showFullTable && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowFullTable(false)}>
          <div
            className="bg-background rounded-lg shadow-2xl max-w-[95vw] w-full max-h-[90vh] flex flex-col"
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
                      <TableHead>Global Step Index</TableHead>
                      <TableHead>Day_of_year</TableHead>
                      <TableHead>DriveCycle_ID</TableHead>
                      <TableHead>Subcycle Trigger(s)</TableHead>
                      <TableHead>Subcycle_ID</TableHead>
                      <TableHead>Subcycle Step Index</TableHead>
                      <TableHead>Value Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Step Type</TableHead>
                      <TableHead>Step Duration (s)</TableHead>
                      <TableHead>Timestep (s)</TableHead>
                      <TableHead>Ambient Temp (°C)</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>step Trigger(s)</TableHead>
                      <TableHead>Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSteps.map((step: any) => (
                      <TableRow key={`${step.dayOfYear}-${step.globalIndex}`}>
                        <TableCell className="font-mono">{step.globalIndex}</TableCell>
                        <TableCell>{step.dayOfYear}</TableCell>
                        <TableCell>{step.drivecycleId}</TableCell>
                        <TableCell>{step.subcycleTriggers || "-"}</TableCell>
                        <TableCell>{step.subcycleId || "-"}</TableCell>
                        <TableCell>{step.subcycleStepIndex}</TableCell>
                        <TableCell>{step.valueType}</TableCell>
                        <TableCell>{step.value}</TableCell>
                        <TableCell>{step.unit}</TableCell>
                        <TableCell>{step.stepType || "-"}</TableCell>
                        <TableCell>{step.duration ?? "-"}</TableCell>
                        <TableCell>{step.timestep ?? "-"}</TableCell>
                        <TableCell>{step.ambientTemp ?? "-"}</TableCell>
                        <TableCell>{step.location || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {step.triggers?.length > 0
                            ? step.triggers.map((t: any) => `${t.type}:${t.value}`).join("; ")
                            : "-"}
                        </TableCell>
                        <TableCell className="truncate max-w-40">{step.label || "-"}</TableCell>
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
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
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
// Updated CSV Export - EXACT column order and labels
function generateSimulationCycleCSV(steps: any[]) {
  const header = [
    "Global Step Index",
    "Day_of_year",
    "DriveCycle_ID",
    "Subcycle Trigger(s)",
    "Subcycle_ID",
    "Subcycle Step Index",
    "Value Type",
    "Value",
    "Unit",
    "Step Type",
    "Step Duration (s)",
    "Timestep (s)",
    "Ambient Temp (°C)",
    "Location",
    "step Trigger(s)",
    "Label"
  ].join(",")
  const rows = steps.map(step => [
    step.globalIndex,
    step.dayOfYear,
    step.drivecycleId || "",
    step.subcycleTriggers || "",
    step.subcycleId || "",
    step.subcycleStepIndex,
    step.valueType || "",
    step.value || "",
    step.unit || "",
    step.stepType || "",
    step.duration ?? "",
    step.timestep ?? "",
    step.ambientTemp ?? "",
    step.location || "",
    step.triggers?.length > 0
      ? step.triggers.map((t: any) => `${t.type}:${t.value}`).join("; ")
      : "",
    (step.label || "").replace(/"/g, '""')
  ].map(val => `"${val}"`).join(","))
  return [header, ...rows].join("\n")
}
// generateSimulationCycle remains unchanged (already correct) - but update to set subcycleTriggers
function generateSimulationCycle(calendarAssignment: any[], drivecycles: any[], subcycles: any[]) {
  if (calendarAssignment.length === 0 || drivecycles.length === 0) return []
  const defaultRule = calendarAssignment.find(rule => rule.id === 'DEFAULT_RULE')
  const defaultDrivecycleId = defaultRule?.drivecycleId || "DC_IDLE"
  const simulationCycle = []
  for (let dayOfYear = 1; dayOfYear <= 364; dayOfYear++) {
    let matchedRule = null
    for (const rule of calendarAssignment) {
      if (rule.id === 'DEFAULT_RULE') continue
      const dayOfWeek = (dayOfYear - 1) % 7
      const monthDay = ((dayOfYear - 1) % 30) + 1
      const month = Math.floor((dayOfYear - 1) / 30) + 1
      const monthMatch = rule.months.includes(month)
      let dayMatch = false
      if (rule.daysOfWeek?.length > 0) {
        dayMatch = rule.daysOfWeek.includes(DAYS_OF_WEEK[dayOfWeek])
      } else if (rule.dates?.length > 0) {
        dayMatch = rule.dates.includes(monthDay)
      }
      if (monthMatch && dayMatch) {
        matchedRule = rule
        break // later rules override earlier → stop at first match
      }
    }
    const drivecycleId = matchedRule?.drivecycleId || defaultDrivecycleId
    const drivecycle = drivecycles.find((dc: any) => dc.id === drivecycleId)
    if (!drivecycle && drivecycleId !== "DC_IDLE") continue
    const steps: any[] = []
    if (drivecycle && drivecycle.composition) {
      for (const comp of drivecycle.composition) {
        const subcycle = subcycles.find((sc: any) => sc.id === comp.subcycleId)
        if (!subcycle) continue
        const subcycleTriggers = comp.triggers || []
        for (let rep = 0; rep < comp.repetitions; rep++) {
          for (const step of subcycle.steps) {
            steps.push({
              valueType: step.valueType,
              value: step.value,
              unit: step.unit,
              duration: step.duration,
              timestep: step.timestep || "",
              stepType: step.stepType || "",
              triggers: step.triggers || [],
              label: step.label || "",
              subcycleId: comp.subcycleId,
              ambientTemp: comp.ambientTemp,
              location: comp.location || "",
              subcycleTriggers: subcycleTriggers.length > 0
                ? subcycleTriggers.map((t: any) => `${t.type}:${t.value}`).join("; ")
                : "",
            })
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
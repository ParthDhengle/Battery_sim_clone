// Frontend/components/simulation/results-dashboard.tsx
"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { SimulationDataChart } from "./simulation-data-chart"
import { getSimulationData } from "@/lib/api/simulations"
import { SimulationDataResponse } from "@/lib/api/simulations"

interface SimulationDataPoint {
  time: number
  voltage?: number
  current?: number
  soc?: number
  temp?: number
  qgen?: number
  [key: string]: any
}

interface SimulationDataResponseWithSummary extends SimulationDataResponse {
  summary?: {
    end_soc?: number
    max_temp?: number
    capacity_fade?: number
    is_partial?: boolean  // NEW: Added
  }
}

interface ResultsDashboardProps {
  results: {
    summary?: {
      end_soc?: number
      max_temp?: number
      capacity_fade?: number
      is_partial?: boolean  // NEW: Added
    }
    simulation_id?: string
  }
  onPrevious?: () => void
  isRunning: boolean
  progress: number
}

export function ResultsDashboard({ results, onPrevious, isRunning, progress }: ResultsDashboardProps) {
  const [simulationData, setSimulationData] = useState<SimulationDataResponseWithSummary | null>(null)
  const [maxPoints, setMaxPoints] = useState("5000")
  const [timeRange, setTimeRange] = useState("full")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["voltage", "current", "soc", "qgen"])
  const [lastFetchTime, setLastFetchTime] = useState(new Date())  // NEW: Freshness state
  const simulationId = results.simulation_id

  // Calculate summary from simulation data if not provided (use useMemo to avoid setState during render)
  const summary = React.useMemo(() => {
    let sum = results.summary || simulationData?.summary  // NEW: Prefer API summary (fresh)
    if (!sum && simulationData && simulationData.data.length > 0) {  // FIXED: Null check
      const lastPoint = simulationData.data[simulationData.data.length - 1]
      const temps = simulationData.data.map(d => d.temp ?? 0).filter(t => t > 0)
      const maxTemp = temps.length > 0 ? Math.max(...temps) : 25.0 // Fallback to 25 if no/zero temp
      const initialSoc = simulationData.data[0]?.soc ?? 1.0
      const endSoc = lastPoint.soc ?? 0
      sum = {
        end_soc: endSoc,
        max_temp: maxTemp,
        capacity_fade: (1 - endSoc / initialSoc) * 100 // Simple fade estimate
      }
    }
    return sum
  }, [results.summary, simulationData])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("[v0] Fetching simulation data:", {
        simulationId,
        maxPoints,
        timeRange,
      })
      let timeRangeValue: string | undefined = undefined
      if (timeRange !== "full") {
        if (timeRange === "1h") timeRangeValue = "0-3600"
        else if (timeRange === "1d") timeRangeValue = "0-86400"
        else if (timeRange === "1m") timeRangeValue = "0-2592000"
      }
      // Skip fetch if simulationId is invalid or mock
      if (!simulationId || simulationId === "mock-simulation" || simulationId.trim() === "") {
        console.log("[v0] Skipping fetch for invalid simulation ID:", simulationId)
        setError("No valid simulation ID provided")
        setIsLoading(false)
        return
      }
      const data: SimulationDataResponseWithSummary = await getSimulationData(simulationId, {
        time_range: timeRangeValue,
        max_points: parseInt(maxPoints)
      })
      console.log("[v0] Data loaded successfully:", {
        total_points: data.total_points,
        sampled_points: data.sampled_points,
        sampling_ratio: data.sampling_ratio,
      })
      // Fill missing fields with defaults if not present
      data.data = data.data.map(d => ({
        ...d,
        soc: d.soc ?? 1.0,
        temp: d.temp ?? 25.0,
        qgen: d.qgen ?? 0.0,
      }))
      setSimulationData(data)
    } catch (err: any) {
      let errorMsg = err.message || "Failed to load simulation data"
      if (errorMsg.includes("Cell not found")) {
        errorMsg = "Cell not configured for this pack!"
      } else if (errorMsg.includes("Simulation CSV not found")) {
        errorMsg = "Simulation data not ready yet. Please wait."
      }
      console.error("[v0] Error fetching data:", errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
      setLastFetchTime(new Date())  // NEW: Update freshness
    }
  }, [simulationId, maxPoints, timeRange]) // Dependencies for useCallback

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchData]) // Now depends on fetchData

  // Polling for data if running
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setIsLoading(true) // To show loading
      fetchData()
    }, 10000)
    return () => clearInterval(interval)
  }, [isRunning, fetchData]) // Depend on fetchData

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/simulations/${simulationId}/export`, {
        method: "GET",
      })
      if (!response.ok) {
        throw new Error("Failed to export data")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `simulation-${simulationId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("[v0] Export failed:", err)
      setError("Failed to export data")
    }
  }

  const toggleMetric = useCallback((metric: string) => {
    setSelectedMetrics((prev) => (prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]))
  }, [])

  const getAlertVariant = (msg: string) => {
    if (msg.includes("not ready") || msg.includes("No data")) {
      return "default"  // Neutral color
    }
    return "destructive"  // Red for critical errors
  }

  return (
    <div className="space-y-6">
      {/* Progress if running */}
      {isRunning && (
        <Card>
          <CardContent className="pt-6">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm mt-2">
              {progress.toFixed(1)}% • Waiting for first data batch...
            </p>
          </CardContent>
        </Card>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">End SOC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((summary?.end_soc || 0) * 100).toFixed(1)}%
              {summary?.is_partial && <span className="text-xs text-muted-foreground ml-1">(Current)</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">State of Charge</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.max_temp || 25.0).toFixed(1)}°C
              {summary?.is_partial && <span className="text-xs text-muted-foreground ml-1">(Current)</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Peak thermal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity Fade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.capacity_fade || 0).toFixed(2)}%
              {summary?.is_partial && <span className="text-xs text-muted-foreground ml-1">(Current)</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Degradation</p>
          </CardContent>
        </Card>
      </div>
      {/* Data Metadata */}
      {simulationData && (
        <Card className="bg-muted/40">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Points: </span>
                <span className="font-medium">{simulationData.total_points.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sampled: </span>
                <span className="font-medium">{simulationData.sampled_points.toLocaleString()}</span>
              </div>
              <Badge variant="outline">Ratio: 1:{simulationData.sampling_ratio}</Badge>
              <div className="ml-auto text-xs text-muted-foreground">{simulationData.time_range}</div>
              {/* NEW: Data Freshness Badge */}
              <Badge variant="secondary" className="ml-auto">
                Updated {lastFetchTime.toLocaleTimeString()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Error State */}
      {error && (
        <Alert variant={getAlertVariant(error)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Metric Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Display Metrics</CardTitle>
          <CardDescription>Select which metrics to display in the table</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["voltage", "current", "soc", "temp", "qgen"].map((metric) => (
              <Badge
                key={metric}
                variant={selectedMetrics.includes(metric) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleMetric(metric)}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Data Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 bg-muted/20 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Loading simulation data...</p>
          </div>
        </div>
      ) : simulationData && simulationData.data.length > 0 ? (
        <div className="space-y-6">
          <SimulationDataChart
            data={simulationData.data}
            maxPoints={maxPoints}
            timeRange={timeRange}
            onMaxPointsChange={setMaxPoints}
            onTimeRangeChange={setTimeRange}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
          </CardContent>
        </Card>
      )}
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Save Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleExport} variant="outline" className="gap-2 flex-1 sm:flex-none bg-transparent">
              Export CSV
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" className="gap-2 flex-1 sm:flex-none">
              Refresh
            </Button>
            {onPrevious && (
              <Button onClick={onPrevious} variant="outline" className="flex-1 sm:flex-none ml-auto bg-transparent">
                Back
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
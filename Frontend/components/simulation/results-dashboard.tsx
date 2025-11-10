"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SimulationDataChart } from "./simulation-data-chart"

interface SimulationDataPoint {
  time: number
  voltage?: number
  current?: number
  soc?: number
  temp?: number
  qgen?: number
  [key: string]: any
}

interface SimulationDataResponse {
  time_range: string
  total_points: number
  sampled_points: number
  sampling_ratio: number
  data: SimulationDataPoint[]
}

interface ResultsDashboardProps {
  results: {
    summary?: {
      end_soc?: number
      max_temp?: number
      capacity_fade?: number
    }
    simulation_id?: string
  }
  onPrevious?: () => void
}

export function ResultsDashboard({ results, onPrevious }: ResultsDashboardProps) {
  const [simulationData, setSimulationData] = useState<SimulationDataResponse | null>(null)
  const [maxPoints, setMaxPoints] = useState("5000")
  const [timeRange, setTimeRange] = useState("full")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["voltage", "current", "soc", "qgen"])

  const simulationId = results.simulation_id

  // Calculate summary from simulation data if not provided (use useMemo to avoid setState during render)
  const summary = React.useMemo(() => {
    if (results.summary) {
      return results.summary
    }
    if (simulationData && simulationData.data.length > 0) {
      const lastPoint = simulationData.data[simulationData.data.length - 1]
      const temps = simulationData.data.map(d => d.temp ?? 0).filter(t => t > 0)
      const maxTemp = temps.length > 0 ? Math.max(...temps) : 25.0  // Fallback to 25 if no/zero temp
      const initialSoc = simulationData.data[0]?.soc ?? 1.0
      const endSoc = lastPoint.soc ?? 0
      return {
        end_soc: endSoc * 100,
        max_temp: maxTemp,
        capacity_fade: (1 - endSoc / initialSoc) * 100  // Simple fade estimate
      }
    }
    return {
      end_soc: 0,
      max_temp: 25.0,  // Default
      capacity_fade: 0
    }
  }, [results.summary, simulationData])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log("[v0] Fetching simulation data:", {
          simulationId,
          maxPoints,
          timeRange,
        })
        const params = new URLSearchParams({
          max_points: maxPoints,
        })
        if (timeRange !== "full") {
          let timeRangeValue = ""
          if (timeRange === "1h") timeRangeValue = "0-3600"
          else if (timeRange === "1d") timeRangeValue = "0-86400"
          else if (timeRange === "1m") timeRangeValue = "0-2592000"
          if (timeRangeValue) params.append("time_range", timeRangeValue)
        }
        // Skip fetch if simulationId is invalid or mock
        if (!simulationId || simulationId === "mock-simulation" || simulationId.trim() === "") {
          console.log("[v0] Skipping fetch for invalid simulation ID:", simulationId)
          setError("No valid simulation ID provided")
          setIsLoading(false)
          return
        }
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const response = await fetch(`${API_BASE}/simulations/${simulationId}/data?${params}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok && response.status !== 404) {
          const errorText = await response.text()
          console.error("[v0] API error response:", errorText)
          throw new Error(`Failed to fetch data: ${response.statusText} - ${errorText}`)
        }
        if (response.status === 404) {
          console.log("[v0] Using mock data (endpoint not available)")
          const mockData: SimulationDataPoint[] = []
          for (let i = 0; i < Math.min(100, Number.parseInt(maxPoints)); i++) {
            mockData.push({
              time: i * 10,
              voltage: 400 - i * 0.01 + Math.random() * 2,
              current: 50 + Math.sin(i / 100) * 30,
              soc: 1.0 - i * 0.001,
              temp: 25 + i * 0.001 + Math.random() * 2,
              qgen: Math.random() * 10,
            })
          }
          setSimulationData({
            time_range: timeRange === "full" ? "0 to end" : timeRange,
            total_points: Number.parseInt(maxPoints) * 10,
            sampled_points: Number.parseInt(maxPoints),
            sampling_ratio: 10,
            data: mockData,
          })
          return
        }
        const data: SimulationDataResponse = await response.json()
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
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load simulation data"
        console.error("[v0] Error fetching data:", errorMsg)
        setError(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }
    const timer = setTimeout(() => {
      fetchData()
    }, 300)
    return () => clearTimeout(timer)
  }, [simulationId, maxPoints, timeRange])

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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">End SOC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.end_soc || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">State of Charge</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.max_temp || 25.0).toFixed(1)}°C</div>
            <p className="text-xs text-muted-foreground mt-1">Peak thermal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity Fade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.capacity_fade || 0).toFixed(2)}%</div>
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
            </div>
          </CardContent>
        </Card>
      )}
      {/* Error State */}
      {error && (
        <Alert variant="destructive">
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
          <SimulationDataChart data={simulationData.data} />
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
          <CardTitle className="text-sm">Data Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Sample Points</label>
              <Select value={maxPoints} onValueChange={setMaxPoints}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1,000 points</SelectItem>
                  <SelectItem value="5000">5,000 points</SelectItem>
                  <SelectItem value="10000">10,000 points</SelectItem>
                  <SelectItem value="20000">20,000 points</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Range</SelectItem>
                  <SelectItem value="1h">Last 1 Hour</SelectItem>
                  <SelectItem value="1d">Last 1 Day</SelectItem>
                  <SelectItem value="1m">Last 1 Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
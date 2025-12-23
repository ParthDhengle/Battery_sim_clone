// FILE: Frontend/components/simulation/results/results-dashboard.tsx
"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SimulationDataChart } from "./simulation-data-chart"
import { generatePDFReport } from './pdf-report-generator'
import { pauseSimulation, downloadContinuation, resumeSimulation, pollUntilStatus } from "@/lib/api/simulations"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  summary?: {
    end_soc?: number
    max_temp?: number
    capacity_fade?: number
  }
  is_partial?: boolean
  status?: string
  progress?: number
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

interface ReportData {
  simulationId: string
  packInfo: {
    cellDetails: {
      formFactor?: string
      dimensions?: {
        radius?: number
        height?: number
        length?: number
        width?: number
      }
      capacity?: number
      voltage?: {
        max?: number
        min?: number
      }
      mass?: number
    }
    packDetails: {
      electrical: {
        nSeries?: number
        nParallel?: number
        nTotal?: number
        packNominalVoltage?: number
        packCapacity?: number
        packEnergyWh?: number
      }
      mechanical: {
        totalPackWeight?: number
        totalPackVolume?: number
        energyDensityGravimetric?: number
        energyDensityVolumetric?: number
      }
      commercial: {
        totalPackCost?: number
      }
    }
  }
  driveCycleInfo: {
    name?: string
    duration?: number
    frequency?: number
  }
  initialConditions?: any
  simulationResults: {
    summary?: any
    total_points?: number
    data?: SimulationDataPoint[]
  }
}

export function ResultsDashboard({ results, onPrevious }: ResultsDashboardProps) {
  const [simulationData, setSimulationData] = useState<SimulationDataResponse | null>(null)
  const [maxPoints, setMaxPoints] = useState("5000")
  const [timeRange, setTimeRange] = useState("full")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["voltage", "current", "soc", "qgen"])
  const [simulationStatus, setSimulationStatus] = useState<string>("unknown")
  const [progress, setProgress] = useState<number>(0)
  const [isSimulationComplete, setIsSimulationComplete] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [expectedTotalRows, setExpectedTotalRows] = useState<number>(0)
  const [refreshKey, setRefreshKey] = useState(0) // Key to trigger manual refresh
  const [showMessage, setShowMessage] = React.useState(false);
  const simulationId = results.simulation_id

  // Calculate summary from simulation data if not provided
  const summary = React.useMemo(() => {
    // Priority: 1. results.summary, 2. simulationData.summary, 3. calculated from data
    if (results.summary && !simulationData?.is_partial) {
      return results.summary
    }

    // Use live data from simulationData if available
    if (simulationData?.summary && Object.keys(simulationData.summary).length > 0) {
      console.log("📊 Using simulationData.summary:", simulationData.summary)
      return simulationData.summary
    }

    // Calculate from raw data as fallback
    if (simulationData && simulationData.data.length > 0) {
      const lastPoint = simulationData.data[simulationData.data.length - 1]
      const firstPoint = simulationData.data[0]
    
      // Calculate max temp from Qgen
      const maxQgen = Math.max(...simulationData.data.map(d => d.qgen ?? 0))
      const maxTemp = maxQgen * 0.01 + 26.85
    
      const initialSoc = firstPoint?.soc ?? 1.0
      const endSoc = lastPoint.soc ?? 0
      const capacityFade = Math.abs((initialSoc - endSoc) / initialSoc * 100)
    
      const calculated = {
        end_soc: endSoc,
        max_temp: maxTemp,
        capacity_fade: capacityFade
      }
      console.log("🧮 Calculated summary from data:", calculated)
      return calculated
    }

    return {
      end_soc: 0,
      max_temp: 25.0,
      capacity_fade: 0
    }
  }, [results.summary, simulationData])

  // Check simulation status
  const checkStatus = useCallback(async () => {
    if (!simulationId || simulationId === "mock-simulation" || simulationId.trim() === "" || isSimulationComplete) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/simulations/${simulationId}`, {
        cache: "no-store"
      })
      if (response.ok) {
        const data = await response.json()
        setSimulationStatus(data.status)
      
        console.log("📡 Status response:", {
          status: data.status,
          progress: data.metadata?.progress,
          summary: data.metadata?.summary,
          partial_summary: data.metadata?.partial_summary
        })
        if (data.status === "completed" || data.status === "stopped" || data.status === "paused") {
          setIsSimulationComplete(true)
          setProgress(100)
          console.log(` Simulation ${data.status}!`)
        } else if (data.status === "failed") {
          setError(data.error || "Simulation failed")
          setIsSimulationComplete(true)
        }
      }
    } catch (err) {
      console.error("Error checking simulation status:", err)
    }
  }, [simulationId, isSimulationComplete])

  // Poll simulation status every 5 seconds
  useEffect(() => {
    if (!simulationId || simulationId === "mock-simulation" || simulationId.trim() === "" || isSimulationComplete) {
      return
    }
    // Initial check
    checkStatus()
    // Poll every 5 seconds
    const statusInterval = setInterval(checkStatus, 5000)
    return () => clearInterval(statusInterval)
  }, [simulationId, isSimulationComplete, checkStatus])

  // Fetch simulation data
  const fetchData = useCallback(async () => {
    if (!simulationId || simulationId === "mock-simulation" || simulationId.trim() === "") {
      console.log("[v0] Skipping fetch for invalid simulation ID:", simulationId)
      setError("No valid simulation ID provided")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
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
      const response = await fetch(`${API_BASE}/simulations/${simulationId}/data?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      })
      if (response.status === 202) {
        // Data not ready yet, but simulation is running
        console.log("[v0] Data not ready, simulation in progress...")
        return
      }
      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] API error response:", errorText)
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }
      const data: SimulationDataResponse = await response.json()
    
      console.log("📥 Received data:", {
        total_points: data.total_points,
        sampled_points: data.sampled_points,
        summary: data.summary,
        is_partial: data.is_partial,
        status: data.status,
        progress: data.progress
      })
    
      // Fill missing fields with defaults
      data.data = data.data.map(d => ({
        ...d,
        soc: d.soc ?? 1.0,
        temp: d.temp ?? 25.0,
        qgen: d.qgen ?? 0.0,
      }))
      setSimulationData(data)
      setSimulationStatus(data.status || "unknown")
    
      // Calculate progress based on total_points vs expected
      if (expectedTotalRows === 0 && data.total_points > 0) {
        // First time, try to estimate expected total
        // Assuming simulation hasn't completed, this is partial data
        setExpectedTotalRows(data.total_points * 10) // Conservative estimate
      }
    
      if (data.status === "completed") {
        setProgress(100)
        setExpectedTotalRows(data.total_points)
      } else if (expectedTotalRows > 0) {
        const calculatedProgress = Math.min(99, (data.total_points / expectedTotalRows) * 100)
        setProgress(calculatedProgress)
        console.log(`📊 Calculated progress: ${calculatedProgress.toFixed(1)}% (${data.total_points}/${expectedTotalRows} rows)`)
      } else if (data.total_points > 0) {
        // If we don't have expected total, show incremental progress
        const incrementalProgress = Math.min(95, (data.total_points / 100000) * 100)
        setProgress(incrementalProgress)
      }
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : "Failed to load simulation data"
      if (errorMsg.includes("Cell not found")) {
        errorMsg = "Cell not configured for this pack!"
      }
      console.error("[v0] Error fetching data:", errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [simulationId, maxPoints, timeRange, expectedTotalRows])

  // Fetch data periodically while running
  useEffect(() => {
    // Initial fetch
    fetchData()
    // Only continue fetching if simulation is still running
    if (!isSimulationComplete) {
      const dataInterval = setInterval(fetchData, 5000) // Fetch data every 5 seconds
      return () => clearInterval(dataInterval)
    }
  }, [simulationId, maxPoints, timeRange, isSimulationComplete, fetchData, refreshKey])

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered")
    setIsLoading(true)
  
    // Check status first
    await checkStatus()
  
    // Then fetch latest data
    await fetchData()
  
    setRefreshKey(prev => prev + 1)
  }, [checkStatus, fetchData])

  const handleExport = async () => {
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 10000);
    if (!simulationId) {
      setError("No simulation ID available")
      return
    }
    try {
      setError(null)
    
      const response = await fetch(`${API_BASE}/simulations/${simulationId}/export`, {
        method: "GET",
        headers: {
          "Accept": "text/csv",
        },
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to export data: ${response.statusText} - ${errorText}`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
    
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `simulation-${simulationId}.csv`
    
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
    
      a.download = filename
      document.body.appendChild(a)
      a.click()
    
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)
    
      console.log(" Export successful:", filename)
    
    } catch (err) {
      console.error("❌ Export failed:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to export data"
      setError(errorMsg)
    }
  }

  const handleReport = async () => {
    if (!simulationData || !simulationId) {
      setError("No simulation data available");
      return;
    }
    try {
      setError(null);
      // 1. Get simulation (has pack_id, initial_conditions, drive_cycle_name)
      const simRes = await fetch(`${API_BASE}/simulations/${simulationId}`, { cache: "no-store" });
      if (!simRes.ok) throw new Error("Failed to fetch simulation");
      const sim = await simRes.json();
      // 2. Get pack
      const packId = sim.pack_id;
      if (!packId) throw new Error("Pack ID not found in simulation");
      const packRes = await fetch(`${API_BASE}/packs/${packId}`, { cache: "no-store" });
      if (!packRes.ok) throw new Error("Failed to fetch pack");
      const pack = await packRes.json();
      // 3. Get cell
      const cellRes = await fetch(`${API_BASE}/cells/${pack.cell_id}`, { cache: "no-store" });
      if (!cellRes.ok) throw new Error("Failed to fetch cell");
      const cell = await cellRes.json();
      // === CORRECTLY extract initial conditions ===
      const rawInit = sim.initial_conditions || {};
      const defaultConditions = {
        temperature: rawInit.temperature || 300,
        soc: (rawInit.soc || 1.0) * 100, // stored as 0–1 → convert to %
        soh: rawInit.soh || 1.0,
        dcir: rawInit.dcir_aging_factor || 1.0,
      };
      const varyingConditions = (rawInit.varying_conditions || []).map((v: any) => ({
        cellIds: v.cell_ids || [],
        temp: v.temperature || defaultConditions.temperature,
        soc: (v.soc || 1.0) * 100,
        soh: v.soh || 1.0,
        dcir: v.dcir_aging_factor || 1.0,
      }));
      // Build report data
      const reportData: ReportData = {
        simulationId,
        packInfo: {
          cellDetails: {
            formFactor: cell.formFactor || "cylindrical",
            dimensions: {
              radius: cell.radius || 0,
              height: cell.height || 0,
              length: cell.length || 0,
              width: cell.width || 0,
            },
            capacity: cell.capacity || 0,
            voltage: { max: cell.upper_voltage || 4.2, min: cell.lower_voltage || 2.5 },
            mass: cell.m_cell || 0,
          },
          packDetails: {
            electrical: {
              nSeries: pack.r_s || 0,
              nParallel: pack.r_p || 0,
              nTotal: (pack.r_s || 0) * (pack.r_p || 0),
              packNominalVoltage: (pack.r_s || 0) * (cell.nominal_voltage || 3.7),
              packCapacity: (pack.r_p || 0) * (cell.capacity || 0),
              packEnergyWh: (pack.r_s || 0) * (cell.nominal_voltage || 3.7) * (pack.r_p || 0) * (cell.capacity || 0),
            },
            mechanical: {
              totalPackWeight: (pack.r_s || 0) * (pack.r_p || 0) * (cell.m_cell || 0),
              totalPackVolume: 0.001,
              energyDensityGravimetric: 0,
              energyDensityVolumetric: 0,
            },
            commercial: {
              totalPackCost: (pack.r_s || 0) * (pack.r_p || 0) * (pack.cost_per_cell || 0),
            },
          },
        },
        driveCycleInfo: {
          name: sim.drive_cycle_name || sim.drive_cycle_file || "Custom Drive Cycle",
          duration: simulationData.data[simulationData.data.length - 1]?.time || 0,
          frequency: 1,
        },
        initialConditions: {
          default: defaultConditions,
          varying: varyingConditions.length > 0 ? varyingConditions : undefined,
        },
        simulationResults: {
          summary,
          total_points: simulationData.total_points,
          data: simulationData.data,
        },
      };
      await generatePDFReport(reportData);
    } catch (err: any) {
      console.error("PDF Generation Error:", err);
      setError(err.message || "Failed to generate PDF report");
    }
  };

  // UPDATED: handlePause
  const handlePause = async () => {
    if (!simulationId) return;
    setIsPausing(true);
    try {
      await pauseSimulation(simulationId);
      // Poll until paused
      await pollUntilStatus(simulationId, "paused");
      setSimulationStatus("paused");
      setProgress(0);  // Reset or keep partial
    } catch (err) {
      setError("Failed to pause: " + (err as Error).message);
    } finally {
      setIsPausing(false);
    }
  };

  // UPDATED: handleResume
  const handleResume = async () => {
    if (!simulationId) return;
    try {
      await resumeSimulation(simulationId);  // Auto, no ZIP
      // Poll until running
      await pollUntilStatus(simulationId, "running");
      setSimulationStatus("running");
      setIsSimulationComplete(false);
    } catch (err) {
      setError("Failed to resume: " + (err as Error).message);
    }
  };

  // UPDATED: Download Continuation ZIP
  const handleDownloadContinuation = async () => {
    try {
      const blob = await downloadContinuation(simulationId!)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `continuation-${simulationId}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError("Failed to download ZIP")
    }
  }

  const toggleMetric = useCallback((metric: string) => {
    setSelectedMetrics((prev) => (prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]))
  }, [])

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      {!isSimulationComplete && (simulationStatus === "running" || simulationStatus === "pending") && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="animate-pulse">⚡</span>
              Simulation in Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time data is being streamed. Charts will update automatically every 20 seconds.
            </p>
          </CardContent>
        </Card>
      )}
      {/* Paused Indicator */}
      {simulationStatus === "paused" && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              ⏸️ Simulation Paused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Simulation is paused. Use Resume to continue or download continuation ZIP.
            </p>
          </CardContent>
        </Card>
      )}
      {/* Stopped Indicator */}
      {simulationStatus === "stopped" && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              🛑 Simulation Stopped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Simulation was stopped manually. Partial results are available below.
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
            <div className="text-2xl font-bold">{((summary.end_soc || 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {simulationStatus === "stopped" ? "Partial" : simulationData?.is_partial ? "Current" : "Final"} State of Charge
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.max_temp || 25.0).toFixed(1)}°C</div>
            <p className="text-xs text-muted-foreground mt-1">
              {simulationStatus === "stopped" ? "Partial" : simulationData?.is_partial ? "Current" : "Peak"} thermal reading
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity Fade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.capacity_fade || 0).toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {simulationStatus === "stopped" ? "Partial" : simulationData?.is_partial ? "Current" : "Total"} degradation
            </p>
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
              {simulationData.is_partial && (
                <Badge variant="secondary" className="animate-pulse">Live Data</Badge>
              )}
              {simulationStatus === "stopped" && (
                <Badge variant="outline" className="border-orange-500 text-orange-500">Partially Completed</Badge>
              )}
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
      {/* Data Chart */}
      {isLoading && !simulationData ? (
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
            <p className="text-sm text-muted-foreground text-center py-8">
              {simulationStatus === "running" ? "Waiting for simulation data..." : "No data available"}
            </p>
          </CardContent>
        </Card>
      )}
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none bg-transparent"
              disabled={simulationStatus === "running" || !simulationData}
              title={simulationStatus === "paused" ? "Partial data only" : undefined}
            >
              📥 Export CSV {simulationStatus === "paused" && "(Partial)"}
            </Button>
            <Button
              onClick={handleReport}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none bg-transparent"
              disabled={!isSimulationComplete && simulationStatus !== "stopped" && simulationStatus !== "paused"}
            >
              📋 Download Report
            </Button>
            {/* UPDATED: ZIP Download */}
            <Button
              onClick={handleDownloadContinuation}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
              disabled={simulationStatus !== "paused"}
            >
              💾 Download Continuation ZIP
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
              disabled={isLoading}
            >
              {isLoading ? "⏳ Refreshing..." : "🔄 Refresh"}
            </Button>
            {/* UPDATED: Pause instead of Stop */}
            {!isSimulationComplete && (simulationStatus === "running" || simulationStatus === "pending") && (
              <Button
                onClick={handlePause}
                variant="secondary"
                className="gap-2 flex-1 sm:flex-none ml-auto"
                disabled={isPausing}
              >
                {isPausing ? "⏳ Pausing..." : "⏸️ Pause Simulation"}
              </Button>
            )}
            {/* NEW: Resume for Paused */}
            {simulationStatus === "paused" && (
              <Button
                onClick={handleResume}
                variant="default"
                className="gap-2 flex-1 sm:flex-none ml-auto"
              >
                ▶️ Resume
              </Button>
            )}
            {onPrevious && (isSimulationComplete || simulationStatus === "stopped" || simulationStatus === "paused") && (
              <Button onClick={onPrevious} variant="outline" className="flex-1 sm:flex-none ml-auto bg-transparent">
                ← Back
              </Button>
            )}
          </div>
        {showMessage && (
          <p
            onClick={handleExport}
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition"
            role="button"
          >
            Your file will start downloading within few minutes, please be patient
          </p>
        )}
        </CardContent>
      </Card>
    </div>
  )
}
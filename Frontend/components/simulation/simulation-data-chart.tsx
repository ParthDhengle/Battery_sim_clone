"use client"
import React, { useState, useRef, useMemo, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from "recharts"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface SimulationDataPoint {
  time: number
  voltage?: number
  current?: number
  soc?: number
  qgen?: number
  temp?: number
}

interface SimulationDataChartProps {
  data: SimulationDataPoint[]
  maxPoints: string
  timeRange: string
  onMaxPointsChange: (value: string) => void
  onTimeRangeChange: (value: string) => void
}

type SingleConfig = {
  label: string
  key: keyof SimulationDataPoint
  color: string
  unit: string
}

type CombinedConfig = {
  label: string
  keys: (keyof SimulationDataPoint)[]
  colors: string[]
  units: string[]
  names: string[]
}

export function SimulationDataChart({
  data,
  maxPoints,
  timeRange,
  onMaxPointsChange,
  onTimeRangeChange,
}: SimulationDataChartProps) {
  const [activeTab, setActiveTab] = useState("voltage_current")
  const [zoomDomains, setZoomDomains] = useState<Record<string, { min: number; max: number } | null>>({
    voltage_current: null,
    soc: null,
    qgen: null,
  })
  const [refAreaLeft, setRefAreaLeft] = useState<Record<string, number | null>>({
    voltage_current: null,
    soc: null,
    qgen: null,
  })
  const [refAreaRight, setRefAreaRight] = useState<Record<string, number | null>>({
    voltage_current: null,
    soc: null,
    qgen: null,
  })
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null)
  const [initialZoomDomain, setInitialZoomDomain] = useState<{ min: number; max: number } | null>(null)
  const [pinchFraction, setPinchFraction] = useState<number | null>(null)
  const [activePinchKey, setActivePinchKey] = useState<string | null>(null)

  const { minTime, maxTime } = useMemo(() => {
    if (data.length === 0) return { minTime: 0, maxTime: 0 }
    const times = data.map((d) => d.time)
    return { minTime: Math.min(...times), maxTime: Math.max(...times) }
  }, [data])

  const getDistance = (touch1: { clientX: number; clientY: number }, touch2: { clientX: number; clientY: number }) => {
    return Math.sqrt(
      (touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2
    )
  }

  const handleMouseDown = (key: string) => (e: any) => {
    setRefAreaLeft((prev) => ({ ...prev, [key]: e?.activeLabel ?? 0 }))
  }

  const handleMouseMove = (key: string) => (e: any) => {
    const left = refAreaLeft[key]
    if (left !== null) {
      setRefAreaRight((prev) => ({ ...prev, [key]: e?.activeLabel ?? 0 }))
    }
  }

  const handleMouseUp = (key: string) => () => {
    const left = refAreaLeft[key]
    const right = refAreaRight[key]
    if (left !== null && right !== null) {
      const min = Math.min(left, right)
      const max = Math.max(left, right)
      setZoomDomains((prev) => ({ ...prev, [key]: { min, max } }))
    }
    setRefAreaLeft((prev) => ({ ...prev, [key]: null }))
    setRefAreaRight((prev) => ({ ...prev, [key]: null }))
  }

  const handleTouchStart = (key: string) => (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dist = getDistance(e.touches[0], e.touches[1])
      setInitialPinchDistance(dist)
      setInitialZoomDomain(zoomDomains[key] || { min: minTime, max: maxTime })
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const target = e.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const x = centerX - rect.left
      const fraction = x / rect.width
      setPinchFraction(fraction)
      setActivePinchKey(key)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && initialPinchDistance && pinchFraction !== null && initialZoomDomain && activePinchKey) {
      const currentDist = getDistance(e.touches[0], e.touches[1])
      const zoomAmount = initialPinchDistance / currentDist
      const range = initialZoomDomain.max - initialZoomDomain.min
      const newRange = range * zoomAmount
      const delta = newRange - range
      const addLeft = delta * pinchFraction
      const addRight = delta * (1 - pinchFraction)
      let newMin = initialZoomDomain.min - addLeft
      let newMax = initialZoomDomain.max + addRight
      if (newMin < minTime) newMin = minTime
      if (newMax > maxTime) newMax = maxTime
      if (newMin >= newMax) return
      setZoomDomains((prev) => ({ ...prev, [activePinchKey]: { min: newMin, max: newMax } }))
    }
  }

  const handleTouchEnd = () => {
    setInitialPinchDistance(null)
    setInitialZoomDomain(null)
    setPinchFraction(null)
    setActivePinchKey(null)
  }

  const ChartWrapper = ({ chartKey, children }: { chartKey: string; children: React.ReactNode }) => {
    const chartRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const ref = chartRef.current
      if (!ref) return

      const handler = (e: WheelEvent) => {
        e.preventDefault()
        const rect = ref.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width
        if (x < 0 || x > width) return
        const fraction = x / width

        setZoomDomains((prev) => {
          const currentDomain = prev[chartKey] || { min: minTime, max: maxTime }
          const range = currentDomain.max - currentDomain.min
          const zoomAmount = e.deltaY < 0 ? 0.9 : 1.1
          const newRange = range * zoomAmount
          const delta = newRange - range
          const addLeft = delta * fraction
          const addRight = delta * (1 - fraction)
          let newMin = currentDomain.min - addLeft
          let newMax = currentDomain.max + addRight
          if (newMin < minTime) newMin = minTime
          if (newMax > maxTime) newMax = maxTime
          if (newMin >= newMax) return prev
          return { ...prev, [chartKey]: { min: newMin, max: newMax } }
        })
      }

      ref.addEventListener("wheel", handler, { passive: false })

      return () => {
        ref.removeEventListener("wheel", handler)
      }
    }, [chartKey, minTime, maxTime])

    return (
      <div
        ref={chartRef}
        onTouchStart={handleTouchStart(chartKey)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ width: "100%", height: 380, touchAction: "none" }}
      >
        {children}
      </div>
    )
  }

  const metricConfig: Record<string, SingleConfig | CombinedConfig> = {
    voltage_current: {
      label: "Voltage & Current vs Time",
      keys: ["voltage", "current"],
      colors: ["#2563eb", "#16a34a"],
      units: ["V", "A"],
      names: ["Voltage", "Current"],
    },
    soc: { label: "SOC vs Time", key: "soc", color: "#f59e0b", unit: "%" },
    qgen: { label: "Heat Generation vs Time", key: "qgen", color: "#ef4444", unit: "W" },
  }

  const renderChart = (key: keyof typeof metricConfig) => {
    const config = metricConfig[key]
    const currentZoom = zoomDomains[key]
    const left = refAreaLeft[key]
    const right = refAreaRight[key]
    let xDomain: [number | string, number | string] = ["dataMin", "dataMax"]

    if ("keys" in config) {
      // Combined config
      const formattedData = data.map((d) => ({
        time: d.time,
        value1: d[config.keys[0]] ?? 0,
        value2: d[config.keys[1]] ?? 0,
      }))
      let chartData = formattedData
      if (currentZoom) {
        chartData = formattedData.filter(
          (d) => d.time >= currentZoom.min && d.time <= currentZoom.max
        )
        xDomain = [currentZoom.min, currentZoom.max]
      }

      return (
        <ChartWrapper chartKey={key}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseDown={handleMouseDown(key)}
              onMouseMove={handleMouseMove(key)}
              onMouseUp={handleMouseUp(key)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                domain={xDomain}
                allowDataOverflow={true}
                type="number"
                label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                domain={["auto", "auto"]}
                label={{
                  value: config.units[0],
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={["auto", "auto"]}
                label={{
                  value: config.units[1],
                  angle: 90,
                  position: "insideRight",
                  offset: 0,
                }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  border: "1px solid #ddd",
                  fontSize: "12px",
                }}
                formatter={(value: any, name: string) => [`${value.toFixed(2)} ${name === config.names[0] ? config.units[0] : config.units[1]}`, name]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="value1"
                stroke={config.colors[0]}
                strokeWidth={2}
                dot={false}
                name={config.names[0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="value2"
                stroke={config.colors[1]}
                strokeWidth={2}
                dot={false}
                name={config.names[1]}
                isAnimationActive={false}
              />
              {left !== null && right !== null && (
                <ReferenceArea x1={left} x2={right} strokeOpacity={0.3} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )
    } else {
      // Single config
      const formattedData = data.map((d) => ({
        time: d.time,
        value:
          config.key === "soc"
            ? (d[config.key] ?? 0) * 100 // convert SOC to %
            : d[config.key] ?? 0,
      }))
      let chartData = formattedData
      if (currentZoom) {
        chartData = formattedData.filter(
          (d) => d.time >= currentZoom.min && d.time <= currentZoom.max
        )
        xDomain = [currentZoom.min, currentZoom.max]
      }

      return (
        <ChartWrapper chartKey={key}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseDown={handleMouseDown(key)}
              onMouseMove={handleMouseMove(key)}
              onMouseUp={handleMouseUp(key)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                domain={xDomain}
                allowDataOverflow={true}
                type="number"
                label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                label={{
                  value: config.unit,
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  border: "1px solid #ddd",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`${value.toFixed(2)} ${config.unit}`, config.label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                name={config.label}
                isAnimationActive={false}
              />
              {left !== null && right !== null && (
                <ReferenceArea x1={left} x2={right} strokeOpacity={0.3} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )
    }
  }

  const handleResetZoom = () => {
    setZoomDomains((prev) => ({ ...prev, [activeTab]: null }))
  }

  return (
    <div>
      

    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Simulation Plots</CardTitle>
        <CardDescription>
          View different simulation parameters over time.
        </CardDescription>
      </CardHeader>
      
      
      <CardContent className="space-y-6">
        {/* Data Controls - Beautifully arranged in a subtle bordered section */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div className="text-xs font-medium uppercase text-muted-foreground mb-3 tracking-wider">
              Data Filters
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Max Sample Points</label>
                <Select value={maxPoints} onValueChange={onMaxPointsChange}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Time Range</label>
                <Select value={timeRange} onValueChange={onTimeRangeChange}>
                  <SelectTrigger className="h-9">
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
          </div>


        <Tabs
          defaultValue="voltage_current"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="voltage_current">Voltage & Current</TabsTrigger>
            <TabsTrigger value="soc">SOC</TabsTrigger>
            <TabsTrigger value="qgen">Heat</TabsTrigger>
            <Button variant="outline" size="sm" onClick={handleResetZoom}>
              Reset Zoom
            </Button>
          </TabsList>

          {Object.keys(metricConfig).map((key) => (
            <TabsContent key={key} value={key}>
              {data && data.length > 0 ? (
                renderChart(key as keyof typeof metricConfig)
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  No data available for {metricConfig[key].label}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
    </div>
    
  )
}
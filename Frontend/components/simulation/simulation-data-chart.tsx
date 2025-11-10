"use client"
import React, { useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
}

export function SimulationDataChart({ data }: SimulationDataChartProps) {
  const [activeTab, setActiveTab] = useState("voltage")

  const metricConfig: Record<
    string,
    { label: string; key: keyof SimulationDataPoint; color: string; unit: string }
  > = {
    voltage: { label: "Voltage vs Time", key: "voltage", color: "#2563eb", unit: "V" },
    soc: { label: "SOC vs Time", key: "soc", color: "#f59e0b", unit: "%" },
    current: { label: "Current vs Time", key: "current", color: "#16a34a", unit: "A" },
    qgen: { label: "Heat Generation vs Time", key: "qgen", color: "#ef4444", unit: "W" },
  }

  const renderChart = (key: keyof typeof metricConfig) => {
    const config = metricConfig[key]
    const formattedData = data.map((d) => ({
      time: d.time,
      value:
        config.key === "soc"
          ? (d[config.key] ?? 0) * 100 // convert SOC to %
          : d[config.key] ?? 0,
    }))

    return (
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
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
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Simulation Plots</CardTitle>
        <CardDescription>
          View different simulation parameters over time
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs
          defaultValue="voltage"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="voltage">Voltage</TabsTrigger>
            <TabsTrigger value="soc">SOC</TabsTrigger>
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="qgen">Heat</TabsTrigger>
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
  )
}

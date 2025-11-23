// Updated: Frontend/components/simulation/drive-cycle-preview.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { getDriveCycleData } from "./SimulationStepper"

interface DriveCyclePreviewProps {
  cycleId: string
}

export function DriveCyclePreview({ cycleId }: DriveCyclePreviewProps) {
  const [data, setData] = useState<{ time: number; current: number }[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)
    setData(null)

    getDriveCycleData(cycleId)
      .then((result: { time: number[]; current: number[] } | null) => {
        if (!isMounted) return
        if (!result || result.time.length < 2) {
          setError("No valid data available for preview.")
          setData(null)
        } else {
          const chartData = result.time.map((t: number, i: number) => ({
            time: t,
            current: result.current[i],
          }))
          setData(chartData)
        }
        setLoading(false)
      })
      .catch((err: Error) => {
        if (!isMounted) return
        setError("Failed to load drive cycle preview.")
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [cycleId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading Drive Cycle Preview...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Drive Cycle Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error || "No preview available."}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Drive Cycle Preview: Time vs Current</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              label={{ value: "Time (s)", position: "inner", offset: -5 }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="current"
              label={{ value: "Current (A)", angle: -90, position: "insideLeft" }}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(value) => `Time: ${value}s`}
              formatter={(value, name) => [value, name === "current" ? "Current (A)" : ""]}
            />
            <Legend />
            <Line type="monotone" dataKey="current" stroke="#8884d8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
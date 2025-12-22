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
import { getDriveCycleData } from "@/components/simulation/flow/SimulationStepper"

interface DriveCyclePreviewProps {
  cycleId?: string
  csvData?: { time: number[]; current: number[] }
}

async function parseCsvFile(cycleId: string): Promise<{ time: number[]; current: number[] } | null> {
  try {
    // This is now handled in getDriveCycleData
    return await getDriveCycleData(cycleId)
  } catch (err) {
    console.error('Error parsing CSV file:', err)
    return null
  }
}

export function DriveCyclePreview({ cycleId, csvData }: DriveCyclePreviewProps) {
  const [data, setData] = useState<{ time: number; current: number }[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)
    setData(null)

    // If CSV data is provided directly, use it
    if (csvData) {
      try {
        if (!csvData.time || !csvData.current || csvData.time.length < 2) {
          setError("No valid data available for preview.")
          setData(null)
        } else {
          const chartData = csvData.time.map((t: number, i: number) => ({
            time: t,
            current: csvData.current[i],
          }))
          setData(chartData)
        }
        setLoading(false)
      } catch (err) {
        if (isMounted) {
          setError("Failed to process CSV data.")
          setLoading(false)
        }
      }
      return
    }

    // Otherwise, parse from cycleId (either CSV file or DB)
    if (cycleId) {
      parseCsvFile(cycleId)
        .then((result) => {
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
          console.error('Preview error:', err)
          setError("Failed to load drive cycle preview.")
          setLoading(false)
        })
    } else {
      setError("No data source provided.")
      setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [cycleId, csvData])

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
        <CardTitle className="text-sm">
          Drive Cycle Preview: Time vs Current ({data.length} points)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              label={{ value: "Time (s)", position: "insideBottom", offset: -5 }}
              allowDecimals={true}
            />
            <YAxis
              dataKey="current"
              label={{ value: "Current (A)", angle: -90, position: "insideLeft" }}
              allowDecimals={true}
            />
            <Tooltip
              labelFormatter={(value) => `Time: ${value}s`}
              formatter={(value: any) => [`${value.toFixed(2)} A`, "Current"]}
            />
            <Legend 
              verticalAlign="top" 
              align="right"
              wrapperStyle={{ paddingBottom: "10px" }}
            />
            <Line 
              type="monotone" 
              dataKey="current" 
              stroke="#8884d8" 
              strokeWidth={2} 
              dot={false}
              name="Current (A)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
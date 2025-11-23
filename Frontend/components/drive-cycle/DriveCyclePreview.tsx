// DriveCyclePreview.tsx
"use client"

import React, { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download,Upload  } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { parseISO, addDays, format, differenceInDays } from "date-fns"

interface DriveCyclePreviewProps {
  config: any
  nominalV?: number
  capacity?: number
}

export function DriveCyclePreview({
  config,
  nominalV = 3.7,
  capacity = 5.0,
}: DriveCyclePreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('day')
  const [selectedPeriod, setSelectedPeriod] = useState(0)

  const startDate = useMemo(() => config.startDate ? parseISO(config.startDate) : null, [config.startDate])
  const endDate = useMemo(() => config.endDate ? parseISO(config.endDate) : null, [config.endDate])
  const totalDays = useMemo(() => startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0, [startDate, endDate])

  useEffect(() => {
    setSelectedPeriod(0)
  }, [filterType])

  const { timeArr, currentArr, warnings } = useMemo(() => {
    setIsGenerating(true)
    try {
      if (!config.startDate || !config.endDate) {
        setIsGenerating(false)
        return { timeArr: [], currentArr: [], warnings: ["Missing startDate or endDate in config."] }
      }
      const startDate = parseISO(config.startDate)
      const endDate = parseISO(config.endDate)
      const totalDays = differenceInDays(endDate, startDate) + 1
      const subCycles: { [key: string]: any } = {}
      config.subCycles?.forEach((sc: any) => {
        subCycles[sc.id] = sc
      })
      const driveCycles: { [key: string]: any } = {}
      config.driveCycles?.forEach((dc: any) => {
        driveCycles[dc.id] = dc
      })
      const rules = config.calendarRules || []
      const defaultDcId = config.defaultDriveCycleId || Object.keys(driveCycles)[0] || ""

      let globalTime = 0.0
      const timeArrLocal: number[] = [0.0]
      const currentArrLocal: number[] = [0.0]
      let warnedSkippedV = false
      let warnedUnknownUnit = false
      const localWarnings: string[] = []

      for (let day = 0; day < totalDays; day++) {
        const currentDate = addDays(startDate, day)
        const month = currentDate.getMonth() + 1
        const weekday = format(currentDate, "EEE") // e.g., "Mon"
        const dateDay = currentDate.getDate()
        const dayStartTime = globalTime

        let matchingDcId = defaultDcId
        for (const rule of rules) {
          const months = rule.months.split(",").map((m: string) => parseInt(m.trim()))
          if (!months.includes(month)) continue
          const daysOrDatesRaw = rule.daysOrDates.split(",").map((d: string) =>
            d.trim().toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
          )
          if (rule.filterType === "weekday") {
            if (daysOrDatesRaw.includes(weekday)) {
              matchingDcId = rule.driveCycleId.trim()
              break
            }
          } else if (rule.filterType === "date") {
            const dates = daysOrDatesRaw
              .filter((d: string) => !isNaN(parseInt(d)))
              .map((d: string) => parseInt(d))
            if (dates.includes(dateDay)) {
              matchingDcId = rule.driveCycleId.trim()
              break
            }
          }
        }

        const dc = driveCycles[matchingDcId]
        if (!dc) {
          localWarnings.push(`No DC for day ${format(currentDate, "yyyy-MM-dd")}, skipping.`)
          // Still advance time for idle day
          globalTime += 86400
          timeArrLocal.push(globalTime)
          currentArrLocal.push(0.0)
          continue
        }

        for (const segment of dc.segments) {
          const sub = subCycles[segment.subCycleId]
          if (!sub) continue
          for (let rep = 0; rep < segment.repetitions; rep++) {
            for (const step of sub.steps) {
              const unit = step.unit
              const value = parseFloat(step.value)
              const duration = step.duration
              const repetitions = step.repetitions || 1
              const totalDuration = duration * repetitions
              if (totalDuration === 0) continue

              let I: number | undefined
              if (unit === "A") {
                I = value
              } else if (unit === "W") {
                I = value / nominalV
              } else if (unit === "C") {
                I = value * capacity
              } else if (unit === "V") {
                if (!warnedSkippedV) {
                  localWarnings.push("Skipping constant V step (not supported).")
                  warnedSkippedV = true
                }
                continue
              } else {
                if (!warnedUnknownUnit) {
                  localWarnings.push(`Unknown unit ${unit}, skipping.`)
                  warnedUnknownUnit = true
                }
                continue
              }

              if (!I) continue

              if (step.isDynamic) {
                const dynamicDt = 0.1
                const numSmallSteps = Math.floor(totalDuration / dynamicDt)
                for (let s = 0; s < numSmallSteps; s++) {
                  globalTime += dynamicDt
                  timeArrLocal.push(globalTime)
                  currentArrLocal.push(I)
                }
                const remainder = totalDuration % dynamicDt
                if (remainder > 0) {
                  globalTime += remainder
                  timeArrLocal.push(globalTime)
                  currentArrLocal.push(I)
                }
              } else {
                globalTime += totalDuration
                timeArrLocal.push(globalTime)
                currentArrLocal.push(I)
              }
            }
          }
        }

        const dayEndTime = dayStartTime + 86400
        const idleDuration = dayEndTime - globalTime
        if (idleDuration > 0) {
          globalTime += idleDuration
          timeArrLocal.push(globalTime)
          currentArrLocal.push(0.0)
        }
      }

      // Limit to ~52k points for performance (as in Python)
      const maxPoints = 52000
      const timeArrSliced = timeArrLocal.slice(0, maxPoints)
      const currentArrSliced = currentArrLocal.slice(0, maxPoints)

      setIsGenerating(false)
      return { timeArr: timeArrSliced, currentArr: currentArrSliced, warnings: localWarnings }
    } catch (error) {
      console.error("Error generating drive cycle:", error)
      setIsGenerating(false)
      return { timeArr: [], currentArr: [], warnings: ["Failed to generate drive cycle data."] }
    }
  }, [config, nominalV, capacity, startDate, endDate, totalDays])

  const periods = useMemo(() => {
    if (!startDate || totalDays === 0) return []

    const getKey = (date: Date): string => {
      switch (filterType) {
        case 'day':
          return format(date, 'yyyy-MM-dd')
        case 'month':
          return `${date.getFullYear()}-${date.getMonth() + 1}`
        case 'year':
          return date.getFullYear().toString()
        default:
          return ''
      }
    }

    const getLabel = (date: Date): string => {
      switch (filterType) {
        case 'day':
          return format(date, 'MMM dd, yyyy')
        case 'month':
          return format(date, 'MMM yyyy')
        case 'year':
          return format(date, 'yyyy')
        default:
          return ''
      }
    }

    const periods: { label: string; startTime: number; endTime: number }[] = []
    let i = 0
    let currentStartIdx = 0
    const firstDate = addDays(startDate, 0)
    let currentKey = getKey(firstDate)

    while (i < totalDays) {
      const date = addDays(startDate, i)
      const key = getKey(date)
      if (key !== currentKey) {
        const periodFirstDate = addDays(startDate, currentStartIdx)
        periods.push({
          label: getLabel(periodFirstDate),
          startTime: currentStartIdx * 86400,
          endTime: i * 86400,
        })
        currentStartIdx = i
        currentKey = key
      }
      i++
    }

    // Push the last period
    const periodFirstDate = addDays(startDate, currentStartIdx)
    periods.push({
      label: getLabel(periodFirstDate),
      startTime: currentStartIdx * 86400,
      endTime: totalDays * 86400,
    })

    return periods
  }, [filterType, startDate, totalDays])

  const filtered = useMemo(() => {
    const p = periods[selectedPeriod]
    if (!p || timeArr.length === 0) {
      return { time: [], current: [] }
    }
    const { startTime, endTime } = p
    const ftime: number[] = []
    const fcurrent: number[] = []
    for (let j = 0; j < timeArr.length; j++) {
      if (timeArr[j] >= startTime && timeArr[j] < endTime) {
        ftime.push(timeArr[j] - startTime)
        fcurrent.push(currentArr[j])
      }
    }
    return { time: ftime, current: fcurrent }
  }, [periods, selectedPeriod, timeArr, currentArr])

  const chartData = useMemo(
    () =>
      filtered.time.map((time, index) => ({
        time,
        current: filtered.current[index],
      })),
    [filtered.time, filtered.current]
  )

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "drive_cycle_rules.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadCSV = () => {
    if (timeArr.length === 0) return
    const csvContent = "Time,Current\n" + timeArr.map((t, i) => `${t},${currentArr[i]}`).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "drive_cycle_dataframe.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drive Cycle Preview</CardTitle>
          <CardDescription>Preview the generated drive cycle for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">No data to preview. Please ensure config is valid.</p>
        </CardContent>
      </Card>
    )
  }

  const selectedLabel = periods[selectedPeriod]?.label || 'selected period'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Drive Cycle Preview
          
        </CardTitle>
        <CardDescription>
          Generated current vs. time for {selectedLabel}. Limited to 52,000 points for performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Preview:</Label>
          <Select value={filterType} onValueChange={(value: 'day' | 'month' | 'year') => setFilterType(value)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedPeriod.toString()}
            onValueChange={(value: string) => setSelectedPeriod(Number(value))}
            disabled={periods.length === 0}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={`Select a ${filterType}`} />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((warning, index) => (
              <p key={index} className="text-sm text-yellow-600">
                ⚠️ {warning}
              </p>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              label={{ value: "Time (s)", position: "insideBottom", offset: -10 }}
            />
            <YAxis
              dataKey="current"
              label={{ value: "Current (A)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              labelFormatter={(value) => `Time: ${value.toFixed(1)} s`}
              formatter={(value) => [value, "Current"]}
            />
            <Line type="monotone" dataKey="current" stroke="#8884d8" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadJSON} disabled={isGenerating}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Rules To DB
            </Button>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadJSON} disabled={isGenerating}>
              <Download className="w-4 h-4 mr-2" />
              Download Rules (JSON)
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCSV} disabled={isGenerating || timeArr.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Download Data (CSV)
            </Button>
        </div>
          
      </CardContent>
    </Card>
  )
}
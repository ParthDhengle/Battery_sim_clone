import { Step, Subcycle } from "./types"

export const calculateTotalDuration = (steps: Step[]) =>
  steps.reduce((sum, s) => sum + s.duration * s.repetitions, 0)

export const getStepCount = (subcycle: Subcycle): number => 
  subcycle.num_steps ?? subcycle.steps.length

export const getTotalDuration = (subcycle: Subcycle): number => 
  subcycle.total_duration ?? calculateTotalDuration(subcycle.steps)

export const convertSecondsToHMS = (totalSeconds: number | string): string => {
  const numSeconds = Number(totalSeconds)
  if (isNaN(numSeconds) || numSeconds < 0) return "0s"
  const secondsInMonth = 30 * 24 * 3600
  const secondsInDay = 24 * 3600
  const secondsInHour = 3600
  const secondsInMinute = 60
  let remaining = Math.floor(numSeconds)
  const months = Math.floor(remaining / secondsInMonth)
  remaining %= secondsInMonth
  const days = Math.floor(remaining / secondsInDay)
  remaining %= secondsInDay
  const hours = Math.floor(remaining / secondsInHour)
  remaining %= secondsInHour
  const minutes = Math.floor(remaining / secondsInMinute)
  const seconds = remaining % secondsInMinute
  const parts: string[] = []
  if (months > 0) parts.push(`${months}mo`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

export const exportSubcycleJson = (subcycle: Subcycle) => {
  const data = JSON.stringify(subcycle, null, 2)
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${subcycle.id}_${subcycle.name.replace(/\s+/g, "_")}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const exportSubcycleCsv = (subcycle: Subcycle) => {
  if (getStepCount(subcycle) === 0) return
  const headers = ["Index", "Duration(s)", "Timestep(s)", "ValueType", "Value", "Unit", "Repetitions", "StepType", "Label", "Triggers"]
  const rows = subcycle.steps.map((s, i) => [
    i + 1,
    s.duration,
    s.timestep,
    s.valueType,
    s.value,
    s.unit,
    s.repetitions,
    s.stepType,
    s.label || "",
    s.triggers.map((t) => `${t.type}:${t.value}`).join(";") || ""
  ])
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${subcycle.id}_${subcycle.name.replace(/\s+/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadTemplate = () => {
  const csvContent = `Index,Duration(s),Timestep(s),ValueType,Value,Unit,Repetitions,StepType,Label,Triggers
1,300,1,current,50,A,1,fixed,Highway Cruise,
2,60,1,current,-100,A,1,fixed,Regenerative Braking,
3,10,0.1,voltage,3.0,V,1,fixed_with_triggers,Charge Pulse,"voltage_high:4.2"
4,3600,1,current,0,A,1,fixed,Rest Period,
`
  const blob = new Blob([csvContent], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "subcycle_template.csv"
  a.click()
  URL.revokeObjectURL(url)
}
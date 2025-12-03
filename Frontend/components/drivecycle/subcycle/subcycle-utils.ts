export const calculateTotalDuration = (steps: any[]) =>
  steps.reduce((sum: number, s: any) => sum + Number(s.duration || 0), 0)

export const exportSubcycleJson = (subcycle: any) => {
  const data = JSON.stringify(subcycle, null, 2)
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${subcycle.id}_${subcycle.name.replace(/\s+/g, "_")}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const exportSubcycleCsv = (subcycle: any) => {
  if (subcycle.steps.length === 0) return
  const headers = ["Index", "Duration(s)", "Timestep(s)", "ValueType", "Value", "Unit", "Repetitions", "StepType", "Label", "Triggers"]
  const rows = subcycle.steps.map((s: any, i: number) => [
    i + 1, s.duration, s.timestep, s.valueType, s.value, s.unit, s.repetitions, s.stepType, s.label || "",
    s.triggers.map((t: any) => `${t.type}:${t.value}`).join(";") || ""
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
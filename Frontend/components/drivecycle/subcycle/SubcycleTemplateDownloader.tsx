"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function SubcycleTemplateDownloader() {
  const downloadTemplate = () => {
    const csvContent = `Index,Duration(s),Timestep(s),ValueType,Value,Unit,Repetitions,StepType,Label,Triggers
1,300,1,current,50,A,300,fixed,Highway Cruise,
2,60,1,current,-100,A,60,fixed,Regenerative Braking,
3,10,0.1,voltage,3.0,V,100,fixed_with_triggers,Charge Pulse,"voltage_high:4.2"
4,3600,1,current,0,A,3600,fixed,Rest Period,
`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "subcycle_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
      <Download className="h-4 w-4" />
      Download CSV Template
    </Button>
  )
}
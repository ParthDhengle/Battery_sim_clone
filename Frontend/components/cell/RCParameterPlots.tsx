// components/RCParameterPlots.tsx
"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react"
import Plotly from "plotly.js-dist-min"

export default function RCParameterPlots({ file, rcType, onClose }: Props) {
  const [plots, setPlots] = useState<{ title: string; data: any; layout: any }[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const plotRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const generatePlots = async () => {
      setLoading(true)
      const text = await file.text()
      const lines = text.split("\n").map(l => l.trim()).filter(l => l)
      const headers = lines[0].split(",").map(h => h.trim())
      const rows = lines.slice(1).map(l => l.split(",").map(c => c.trim()))

      const variables = rcType === "rc2"
        ? ["ocv", "r0", "r1", "r2", "c1", "c2"]
        : ["ocv", "r0", "r1", "r2", "r3", "c1", "c2", "c3"]

      const modes = ["CHARGE", "DISCHARGE"]
      const generatedPlots: { title: string; data: any; layout: any }[] = []

      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

      for (const mode of modes) {
        for (const variable of variables) {
          const tempData: { [temp: string]: { soc: number[]; val: number[] } } = {}

          headers.forEach((header, colIdx) => {
            const match = header.match(new RegExp(`^${mode}_T(-?\\d+)_(.*)$`, "i"))
            if (match) {
              const temp = match[1]
              const varName = match[2].toLowerCase()
              if (varName === "soc") {
                tempData[temp] = tempData[temp] || { soc: [], val: [] }
                rows.forEach(row => {
                  const socVal = parseFloat(row[colIdx])
                  if (!isNaN(socVal)) tempData[temp].soc.push(socVal)
                })
              } else if (varName === variable.toLowerCase()) {
                const tempKey = temp
                if (!tempData[tempKey]) tempData[tempKey] = { soc: [], val: [] }
                rows.forEach((row, i) => {
                  const val = parseFloat(row[colIdx])
                  if (!isNaN(val)) tempData[tempKey].val.push(val)
                })
              }
            }
          })

          const sortedTemps = Object.keys(tempData).sort((a, b) => parseInt(a) - parseInt(b))

          const traces = sortedTemps.map((temp, i) => ({
            x: tempData[temp].soc.map(s => s * 100), // Convert to percentage
            y: tempData[temp].val,
            mode: 'lines+markers',
            name: `${temp}°C`,
            line: { color: colors[i % colors.length], width: 2 },
            marker: { size: 6, color: colors[i % colors.length] }
          }))

          const layout = {
            title: {
              text: `${mode} – ${variable.toUpperCase()} vs SOC`,
              font: { size: 16, weight: 600 }
            },
            xaxis: {
              title: 'SOC (%)',
              gridcolor: '#e5e7eb',
              showgrid: true
            },
            yaxis: {
              title: variable.toUpperCase(),
              gridcolor: '#e5e7eb',
              showgrid: true
            },
            showlegend: true,
            legend: {
              x: 1.02,
              y: 1,
              xanchor: 'left',
              yanchor: 'top'
            },
            margin: { l: 60, r: 120, t: 50, b: 50 },
            paper_bgcolor: '#ffffff',
            plot_bgcolor: '#ffffff',
            hovermode: 'closest'
          }

          generatedPlots.push({
            title: `${mode}_SOC_vs_${variable.toUpperCase()}`,
            data: traces,
            layout: layout
          })
        }
      }

      setPlots(generatedPlots)
      setLoading(false)
    }

    generatePlots()
  }, [file, rcType])

  useEffect(() => {
    if (plots.length > 0 && plotRef.current) {
      const current = plots[currentIndex]
      Plotly.newPlot(plotRef.current, current.data, current.layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
      })
    }
  }, [currentIndex, plots])

  const downloadCurrentPlot = () => {
    if (plotRef.current) {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 600,
        filename: plots[currentIndex].title
      })
    }
  }

  if (loading) {
    return (
      <Card className="p-8 text-center border-primary/20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-base font-medium text-foreground">
            Generating {rcType === "rc2" ? "12" : "16"} parameter plots...
          </div>
        </div>
      </Card>
    )
  }

  if (plots.length === 0) {
    return (
      <Card className="p-6 text-center border-destructive/20">
        <div className="text-muted-foreground">No valid data found for plotting.</div>
      </Card>
    )
  }

  const current = plots[currentIndex]

  return (
    <Card className="mt-4 overflow-hidden border-primary/20 shadow-lg">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary-foreground/80 animate-pulse"></div>
          <h3 className="font-semibold text-base">
            RC Parameter Analysis
          </h3>
          <span className="px-2 py-0.5 bg-primary-foreground/10 rounded-full text-xs font-medium">
            {currentIndex + 1} / {plots.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={downloadCurrentPlot}
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
            title="Download current plot"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Plot Display */}
      <div className="p-4 bg-muted/30">
        <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
          <div ref={plotRef} style={{ width: '100%', height: '400px' }}></div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-4 gap-4">
          <Button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            size="sm"
            variant="outline"
            className="min-w-[100px]"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          <div className="flex-1 text-center">
            <div className="text-xs font-semibold text-foreground">
              {current.title.replace(/_/g, " ")}
            </div>
            <div className="text-xs text-muted-foreground">
              {rcType.toUpperCase()} Model
            </div>
          </div>

          <Button
            onClick={() => setCurrentIndex(i => Math.min(plots.length - 1, i + 1))}
            disabled={currentIndex === plots.length - 1}
            size="sm"
            variant="outline"
            className="min-w-[100px]"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Progress Indicator */}
        <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentIndex + 1) / plots.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </Card>
  )
}
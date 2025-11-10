"use client"

import { useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Minimal inline ExportModal replacement to avoid missing module import.
 * Accepts `data` (array of objects or primitives) and `filename` to download a CSV file.
 */
export function ExportModal({ data, filename = 'export' }: { data: any[]; filename?: string }) {
  const csv = useMemo(() => {
    if (!data || data.length === 0) return ''
    // If items are objects, use keys as header and values as rows.
    if (typeof data[0] === 'object' && data[0] !== null) {
      const header = Object.keys(data[0]).join(',')
      const rows = data.map((row: any) =>
        Object.values(row).map((v: any) => {
          // Basic CSV escaping for commas and quotes
          const s = v == null ? '' : String(v)
          if (s.includes('"') || s.includes(',')) {
            return `"${s.replace(/"/g, '""')}"`
          }
          return s
        }).join(',')
      )
      return [header, ...rows].join('\n')
    }
    // Fallback for array of primitives
    return data.map((d: any) => String(d)).join('\n')
  }, [data])

  const download = () => {
    if (!csv) return
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={download} type="button" className="px-3 py-1 rounded bg-slate-700 text-white">
      Export
    </button>
  )
}

export default function ExportResults() {
  const params = useParams()
  const simId = params.id as string
  const { simulations } = useAppStore()
  const sim = simulations.find((s) => s.id === simId)

  if (!sim?.results) {
    return <div>No results to export</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Results</CardTitle>
      </CardHeader>
      <CardContent>
        <ExportModal data={sim.results.timeSeries} filename={`simulation-${simId}`} />
      </CardContent>
    </Card>
  )
}
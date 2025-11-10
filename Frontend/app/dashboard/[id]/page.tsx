"use client"

import { useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { ResultsDashboard } from "@/components/simulation/results-dashboard"

export default function DashboardResults() {
  const params = useParams()
  const simId = params.id as string
  const { simulations } = useAppStore()
  const sim = simulations.find((s) => s.id === simId)

  if (!sim?.results) {
    return <div>No results available</div>
  }

  return <ResultsDashboard results={sim.results} onPrevious={() => {}} />
}
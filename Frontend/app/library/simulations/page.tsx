"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Plus, TrendingDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getAllSimulations } from "@/lib/api/simulations"  // ✅ import your utility function

interface Simulation {
  _id: string
  name: string
  type: string
  status: "completed" | "running" | "failed" | "pending" | "unknown"
  created_at: string
  progress: number
  summary?: {
    end_soc?: number
    max_temp?: number
    capacity_fade?: number
  }
}

export default function Simulations() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // ✅ Fetch all simulations from backend
  const loadSimulations = async () => {
    try {
      setIsLoading(true)
      const data = await getAllSimulations()
      setSimulations(data)
      setError("")
    } catch (err: any) {
      console.error("❌ Error loading simulations:", err)
      setError(err.message || "Failed to load simulations")
      setSimulations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSimulations()
    const interval = setInterval(loadSimulations, 10000) // Poll every 10 seconds for updates
    return () => clearInterval(interval)
  }, [])

  const handleViewResults = (simId: string) => {
    router.push(`/simulation/${simId}/results`)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "running":
      case "pending":
        return "bg-blue-100 text-blue-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
      case "pending":
        return "⏳"
      case "completed":
        return "✓"
      case "failed":
        return "✕"
      default:
        return "○"
    }
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="w-8 h-8" />
            Simulation Library
          </h1>
          <p className="text-muted-foreground">View and manage your battery simulations</p>
        </div>
        <Link href="/simulation">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Simulation
          </Button>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-12">Loading simulations...</p>
          </CardContent>
        </Card>
      ) : simulations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No simulations yet. Create your first simulation to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {simulations.map((sim) => (
            <Card
              key={sim._id}
              className="hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50"
              onClick={() => handleViewResults(sim._id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-lg">{sim.name}</CardTitle>
                    <CardDescription className="mt-1">{sim.type}</CardDescription>
                  </div>
                  <Badge className={`whitespace-nowrap ml-2 ${getStatusBadgeColor(sim.status)}`}>
                    <span className="mr-1">{getStatusIcon(sim.status)}</span>
                    {sim.status.charAt(0).toUpperCase() + sim.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar if running/pending */}
                {(sim.status === "running" || sim.status === "pending") && (
                  <div className="space-y-2">
                    <Progress value={sim.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">{sim.progress.toFixed(1)}% Complete</p>
                  </div>
                )}

                {/* Summary Stats */}
                {sim.summary ? (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted rounded p-2">
                      <span className="text-muted-foreground block text-[10px]">End SOC</span>
                      <p className="font-bold text-sm">
                        {sim.summary.end_soc !== undefined
                          ? (sim.summary.end_soc * 100).toFixed(1) + "%"
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <span className="text-muted-foreground block text-[10px]">Max Temp</span>
                      <p className="font-bold text-sm">
                        {sim.summary.max_temp !== undefined
                          ? sim.summary.max_temp.toFixed(1) + "°C"
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <span className="text-muted-foreground block text-[10px]">Cap Fade</span>
                      <p className="font-bold text-sm flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        {sim.summary.capacity_fade !== undefined
                          ? sim.summary.capacity_fade.toFixed(2) + "%"
                          : "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted rounded p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {sim.status === "failed"
                        ? "Simulation failed"
                        : "Simulation in progress..."}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-muted-foreground">
                  <span className="block">
                    Created:{" "}
                    {sim.created_at
                      ? new Date(sim.created_at).toLocaleString()
                      : "Unknown date"}
                  </span>
                </div>

                {/* View Results Button */}
                {sim.status === "completed" && (
                  <Button
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewResults(sim._id)
                    }}
                  >
                    View Results
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
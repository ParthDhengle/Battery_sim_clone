"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Zap, BarChart3, Settings, Loader2 } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Simulation {
  _id: string
  name: string
  type: string
  status: string
  created_at: string
  summary: any
  progress: number
}

export default function Home() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch simulations from the backend
  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/simulations/all`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Failed to fetch simulations: ${await res.text()}`)
        const data = await res.json()
        setSimulations(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching simulations:", err)
        setError(err instanceof Error ? err.message : "Failed to load simulations")
      } finally {
        setLoading(false)
      }
    }

    fetchSimulations()
  }, [])

  // Calculate statistics
  const totalSimulations = simulations.length
  const activeSimulations = simulations.filter(
    (sim) => sim.status === "running" || sim.status === "pending"
  ).length

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">Battery Pack Simulation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Design, configure, and simulate battery packs with physics-based models. Analyze performance across custom
          drive cycles.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/simulation">
          <Card className="cursor-pointer hover:border-accent transition-colors h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                New Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Start a new battery pack simulation project</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/pack-builder">
          <Card className="cursor-pointer hover:border-accent transition-colors h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Pack Builder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create Battery Pack</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/drive-cycle-builder">
          <Card className="cursor-pointer hover:border-accent transition-colors h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-accent" />
                Drive Cycle Builder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create custom drive cycles</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !simulations.length ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="text-xl text-muted-foreground">Loading...</span>
              </div>
            ) : error ? (
              <p className="text-xl text-destructive">Error</p>
            ) : (
              <p className="text-3xl font-bold">{totalSimulations}</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !simulations.length ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="text-xl text-muted-foreground">Loading...</span>
              </div>
            ) : error ? (
              <p className="text-xl text-destructive">Error</p>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold">{activeSimulations}</p>
                {activeSimulations > 0 && (
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Simulations Preview */}
      {!loading && simulations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {simulations.slice(0, 5).map((sim) => (
                <div
                  key={sim._id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{sim.name}</p>
                    <p className="text-sm text-muted-foreground">{sim.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sim.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : sim.status === "running"
                          ? "bg-blue-100 text-blue-800"
                          : sim.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {sim.status}
                    </span>
                    {(sim.status === "running" || sim.status === "pending") && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {simulations.length > 5 && (
              <Link href="/library/simulations" className="block mt-4 text-center text-sm text-accent hover:underline">
                View all {simulations.length} simulations →
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
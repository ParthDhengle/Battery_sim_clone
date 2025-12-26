// FILE: Frontend/app/library/simulations/page.tsx
"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Plus, TrendingDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllSimulations, resumeSimulation } from "@/lib/api/simulations" // import your utility function
interface Simulation {
  _id: string
  name: string
  type: string
  status: "completed" | "running" | "failed" | "pending" | "paused" | "unknown"
  created_at: string
  // NEW: These fields are now returned from backend
  pack_name?: string
  drive_cycle_name?: string
  drive_cycle_file?: string
  // Optional fallback via metadata (some old sims may still use this)
  metadata?: {
    name?: string
    type?: string
    pack_name?: string
    drive_cycle_name?: string
    summary?: any
    progress?: number
  }
  summary?: {
    end_soc?: number
    max_temp?: number
    capacity_fade?: number
  }
  progress?: number
}
export default function Simulations() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [showManualContinue, setShowManualContinue] = useState(false)
  const [selectedContZip, setSelectedContZip] = useState<File | null>(null)
  const [manualSimId, setManualSimId] = useState("")
  const router = useRouter()
  // Fetch all simulations from backend
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
  }, [])
  const handleViewResults = (simId: string) => {
    router.push(`/simulation/${simId}/results`)
  }
  // NEW: Auto continue (no upload)
  const handleAutoContinue = async (simId: string) => {
    try {
      await resumeSimulation(simId) // No file
      router.push(`/simulation/${simId}/results`)
    } catch (err) {
      setError("Failed to resume simulation")
    }
  }
  // UPDATED: Manual continue with ZIP
  const submitManualContinue = async () => {
    if (!selectedContZip || !manualSimId) return
    try {
      await resumeSimulation(manualSimId, selectedContZip)
      router.push(`/simulation/${manualSimId}/results`)
      setShowManualContinue(false)
      setSelectedContZip(null)
      setManualSimId("")
    } catch (err) {
      setError("Failed to resume with ZIP")
    }
  }
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "running":
      case "pending":
        return "bg-blue-100 text-blue-800"
      case "paused":
        return "bg-yellow-100 text-yellow-800" // NEW
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
      case "paused":
        return "⏸️" // NEW
      case "completed":
        return "✓"
      case "failed":
        return "✕"
      default:
        return "○"
    }
  }
  const pausedSims = simulations.filter(sim => sim.status === "paused")
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowManualContinue(true)}>
            Continue Simulation
          </Button>
          <Link href="/simulation">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Simulation
            </Button>
          </Link>
        </div>
      </div>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* UPDATED: Manual ZIP Modal */}
      {showManualContinue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Manual Continue Simulation</h3>
              <Select onValueChange={setManualSimId} value={manualSimId}>
                <SelectTrigger className="mb-4">
                  <SelectValue placeholder="Select paused simulation" />
                </SelectTrigger>
                <SelectContent>
                  {pausedSims.map(sim => (
                    <SelectItem key={sim._id} value={sim._id}>
                      {sim.name} ({sim._id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="file"
                onChange={(e) => setSelectedContZip(e.target.files?.[0] || null)}
                accept=".zip"
                className="w-full p-2 border rounded mb-4"
              />
              <div className="flex gap-2">
                <Button onClick={submitManualContinue} disabled={!selectedContZip || !manualSimId} className="flex-1">
                  Continue
                </Button>
                <Button variant="outline" onClick={() => { setShowManualContinue(false); setSelectedContZip(null); setManualSimId("") }} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {simulations.map((sim) => (
            <Card
              key={sim._id}
              className="hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50"
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
                        {sim.summary?.capacity_fade != null
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
                <div className="text-xs text-muted-foreground space-y-1">
                  <span className="block">
                    Pack: <span className="font-medium">
                      {sim.pack_name || sim.metadata?.pack_name || "—"}
                    </span>
                  </span>
                  <span className="block">
                    Drive Cycle: <span className="font-medium">
                      {sim.drive_cycle_name || sim.drive_cycle_file || sim.metadata?.drive_cycle_name || "—"}
                    </span>
                  </span>
                  <span className="block">
                    Created: {sim.created_at ? new Date(sim.created_at).toLocaleString() : "—"}
                  </span>
                </div>
                {/* Buttons */}
                <div className="space-y-2">
                  {sim.status === "completed" && (
                    <Button
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewResults(sim._id)
                      }}
                    >
                      View Results
                    </Button>
                  )}
                  {sim.status === "paused" && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAutoContinue(sim._id)
                        }}
                      >
                        ▶️ Resume
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewResults(sim._id)
                        }}
                      >
                        View Partial Results
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
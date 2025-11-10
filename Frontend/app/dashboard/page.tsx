"use client"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Zap, TrendingUp } from "lucide-react"

export default function DashboardOverview() {
  const { simulations } = useAppStore()

  const completedSims = simulations.filter((s) => s.status === "completed")
  const totalEnergy = completedSims.length * 50 // Mock calculation

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your simulations and results</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Total Simulations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{simulations.length}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedSims.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {simulations.length > 0 ? Math.round((completedSims.length / simulations.length) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Avg Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">92%</p>
            <p className="text-xs text-muted-foreground mt-1">Across all packs</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Simulations</CardTitle>
        </CardHeader>
        <CardContent>
          {simulations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No simulations yet. Start by creating a new project.
            </p>
          ) : (
            <div className="space-y-2">
              {simulations
                .slice(-5)
                .reverse()
                .map((sim) => (
                  <div key={sim.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{sim.name}</p>
                      <p className="text-sm text-muted-foreground">{sim.status}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{new Date(sim.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

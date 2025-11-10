"use client"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Zap, BarChart3, Settings } from "lucide-react"

export default function Home() {
  const { projects } = useAppStore()

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
      

        <Link href="/library/drive-cycles">
          <Card className="cursor-pointer hover:border-accent transition-colors h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-accent" />
                Drive Cycle Builder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create custome drive cycles</p>
            </CardContent>
          </Card>
        </Link>
        
        </div>

        

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">92%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

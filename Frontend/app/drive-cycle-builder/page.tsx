// FILE: Frontend/app/drive-cycle-builder/page.tsx
"use client"
import { useState } from "react"
import SubcycleLibrary from "@/components/drivecycle/subcycle/subcycle-library"
import DriveCycleBuilder from "@/components/drivecycle/drivecycle/drivecycle-builder"
import CalendarAssignment from "@/components/drivecycle/simulationcycle/calendar-assignment"
import SimulationCycleViewer from "@/components/drivecycle/simulationcycle/simulation-cycle-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSimulationCycle } from "@/lib/api/drive-cycle"
export default function Home() {
  const [subcycles, setSubcycles] = useState<any[]>([])
  const [drivecycles, setDrivecycles] = useState<any[]>([])
  const [calendarAssignment, setCalendarAssignment] = useState<any[]>([])
  const [simulationCycle, setSimulationCycle] = useState<any[]>([])
  const [simId, setSimId] = useState<string | null>(null)
  const [simName, setSimName] = useState("")
  const [simDesc, setSimDesc] = useState("")
  const [isCreatingSim, setIsCreatingSim] = useState(false)
  const handleCreateSimulation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simName) return
    setIsCreatingSim(true)
    try {
      const sim = await createSimulationCycle({ name: simName, description: simDesc })
      setSimId(sim.id)
    } catch (err) {
      alert("Failed to create simulation")
    } finally {
      setIsCreatingSim(false)
    }
  }
  // Initial Setup View
  if (!simId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>New Simulation Cycle</CardTitle>
            <CardDescription>Start by creating a new simulation context.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSimulation} className="space-y-4">
              <div>
                <Label htmlFor="simName">Simulation Name</Label>
                <Input
                  id="simName"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  placeholder="e.g., WLTP Analysis V1"
                  disabled={isCreatingSim}
                />
              </div>
              <div>
                <Label htmlFor="simDesc">Description</Label>
                <Input
                  id="simDesc"
                  value={simDesc}
                  onChange={e => setSimDesc(e.target.value)}
                  placeholder="Optional notes..."
                  disabled={isCreatingSim}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!simName || isCreatingSim}>
                {isCreatingSim ? "Creating..." : "Start Builder"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="top-0 z-40 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Drive Cycle Builder</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-medium">{simName}</span>
              <span className="text-muted-foreground text-sm border-l pl-2">{simDesc}</span>
              <code className="text-xs bg-muted px-1 rounded ml-2 text-muted-foreground">{simId}</code>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            if (confirm("Exit current simulation? Unsaved changes may be lost.")) {
              setSimId(null);
              setSimName("");
              setSimDesc("");
            }
          }}>
            Exit Simulation
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="subcycles" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="subcycles">1. Sub-cycles</TabsTrigger>
            <TabsTrigger value="drivecycles">2. Drive Cycles</TabsTrigger>
            <TabsTrigger value="calendar">3. Calendar</TabsTrigger>
            <TabsTrigger value="simulation">4. Simulation</TabsTrigger>
          </TabsList>
          <TabsContent value="subcycles" className="space-y-4">
            <Card>
              <CardContent>
                <SubcycleLibrary
                  subcycles={subcycles}
                  onSubcyclesChange={setSubcycles}
                  simId={simId}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="drivecycles" className="space-y-4">
            <Card>
              <CardContent>
                <DriveCycleBuilder
                  subcycles={subcycles}
                  drivecycles={drivecycles}
                  onDrivecyclesChange={setDrivecycles}
                  simId={simId}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Year Assignment</CardTitle>
                <CardDescription>Map drive cycles to calendar days</CardDescription>
              </CardHeader>
              <CardContent>
                <CalendarAssignment
                  drivecycles={drivecycles}
                  onCalendarChange={setCalendarAssignment}
                  calendarData={calendarAssignment}
                  simId={simId}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="simulation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Simulation Cycle Table</CardTitle>
                <CardDescription>Final Output</CardDescription>
              </CardHeader>
              <CardContent>
                <SimulationCycleViewer
                  calendarAssignment={calendarAssignment}
                  drivecycles={drivecycles}
                  subcycles={subcycles}
                  simId={simId}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
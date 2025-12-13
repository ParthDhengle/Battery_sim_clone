"use client"

import { useState } from "react"
import SubcycleLibrary from "@/components/drivecycle/subcycle/subcycle-library"
import DriveCycleBuilder from "@/components/drivecycle/drivecycle/drivecycle-builder"
import CalendarAssignment from "@/components/drivecycle/simulationcycle/calendar-assignment"
import SimulationCycleViewer from "@/components/drivecycle/simulationcycle/simulation-cycle-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const [subcycles, setSubcycles] = useState<any[]>([])
  const [drivecycles, setDrivecycles] = useState<any[]>([])
  const [calendarAssignment, setCalendarAssignment] = useState<any[]>([])
  const [simulationCycle, setSimulationCycle] = useState<any[]>([])
  
  const [simId, setSimId] = useState<string | null>(null)
  return (
    <div className="min-h-screen bg-background">
      <header className="top-0 z-40 border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-foreground">Drive Cycle Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and simulate drive cycles for battery simulations
          </p>
             {/* Optional: Show current simulation ID for debugging */}
          {simId && (
            <p className="text-sm text-muted-foreground mt-2">
              Simulation ID: <code className="bg-muted px-2 py-1 rounded">{simId}</code>
            </p>
          )}
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
                  onSimIdCreated={setSimId}  
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Year Assignment</CardTitle>
                <CardDescription>Map drive cycles to calendar days (364 days per year)</CardDescription>
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
                <CardDescription>Final expanded output - ready for battery solver consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <SimulationCycleViewer
                  calendarAssignment={calendarAssignment}
                  drivecycles={drivecycles}
                  subcycles={subcycles}
                  onSimulationCycleGenerate={setSimulationCycle}
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

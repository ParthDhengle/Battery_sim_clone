// FILE: Frontend/app/drive-cycle-builder/page.tsx
"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import SubcycleLibrary from "@/components/drivecycle/subcycle/subcycle-library"
import DriveCycleBuilder, { Drivecycle } from "@/components/drivecycle/drivecycle/drivecycle-builder"  // ← FIXED: Named import for Drivecycle type
import CalendarAssignment from "@/components/drivecycle/simulationcycle/calendar-assignment"
import SimulationCycleViewer from "@/components/drivecycle/simulationcycle/simulation-cycle-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"  // ← FIXED: Added AlertCircle import
import { createSimulationCycle, get_simulation_cycle, updateSimulationSubcycles, saveDriveCycles, saveCalendarAssignments, getSubcycles } from "@/lib/api/drive-cycle"
import { CalendarRule } from "@/components/drivecycle/simulationcycle/calendar-types"

export default function Home() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const existingSimId = searchParams.get("simId")
  const [subcycles, setSubcycles] = useState<any[]>([])
  const [drivecycles, setDrivecycles] = useState<Drivecycle[]>([])
  const [calendarAssignment, setCalendarAssignment] = useState<CalendarRule[]>([])
  const [simulationCycle, setSimulationCycle] = useState<any[]>([])
  const [simId, setSimId] = useState<string | null>(null)
  const [simName, setSimName] = useState("")
  const [simDesc, setSimDesc] = useState("")
  const [isCreatingSim, setIsCreatingSim] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("subcycles")
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (existingSimId && !isLoaded) {
      loadExistingSimulation(existingSimId)
    } else {
      setIsLoading(false)
    }
  }, [existingSimId, isLoaded])

  const loadExistingSimulation = async (id: string) => {
    if (!id || id === 'undefined') {
      setLoadError("Invalid simulation ID provided")
      router.push('/library/drive-cycles')
      return
    }
    try {
      setIsLoading(true)
      setLoadError(null)
      console.log(`Loading simulation ${id}`)
      const sim = await get_simulation_cycle(id)
      console.log("Loaded sim data:", sim)
      setSimId(id)
      setSimName(sim.name)
      setSimDesc(sim.description || "")
      
      // Load subcycles: Fetch FULL data
      const partialSubcycles = sim.subcycle_ids?.map((sid: string) => ({ id: sid })) || []
      setSubcycles(partialSubcycles)
      if (partialSubcycles.length > 0) {
        const fullSubcycles = await getSubcycles()
        const loadedSubcycles = fullSubcycles.filter((sc: any) => sim.subcycle_ids.includes(sc.id))
        setSubcycles(loadedSubcycles)
        console.log("Loaded full subcycles:", loadedSubcycles.length)
      }
      
      // Load drivecycles from metadata
      setDrivecycles(sim.drive_cycles_metadata?.map((dc: any) => ({
        id: dc.id,
        name: dc.name,
        notes: dc.notes || "",
        source: "manual" as const,
        composition: dc.composition || []
      })) || [])
      
      // Load calendar
      setCalendarAssignment(sim.calendar_assignments || [])
      
      // Set active tab based on completeness
      if ((sim.drive_cycles_metadata?.length || 0) > 0 && (sim.calendar_assignments?.length || 0) > 0) {
        setActiveTab("simulation")
      } else if ((sim.drive_cycles_metadata?.length || 0) > 0) {
        setActiveTab("calendar")
      } else {
        setActiveTab("drivecycles")
      }
      
      setIsLoaded(true)
    } catch (err: any) {
      console.error("Failed to load simulation:", err)
      const msg = err.message || "Unknown error"
      setLoadError(`Failed to load simulation: ${msg}. Redirecting...`)
      setTimeout(() => router.push('/library/drive-cycles'), 2000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSimulation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simName) return
    setIsCreatingSim(true)
    try {
      const sim = await createSimulationCycle({ name: simName, description: simDesc })
      setSimId(sim.id)
      setActiveTab("subcycles")
      setIsLoaded(true)
    } catch (err) {
      alert("Failed to create simulation")
    } finally {
      setIsCreatingSim(false)
    }
  }

  const handleSaveAndExit = async () => {
    if (!simId) return
    setIsSaving(true)
    try {
      await updateSimulationSubcycles(simId, subcycles.map(s => s.id))
      await saveDriveCycles(simId, drivecycles)
      await saveCalendarAssignments(simId, calendarAssignment)
      router.push('/library/drive-cycles')
    } catch (err) {
      alert("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // Loading/Error States
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Loading simulation...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-destructive text-center">{loadError}</p>
      </div>
    )
  }

  // Initial Setup View (New Sim)
  if (!simId && !isLoaded) {
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

  // Main Builder View (Loaded Sim)
  return (
    <div className="min-h-screen bg-background">
      <header className="top-0 z-40 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Drive Cycle Builder {simId ? '(Edit Mode)' : '(New)'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-medium">{simName}</span>
              <span className="text-muted-foreground text-sm border-l pl-2">{simDesc}</span>
              {simId && <code className="text-xs bg-muted px-1 rounded ml-2 text-muted-foreground">{simId}</code>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveAndExit} disabled={isSaving || !simId}>
            {isSaving ? "Saving..." : "Save and Exit"}
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  simId={simId!}
                  simName={simName}
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
                  simId={simId!}
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
                  simId={simId!}
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
                  simId={simId!}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
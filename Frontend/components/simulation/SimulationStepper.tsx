// Frontend/components/simulation/SimulationStepper.tsx
"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SimulationSetup } from "@/components/simulation/simulation-setup"
import { ResultsDashboard } from "@/components/simulation/results-dashboard"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getPacks, getPack } from "@/lib/api/packs"
import { runSimulation, getSimulationStatus } from "@/lib/api/simulations"
import { PackSelector } from "@/components/simulation/pack-selector"
import { DriveCycleSelector } from "@/components/simulation/drive-cycle-selector"
interface SimulationStepperProps {
  projectId?: string
  name: string
  simType: string
}
interface PackOption {
  value: string
  label: string
  specs?: Record<string, string | number>
}
interface DriveOption {
  value: string
  label: string
  specs?: Record<string, string | number>
}
function StepIndicator({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-primary" : "bg-muted")}
        />
      ))}
    </div>
  )
}
function ConfigurationSummary({
  packId,
  cycleId,
  simulationConfig,
}: {
  packId?: string
  cycleId?: string
  simulationConfig?: Record<string, any>
}) {
  const [packs, setPacks] = useState<PackOption[]>([])
  const [cycles, setCycles] = useState<DriveOption[]>([])
  useEffect(() => {
    getPacks().then(setPacks)
    // Note: getDriveCyclesFromStorage is from drive-cycle-selector, import if needed
    // For simplicity, assuming cycles are loaded similarly
  }, [])
  const pack = packs.find((p) => p.value === packId)
  const cycle = cycles.find((c) => c.value === cycleId)
  const cycleLabel = cycle?.label ?? (cycleId?.endsWith(".csv") ? cycleId : null)
  if (!pack && !cycleLabel && !simulationConfig) return null
  if (!simulationConfig && !pack && !cycleLabel) return null
  return (
    <Card className="bg-muted/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Configuration Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {pack && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pack:</span>
            <span className="font-medium">{pack.label}</span>
          </div>
        )}
        {cycleLabel && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cycle:</span>
            <span className="font-medium">{cycleLabel}</span>
          </div>
        )}
        {simulationConfig?.electrical?.details?.name && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Electrical Model:</span>
            <span className="font-medium">{simulationConfig.electrical.details.name}</span>
          </div>
        )}
        {simulationConfig?.thermal?.enabled && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thermal:</span>
            <span className="font-medium">Enabled</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
async function getDriveCycleCsv(cycleId: string): Promise<string> {
  if (cycleId.endsWith('.csv')) {
    return sessionStorage.getItem(`csv:${cycleId}`) || ''
  } else {
    // Assume key format and that window.storage is available
    const key = `drivecycle:${cycleId}` // Adjust based on actual storage key format
    if (typeof window !== 'undefined' && window.storage && window.storage.get) {
      const dc = await window.storage.get(key)
      if (!dc) return ''
      const cycle = JSON.parse(dc.value)
      // Assume cycle.data is array of objects with Time and Current, or [time, current]
      let rows = ''
      if (Array.isArray(cycle.data)) {
        rows = cycle.data.map((item: any) => {
          const t = Array.isArray(item) ? item[0] : item.Time
          const c = Array.isArray(item) ? item[1] : item.Current
          return `${t},${c}`
        }).join('\n')
      }
      return 'Time,Current\n' + rows
    }
    return ''
  }
}
export function SimulationStepper({ projectId, name, simType }: SimulationStepperProps) {
  const [activeTab, setActiveTab] = useState("selection")
  const [packId, setPackId] = useState("")
  const [cycleId, setCycleId] = useState("")
  const [simulationConfig, setSimulationConfig] = useState<Record<string, any> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [simulationResults, setSimulationResults] = useState<any>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)
  const [simulationId, setSimulationId] = useState<string | null>(null)
  const addSimulation = useAppStore((state) => state.addSimulation)
  const canProceedToConfig = !!(packId && cycleId)
  const canRunSimulation = !!(canProceedToConfig && simulationConfig)
  const handleRunSimulation = async () => {
    if (!canRunSimulation) {
      setError("Please complete all configuration steps before running the simulation.")
      return
    }
    setError(null)
    setSimulationError(null)
    setSimulationResults(null)
    setSimulationId(null)
    setActiveTab("results")
    setIsRunning(true)
    try {
      const packConfig = await getPack(packId)
      const driveCycleCsv = await getDriveCycleCsv(cycleId)
      const modelConfig = simulationConfig
      const payload = {
        name,
        type: simType,
        packConfig,
        modelConfig,
        driveCycleCsv,
      }
      const res = await runSimulation(payload)
      setSimulationId(res.simulation_id)
      if (projectId) {
        addSimulation(projectId, JSON.stringify({ packId, cycleId, simulationConfig, results: { simulation_id: res.simulation_id } }))
      }
    } catch (err: any) {
      setSimulationError(err.message || "Failed to start simulation")
      setIsRunning(false)
    }
  }
  // Polling effect for simulation status
  useEffect(() => {
    if (!simulationId || !isRunning) return
    const interval = setInterval(async () => {
      try {
        const data = await getSimulationStatus(simulationId)
        if (data.status === "completed") {
          setSimulationResults({ 
            simulation_id: simulationId, 
            summary: data.metadata?.summary || null 
          })
          setIsRunning(false)
          clearInterval(interval)
        } else if (data.status === "failed") {
          setSimulationError(data.error || "Simulation failed")
          setIsRunning(false)
          clearInterval(interval)
        }
        // For "pending" or "running", continue polling
      } catch (err: any) {
        console.error("Polling error:", err)
        // Optionally stop polling on error, or continue
        setSimulationError(err.message || "Polling error")
        setIsRunning(false)
        clearInterval(interval)
      }
    }, 2000) // Poll every 2 seconds
    return () => clearInterval(interval)
  }, [simulationId, isRunning])
  const handleResetSimulation = () => {
    setActiveTab("selection")
    setPackId("")
    setCycleId("")
    setSimulationConfig(undefined)
    setError(null)
    setSimulationResults(null)
    setSimulationError(null)
    setSimulationId(null)
    setIsRunning(false)
  }
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Battery Simulation</h1>
          <p className="text-muted-foreground">Configure your battery components and run performance simulations</p>
        </div>
        {(error || simulationError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || simulationError}</AlertDescription>
          </Alert>
        )}
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60">
            <div className="space-y-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2">🔋 Simulation Configuration</CardTitle>
                <CardDescription>Follow the steps to configure and run your battery simulation</CardDescription>
              </div>
              <StepIndicator step={activeTab === "selection" ? 1 : activeTab === "setup" ? 2 : 3} totalSteps={3} />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="selection" disabled={false}>
                  <span className="hidden sm:inline">1. Selection</span>
                  <span className="sm:hidden">Selection</span>
                </TabsTrigger>
                <TabsTrigger value="setup" disabled={!canProceedToConfig}>
                  <span className="hidden sm:inline">2. Configuration</span>
                  <span className="sm:hidden">Config</span>
                </TabsTrigger>
                <TabsTrigger value="results" disabled={!simulationResults && !isRunning}>
                  <span className="hidden sm:inline">3. Results</span>
                  <span className="sm:hidden">Results</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="selection" className="space-y-6">
                <div className="flex justify-center ">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                    <PackSelector value={packId} onValueChange={setPackId} />
                    <DriveCycleSelector value={cycleId} onValueChange={setCycleId} />
                  </div>
                </div>
                {canProceedToConfig && <ConfigurationSummary packId={packId} cycleId={cycleId} />}
                <div className="flex justify-between pt-4">
                  <div />
                  <Button onClick={() => setActiveTab("setup")} disabled={!canProceedToConfig} className="gap-2">
                    {canProceedToConfig && "✓"}
                    Next: Configure
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="setup" className="space-y-6">
                <SimulationSetup onConfigChange={setSimulationConfig} />
                <ConfigurationSummary packId={packId} cycleId={cycleId} simulationConfig={simulationConfig} />
                <div className="flex justify-between pt-4 gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("selection")}>
                    Back
                  </Button>
                  <Button onClick={handleRunSimulation} disabled={!canRunSimulation} className="gap-2">
                    {isRunning ? (
                      <>⏳ Running...</>
                    ) : (
                      <>
                        {canRunSimulation && "✓"}
                        Run Simulation
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="results" className="space-y-6">
                {isRunning ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Running Simulation</p>
                      <p className="text-xs text-muted-foreground">
                        Please wait while we process your configuration...
                      </p>
                      {simulationId && (
                        <p className="text-xs text-muted-foreground">
                          ID: {simulationId}
                        </p>
                      )}
                    </div>
                  </div>
                ) : simulationError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{simulationError}</AlertDescription>
                  </Alert>
                ) : simulationResults ? (
                  <div className="space-y-6">
                    <ResultsDashboard
                      results={simulationResults}
                      onPrevious={() => setActiveTab("setup")}
                    />
                    <div className="flex justify-between pt-4 gap-3">
                      <Button variant="outline" onClick={() => setActiveTab("setup")}>
                        Back to Configuration
                      </Button>
                      <Button onClick={handleResetSimulation} className="gap-2">
                        🔄 Run New Simulation
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
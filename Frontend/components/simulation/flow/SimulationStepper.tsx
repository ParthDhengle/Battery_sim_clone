// Updated: Frontend/components/simulation/SimulationStepper.tsx
"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SimulationSetup } from "@/components/simulation/configuration/simulation-setup"
import { ResultsDashboard } from "@/components/simulation/results/results-dashboard"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getPacks, getPack } from "@/lib/api/packs"
import { runSimulation } from "@/lib/api/simulations"
import { PackSelector } from "@/components/simulation/selections/pack-selector"
import { DriveCycleSelector } from "@/components/simulation/selections/drive-cycle-selector"
import { DriveCyclePreview } from "@/components/simulation/selections/drive-cycle-preview"
import { getPacksFromStorage } from "@/lib/api/get-packs-storage"

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
  cycleLabel,
  simulationConfig,
}: {
  packId?: string
  cycleId?: string
  cycleLabel?: string
  simulationConfig?: Record<string, any>
}) {
  const [packs, setPacks] = useState<PackOption[]>([])

  useEffect(() => {
    // FIX: Use same function as PackSelector
    getPacksFromStorage().then(setPacks)
  }, [])

  const pack = packs.find((p) => p.value === packId)

  if (!pack && !cycleLabel && !simulationConfig) return null

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
    try {
      const { getSimulationCycleTable } = await import("@/lib/api/drive-cycle")
      return await getSimulationCycleTable(cycleId)
    } catch (err) {
      console.error('Error fetching drive cycle table:', err)
      return ''
    }
  }
}

async function getDriveCycleData(cycleId: string): Promise<{ time: number[]; current: number[] } | null> {
  try {
    const csvContent = await getDriveCycleCsv(cycleId)
    if (!csvContent) return null

    const lines = csvContent.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) return null

    // Skip header
    const dataLines = lines.slice(1)
    const time: number[] = []
    const current: number[] = []

    if (cycleId.endsWith('.csv')) {
      // Simple CSV: Time,Current
      dataLines.forEach(line => {
        const [tStr, cStr] = line.split(',')
        const t = Number.parseFloat(tStr)
        const c = Number.parseFloat(cStr)
        if (!isNaN(t) && !isNaN(c)) {
          time.push(t)
          current.push(c)
        }
      })
    } else {
      // DB full table: extract stepwise
      const header = lines[0].split(',').map(h => h.trim().toLowerCase())
      const durationIdx = header.findIndex(h => h.includes('step duration'))
      const valueIdx = header.findIndex(h => h.includes('value'))
      const typeIdx = header.findIndex(h => h.includes('value type'))

      if (durationIdx === -1 || valueIdx === -1) return null

      let cumTime = 0
      dataLines.forEach(line => {
        const values = line.split(',').map(v => v.trim())
        if (typeIdx !== -1 && values[typeIdx] !== 'current') return

        const duration = Number.parseFloat(values[durationIdx] || '0')
        const val = Number.parseFloat(values[valueIdx] || '0')

        if (!isNaN(duration) && duration > 0 && !isNaN(val)) {
          time.push(cumTime)
          current.push(val)
          cumTime += duration
          time.push(cumTime)
          current.push(val)
        }
      })
    }

    if (time.length < 2) return null

    // Sample if > 5000 points
    const maxPoints = 5000
    if (time.length > maxPoints) {
      const step = Math.ceil(time.length / maxPoints)
      const sampledTime: number[] = []
      const sampledCurrent: number[] = []
      for (let i = 0; i < time.length; i += step) {
        sampledTime.push(time[i])
        sampledCurrent.push(current[i])
      }
      return { time: sampledTime, current: sampledCurrent }
    }

    return { time, current }
  } catch (err) {
    console.error('Error fetching drive cycle data:', err)
    return null
  }
}

export function SimulationStepper({ projectId, name, simType }: SimulationStepperProps) {
  const [activeTab, setActiveTab] = useState("selection")
  const [packId, setPackId] = useState("")
  const [packData, setPackData] = useState<any>(null)
  const [cycleId, setCycleId] = useState("")
  const [cycleLabel, setCycleLabel] = useState("")
  const [simulationConfig, setSimulationConfig] = useState<Record<string, any> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
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
  setIsStarting(true)

  try {
    const packConfig = await getPack(packId)
    const driveCycleCsv = await getDriveCycleCsv(cycleId)

    const payload = {
      name,
      type: simType,
      packConfig,
      modelConfig: simulationConfig,
      driveCycleCsv,
      driveCycleSource: cycleId.endsWith(".csv")
        ? { type: "upload", filename: cycleId, name: cycleLabel }
        : { type: "database", id: cycleId, name: cycleLabel },
    }
    console.log("Pack : ")
    console.log(packConfig)
    console.log("Simulation : ")
    console.log(simulationConfig)
    const res = await runSimulation(payload)
    setSimulationId(res.simulation_id)
    setActiveTab("results")
    setSimulationResults({ simulation_id: res.simulation_id })

    console.log("Simulation started:", res.simulation_id)
  } catch (err: any) {
    setSimulationError(err.message || "Failed to start simulation")
  } finally {
    setIsStarting(false)
  }
}

  useEffect(() => {
    if (packId) {
      getPack(packId).then(setPackData).catch(console.error)
    } else {
      setPackData(null)
    }
  }, [packId])

  const handleResetSimulation = () => {
    setActiveTab("selection")
    setPackId("")
    setCycleId("")
    setCycleLabel("")
    setSimulationConfig(undefined)
    setError(null)
    setSimulationResults(null)
    setSimulationError(null)
    setSimulationId(null)
    setIsStarting(false)
  }

  const handleCycleChange = (value: string, label?: string) => {
    setCycleId(value)
    setCycleLabel(label || value)
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
                <TabsTrigger value="results" disabled={!simulationResults}>
                  <span className="hidden sm:inline">3. Results</span>
                  <span className="sm:hidden">Results</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="selection" className="space-y-6">
                <div className="flex justify-center ">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                    <PackSelector value={packId} onValueChange={setPackId} />
                    <DriveCycleSelector value={cycleId} onValueChange={handleCycleChange} />
                  </div>
                </div>
                {cycleId && <DriveCyclePreview cycleId={cycleId} />}
                
                <div className="flex justify-between pt-4">
                  <div />
                  <Button onClick={() => setActiveTab("setup")} disabled={!canProceedToConfig} className="gap-2">
                    {canProceedToConfig && "✓"}
                    Next: Configure
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="setup" className="space-y-6">
                <SimulationSetup 
                  onConfigChange={setSimulationConfig}  
                  packData={packData} 
                />
                <ConfigurationSummary packId={packId} cycleId={cycleId} cycleLabel={cycleLabel} simulationConfig={simulationConfig} />
                <div className="flex justify-between pt-4 gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("selection")}>
                    Back
                  </Button>
                  <Button onClick={handleRunSimulation} disabled={!canRunSimulation || isStarting} className="gap-2">
                    {isStarting ? (
                      <>⏳ Starting...</>
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
                {simulationResults ? (
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
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <p className="text-sm text-muted-foreground">No simulation results available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Export getDriveCycleData and getDriveCycleCsv for use in other components
export { getDriveCycleData, getDriveCycleCsv }
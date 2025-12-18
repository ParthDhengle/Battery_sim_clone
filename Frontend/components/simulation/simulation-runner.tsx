"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, AlertCircle, CheckCircle, Loader2, ChevronsUpDown  } from "lucide-react"
import { ConfigReviewDisplay } from "@/components/ConfigReview"
interface SimulationRunnerProps {
  packConfig: any
  driveConfig: any
  simulationConfig: any
  onComplete: (results: any) => void
  onPrevious: () => void
}

export function SimulationRunner({
  packConfig,
  driveConfig,
  simulationConfig,
  onComplete,
  onPrevious,
}: SimulationRunnerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState("")
  const [completed, setCompleted] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  // Simulate the physics-based calculation
  const runSimulation = async () => {
    setIsRunning(true)
    setProgress(0)
    setLogs([])
    setError("")
    setCompleted(false)
    console.log("Pack config: \n")
    console.log(packConfig)
    console.log("simulation config: \n")
    console.log(simulationConfig)

    try {
      // Step 1: Initialize
      setCurrentStep("Initializing simulation parameters...")
      setLogs((prev) => [...prev, "Starting battery pack simulation"])
      setLogs((prev) => [
        ...prev,
        `Pack: ${packConfig?.seriesCount}S${packConfig?.parallelCount}P ${packConfig?.cell?.name}`,
      ])
      setLogs((prev) => [
        ...prev,
        `Drive cycle: ${driveConfig?.type === "predefined" ? driveConfig?.cycle?.name : "Custom CSV"}`,
      ])
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setProgress(20)

      // Step 2: Electrical model setup
      setCurrentStep("Setting up electrical model...")
      setLogs((prev) => [...prev, `Electrical model: ${simulationConfig?.electrical?.details?.name}`])
      if (simulationConfig?.thermal?.enabled) {
        setLogs((prev) => [
          ...prev,
          `Thermal model: ${simulationConfig?.thermal?.model} with ${simulationConfig?.thermal?.cooling} cooling`,
        ])
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setProgress(40)

      // Step 3: Running physics solver
      setCurrentStep("Running physics-based solver...")
      setLogs((prev) => [...prev, "Integrating differential equations..."])
      setLogs((prev) => [...prev, "Computing SOC, voltage, and current profiles..."])
      if (simulationConfig?.thermal?.enabled) {
        setLogs((prev) => [...prev, "Calculating thermal dynamics..."])
      }
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setProgress(70)

      // Step 4: Post-processing
      setCurrentStep("Processing results...")
      setLogs((prev) => [...prev, "Computing performance metrics..."])
      if (simulationConfig?.life?.enabled) {
        setLogs((prev) => [...prev, "Calculating capacity fade and SOH..."])
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setProgress(90)

      // Step 5: Complete
      setCurrentStep("Simulation complete!")
      setLogs((prev) => [...prev, "Simulation completed successfully"])
      setProgress(100)
      setCompleted(true)

      // Generate mock results
      const results = generateMockResults(packConfig, driveConfig, simulationConfig)

      setTimeout(() => {
        onComplete(results)
      }, 1000)
    } catch (err) {
      setError("Simulation failed: " + (err instanceof Error ? err.message : "Unknown error"))
      setIsRunning(false)
    }
  }

  const generateMockResults = (pack: any, drive: any, sim: any) => {
    const duration = drive?.cycle?.duration || 1800
    const points = Math.min(200, duration) // Limit points for performance
    const timeStep = duration / points

    const data: {
      time: number
      soc: number
      voltage: number
      current: number
      temperature: number
      power: number
    }[] = []
    let soc = drive?.startingSoc || 80
    let voltage = pack?.totalVoltage || 355.2
    let temperature = drive?.ambientTemp || 25
    const capacity = pack?.totalCapacity || 15.0

    for (let i = 0; i <= points; i++) {
      const time = i * timeStep

      // Simulate current profile (simplified)
      const current = 50 * Math.sin(time * 0.01) + 30 * Math.random() - 15

      // Update SOC (simplified)
      soc = Math.max(0, soc - ((current * timeStep) / (capacity * 3600)) * 100)

      // Update voltage (simplified)
      voltage = pack?.cell?.voltage * pack?.seriesCount * (0.85 + (0.15 * soc) / 100) - current * 0.1

      // Update temperature (if thermal enabled)
      if (sim?.thermal?.enabled) {
        const heatGeneration = Math.abs(current * current * 0.01)
        temperature += ((heatGeneration - (temperature - drive?.ambientTemp) * 0.1) * timeStep) / 1000
      }

      data.push({
        time,
        soc,
        voltage,
        current,
        temperature,
        power: (voltage * current) / 1000, // kW
      })
    }

    // Calculate summary metrics
    const finalSoc = data[data.length - 1]?.soc || soc
    const maxTemp = Math.max(...data.map((d) => d.temperature))
    const totalEnergy = data.reduce((sum, d, i) => {
      if (i === 0) return 0
      const dt = (d.time - data[i - 1].time) / 3600 // hours
      return sum + Math.abs(d.power * dt)
    }, 0)

    const efficiency = ((((drive?.startingSoc - finalSoc) / 100) * pack?.totalEnergy) / totalEnergy) * 100

    return {
      summary: {
        finalSoc: finalSoc.toFixed(1),
        totalEnergy: totalEnergy.toFixed(2),
        maxTemperature: maxTemp.toFixed(1),
        efficiency: efficiency.toFixed(1),
        stateOfHealth: sim?.life?.enabled ? (98.5 - Math.random() * 2).toFixed(1) : null,
      },
      timeSeries: data,
      metadata: {
        packConfig: pack,
        driveConfig: drive,
        simulationConfig: sim,
        simulationTime: new Date().toISOString(),
      },
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Run Simulation
          </CardTitle>
          <CardDescription>Review your configuration and execute the simulation.</CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Pack Config</div>
                <div className="font-medium">
                  {packConfig?.cells?.length} cells ({packConfig?.meta?.formFactor})
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Drive Cycle</div>
                <div className="font-medium">
                  {driveConfig?.driveCycles?.length || 0} cycles defined
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Complexity</div>
                <div className="font-medium">
                  {simulationConfig?.complexityLevel}
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <Button
                variant="link"
                className="text-sm h-auto p-1"
                onClick={() => setShowDetails(!showDetails)}
              >
                <ChevronsUpDown className="w-4 h-4 mr-2" />
                {showDetails ? "Hide Full Configuration" : "Show Full Configuration"}
              </Button>
            </div>
          </div>
          
          {/* This now renders the complete 3-part review when toggled */}
          {showDetails && (
            <ConfigReviewDisplay
              packConfig={packConfig}
              driveConfig={driveConfig}
              simulationConfig={simulationConfig}
            />
          )}

          {/* Progress Section */}
          {(isRunning || completed) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                  {completed && <CheckCircle className="w-4 h-4 text-green-600" />}
                  <span className="font-medium">{currentStep}</span>
                </div>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Simulation Logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Simulation Log</div>
              <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Run Button */}
          {!isRunning && !completed && (
            <Button onClick={runSimulation} className="w-full" size="lg">
              <Play className="w-4 h-4 mr-2" />
              Start Simulation
            </Button>
          )}

          {/* Estimated Time */}
          {!isRunning && !completed && (
            <div className="text-center text-sm text-muted-foreground">
              Estimated time: {simulationConfig?.estimatedComputeTime || "Unknown"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} disabled={isRunning}>
          Previous: Configure Models
        </Button>
        <Button disabled={!completed} className="min-w-32">
          {completed ? "View Results" : "Waiting for simulation..."}
        </Button>
      </div>
    </div>
  )
}

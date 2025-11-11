// Frontend/app/simulation/page.tsx
"use client"
import { useAppStore } from '@/lib/store'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimulationStepper } from '@/components/simulation/SimulationStepper'
import { useState } from 'react'
export default function NewSimulation() {
  const addProject = useAppStore((state) => state.addProject)
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const handleCreateProject = () => {
    if (projectName) {
      const id = addProject(projectName)
      setProjectId(id)
    }
  }
  if (!projectId) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>New Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Simulation Name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., EV Pack Test"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-type">Simulation Type</Label>
            <Input
              id="project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="e.g., Discharge, Fast-Charge, Thermal"
            />
          </div>
          <Button onClick={handleCreateProject} className="w-full" disabled={!projectName}>
            Create & Start
          </Button>
        </CardContent>
      </Card>
    )
  }
  return <SimulationStepper projectId={projectId} name={projectName} simType={projectType} />
}
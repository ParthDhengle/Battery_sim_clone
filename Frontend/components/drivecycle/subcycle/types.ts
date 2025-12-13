// components/drivecycle/subcycle/types.ts

export interface Trigger {
  type: string
  value: number
}

export interface Step {
  id: string
  duration: number
  timestep: number
  valueType: string
  value: string
  unit: string
  repetitions: number
  stepType: string
  triggers: Trigger[]
  label: string
}

export interface Subcycle {
  id: string
  name: string
  description: string
  source: "manual" | "import"
  steps: Step[]
}

export interface SubcycleLibraryProps {
  subcycles: Subcycle[]
  onSubcyclesChange: (subcycles: Subcycle[]) => void
  simId: string | null
}
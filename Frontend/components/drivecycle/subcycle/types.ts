export interface Trigger {
  type: string
  value: number
}

export interface Step {
  id?: string // Optional to match API/backend
  duration: number
  timestep: number
  valueType: string
  value: number // Number to match backend
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
  source: "manual" | "import" | "import_file"
  steps: Step[]
  num_steps?: number  // For large imports (steps=[] in list)
  total_duration?: number  // For large imports
}

export interface SubcycleLibraryProps {
  subcycles: Subcycle[]
  onSubcyclesChange: (subcycles: Subcycle[]) => void
  simId: string | null
}
import { create } from "zustand"

interface Simulation {
  id: string
  projectId: string
  name: string
  status: "draft" | "running" | "completed" | "failed"
  config: {
    cellConfig?: any
    packConfig?: any
    driveConfig?: any
    simulationConfig?: any
  }
  results?: any
  createdAt: Date
  updatedAt: Date
}

interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

interface AppStore {
  projects: Project[]
  simulations: Simulation[]
  addProject: (name: string, description?: string) => string
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  addSimulation: (projectId: string, name: string) => string
  updateSimulation: (id: string, updates: Partial<Simulation>) => void
  deleteSimulation: (id: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  projects: [],
  simulations: [],

  addProject: (name: string, description?: string) => {
    const id = `proj-${Date.now()}`
    const newProject: Project = {
      id,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({
      projects: [...state.projects, newProject],
    }))
    return id
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)),
    }))
  },

  deleteProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      simulations: state.simulations.filter((s) => s.projectId !== id),
    }))
  },

  addSimulation: (projectId: string, name: string) => {
    const id = `sim-${Date.now()}`
    const newSimulation: Simulation = {
      id,
      projectId,
      name,
      status: "draft",
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({
      simulations: [...state.simulations, newSimulation],
    }))
    return id
  },

  updateSimulation: (id: string, updates: Partial<Simulation>) => {
    set((state) => ({
      simulations: state.simulations.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s)),
    }))
  },

  deleteSimulation: (id: string) => {
    set((state) => ({
      simulations: state.simulations.filter((s) => s.id !== id),
    }))
  },
}))

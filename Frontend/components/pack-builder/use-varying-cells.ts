"use client"

import { useState } from "react"

export interface VaryingCell {
  id: number
  cellIndex: string
  temp: string
  soc: string
  soh: string
  dcir: string
}

export function useVaryingCells(initialCells: VaryingCell[] = []) {
  const [varyingCells, setVaryingCells] = useState<VaryingCell[]>(initialCells)
  const [nextVaryingId, setNextVaryingId] = useState(initialCells.length + 1)

  const addVaryingCell = () => {
    setVaryingCells([
      ...varyingCells,
      { id: nextVaryingId, cellIndex: "", temp: "300", soc: "100", soh: "1.0", dcir: "1.0" },
    ])
    setNextVaryingId(nextVaryingId + 1)
  }

  const removeVaryingCell = (id: number) => {
    setVaryingCells(varyingCells.filter((vc) => vc.id !== id))
  }

  const updateVaryingCell = (id: number, field: string, value: string) => {
    setVaryingCells(
      varyingCells.map((vc) => {
        if (vc.id !== id) return vc
        return { ...vc, [field]: value }
      }),
    )
  }

  const initializeVaryingCells = (loadedCells: VaryingCell[]) => {
    setVaryingCells(loadedCells)
    setNextVaryingId(loadedCells.length + 1)
  }

  return {
    varyingCells,
    setVaryingCells,
    nextVaryingId,
    addVaryingCell,
    removeVaryingCell,
    updateVaryingCell,
    initializeVaryingCells,
  }
}

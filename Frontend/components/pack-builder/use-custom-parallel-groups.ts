"use client"

import { useState } from "react"

export interface CustomParallelGroup {
  id: number
  cellIds: string
}

export function useCustomParallelGroups(initialGroups: CustomParallelGroup[] = []) {
  const [customParallelGroups, setCustomParallelGroups] = useState<CustomParallelGroup[]>(initialGroups)
  const [nextGroupId, setNextGroupId] = useState(initialGroups.length + 1)
  const [customConnectionError, setCustomConnectionError] = useState<string>("")

  const addCustomParallelGroup = () => {
    setCustomParallelGroups([...customParallelGroups, { id: nextGroupId, cellIds: "" }])
    setNextGroupId(nextGroupId + 1)
  }

  const removeCustomParallelGroup = (id: number) => {
    setCustomParallelGroups(customParallelGroups.filter((g) => g.id !== id))
    setCustomConnectionError("")
  }

  const updateCustomParallelGroup = (id: number, cellIds: string) => {
    setCustomParallelGroups(
      customParallelGroups.map((g) => {
        if (g.id !== id) return g
        return { ...g, cellIds }
      }),
    )
    setCustomConnectionError("")
  }

  const validateCustomConnection = (totalCells: number): boolean => {
    if (customParallelGroups.length === 0) {
      setCustomConnectionError("Add at least one parallel group")
      return false
    }

    const cellsPerGroup: number[] = []
    for (const group of customParallelGroups) {
      if (!group.cellIds.trim()) {
        setCustomConnectionError("All groups must have cell IDs")
        return false
      }
      const ids = group.cellIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id)
      if (ids.length === 0) {
        setCustomConnectionError("Groups must contain at least one cell ID")
        return false
      }
      cellsPerGroup.push(ids.length)
    }

    const expectedTotal = cellsPerGroup[0] * customParallelGroups.length
    if (expectedTotal !== totalCells) {
      setCustomConnectionError(
        `Total cells mismatch: ${customParallelGroups.length} groups × ${cellsPerGroup[0]} cells = ${expectedTotal}, but pack has ${totalCells} cells`,
      )
      return false
    }

    setCustomConnectionError("")
    return true
  }

  const initializeGroups = (loadedGroups: CustomParallelGroup[]) => {
    setCustomParallelGroups(loadedGroups)
    setNextGroupId(loadedGroups.length + 1)
  }

  return {
    customParallelGroups,
    setCustomParallelGroups,
    nextGroupId,
    customConnectionError,
    setCustomConnectionError,
    addCustomParallelGroup,
    removeCustomParallelGroup,
    updateCustomParallelGroup,
    validateCustomConnection,
    initializeGroups,
  }
}

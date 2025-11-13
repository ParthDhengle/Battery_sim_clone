"use client"
import { useState } from "react"
export interface Layer {
  id: number
  gridType: string
  nRows: number
  nCols: number
  pitchX: number
  pitchY: number
  zMode: "index_pitch" | "explicit"
  zCenter: string
}
export function useLayers(initialLayers: Layer[] = []) {
  const [layers, setLayers] = useState<Layer[]>(initialLayers)
  const [nextId, setNextId] = useState(initialLayers.length + 1)
  const zPitch = "5" // Default zPitch, can be overridden
  const addLayer = (minPitchX: number, minPitchY: number, height: number, currentZPitch: string) => {
    // Enforce single layer: only add if none exists
    if (layers.length > 0) return; // Prevent adding more than one
    const lastLayer = layers[layers.length - 1]
    const baseZ = lastLayer ? Number(lastLayer.zCenter) || 0 : 0
    const newHeight = lastLayer ? height + 5 || 0 : 0
    const effectiveZPitch = Number.parseFloat(currentZPitch) || Number.parseFloat(zPitch)
    setLayers([
      ...layers,
      {
        id: nextId,
        gridType: "rectangular",
        nRows: 3,
        nCols: 3,
        pitchX: minPitchX + 2,
        pitchY: minPitchY + 2,
        zMode: "explicit",
        zCenter: (baseZ + newHeight).toString(),
      },
    ])
    setNextId(nextId + 1)
  }
  const removeLayer = (id: number) => {
    // Prevent removing the last layer
    if (layers.length <= 1) return;
    const removedIdx = layers.findIndex((l) => l.id === id)
    if (removedIdx === -1) return
    const removedLayer = layers[removedIdx]
    let newLayers = layers.filter((l) => l.id !== id)
    let shiftAmount = 0
    const pitch = Number.parseFloat(zPitch) || 0
    let prevZ = 0
    if (removedIdx > 0) {
      const prevLayer = layers[removedIdx - 1]
      if (prevLayer.zMode === "explicit") {
        prevZ = Number.parseFloat(prevLayer.zCenter) || 0
      } else {
        prevZ = (removedIdx - 1) * pitch
      }
    }
    if (removedLayer.zMode === "explicit") {
      const removedZ = Number.parseFloat(removedLayer.zCenter) || 0
      shiftAmount = removedZ - prevZ
    } else {
      shiftAmount = pitch
    }
    newLayers = newLayers.map((layer, newIdx) => {
      if (newIdx >= removedIdx && layer.zMode === "explicit") {
        const currentZ = Number.parseFloat(layer.zCenter) || 0
        const newZ = currentZ - shiftAmount
        return { ...layer, zCenter: newZ.toString() }
      }
      return layer
    })
    setLayers(newLayers)
  }
  const updateLayer = (id: number, field: keyof Layer, value: string, minPitchY: number) => {
    setLayers((prevLayers) =>
      prevLayers.map((l, idx) => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: value }
        if (field === "zCenter") {
          const prevLayer = prevLayers[idx - 1]
          if (prevLayer) {
            const minZ = Number(prevLayer.zCenter) || 0
            if (Number(value) <= minZ) {
              updated.zCenter = (minZ + minPitchY).toString()
            }
          }
        }
        return updated
      }),
    )
  }
  const initializeLayers = (loadedLayers: Layer[]) => {
    setLayers(loadedLayers)
    setNextId(loadedLayers.length + 1)
  }
  return {
    layers,
    setLayers,
    nextId,
    addLayer,
    removeLayer,
    updateLayer,
    initializeLayers,
  }
}
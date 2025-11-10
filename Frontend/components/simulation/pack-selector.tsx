"use client"

import { useState, useEffect } from "react"
import { getPacks } from "@/lib/api/packs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PackOption {
  value: string
  label: string
  specs?: Record<string, string | number>
}

export interface PackSelectorProps {
  value: string
  onValueChange: (value: string) => void
}

async function getPacksFromStorage(): Promise<PackOption[]> {
  if (typeof window === "undefined") return []
  try {
    const packs = await getPacks()
    return packs
      .filter((pack: any) => pack._id || pack.id)
      .map((pack: any) => ({
        value: String(pack._id ?? pack.id),
        label: pack.name,
        specs: {
          config: `${pack.r_s || 0}s${pack.r_p || 0}p`,
          connection: pack.connection_type,
        },
      }))
  } catch (error) {
    console.error("Failed to fetch packs:", error)
    return [
      { value: "series-parallel-10s5p", label: "10S5P Pack (Mock)", specs: { config: "10s5p", energy: "150Wh" } },
      { value: "series-parallel-20s10p", label: "20S10P Pack (Mock)", specs: { config: "20s10p", energy: "300Wh" } },
    ]
  }
}

export function PackSelector({ value, onValueChange }: PackSelectorProps) {
  const [packs, setPacks] = useState<PackOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPacksFromStorage()
      .then(setPacks)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">⏳ Loading packs...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Battery Pack Configuration</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a pack configuration" />
        </SelectTrigger>
        <SelectContent>
          {packs.map((pack) => (
            <SelectItem key={pack.value} value={pack.value}>
              <div className="flex flex-col">
                <span>{pack.label}</span>
                {pack.specs && (
                  <span className="text-xs text-muted-foreground">
                    {Object.entries(pack.specs)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Frontend/components/simulation/pack-selector.tsx
"use client"
import { useState, useEffect } from "react"
import { getPacks,getPack } from "@/lib/api/packs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getPacksFromStorage } from "@/lib/api/get-packs-storage"

interface PackOption {
  value: string
  label: string
  specs?: Record<string, string | number>
}

export interface PackSelectorProps {
  value: string
  onValueChange: (value: string) => void
}


export function PackSelector({ value, onValueChange }: PackSelectorProps) {
  const [packs, setPacks] = useState<PackOption[]>([])
  const [loading, setLoading] = useState(true)
  const [packError, setPackError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getPacksFromStorage()
      .then(setPacks)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (value) {
      // Verify if pack has valid cell
      getPack(value).then((pack) => {
        if (!pack.cell) {
          setPackError("Selected pack does not have a configured cell.")
        } else {
          setPackError(null)
        }
      }).catch(() => {
        setPackError("Failed to validate pack.")
      })
    }
  }, [value])

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
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select pack">
      {value 
        ? packs.find((p) => p.value === value)?.label 
        : "Select pack"}
    </SelectValue>
  </SelectTrigger>

  <SelectContent className="w-[var(--radix-select-trigger-width)]">
    {packs.map((pack) => (
      <SelectItem key={pack.value} value={pack.value}>
        <div className="flex flex-col">
          <span>{pack.label}</span>
          {pack.specs && (
            <span className="text-xs text-muted-foreground whitespace-normal break-words">
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

      {packError && (
        <Alert variant="destructive">
          <AlertDescription>{packError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
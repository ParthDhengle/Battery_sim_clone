"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface DesignConstraintsProps {
  maxWeight: string
  setMaxWeight: (value: string) => void
  maxVolume: string
  setMaxVolume: (value: string) => void
}

export function DesignConstraints({ maxWeight, setMaxWeight, maxVolume, setMaxVolume }: DesignConstraintsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Design Constraints (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>Maximum Weight (kg)</Label>
            <Input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Maximum Volume (m³)</Label>
            <Input type="number" value={maxVolume} onChange={(e) => setMaxVolume(e.target.value)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

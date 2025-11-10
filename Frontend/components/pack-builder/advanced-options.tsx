"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

interface AdvancedOptionsProps {
  computeNeighbors: boolean
  setComputeNeighbors: (value: boolean) => void
  labelSchema: string
  setLabelSchema: (value: string) => void
}

export function AdvancedOptions({
  computeNeighbors,
  setComputeNeighbors,
  labelSchema,
  setLabelSchema,
}: AdvancedOptionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="compute-neighbors"
            checked={computeNeighbors}
            onCheckedChange={(checked) => setComputeNeighbors(checked as boolean)}
          />
          <Label htmlFor="compute-neighbors">Compute Neighbors</Label>
        </div>

        <div className="space-y-3">
          <Label>Label Schema</Label>
          <Input
            value={labelSchema}
            onChange={(e) => setLabelSchema(e.target.value)}
            placeholder="e.g. R{row}C{col}L{layer}"
          />
        </div>
      </CardContent>
    </Card>
  )
}

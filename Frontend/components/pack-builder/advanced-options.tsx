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
      
          <div className="space-y-2">
            <Label htmlFor="labelSchema">Cell Label Schema</Label>
            <Input
              id="labelSchema"
              value={labelSchema}
              onChange={(e) => setLabelSchema(e.target.value)}
              placeholder="R{row}C{col}L{layer}"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{row}"}, {"{col}"}, {"{layer}"} as placeholders
            </p>
        
        </div>
      </CardContent>
    </Card>
  )
}

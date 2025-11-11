// Frontend/components/pack-builder/pack-basic-info.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PackBasicInfoProps {
  packName: string
  setPackName: (value: string) => void
  packDescription: string
  setPackDescription: (value: string) => void
  cells: any[]
  selectedCellId: string
  onSelectCell: (id: string) => void
}

export function PackBasicInfo({
  packName,
  setPackName,
  packDescription,
  setPackDescription,
  cells,
  selectedCellId,
  onSelectCell,
}: PackBasicInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pack Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Pack Name<span className="text-red-500">*</span></Label>
          <Input value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="Enter pack name" />
        </div>
        <div className="space-y-3">
          <Label>Pack Description (Optional)</Label>
          <Input
            value={packDescription}
            onChange={(e) => setPackDescription(e.target.value)}
            placeholder="Enter pack description"
          />
        </div>
        <div className="space-y-3">
          <Label>Select Cell from Database<span className="text-red-500">*</span></Label>
          <Select value={selectedCellId} onValueChange={onSelectCell}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cells.map((cell) => (
                <SelectItem key={cell.id} value={cell.id}>
                  {cell.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
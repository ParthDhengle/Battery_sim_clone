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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label htmlFor="packName">
              Pack Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="packName"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder="e.g., EV Battery Pack v1"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="cellSelect">
              Select Cell <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedCellId} onValueChange={onSelectCell}>
              <SelectTrigger id="cellSelect">
                <SelectValue placeholder="Choose a cell" />
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
        </div>

        <div className="space-y-3">
          <Label htmlFor="packDesc">Description (Optional)</Label>
          <Input
            id="packDesc"
            value={packDescription}
            onChange={(e) => setPackDescription(e.target.value)}
            placeholder="Add notes about this pack configuration"
          />
        </div>
      </CardContent>
    </Card>
  )
}

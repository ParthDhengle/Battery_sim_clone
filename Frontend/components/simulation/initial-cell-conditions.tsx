"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Plus } from "lucide-react"

interface VaryingCell {
  id: number
  cellIds: string[]
  temp: string
  soc: string
  soh: string
  dcir: string
}

interface InitialCellConditionsProps {
  initialTemperature: string
  setInitialTemperature: (value: string) => void
  initialSOC: string
  setInitialSOC: (value: string) => void
  initialSOH: string
  setInitialSOH: (value: string) => void
  initialDCIR: string
  setInitialDCIR: (value: string) => void
  varyingCells: VaryingCell[]
  onAddVaryingCell: () => void
  onRemoveVaryingCell: (id: number) => void
  onUpdateVaryingCell: (id: number, field: string, value: any) => void
  packData?: any
}

// Generate cell IDs based on pack configuration
function generateCellIds(packData: any): string[] {
  if (!packData?.layers) return []
  
  const cellIds: string[] = []
  const labelSchema = packData.options?.label_schema || "R{row}C{col}L{layer}"
  
  packData.layers.forEach((layer: any, layerIndex: number) => {
    for (let row = 0; row < layer.n_rows; row++) {
      for (let col = 0; col < layer.n_cols; col++) {
        const cellId = labelSchema
          .replace("{row}", String(row + 1))
          .replace("{col}", String(col + 1))
          .replace("{layer}", String(layerIndex + 1))
        cellIds.push(cellId)
      }
    }
  })
  
  return cellIds
}

function CellSelector({ 
  selectedCells, 
  availableCells, 
  onToggleCell 
}: { 
  selectedCells: string[]
  availableCells: string[]
  onToggleCell: (cellId: string) => void 
}) {
  const [searchTerm, setSearchTerm] = useState("")
  
  const filteredCells = availableCells.filter(cellId => 
    cellId.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  return (
    <div className="space-y-3">
      <Input 
        placeholder="Search cells..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-8"
      />
      <ScrollArea className="h-48 border rounded-md">
        <div className="p-3 space-y-1">
          {filteredCells.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {availableCells.length === 0 ? "All cells assigned" : "No cells found"}
            </p>
          ) : (
            filteredCells.map(cellId => {
              const isSelected = selectedCells.includes(cellId)
              return (
                <button
                  key={cellId}
                  onClick={() => onToggleCell(cellId)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  }`}
                >
                  {cellId}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SelectedCellsBadges({ 
  cellIds, 
  onRemove 
}: { 
  cellIds: string[]
  onRemove: (cellId: string) => void 
}) {
  if (cellIds.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-md p-4 text-center">
        <p className="text-sm text-muted-foreground">No cells selected</p>
      </div>
    )
  }
  
  return (
    <div className="flex flex-wrap gap-2 border rounded-md p-3 min-h-[60px]">
      {cellIds.map(cellId => (
        <Badge key={cellId} variant="secondary" className="gap-1 pr-1">
          {cellId}
          <button
            onClick={() => onRemove(cellId)}
            className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

export function InitialCellConditions({
  initialTemperature,
  setInitialTemperature,
  initialSOC,
  setInitialSOC,
  initialSOH,
  setInitialSOH,
  initialDCIR,
  setInitialDCIR,
  varyingCells,
  onAddVaryingCell,
  onRemoveVaryingCell,
  onUpdateVaryingCell,
  packData,
}: InitialCellConditionsProps) {
  const [allCellIds, setAllCellIds] = useState<string[]>([])
  const [expandedCondition, setExpandedCondition] = useState<number | null>(null)
  
  useEffect(() => {
    if (packData) {
      const cellIds = generateCellIds(packData)
      setAllCellIds(cellIds)
    }
  }, [packData])
  
  // Get cells that are already assigned to other conditions
  const getAssignedCells = (excludeConditionId?: number) => {
    const assigned = new Set<string>()
    varyingCells.forEach(vc => {
      if (vc.id !== excludeConditionId) {
        vc.cellIds?.forEach(cellId => assigned.add(cellId))
      }
    })
    return assigned
  }
  
  const getAvailableCells = (conditionId: number) => {
    const assignedCells = getAssignedCells(conditionId)
    return allCellIds.filter(cellId => !assignedCells.has(cellId))
  }
  
  const handleToggleCell = (conditionId: number, cellId: string) => {
    const condition = varyingCells.find(vc => vc.id === conditionId)
    if (!condition) return
    
    const currentCells = condition.cellIds || []
    const newCells = currentCells.includes(cellId)
      ? currentCells.filter(id => id !== cellId)
      : [...currentCells, cellId]
    
    onUpdateVaryingCell(conditionId, "cellIds", newCells)
  }
  
  const handleRemoveCell = (conditionId: number, cellId: string) => {
    const condition = varyingCells.find(vc => vc.id === conditionId)
    if (!condition) return
    
    const newCells = (condition.cellIds || []).filter(id => id !== cellId)
    onUpdateVaryingCell(conditionId, "cellIds", newCells)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initial Cell Conditions</CardTitle>
        <CardDescription>Define initial conditions for all cells and specific cells if needed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Conditions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Default Conditions (All Cells)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Initial Temperature (K)</Label>
              <Input type="number" value={initialTemperature} onChange={(e) => setInitialTemperature(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Initial SOC (%)</Label>
              <Input type="number" min="0" max="100" value={initialSOC} onChange={(e) => setInitialSOC(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Initial SOH</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={initialSOH}
                onChange={(e) => setInitialSOH(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial DCIR Aging Factor</Label>
              <Input type="number" min="0" value={initialDCIR} onChange={(e) => setInitialDCIR(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Varying Conditions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Cell-Specific Conditions</h3>
              <p className="text-xs text-muted-foreground">Override default conditions for specific cells</p>
            </div>
            <Button onClick={onAddVaryingCell} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Condition
            </Button>
          </div>
          
          {!packData && (
            <div className="border-2 border-dashed rounded-md p-4 text-center">
              <p className="text-sm text-muted-foreground">Select a pack to configure cell-specific conditions</p>
            </div>
          )}
          
          {packData && varyingCells.length === 0 && (
            <div className="border-2 border-dashed rounded-md p-4 text-center">
              <p className="text-sm text-muted-foreground">No cell-specific conditions added yet</p>
            </div>
          )}
          
          {packData && varyingCells.map((vc) => {
            const isExpanded = expandedCondition === vc.id
            const selectedCells = vc.cellIds || []
            
            return (
              <Card key={vc.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Condition {vc.id}</CardTitle>
                      <CardDescription className="text-xs">
                        {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onRemoveVaryingCell(vc.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected Cells Display */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">Selected Cells</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedCondition(isExpanded ? null : vc.id)}
                      >
                        {isExpanded ? "Close Selector" : "Add/Remove Cells"}
                      </Button>
                    </div>
                    <SelectedCellsBadges 
                      cellIds={selectedCells}
                      onRemove={(cellId) => handleRemoveCell(vc.id, cellId)}
                    />
                  </div>
                  
                  {/* Cell Selector (Expandable) */}
                  {isExpanded && (
                    <div className="space-y-2">
                      <Label className="text-sm">Available Cells</Label>
                      <CellSelector
                        selectedCells={selectedCells}
                        availableCells={getAvailableCells(vc.id)}
                        onToggleCell={(cellId) => handleToggleCell(vc.id, cellId)}
                      />
                    </div>
                  )}
                  
                  {/* Condition Parameters */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label className="text-sm">Temperature (K)</Label>
                      <Input
                        type="number"
                        value={vc.temp}
                        onChange={(e) => onUpdateVaryingCell(vc.id, "temp", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">SOC (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={vc.soc}
                        onChange={(e) => onUpdateVaryingCell(vc.id, "soc", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">SOH</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={vc.soh}
                        onChange={(e) => onUpdateVaryingCell(vc.id, "soh", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">DCIR Aging Factor</Label>
                      <Input
                        type="number"
                        min="0"
                        value={vc.dcir}
                        onChange={(e) => onUpdateVaryingCell(vc.id, "dcir", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        {/* Pack Summary */}
        {packData && allCellIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <span>Total cells in pack: <strong>{allCellIds.length}</strong></span>
            <span>•</span>
            <span>Cells with custom conditions: <strong>{
              new Set(varyingCells.flatMap(vc => vc.cellIds || [])).size
            }</strong></span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
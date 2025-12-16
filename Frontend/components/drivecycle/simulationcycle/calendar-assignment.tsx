// FILE: Frontend/components/drivecycle/simulationcycle/calendar-assignment.tsx
"use client"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, AlertTriangle, Check } from "lucide-react"
import CalendarRuleTable from "./calendar-rule-table"
import DefaultRuleEditor from "./default-rule-editor"
import SmartCalendarRuleEditor from "./smart-calendar-rule-editor"
import { CalendarRule, CalendarAssignmentProps, getOccupiedSelections } from "./calendar-types"
import { saveCalendarAssignments } from "@/lib/api/drive-cycle"

export default function CalendarAssignment({ drivecycles, onCalendarChange, calendarData, simId }: CalendarAssignmentProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const defaultRule = calendarData.find(r => r.id === "DEFAULT_RULE")
  const hasDefaultRule = !!defaultRule

  // MOCK IDLE DRIVE CYCLE (fallback)
  const MOCK_IDLE_DRIVECYCLE = {
    id: "DC_IDLE",
    name: "Idle / No Operation",
    composition: [] // no steps → rest day
  }

  // Coverage stats (includes default rule coverage)
  const coverageStats = useMemo(() => {
    const covered = new Set<number>()
    calendarData.forEach(rule => getOccupiedSelections(calendarData).allOccupiedDays.forEach(d => covered.add(d)))
    return {
      coveredDays: covered.size,
      uncoveredDays: 364 - covered.size,
      totalDays: 364
    }
  }, [calendarData])

  const handleAddRule = async (newRule: Omit<CalendarRule, "id" | "ruleIndex">) => {
    try {
      // Generate temporary ID for optimistic UI update
      const tempId = `RULE_${Date.now()}`
      const ruleWithTempId: CalendarRule = {
        ...newRule,
        id: tempId,
        ruleIndex: calendarData.length + 1
      }
      // Optimistic local update
      onCalendarChange([...calendarData, ruleWithTempId])
      // Send to backend (exclude DEFAULT_RULE)
      const rulesToSave = calendarData.filter(r => r.id !== "DEFAULT_RULE").concat([newRule as any])
      const updatedRules = await saveCalendarAssignments(simId, rulesToSave)
      // Sync local state with backend response (which has real IDs)
      const syncedRules = updatedRules.calendar_assignments || updatedRules
      const fullLocalRules = [...syncedRules.map((r: any, idx: number) => ({
        ...r,
        id: r.id || `RULE_${idx}`,
        ruleIndex: idx + 1
      })), ...(defaultRule ? [defaultRule] : [])]
      onCalendarChange(fullLocalRules)
      setShowNew(false)
    } catch (err) {
      alert("Failed to save rule. Please try again.")
      // Revert optimistic update on error if needed
    }
  }

  const handleEditRule = async (id: string, updatedRule: Omit<CalendarRule, "id" | "ruleIndex">) => {
    try {
      // Optimistic update
      const optimisticRules = calendarData.map(r =>
        r.id === id ? { ...updatedRule, id, ruleIndex: r.ruleIndex } as CalendarRule : r
      )
      onCalendarChange(optimisticRules)
      // Save to backend (exclude DEFAULT_RULE)
      const rulesToSave = optimisticRules
        .filter(r => r.id !== "DEFAULT_RULE")
        .map(r => ({
          id: r.id,
          drivecycleId: r.drivecycleId,
          drivecycleName: r.drivecycleName,
          months: r.months,
          daysOfWeek: r.daysOfWeek,
          dates: r.dates,
          notes: r.notes
        }))
      const result = await saveCalendarAssignments(simId, rulesToSave)
      const syncedRules = result.calendar_assignments || result
      const fullLocalRules = [...syncedRules.map((r: any, idx: number) => ({
        ...r,
        id: r.id || `RULE_${idx}`,
        ruleIndex: idx + 1
      })), ...(defaultRule ? [defaultRule] : [])]
      onCalendarChange(fullLocalRules)
      setEditing(null)
    } catch (err) {
      alert("Failed to update rule.")
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (id === "DEFAULT_RULE") {
      alert("Cannot delete the default rule. You can change it instead.")
      return
    }
    if (!confirm("Are you sure you want to delete this rule?")) return
    try {
      // Optimistic update
      const remainingRules = calendarData.filter(r => r.id !== id)
      onCalendarChange(remainingRules)
      // Save to backend (exclude DEFAULT_RULE)
      const rulesToSave = remainingRules.filter(r => r.id !== "DEFAULT_RULE").map(r => ({
        id: r.id,
        drivecycleId: r.drivecycleId,
        drivecycleName: r.drivecycleName,
        months: r.months,
        daysOfWeek: r.daysOfWeek,
        dates: r.dates,
        notes: r.notes
      }))
      const result = await saveCalendarAssignments(simId, rulesToSave)
      const syncedRules = result.calendar_assignments || result
      const fullLocalRules = [...syncedRules.map((r: any, idx: number) => ({
        ...r,
        id: r.id || `RULE_${idx}`,
        ruleIndex: idx + 1
      })), ...(defaultRule ? [defaultRule] : [])]
      onCalendarChange(fullLocalRules)
    } catch (err) {
      alert("Failed to delete rule.")
    }
  }

  const handleCancel = () => {
    setShowNew(false)
    setEditing(null)
  }

  const isEditingMode = showNew || editing !== null

  return (
    <div className="space-y-6">
      {/* Default Rule Card - Always visible, optional */}
      <Card className={hasDefaultRule ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-400 bg-amber-50 dark:bg-amber-950/30"}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {hasDefaultRule ? (
                <div className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center mt-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              )}
              <div>
                <p className={`font-semibold ${hasDefaultRule ? "text-green-900 dark:text-green-100" : "text-amber-900 dark:text-amber-100"}`}>
                  {hasDefaultRule ? "Default Drive Cycle Set" : "No Default Drive Cycle"}
                </p>
                {hasDefaultRule ? (
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    <span className="font-medium">{defaultRule.drivecycleId}</span> - {defaultRule.drivecycleName}
                  </p>
                ) : (
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    Unassigned days will use <strong>DC_IDLE</strong> (Idle / No Operation)
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => setEditing("DEFAULT_RULE")}
              size="sm"
              variant={hasDefaultRule ? "outline" : "default"}
              className={hasDefaultRule ? "border-green-600 text-green-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              {hasDefaultRule ? "Change" : "Set Default"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Coverage Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Days Assigned</p><p className="text-2xl font-bold">{coverageStats.coveredDays}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Days Unassigned</p><p className="text-2xl font-bold">{coverageStats.uncoveredDays}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Coverage</p><p className="text-2xl font-bold">{((coverageStats.coveredDays / 364) * 100).toFixed(1)}%</p></CardContent></Card>
      </div>
      {/* Add Rule Button */}
      <Button onClick={() => setShowNew(true)} className="w-full gap-2">
        <Plus className="h-4 w-4" /> Add Calendar Rule
      </Button>
      {/* Layout: Editor (left) + Table (right) */}
      <div className="grid grid-cols-1 gap-6">
        {/* Editor */}
        {(showNew || editing) && (
          <div className="order-2 lg:order-1">
            {showNew && (
              <SmartCalendarRuleEditor
                drivecycles={drivecycles}
                onSubmit={handleAddRule}
                onCancel={handleCancel}
                occupiedSelections={getOccupiedSelections(calendarData)}
              />
            )}
            {editing && editing !== "DEFAULT_RULE" && (
              <SmartCalendarRuleEditor
                drivecycles={drivecycles}
                onSubmit={rule => handleEditRule(editing, rule)}
                onCancel={handleCancel}
                initialData={calendarData.find(r => r.id === editing)}
                isEditing
                occupiedSelections={getOccupiedSelections(calendarData, editing)}
              />
            )}
            {editing === "DEFAULT_RULE" && (
              <DefaultRuleEditor
                drivecycles={drivecycles}
                onSubmit={async (id, name) => {
                  const newDefaultRule: CalendarRule = {
                    drivecycleId: id,
                    drivecycleName: name,
                    months: [],
                    daysOfWeek: [],
                    dates: [],
                    notes: "Default drive cycle for unassigned days",
                    id: "DEFAULT_RULE",
                    ruleIndex: 0
                  }
                  try {
                    // Remove old default, add new one
                    const rulesWithoutDefault = calendarData.filter(r => r.id !== "DEFAULT_RULE")
                    const result = await saveCalendarAssignments(simId, rulesWithoutDefault)
                    const updatedRules = result.calendar_assignments || []
                    // Include DEFAULT_RULE with proper structure in local state
                    const localRules = updatedRules.map((r: any, idx: number) => ({
                      ...r,
                      id: r.id || (r.drivecycleId === id ? "DEFAULT_RULE" : `RULE_${idx}`),
                      ruleIndex: r.id === "DEFAULT_RULE" ? 0 : idx + 1
                    })).concat(newDefaultRule)
                    onCalendarChange(localRules)
                    setEditing(null)
                  } catch (err) {
                    alert("Failed to set default rule.")
                  }
                }}
                onCancel={handleCancel}
                initialData={defaultRule}
                isEditing={hasDefaultRule}
              />
            )}
          </div>
        )}
        {/* Table - Always visible */}
        <div >
          {calendarData.filter(r => r.id !== "DEFAULT_RULE").length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-muted-foreground">
                No calendar rules yet. Add rules to assign drive cycles to specific days.
              </CardContent>
            </Card>
          ) : (
            <CalendarRuleTable
              rules={calendarData.filter(r => r.id !== "DEFAULT_RULE")}
              onEdit={setEditing}
              onDelete={handleDeleteRule}
            />
          )}
        </div>
      </div>
      {/* Info */}
      <Card className="bg-secondary/30">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold mb-2">Calendar Notes:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Default drive cycle is <strong>optional</strong></li>
            <li>Unassigned days → <code className="bg-secondary px-1 rounded">DC_IDLE</code> (no operation)</li>
            <li>You can replace the mock idle cycle later in <code>data/mock-drivecycles.ts</code></li>
            <li>Each day can only be assigned once (no overlaps)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
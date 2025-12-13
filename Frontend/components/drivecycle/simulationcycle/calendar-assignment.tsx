// components/drivecycle/calendar/calendar-assignment.tsx

"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, AlertTriangle, Check } from "lucide-react"
import CalendarRuleTable from "./calendar-rule-table"
import { Toggle } from "@/components/ui/toggle"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { saveCalendarAssignments } from "@/lib/api/drive-cycle"

interface CalendarRule {
  id: string
  ruleIndex: number
  drivecycleId: string
  drivecycleName: string
  months: number[]
  daysOfWeek: string[]
  dates: number[]
  notes: string
}

interface CalendarAssignmentProps {
  drivecycles: any[]
  onCalendarChange: (rules: CalendarRule[]) => void
  calendarData: CalendarRule[]
  simId: string | null  // NEW: from parent page
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// Helper: which days does a rule cover?
function getDaysCoveredByRule(rule: Partial<CalendarRule>): Set<number> {
  const days = new Set<number>()
  if (!rule.months || rule.months.length === 0) return days

  for (let dayOfYear = 1; dayOfYear <= 364; dayOfYear++) {
    const dayOfWeek = (dayOfYear - 1) % 7
    const monthDay = ((dayOfYear - 1) % 30) + 1
    const month = Math.floor((dayOfYear - 1) / 30) + 1

    const monthMatch = rule.months.includes(month)
    let dayMatch = false

    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      dayMatch = rule.daysOfWeek.includes(DAYS_OF_WEEK[dayOfWeek])
    } else if (rule.dates && rule.dates.length > 0) {
      dayMatch = rule.dates.includes(monthDay)
    }

    if (monthMatch && dayMatch) days.add(dayOfYear)
  }
  return days
}

// Helper: find occupied months/days/dates
function getOccupiedSelections(existingRules: CalendarRule[], excludeRuleId?: string): {
  occupiedByMonth: Map<number, Set<string | number>>
  allOccupiedDays: Set<number>
} {
  const occupiedByMonth = new Map<number, Set<string | number>>()
  const allOccupiedDays = new Set<number>()

  for (let month = 1; month <= 12; month++) occupiedByMonth.set(month, new Set())

  existingRules.forEach(rule => {
    if (excludeRuleId && rule.id === excludeRuleId) return

    const coveredDays = getDaysCoveredByRule(rule)
    coveredDays.forEach(day => allOccupiedDays.add(day))

    rule.months.forEach(month => {
      if (rule.daysOfWeek?.length) {
        rule.daysOfWeek.forEach(day => occupiedByMonth.get(month)?.add(day))
      } else if (rule.dates?.length) {
        rule.dates.forEach(date => occupiedByMonth.get(month)?.add(date))
      }
    })
  })

  return { occupiedByMonth, allOccupiedDays }
}

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
    calendarData.forEach(rule => getDaysCoveredByRule(rule).forEach(d => covered.add(d)))
    return {
      coveredDays: covered.size,
      uncoveredDays: 364 - covered.size,
      totalDays: 364
    }
  }, [calendarData])

  const handleAddRule = async (newRule: Omit<CalendarRule, "id" | "ruleIndex">) => {
    if (!simId) {
      alert("Please create a drive cycle first to start a simulation.")
      return
    }

    try {
      // Generate temporary ID for optimistic UI update
      const tempId = `RULE_${Date.now()}`
      const ruleWithTempId = {
        ...newRule,
        id: tempId,
        ruleIndex: calendarData.length + 1
      }

      // Optimistic local update
      onCalendarChange([...calendarData, ruleWithTempId])

      // Send to backend
      const updatedRules = await saveCalendarAssignments(simId, [...calendarData, newRule])

      // Sync local state with backend response (which has real IDs)
      onCalendarChange(updatedRules.calendar_assignments || updatedRules)

      setShowNew(false)
    } catch (err) {
      alert("Failed to save rule. Please try again.")
      // Revert optimistic update on error if needed
    }
  }

  const handleEditRule = async (id: string, updatedRule: Omit<CalendarRule, "id" | "ruleIndex">) => {
    if (!simId) return

    try {
      // Optimistic update
      const optimisticRules = calendarData.map(r =>
        r.id === id ? { ...updatedRule, id, ruleIndex: r.ruleIndex } : r
      )
      onCalendarChange(optimisticRules)

      // Save to backend
      const result = await saveCalendarAssignments(simId, optimisticRules.map(r => ({
        id: r.id,
        drivecycleId: r.drivecycleId,
        drivecycleName: r.drivecycleName,
        months: r.months,
        daysOfWeek: r.daysOfWeek,
        dates: r.dates,
        notes: r.notes
      })))

      onCalendarChange(result.calendar_assignments)
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

    if (!simId) return

    try {
      // Optimistic update
      const remainingRules = calendarData.filter(r => r.id !== id)
      onCalendarChange(remainingRules)

      // Save to backend
      const result = await saveCalendarAssignments(simId, remainingRules.filter(r => r.id !== "DEFAULT_RULE"))
      onCalendarChange(result.calendar_assignments)
    } catch (err) {
      alert("Failed to delete rule.")
    }
  }

  const handleCancel = () => {
    setShowNew(false)
    setEditing(null)
  }

  const isEditingMode = showNew || editing !== null
  if (!simId) {
    return (
      <Card>
        <CardContent className="pt-8 text-center">
          <p className="text-muted-foreground">
            Create your first drive cycle to start a simulation and assign calendar rules.
          </p>
        </CardContent>
      </Card>
    )
  }

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
                  if (!simId) {
                    alert("Please create a drive cycle first.")
                    return
                  }

                  const newDefaultRule = {
                    drivecycleId: id,
                    drivecycleName: name,
                    months: [],
                    daysOfWeek: [],
                    dates: [],
                    notes: "Default drive cycle for unassigned days"
                  }

                  try {
                    // Remove old default, add new one
                    const rulesWithoutDefault = calendarData.filter(r => r.id !== "DEFAULT_RULE")
                    const result = await saveCalendarAssignments(simId, [...rulesWithoutDefault, newDefaultRule])
                    const updatedRules = result.calendar_assignments || []

                    // Include DEFAULT_RULE with proper structure in local state
                    const localRules = updatedRules.map((r: any, idx: number) => ({
                      ...r,
                      id: r.id || (r.drivecycleId === id ? "DEFAULT_RULE" : `RULE_${idx}`),
                      ruleIndex: r.id === "DEFAULT_RULE" ? 0 : idx + 1
                    }))

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

// Default Rule Editor
function DefaultRuleEditor({ drivecycles, onSubmit, onCancel, initialData, isEditing }: {
  drivecycles: any[], onSubmit: (id: string, name: string) => void, onCancel: () => void,
  initialData?: any, isEditing?: boolean
}) {
  const [value, setValue] = useState(initialData?.drivecycleId || "")
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value) return alert("Select a drive cycle")
    const dc = drivecycles.find(d => d.id === value)
    if (dc) onSubmit(dc.id, dc.name)
  }

  return (
    <Card className="border-2 border-primary">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-2">{isEditing ? "Change" : "Set"} Default Drive Cycle</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select value={value} onChange={e => setValue(e.target.value)} className="w-full p-2 border rounded-md bg-background">
            <option value="">Choose drive cycle</option>
            {drivecycles.map(dc => (
              <option key={dc.id} value={dc.id}>{dc.id} - {dc.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{isEditing ? "Update" : "Set"} Default</Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}


// Smart editor component with disabled selections
function SmartCalendarRuleEditor({
  drivecycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
  occupiedSelections,
}: {
  drivecycles: any[]
  onSubmit: (rule: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
  occupiedSelections: ReturnType<typeof getOccupiedSelections>
}) {
  const [rule, setRule] = useState(
    initialData || {
      drivecycleId: "",
      drivecycleName: "",
      months: [],
      daysOfWeek: [],
      dates: [],
      notes: "",
    },
  )

  const [useDate, setUseDate] = useState(!!initialData?.dates?.length)

  const MONTHS = [
    { value: 1, Label: "January" },
    { value: 2, Label: "February" },
    { value: 3, Label: "March" },
    { value: 4, Label: "April" },
    { value: 5, Label: "May" },
    { value: 6, Label: "June" },
    { value: 7, Label: "July" },
    { value: 8, Label: "August" },
    { value: 9, Label: "September" },
    { value: 10, Label: "October" },
    { value: 11, Label: "November" },
    { value: 12, Label: "December" },
  ]

  const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  // Check if a specific day of week is available for selected months
  const isDayOfWeekAvailable = (day: string): boolean => {
    if (rule.months.length === 0) return true

    return rule.months.every((month: number) => {
      const occupied = occupiedSelections.occupiedByMonth.get(month)
      return !occupied?.has(day)
    })
  }

  // Check if a specific date is available for selected months
  const isDateAvailable = (date: number): boolean => {
    if (rule.months.length === 0) return true

    return rule.months.every((month: number) => {
      const occupied = occupiedSelections.occupiedByMonth.get(month)
      return !occupied?.has(date)
    })
  }

  // Get available dates for the selected months
  const getAvailableDateRanges = (): string => {
    if (rule.months.length === 0) return "Select months first"

    const availableDates: number[] = []
    for (let date = 1; date <= 31; date++) {
      if (isDateAvailable(date)) {
        availableDates.push(date)
      }
    }

    if (availableDates.length === 0) return "No dates available"
    if (availableDates.length === 31) return "All dates available (1-31)"

    // Show ranges
    const ranges: string[] = []
    let start = availableDates[0]
    let end = availableDates[0]

    for (let i = 1; i < availableDates.length; i++) {
      if (availableDates[i] === end + 1) {
        end = availableDates[i]
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`)
        start = availableDates[i]
        end = availableDates[i]
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`)

    return `Available: ${ranges.join(", ")}`
  }

  const handleSelectDrivecycle = (drivecycleId: string) => {
    const drivecycle = drivecycles.find((dc) => dc.id === drivecycleId)
    if (drivecycle) {
      setRule({
        ...rule,
        drivecycleId,
        drivecycleName: drivecycle.name,
      })
    }
  }

  const handleMonthToggle = (month: number) => {
    const newMonths = rule.months.includes(month)
      ? rule.months.filter((m: number) => m !== month)
      : [...rule.months, month]

    // Clear selections that might become invalid with new month selection
    setRule({
      ...rule,
      months: newMonths,
      daysOfWeek: rule.daysOfWeek.filter((day: string) => {
        return newMonths.every((m: number) => {
          const occupied = occupiedSelections.occupiedByMonth.get(m)
          return !occupied?.has(day)
        })
      }),
      dates: rule.dates.filter((date: number) => {
        return newMonths.every((m: number) => {
          const occupied = occupiedSelections.occupiedByMonth.get(m)
          return !occupied?.has(date)
        })
      })
    })
  }

  const handleDayToggle = (day: string) => {
    if (!isDayOfWeekAvailable(day)) return

    const newDays = rule.daysOfWeek.includes(day)
      ? rule.daysOfWeek.filter((d: string) => d !== day)
      : [...rule.daysOfWeek, day]
    setRule({ ...rule, daysOfWeek: newDays })
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dates = e.target.value
      .split(",")
      .map((d: string) => Number.parseInt(d.trim()))
      .filter((d: number) => !isNaN(d) && d >= 1 && d <= 31 && isDateAvailable(d))
    setRule({ ...rule, dates })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rule.drivecycleId) {
      alert("Please select a drive cycle")
      return
    }
    if (rule.months.length === 0) {
      alert("Select at least one month")
      return
    }
    if (!useDate && rule.daysOfWeek.length === 0) {
      alert("Select at least one day of week")
      return
    }
    if (useDate && rule.dates.length === 0) {
      alert("Enter at least one valid date")
      return
    }
    onSubmit(rule)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>

            <Label htmlFor="drivecycleId" className="text-sm font-medium">
              Select Drive Cycle *
            </Label>

            <Select value={rule.drivecycleId} onValueChange={handleSelectDrivecycle}>
              <SelectTrigger id="drivecycleId" className="w-full mt-2">
                <SelectValue placeholder="Choose a drive cycle" />
              </SelectTrigger>

              <SelectContent>
                {drivecycles.map((dc) => (
                  <SelectItem key={dc.id} value={dc.id}>
                    {dc.id} - {dc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div>
            <Label className="text-sm font-medium mb-3 block">Select Months *</Label>

            <div className="grid grid-cols-3 gap-3">
              {MONTHS.map((month) => {
                const isSelected = rule.months.includes(month.value);

                return (
                  <Toggle
                    key={month.value}
                    pressed={isSelected}
                    onPressedChange={() => handleMonthToggle(month.value)}
                    className="w-full justify-center py-2 text-sm"
                  >
                    {month.Label}
                  </Toggle>
                );
              })}
            </div>
          </div>


          <div>
            <Label className="text-sm font-medium mb-3 block">Calendar Filter *</Label>

            <div className="space-y-4">

              {/* Radio: Days of Week */}
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="useDay"
                  checked={!useDate}
                  onChange={() => {
                    setUseDate(false)
                    setRule({ ...rule, dates: [] })
                  }}
                  className="cursor-pointer"
                />
                <Label htmlFor="useDay" className="text-sm cursor-pointer">
                  Days of Week
                </Label>
              </div>

              {/* BUTTON UI — Days of Week */}
              {!useDate && (
                <div className="grid grid-cols-4 gap-3 pl-6">
                  {DAYS_OF_WEEK.map((day) => {
                    const isAvailable = isDayOfWeekAvailable(day)
                    const isSelected = rule.daysOfWeek.includes(day)

                    return (
                      <Toggle
                        key={day}
                        pressed={isSelected}
                        onPressedChange={() => isAvailable && handleDayToggle(day)}
                        disabled={!isAvailable}
                        className={`
            w-full justify-center py-2 text-sm
            ${!isAvailable ? "opacity-50 cursor-not-allowed line-through" : ""}
          `}
                      >
                        {day}
                      </Toggle>
                    )
                  })}
                </div>
              )}


              {/* Radio: Specific Dates */}
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="useDate"
                  checked={useDate}
                  onChange={() => {
                    setUseDate(true)
                    setRule({ ...rule, daysOfWeek: [] })
                  }}
                  className="cursor-pointer"
                />
                <Label htmlFor="useDate" className="text-sm cursor-pointer">
                  Specific Dates
                </Label>
              </div>

              {/* Date Input */}
              {useDate && (
                <div className="pl-6 space-y-2">
                  <input
                    type="text"
                    placeholder="e.g., 1, 15, 30"
                    onChange={handleDateInputChange}
                    defaultValue={rule.dates.join(", ")}
                    className="w-full p-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {getAvailableDateRanges()}
                  </p>
                </div>
              )}
            </div>
          </div>


          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <textarea
              id="notes"
              value={rule.notes}
              onChange={(e) => setRule({ ...rule, notes: e.target.value })}
              placeholder="Optional description of this rule"
              rows={2}
              className="w-full mt-2 p-2 border rounded-md bg-background"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Rule" : "Add Rule"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
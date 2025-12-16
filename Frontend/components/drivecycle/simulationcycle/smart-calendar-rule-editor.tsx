// FILE: Frontend/components/drivecycle/simulationcycle/smart-calendar-rule-editor.tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Toggle } from "@/components/ui/toggle"
import { CalendarRule, getOccupiedSelections } from "./calendar-types"

interface SmartCalendarRuleEditorProps {
  drivecycles: any[]
  onSubmit: (rule: any) => void
  onCancel: () => void
  initialData?: Partial<CalendarRule>
  isEditing?: boolean
  occupiedSelections: ReturnType<typeof getOccupiedSelections>
}

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

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export default function SmartCalendarRuleEditor({
  drivecycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
  occupiedSelections,
}: SmartCalendarRuleEditorProps) {
  const [rule, setRule] = useState<Partial<CalendarRule>>(
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
    if (!rule.months || rule.months.length === 0) return "Select months first"
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
      } as Partial<CalendarRule>)
    }
  }

  const handleMonthToggle = (month: number) => {
    const newMonths = rule.months?.includes(month)
      ? rule.months.filter((m: number) => m !== month)
      : [...(rule.months || []), month]
    // Clear selections that might become invalid with new month selection
    setRule({
      ...rule,
      months: newMonths,
      daysOfWeek: (rule.daysOfWeek || []).filter((day: string) => {
        return newMonths.every((m: number) => {
          const occupied = occupiedSelections.occupiedByMonth.get(m)
          return !occupied?.has(day)
        })
      }),
      dates: (rule.dates || []).filter((date: number) => {
        return newMonths.every((m: number) => {
          const occupied = occupiedSelections.occupiedByMonth.get(m)
          return !occupied?.has(date)
        })
      })
    } as Partial<CalendarRule>)
  }

  const handleDayToggle = (day: string) => {
    if (!isDayOfWeekAvailable(day)) return
    const newDays = rule.daysOfWeek?.includes(day)
      ? (rule.daysOfWeek || []).filter((d: string) => d !== day)
      : [...(rule.daysOfWeek || []), day]
    setRule({ ...rule, daysOfWeek: newDays } as Partial<CalendarRule>)
  }

  // Updated: Parse ranges like 3-10,12,30 and expand to full list
  const parseDatesWithRanges = (input: string): number[] => {
    const parts = input.split(',').map(p => p.trim()).filter(p => p)
    const dates: number[] = []
    parts.forEach(part => {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-')
        const start = parseInt(startStr, 10)
        const end = parseInt(endStr, 10)
        if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 31 && start <= end) {
          for (let d = start; d <= end; d++) {
            if (isDateAvailable(d) && !dates.includes(d)) {
              dates.push(d)
            }
          }
        }
      } else {
        const d = parseInt(part, 10)
        if (!isNaN(d) && d >= 1 && d <= 31 && isDateAvailable(d) && !dates.includes(d)) {
          dates.push(d)
        }
      }
    })
    return dates.sort((a: number, b: number) => a - b)
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const parsedDates = parseDatesWithRanges(input)
    setRule({ ...rule, dates: parsedDates } as Partial<CalendarRule>)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rule.drivecycleId) {
      alert("Please select a drive cycle")
      return
    }
    if (!rule.months || rule.months.length === 0) {
      alert("Select at least one month")
      return
    }
    if (!useDate && (!rule.daysOfWeek || rule.daysOfWeek.length === 0)) {
      alert("Select at least one day of week")
      return
    }
    if (useDate && (!rule.dates || rule.dates.length === 0)) {
      alert("Enter at least one valid date")
      return
    }
    onSubmit(rule)
  }

  // For display in editor, show expanded comma-separated
  const displayDates = (rule.dates || []).sort((a: number, b: number) => a - b).join(', ')

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="drivecycleId" className="text-sm font-medium">
              Select Drive Cycle *
            </Label>
            <Select value={rule.drivecycleId || ""} onValueChange={handleSelectDrivecycle}>
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
                const isSelected = (rule.months || []).includes(month.value);
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
                    setRule({ ...rule, dates: [] } as Partial<CalendarRule>)
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
                    const isSelected = (rule.daysOfWeek || []).includes(day)
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
                    setRule({ ...rule, daysOfWeek: [] } as Partial<CalendarRule>)
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
                    placeholder="e.g., 3-10,12,30"
                    onChange={handleDateInputChange}
                    value={initialData ? (initialData.dates || []).join(',') : displayDates}
                    className="w-full p-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {getAvailableDateRanges()}
                  </p>
                  {(rule.dates || []).length > 0 && (
                    <p className="text-xs text-green-600">
                      Selected: {displayDates}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <textarea
              id="notes"
              value={rule.notes || ""}
              onChange={(e) => setRule({ ...rule, notes: e.target.value } as Partial<CalendarRule>)}
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
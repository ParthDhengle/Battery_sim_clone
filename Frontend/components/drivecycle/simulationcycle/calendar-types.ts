// FILE: Frontend/components/drivecycle/simulationcycle/calendar-types.ts
export interface CalendarRule {
  id: string
  ruleIndex: number
  drivecycleId: string
  drivecycleName: string
  months: number[]
  daysOfWeek: string[]
  dates: number[]
  notes: string
}

export interface CalendarAssignmentProps {
  drivecycles: any[]
  onCalendarChange: (rules: CalendarRule[]) => void
  calendarData: CalendarRule[]
  simId: string
}

export const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

// Helper: which days does a rule cover?
export function getDaysCoveredByRule(rule: Partial<CalendarRule>): Set<number> {
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
export function getOccupiedSelections(
  existingRules: CalendarRule[], 
  excludeRuleId?: string
): {
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
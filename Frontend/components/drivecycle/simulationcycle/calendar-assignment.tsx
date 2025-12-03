"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus } from "lucide-react"
import CalendarRuleEditor from "./calendar-rule-editor"
import CalendarRuleTable from "./calendar-rule-table"

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
}

export default function CalendarAssignment({ drivecycles, onCalendarChange, calendarData }: CalendarAssignmentProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const generateId = () => `RULE_${Date.now()}`

  const handleAddRule = (rule: Omit<CalendarRule, "id">) => {
    onCalendarChange([
      ...calendarData,
      {
        ...rule,
        id: generateId(),
        ruleIndex: calendarData.length + 1,
      },
    ])
    setShowNew(false)
  }

  const handleEditRule = (id: string, rule: Omit<CalendarRule, "id">) => {
    onCalendarChange(calendarData.map((r) => (r.id === id ? { ...rule, id } : r)))
    setEditing(null)
  }

  const handleDeleteRule = (id: string) => {
    onCalendarChange(calendarData.filter((r) => r.id !== id))
  }

  if (showNew) {
    return <CalendarRuleEditor drivecycles={drivecycles} onSubmit={handleAddRule} onCancel={() => setShowNew(false)} />
  }

  if (editing) {
    const rule = calendarData.find((r) => r.id === editing)
    if (rule) {
      return (
        <CalendarRuleEditor
          drivecycles={drivecycles}
          onSubmit={(newRule) => handleEditRule(editing, newRule)}
          onCancel={() => setEditing(null)}
          initialData={rule}
          isEditing
        />
      )
    }
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setShowNew(true)} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Calendar Rule
      </Button>

      {calendarData.length === 0 ? (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-muted-foreground">
              No calendar rules created yet. Add rules to map drive cycles to calendar days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <CalendarRuleTable rules={calendarData} onEdit={(id) => setEditing(id)} onDelete={handleDeleteRule} />
        </div>
      )}

      <Card className="bg-secondary/30">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold mb-2">Calendar Assignment Info:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Rules are evaluated top-to-bottom (later rules override earlier ones)</li>
            <li>Each rule applies to matched days: Months ∩ (Days of Week OR Dates)</li>
            <li>Use Days of Week OR Dates, but not both</li>
            <li>Unmatched days receive DC_IDLE (automatic idle cycle)</li>
            <li>Total: 364 days per calendar year</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface CalendarRuleEditorProps {
  drivecycles: any[]
  onSubmit: (rule: any) => void
  onCancel: () => void
  initialData?: any
  isEditing?: boolean
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function CalendarRuleEditor({
  drivecycles,
  onSubmit,
  onCancel,
  initialData,
  isEditing,
}: CalendarRuleEditorProps) {
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
    const newMonths = rule.months.includes(month) ? rule.months.filter((m) => m !== month) : [...rule.months, month]
    setRule({ ...rule, months: newMonths })
  }

  const handleDayToggle = (day: string) => {
    const newDays = rule.daysOfWeek.includes(day) ? rule.daysOfWeek.filter((d) => d !== day) : [...rule.daysOfWeek, day]
    setRule({ ...rule, daysOfWeek: newDays })
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dates = e.target.value
      .split(",")
      .map((d) => Number.parseInt(d.trim()))
      .filter((d) => !isNaN(d) && d >= 1 && d <= 31)
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
      alert("Enter at least one date")
      return
    }
    onSubmit(rule)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="drivecycleId">Select Drive Cycle *</Label>
            <Select value={rule.drivecycleId} onValueChange={handleSelectDrivecycle}>
              <SelectTrigger id="drivecycleId">
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
            <Label className="mb-3 block">Select Months *</Label>
            <div className="grid grid-cols-3 gap-3">
              {MONTHS.map((month) => (
                <div key={month.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`month-${month.value}`}
                    checked={rule.months.includes(month.value)}
                    onCheckedChange={() => handleMonthToggle(month.value)}
                  />
                  <Label htmlFor={`month-${month.value}`} className="font-normal cursor-pointer">
                    {month.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Calendar Filter *</Label>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="useDay"
                  checked={!useDate}
                  onCheckedChange={() => {
                    setUseDate(false)
                    setRule({ ...rule, dates: [] })
                  }}
                />
                <Label htmlFor="useDay" className="font-normal cursor-pointer">
                  Days of Week
                </Label>
              </div>

              {!useDate && (
                <div className="grid grid-cols-4 gap-3 pl-6">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day}`}
                        checked={rule.daysOfWeek.includes(day)}
                        onCheckedChange={() => handleDayToggle(day)}
                      />
                      <Label htmlFor={`day-${day}`} className="font-normal cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="useDate"
                  checked={useDate}
                  onCheckedChange={() => {
                    setUseDate(true)
                    setRule({ ...rule, daysOfWeek: [] })
                  }}
                />
                <Label htmlFor="useDate" className="font-normal cursor-pointer">
                  Specific Dates
                </Label>
              </div>

              {useDate && (
                <div className="pl-6">
                  <Input
                    placeholder="e.g., 1, 15, 30"
                    onChange={handleDateInputChange}
                    defaultValue={rule.dates.join(", ")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter comma-separated dates (1-31)</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={rule.notes}
              onChange={(e) => setRule({ ...rule, notes: e.target.value })}
              placeholder="Optional description of this rule"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEditing ? "Update Rule" : "Add Rule"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

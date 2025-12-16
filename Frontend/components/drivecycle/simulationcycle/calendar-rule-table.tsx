// FILE: Frontend/components/drivecycle/simulationcycle/calendar-rule-table.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit2, Trash2 } from "lucide-react"

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

interface CalendarRuleTableProps {
  rules: CalendarRule[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function CalendarRuleTable({ rules, onEdit, onDelete }: CalendarRuleTableProps) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Index</TableHead>
            <TableHead>Drive Cycle</TableHead>
            <TableHead>Months</TableHead>
            <TableHead>Days/Dates</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule, idx) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{idx + 1}</TableCell>
              <TableCell>
                <div>
                  <p className="font-semibold">{rule.drivecycleId}</p>
                  <p className="text-sm text-muted-foreground">{rule.drivecycleName}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm">{rule.months.map((m) => MONTH_NAMES[m - 1]).join(", ")}</TableCell>
              <TableCell className="text-sm">
                {rule.daysOfWeek.length > 0 ? rule.daysOfWeek.join(", ") : rule.dates.sort((a, b) => a - b).join(", ")}
              </TableCell>
              <TableCell className="text-sm">{rule.notes || "-"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(rule.id)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(rule.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
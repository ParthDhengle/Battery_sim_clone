"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { add, addDays, eachMonthOfInterval, format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

interface SubCycleStep {
  value: number
  isDynamic: boolean
  unit: "A" | "C" | "W" | "V"
  duration: number
  triggerCondition?: string
  repetitions: number
}

interface SubCycle {
  id: string
  name: string
  steps: SubCycleStep[]
}

interface DriveCycleSegment {
  subCycleId: string
  repetitions: number
  ambientTemp: number
  triggerCondition?: string
}

interface DriveCycle {
  id: string
  name: string
  segments: DriveCycleSegment[]
}

interface CalendarRule {
  months: string // comma-separated, e.g., "1,2,3"
  filterType: "weekday" | "date"
  daysOrDates: string // comma-separated, e.g., "Mon,Tue" or "1,15,30"
  driveCycleId: string
}

interface SimulationDuration {
  years: number
  months: number
  days: number
}

interface Config {
  subCycles: SubCycle[]
  driveCycles: DriveCycle[]
  calendarRules: CalendarRule[]
  defaultDriveCycleId: string
  simulationDuration: SimulationDuration
  startDate: string
  endDate: string
}

interface ManualDriveCycleBuilderProps {
  onConfigUpdate: (config: Config) => void
  startingSoc: string
  loadedConfig?: Config | null
}

export function ManualDriveCycleBuilder({ onConfigUpdate, startingSoc, loadedConfig }: ManualDriveCycleBuilderProps) {
  const [subCycles, setSubCycles] = useState<SubCycle[]>([])
  const [currentSubCycleId, setCurrentSubCycleId] = useState("SC-001")
  const [currentSubCycleName, setCurrentSubCycleName] = useState("")
  const [currentSubCycleSteps, setCurrentSubCycleSteps] = useState<SubCycleStep[]>([])
  const [driveCycles, setDriveCycles] = useState<DriveCycle[]>([])
  const [currentDriveCycleId, setCurrentDriveCycleId] = useState("DC-001")
  const [currentDriveCycleName, setCurrentDriveCycleName] = useState("")
  const [currentDriveCycleSegments, setCurrentDriveCycleSegments] = useState<DriveCycleSegment[]>([])
  const [calendarRules, setCalendarRules] = useState<CalendarRule[]>([])
  const [newRuleSelectedMonths, setNewRuleSelectedMonths] = useState<number[]>([])
  const [newRuleFilterType, setNewRuleFilterType] = useState<"weekday" | "date">("weekday")
  const [newRuleSelectedWeekdays, setNewRuleSelectedWeekdays] = useState<string[]>([])
  const [newRuleDates, setNewRuleDates] = useState("")
  const [newRuleDriveCycleId, setNewRuleDriveCycleId] = useState("")
  const [defaultDriveCycleId, setDefaultDriveCycleId] = useState("")
  const [error, setError] = useState("")
  const [currentStep, setCurrentStep] = useState(1) // 1: Sub-Cycle, 2: Drive Cycle, 3: Calendar
  const [simYears, setSimYears] = useState(1)
  const [simMonths, setSimMonths] = useState(0)
  const [simDays, setSimDays] = useState(0)
  const [startDate, setStartDate] = useState<Date>(new Date(2025, 9, 14))
  const [isLoaded, setIsLoaded] = useState(false)

  const months = [
    { num: 1, label: "Jan" }, { num: 2, label: "Feb" }, { num: 3, label: "Mar" },
    { num: 4, label: "Apr" }, { num: 5, label: "May" }, { num: 6, label: "Jun" },
    { num: 7, label: "Jul" }, { num: 8, label: "Aug" }, { num: 9, label: "Sep" },
    { num: 10, label: "Oct" }, { num: 11, label: "Nov" }, { num: 12, label: "Dec" },
  ]

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const endInclusive = (simYears + simMonths + simDays === 0)
    ? startDate
    : addDays(add(startDate, { years: simYears, months: simMonths, days: simDays }), -1);

  const simulationInterval = {
    start: startOfDay(startDate),
    end: endOfDay(endInclusive)
  };

  const monthsInPeriod = eachMonthOfInterval({
    start: startDate,
    end: endInclusive
  });

  const availableMonthNums = [...new Set(monthsInPeriod.map(m => m.getMonth() + 1))].sort((a, b) => a - b);

  const isMatchedDay = (day: Date): boolean => {
    if (!isWithinInterval(day, simulationInterval)) return false
    const month = day.getMonth() + 1
    const weekday = format(day, "EEE")
    const date = day.getDate()
    for (const rule of calendarRules) {
      const ruleMonths = rule.months.split(",").map(Number)
      if (!ruleMonths.includes(month)) continue
      if (rule.filterType === "weekday") {
        const ruleDays = rule.daysOrDates.split(",")
        if (ruleDays.includes(weekday)) return true
      } else {
        const ruleDates = rule.daysOrDates.split(",").map(Number)
        if (ruleDates.includes(date)) return true
      }
    }
    return false
  }

  useEffect(() => {
    if (loadedConfig && !isLoaded) {
      setSubCycles(loadedConfig.subCycles || [])
      setDriveCycles(loadedConfig.driveCycles || [])
      setCalendarRules(loadedConfig.calendarRules || [])
      setDefaultDriveCycleId(loadedConfig.defaultDriveCycleId || "")
      setSimYears(loadedConfig.simulationDuration?.years || 1)
      setSimMonths(loadedConfig.simulationDuration?.months || 0)
      setSimDays(loadedConfig.simulationDuration?.days || 0)
      setStartDate(loadedConfig.startDate ? parseISO(loadedConfig.startDate) : new Date(2025, 9, 14))
      setIsLoaded(true)
      setCurrentStep(1) // Reset to first step for viewing/editing
    }
  }, [loadedConfig, isLoaded])

  useEffect(() => {
    const config = getCurrentConfig()
    onConfigUpdate(config)
  }, [subCycles, driveCycles, calendarRules, defaultDriveCycleId, simYears, simMonths, simDays, startDate])

  const getCurrentConfig = (): Config => ({
    subCycles,
    driveCycles,
    calendarRules,
    defaultDriveCycleId,
    simulationDuration: { years: simYears, months: simMonths, days: simDays },
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endInclusive, "yyyy-MM-dd")
  })

  // Sub-Cycle Handlers
  const addSubCycleStep = () => {
    setCurrentSubCycleSteps([
      ...currentSubCycleSteps,
      { value: 0, isDynamic: false, unit: "A", duration: 0, repetitions: 1 },
    ])
  }

  const updateSubCycleStep = (index: number, field: keyof SubCycleStep, value: any) => {
    const updatedSteps = [...currentSubCycleSteps]
    updatedSteps[index] = { ...updatedSteps[index], [field]: value }
    setCurrentSubCycleSteps(updatedSteps)
  }

  const removeSubCycleStep = (index: number) => {
    setCurrentSubCycleSteps(currentSubCycleSteps.filter((_, i) => i !== index))
  }

  const generateSubCycleId = (subCycles: SubCycle[]) => {
    let maxNum = 0;
    subCycles.forEach(({ id }) => {
      const match = id.match(/^SC-(\d{3})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `SC-${String(maxNum + 1).padStart(3, "0")}`;
  }

  const saveSubCycle = () => {
    if (!currentSubCycleId || !currentSubCycleName || currentSubCycleSteps.length === 0) {
      setError("Sub-cycle ID, name, and at least one step are required")
      return
    }
    if (subCycles.some((sc) => sc.id === currentSubCycleId)) {
      setSubCycles(
        subCycles.map((sc) =>
          sc.id === currentSubCycleId
            ? { id: currentSubCycleId, name: currentSubCycleName, steps: currentSubCycleSteps }
            : sc
        )
      )
    } else {
      setSubCycles([
        ...subCycles,
        { id: currentSubCycleId, name: currentSubCycleName, steps: currentSubCycleSteps },
      ])
    }
    resetSubCycleForm()
  }

  const loadSubCycle = (id: string) => {
    const sc = subCycles.find((sc) => sc.id === id)
    if (sc) {
      setCurrentSubCycleId(sc.id)
      setCurrentSubCycleName(sc.name)
      setCurrentSubCycleSteps(sc.steps)
    }
  }

  const resetSubCycleForm = () => {
    setCurrentSubCycleId(generateSubCycleId(subCycles))
    setCurrentSubCycleName("")
    setCurrentSubCycleSteps([])
    setError("")
  }

  // Drive Cycle Handlers
  const addDriveCycleSegment = () => {
    setCurrentDriveCycleSegments([
      ...currentDriveCycleSegments,
      { subCycleId: "", repetitions: 1, ambientTemp: 25 },
    ])
  }

  const updateDriveCycleSegment = (index: number, field: keyof DriveCycleSegment, value: any) => {
    const updatedSegments = [...currentDriveCycleSegments]
    updatedSegments[index] = { ...updatedSegments[index], [field]: value }
    setCurrentDriveCycleSegments(updatedSegments)
  }

  const removeDriveCycleSegment = (index: number) => {
    setCurrentDriveCycleSegments(currentDriveCycleSegments.filter((_, i) => i !== index))
  }

  const generateDriveCycleId = (driveCycles: DriveCycle[]) => {
    let maxNum = 0;
    driveCycles.forEach(({ id }) => {
      const match = id.match(/^DC-(\d{3})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `DC-${String(maxNum + 1).padStart(3, "0")}`;
  }

  const saveDriveCycle = () => {
    if (!currentDriveCycleId || !currentDriveCycleName || currentDriveCycleSegments.length === 0) {
      setError("Drive cycle ID, name, and at least one segment are required")
      return
    }
    if (driveCycles.some((dc) => dc.id === currentDriveCycleId)) {
      setDriveCycles(driveCycles.map((dc) => (dc.id === currentDriveCycleId ? { id: currentDriveCycleId, name: currentDriveCycleName, segments: currentDriveCycleSegments } : dc)))
    } else {
      setDriveCycles([...driveCycles, { id: currentDriveCycleId, name: currentDriveCycleName, segments: currentDriveCycleSegments }])
    }
    resetDriveCycleForm()
  }

  const loadDriveCycle = (id: string) => {
    const dc = driveCycles.find((dc) => dc.id === id)
    if (dc) {
      setCurrentDriveCycleId(dc.id)
      setCurrentDriveCycleName(dc.name)
      setCurrentDriveCycleSegments(dc.segments)
    }
  }

  const resetDriveCycleForm = () => {
    setCurrentDriveCycleId(generateDriveCycleId(driveCycles))
    setCurrentDriveCycleName("")
    setCurrentDriveCycleSegments([])
  }

  // Calendar Rule Handlers
  const toggleMonth = (monthNum: number) => {
    setNewRuleSelectedMonths(prev =>
      prev.includes(monthNum) ? prev.filter(m => m !== monthNum) : [...prev, monthNum]
    )
  }

  const toggleWeekday = (day: string) => {
    setNewRuleSelectedWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const addCalendarRule = () => {
    if (newRuleSelectedMonths.length === 0 || !newRuleDriveCycleId) {
      setError("Months and Drive Cycle ID are required")
      return
    }
    let daysOrDates = ""
    if (newRuleFilterType === "weekday") {
      if (newRuleSelectedWeekdays.length === 0) {
        setError("Select at least one weekday")
        return
      }
      daysOrDates = newRuleSelectedWeekdays.join(",")
    } else {
      if (!newRuleDates) {
        setError("Enter dates")
        return
      }
      daysOrDates = newRuleDates
      const dateNums = daysOrDates.split(",").map(d => parseInt(d.trim()))
      if (dateNums.some(d => isNaN(d) || d < 1 || d > 31)) {
        setError("Dates must be between 1-31")
        return
      }
      if (newRuleSelectedMonths.includes(2) && dateNums.some(d => d > 28)) {
        setError("Note: February has only 28 days in 2025 (non-leap year)")
      }
    }

    setCalendarRules([
      ...calendarRules,
      {
        months: newRuleSelectedMonths.sort((a,b)=>a-b).join(","),
        filterType: newRuleFilterType,
        daysOrDates,
        driveCycleId: newRuleDriveCycleId,
      },
    ])
    resetRuleForm()
  }

  const removeCalendarRule = (index: number) => {
    setCalendarRules(calendarRules.filter((_, i) => i !== index))
  }

  const resetRuleForm = () => {
    setNewRuleSelectedMonths([])
    setNewRuleFilterType("weekday")
    setNewRuleSelectedWeekdays([])
    setNewRuleDates("")
    setNewRuleDriveCycleId("")
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">1. Sub-Cycle Builder</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subcycle-id">Sub-Cycle ID</Label>
              <Input id="subcycle-id" value={currentSubCycleId} onChange={(e) => setCurrentSubCycleId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcycle-name">Name</Label>
              <Input id="subcycle-name" value={currentSubCycleName} onChange={(e) => setCurrentSubCycleName(e.target.value)} />
            </div>
          </div>
          <Button onClick={addSubCycleStep}>Add Step</Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
                <TableHead>Dynamic?</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Duration (s)</TableHead>
                <TableHead>Trigger Condition</TableHead>
                <TableHead>Repetitions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentSubCycleSteps.map((step, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input type="number" step="any" value={step.value} onChange={(e) => updateSubCycleStep(index, "value", Number.parseFloat(e.target.value))} />
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={step.isDynamic} onCheckedChange={(checked) => updateSubCycleStep(index, "isDynamic", checked)} />
                  </TableCell>
                  <TableCell>
                    <Select value={step.unit} onValueChange={(value: "A" | "C" | "W" | "V") => updateSubCycleStep(index, "unit", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A (Current)</SelectItem>
                        <SelectItem value="C">C-rate</SelectItem>
                        <SelectItem value="W">W (Power)</SelectItem>
                        <SelectItem value="V">V (Voltage)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" value={step.duration} onChange={(e) => updateSubCycleStep(index, "duration", Math.max(0, Number.parseInt(e.target.value) || 0))} />
                  </TableCell>
                  <TableCell>
                    <Input value={step.triggerCondition || ""} onChange={(e) => updateSubCycleStep(index, "triggerCondition", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="1" value={step.repetitions} onChange={(e) => updateSubCycleStep(index, "repetitions", Math.max(1, Number.parseInt(e.target.value) || 1))} />
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" onClick={() => removeSubCycleStep(index)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={saveSubCycle}>Save Sub-Cycle</Button>
          <div className="space-y-2">
            <Label>Load Existing Sub-Cycle</Label>
            <Select onValueChange={loadSubCycle}>
              <SelectTrigger>
                <SelectValue placeholder="Select sub-cycle" />
              </SelectTrigger>
              <SelectContent>
                {subCycles.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.name} ({sc.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setCurrentStep(2)}>Next: Drive Cycle Builder</Button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">2. Drive Cycle Builder</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="drivecycle-id">Drive Cycle ID</Label>
              <Input id="drivecycle-id" value={currentDriveCycleId} onChange={(e) => setCurrentDriveCycleId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drivecycle-name">Name</Label>
              <Input id="drivecycle-name" value={currentDriveCycleName} onChange={(e) => setCurrentDriveCycleName(e.target.value)} />
            </div>
          </div>
          <Button onClick={addDriveCycleSegment}>Add Segment</Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub-Cycle ID</TableHead>
                <TableHead>Repetitions</TableHead>
                <TableHead>Ambient Temp (°C)</TableHead>
                <TableHead>Trigger Condition</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentDriveCycleSegments.map((segment, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select value={segment.subCycleId} onValueChange={(value) => updateDriveCycleSegment(index, "subCycleId", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subCycles.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name} ({sc.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="1" value={segment.repetitions} onChange={(e) => updateDriveCycleSegment(index, "repetitions", Math.max(1, Number.parseInt(e.target.value) || 1))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="-50" max="50" step="0.1" value={segment.ambientTemp} onChange={(e) => updateDriveCycleSegment(index, "ambientTemp", Number.parseFloat(e.target.value) || 25)} />
                  </TableCell>
                  <TableCell>
                    <Input value={segment.triggerCondition || ""} onChange={(e) => updateDriveCycleSegment(index, "triggerCondition", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" onClick={() => removeDriveCycleSegment(index)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={saveDriveCycle}>Save Drive Cycle</Button>
          <div className="space-y-2">
            <Label>Load Existing Drive Cycle</Label>
            <Select onValueChange={loadDriveCycle}>
              <SelectTrigger>
                <SelectValue placeholder="Select drive cycle" />
              </SelectTrigger>
              <SelectContent>
                {driveCycles.map((dc) => (
                  <SelectItem key={dc.id} value={dc.id}>
                    {dc.name} ({dc.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button onClick={() => setCurrentStep(3)}>Next: Calendar Assignment</Button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">3. Calendar Assignment</h2>
          <div className="space-y-4">
            <div className="space-y-2">
  <Label>Start Date</Label>

  <Popover onOpenChange={(open) => console.log("Popover open:", open)}>
    <PopoverTrigger asChild>
      {/* If this works with <button> but not your <Button>, your Button likely doesn't forwardRef */}
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-sans",
          !startDate && "text-muted-foreground"
        )}
      >
        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
      </Button>
    </PopoverTrigger>

    {/* stronger z-index + align + sideOffset to avoid clipping */}
    <PopoverContent className="w-auto p-0 z-50" align="start" sideOffset={6}>
      <CalendarComponent
        mode="single"
        selected={startDate}
        onSelect={(date: Date | undefined) => {
          if (date) {
            setStartDate(date)
          }
        }}
        initialFocus
        disabled={(date) => date < new Date(2000, 0, 1) || date > new Date(2050, 11, 31)}
      />
    </PopoverContent>
  </Popover>
</div>
            <div className="space-y-2">
              <Label>Simulation Duration</Label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sim-years">Years</Label>
                  <Input id="sim-years" type="number" min="0" value={simYears} onChange={(e) => setSimYears(Math.max(0, Number.parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <Label htmlFor="sim-months">Months</Label>
                  <Input id="sim-months" type="number" min="0" max="11" value={simMonths} onChange={(e) => setSimMonths(Math.max(0, Math.min(11, Number.parseInt(e.target.value) || 0)))} />
                </div>
                <div>
                  <Label htmlFor="sim-days">Days</Label>
                  <Input id="sim-days" type="number" min="0" max="31" value={simDays} onChange={(e) => setSimDays(Math.max(0, Math.min(31, Number.parseInt(e.target.value) || 0)))} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                End Date: {startDate ? format(endInclusive, "PPP") : "Select a start date"}
              </p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Add New Rule</h3>
              <div className="space-y-2">
                <Label>Select Months (only available in simulation period)</Label>
                <div className="grid grid-cols-6 gap-2">
                  {months.filter(m => availableMonthNums.includes(m.num)).map((m) => (
                    <div key={m.num} className="flex items-center space-x-2">
                      <Checkbox
                        id={`month-${m.num}`}
                        checked={newRuleSelectedMonths.includes(m.num)}
                        onCheckedChange={() => toggleMonth(m.num)}
                      />
                      <label htmlFor={`month-${m.num}`} className="text-sm">
                        {m.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Filter Type</Label>
                <Select value={newRuleFilterType} onValueChange={(value: "weekday" | "date") => setNewRuleFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">Weekday</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newRuleFilterType === "weekday" ? (
                <div className="space-y-2">
                  <Label>Select Weekdays</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {weekdays.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`weekday-${day}`}
                          checked={newRuleSelectedWeekdays.includes(day)}
                          onCheckedChange={() => toggleWeekday(day)}
                        />
                        <label htmlFor={`weekday-${day}`} className="text-sm">
                          {day}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Dates (comma-separated, 1-31)</Label>
                  <Input
                    type="text"
                    value={newRuleDates}
                    onChange={(e) => setNewRuleDates(e.target.value.replace(/[^0-9,]/g, ''))} // Only allow numbers and commas
                    placeholder="1,15,30"
                  />
                  <p className="text-sm text-muted-foreground">Note: February has 28 days in 2025. Invalid dates will be ignored.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Drive Cycle ID</Label>
                <Select value={newRuleDriveCycleId} onValueChange={setNewRuleDriveCycleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select DC" />
                  </SelectTrigger>
                  <SelectContent>
                    {driveCycles.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name} ({dc.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addCalendarRule}>Add Rule</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Months</TableHead>
                  <TableHead>Filter Type</TableHead>
                  <TableHead>Days/Dates</TableHead>
                  <TableHead>Drive Cycle ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calendarRules.map((rule, index) => (
                  <TableRow key={index}>
                    <TableCell>{rule.months}</TableCell>
                    <TableCell>{rule.filterType}</TableCell>
                    <TableCell>{rule.daysOrDates}</TableCell>
                    <TableCell>{rule.driveCycleId}</TableCell>
                    <TableCell>
                      <Button variant="destructive" onClick={() => removeCalendarRule(index)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2">
              <Label>Default Drive Cycle ID (required for unmatched days)</Label>
              <Select value={defaultDriveCycleId} onValueChange={setDefaultDriveCycleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default DC" />
                </SelectTrigger>
                <SelectContent>
                  {driveCycles.map((dc) => (
                    <SelectItem key={dc.id} value={dc.id}>
                      {dc.name} ({dc.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Simulation Calendar Preview</h3>
              <div className="overflow-auto max-h-96">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {monthsInPeriod.map((month) => (
                    <div key={month.getTime()} className="space-y-2 border rounded-lg p-4 bg-background">
                      
                      <CalendarComponent
                        mode="single"
                        month={month}
                        modifiers={{
                          matched: isMatchedDay,
                          outside: (day) => !isWithinInterval(day, simulationInterval),
                        }}
                        classNames={{
                          day_selected: cn("bg-green-500 text-white hover:bg-green-600"),
                          day_outside: cn("text-muted-foreground opacity-50"),
                        }}
                        showOutsideDays
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setCurrentStep(2)}>Back</Button>
        </div>
      )}
    </div>
  )
}
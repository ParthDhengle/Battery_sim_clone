// FILE: Frontend/app/library/drive-cycles/page.tsx
"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Download, Pencil, Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { list_simulation_cycles, delete_simulation_cycle } from "@/lib/api/drive-cycle"
type DriveCycleConfig = {
  id: string;
  name: string;
  subCycles: number; // Count for summary
  driveCycles: number; // Count for summary
  calendarRules: number; // Count for summary
  created_at: string;
  simulation_table_path?: string | null;
  deleted_at?: string | null;
};
export default function DriveCycles() {
  const [driveCycles, setDriveCycles] = useState<DriveCycleConfig[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    loadDriveCycles();
  }, []);
  const loadDriveCycles = async () => {
    try {
      const cycles = await list_simulation_cycles();
      const formatted = cycles.map(c => ({
        id: c.id,
        name: c.name,
        subCycles: c.subcycle_ids.length,
        driveCycles: c.drive_cycles_metadata.length,
        calendarRules: c.calendar_assignments.length,
        created_at: c.created_at,
        simulation_table_path: c.simulation_table_path,
        deleted_at: c.deleted_at
      }));
      setDriveCycles(formatted.filter(c => !c.deleted_at));
    } catch (err) {
      setError("Failed to load drive cycles");
    }
  };
  const handleDelete = async (cycleId: string) => {
    if (confirm('Are you sure you want to delete this drive cycle? It will be permanently removed after 30 days.')) {
      try {
        await delete_simulation_cycle(cycleId)
        loadDriveCycles();
      } catch (err) {
        alert('Failed to delete drive cycle');
      }
    }
  };
  const handleDownload = async (config: DriveCycleConfig) => {
    if (!config.simulation_table_path) return
    try {
      const res = await fetch(`http://localhost:8000${config.simulation_table_path}`)
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert("Download failed")
    }
  };
  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-8 h-8" />
            Drive Cycle Library
          </h1>
          <p className="text-muted-foreground">Manage drive cycle configurations</p>
        </div>
        <Link href="/drive-cycle-builder">
          <Button>
            <Pencil className="w-4 h-4 mr-2" />
            Add Drive Cycle
          </Button>
        </Link>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {driveCycles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved Drive Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No drive cycles saved yet. Create your first drive cycle to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {driveCycles.map((dc) => (
            <Card key={dc.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{dc.name}</span>
                  {dc.simulation_table_path ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Incomplete
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{new Date(dc.created_at).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sub-Cycles:</span>
                    <p className="font-medium">{dc.subCycles}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Drive Cycles:</span>
                    <p className="font-medium">{dc.driveCycles}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Calendar Rules:</span>
                    <p className="font-medium">{dc.calendarRules}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/drive-cycle-builder?simId=${dc.id}`}>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  {dc.simulation_table_path && (
                    <Button variant="outline" size="sm" onClick={() => handleDownload(dc)}>
                      <Download className="w-3 h-3 mr-1" />
                      Download CSV
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(dc.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
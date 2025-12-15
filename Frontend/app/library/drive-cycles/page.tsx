// FILE: Frontend/app/library/drive-cycles/page.tsx
"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Download, Pencil, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { list_simulation_cycles } from "@/lib/api/drive-cycle"
type DriveCycleConfig = {
  id: string;
  name: string;
  subCycles: number; // Count for summary
  driveCycles: number; // Count for summary
  calendarRules: number; // Count for summary
  created_at: string;
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
        created_at: c.created_at
      }));
      setDriveCycles(formatted);
    } catch (err) {
      setError("Failed to load drive cycles");
    }
  };
  const handleDelete = async (cycleId: string) => {
    if (confirm('Are you sure you want to delete this drive cycle?')) {
      try {
        // Implement delete endpoint if needed
        loadDriveCycles();
      } catch (err) {
        alert('Failed to delete drive cycle');
      }
    }
  };
  const exportDriveCycle = (dc: DriveCycleConfig) => {
    const dataStr = JSON.stringify(dc, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dc.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
                  <CalendarDays className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardTitle>
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
                  <Button variant="outline" size="sm" onClick={() => exportDriveCycle(dc)}>
                    <Download className="w-3 h-3" />
                  </Button>
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
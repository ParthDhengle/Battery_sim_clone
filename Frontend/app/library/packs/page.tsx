"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Battery, Download, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { deletePack, getPacks } from "@/lib/api/packs";

export default function Packs() {
  const [packs, setPacks] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      const data = await getPacks();
      setPacks(data);
    } catch (err: any) {
      setError(err.message);
      setPacks([]);
    }
  };

  const handleDelete = async (packId: string) => {
    if (confirm("Are you sure you want to delete this pack?")) {
      try {
        await deletePack(packId);
        loadPacks();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const exportPack = (pack: any) => {
    const dataStr = JSON.stringify(pack, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pack.name.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Battery className="w-8 h-8" />
            Pack Library
          </h1>
          <p className="text-muted-foreground">Manage battery pack configurations</p>
        </div>
        <Link href="/pack-builder">
          <Button>
            <Pencil className="w-4 h-4 mr-2" />
            Add Pack
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {packs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved Packs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No packs saved yet. Create your first pack to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <Card key={pack._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{pack.name}</span>
                  <Battery className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardTitle>
                <CardDescription>
                  {pack.cell.form_factor === "cylindrical" ? "Cylindrical" : "Prismatic"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Capacity:</span>
                    <p className="font-medium">{pack.cell.capacity} Ah</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Cells:</span>
                    <p className="font-medium">{pack.summary.mechanical.total_cells}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Connection:</span>
                    <p className="font-medium">{pack.connection_type=='row_series_column_parallel'? 'Row Parallel' : 'Column Parallel' }</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/pack-builder?id=${pack._id}`}>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportPack(pack)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(pack._id)}
                  >
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
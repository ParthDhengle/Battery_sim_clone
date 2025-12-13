"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Battery, Ruler, Weight, Zap, Beaker, DollarSign,
  FileText, Gauge, Activity, ArrowUpDown, Package, CircuitBoard
} from "lucide-react";
import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import Link from "next/link";
import RCParameterPlots from "@/components/cell/RCParameterPlots";
import { getRCParameterFile } from "@/lib/api/cells";

type Cell = {
  id: string;
  name: string;
  formFactor: "cylindrical" | "prismatic" | "pouch" | "coin";
  dims: { radius?: number; length?: number; width?: number; height: number };
  cell_nominal_voltage: number;
  cell_upper_voltage_cutoff: number;
  cell_lower_voltage_cutoff: number;
  capacity: number;
  max_charging_current_continuous?: number | null;
  max_charging_current_instantaneous?: number | null;
  max_discharging_current_continuous?: number | null;
  max_discharging_current_instantaneous?: number | null;
  max_charge_voltage?: number | null;
  columbic_efficiency: number;
  cell_weight: number;
  cell_volume?: number | null;
  cost_per_cell: number;
  anode_composition: string;
  cathode_composition: string;
  rc_pair_type?: "rc2" | "rc3" | null;
  rc_parameter_file_path?: string | null;
  soh_file?: { name: string } | null;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  cell: Cell;
};

export default function CellDetailsView({ cell }: Props) {
  const [open, setOpen] = useState(false);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [loadingRC, setLoadingRC] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);

  const hasRCData = !!cell.rc_parameter_file_path && !!cell.rc_pair_type;

  useEffect(() => {
    if (open && hasRCData && !rcFile) {
      loadRCFile();
    }
  }, [open, hasRCData]);

  const loadRCFile = async () => {
    if (!cell.rc_parameter_file_path) return;
    setLoadingRC(true);
    setRcError(null);
    try {
      const file = await getRCParameterFile(cell.rc_parameter_file_path);
      setRcFile(file);
    } catch (err: any) {
      console.error("Failed to load RC file:", err);
      setRcError("Could not load RC parameter data");
    } finally {
      setLoadingRC(false);
    }
  };

  const formatDim = () => {
    const { formFactor, dims } = cell;
    if (formFactor === "cylindrical" || formFactor === "coin") {
      return `Radius: ${dims.radius?.toFixed(1) || "-"} mm • Height: ${dims.height.toFixed(1)} mm`;
    }
    return `L: ${dims.length?.toFixed(1) || "-"} × W: ${dims.width?.toFixed(1) || "-"} × H: ${dims.height.toFixed(1)} mm`;
  };

  const formFactorLabel = cell.formFactor.charAt(0).toUpperCase() + cell.formFactor.slice(1);
  const hasValue = (val: any) => val !== null && val !== undefined && val !== "";

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Battery className="w-3.5 h-3.5 mr-1" />
        View
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-full md:max-w-5xl lg:max-w-6xl max-h-[94vh] overflow-y-auto flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="bg-blue-500 p-2 rounded-lg shadow-lg">
                    <Battery className="w-6 h-6 text-white" />
                  </div>
                  {cell.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge variant="secondary">{formFactorLabel}</Badge>
                  {cell.rc_pair_type && (
                    <Badge variant={cell.rc_pair_type === "rc2" ? "default" : "outline"}
                      className={cell.rc_pair_type === "rc2" ? "bg-blue-600" : "border-purple-600 text-purple-700"}>
                      <CircuitBoard className="w-3 h-3 mr-1" />
                      {cell.rc_pair_type.toUpperCase()} Model
                    </Badge>
                  )}
                  {cell.soh_file && (
                    <Badge variant="outline" className="border-green-600 text-green-700">
                      <FileText className="w-3 h-3 mr-1" />
                      SOH Data
                    </Badge>
                  )}
                </div>
              </div>
              <Link href={`/cell-builder?id=${cell.id}`}>
                <Button variant="outline">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Cell
                </Button>
              </Link>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4 overflow-y-auto">

            <div className="space-y-3 py-3">

              {/* === 1. Core Electrical Specs === */}
              <section className="bg-white rounded-lg p-3 border border-yellow-200/50 shadow-sm">

                <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                  <div className="bg-yellow-500 p-1 rounded shadow">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  Core Electrical Parameters
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SpecCard icon={Battery} label="Capacity" value={`${cell.capacity} Ah`} color="text-amber-700" bgColor="bg-white" />
                  <SpecCard icon={Zap} label="Nominal Voltage" value={`${cell.cell_nominal_voltage} V`} color="text-green-700" bgColor="bg-white" />
                  <SpecCard icon={ArrowUpDown} label="Voltage Range" value={`${cell.cell_lower_voltage_cutoff}–${cell.cell_upper_voltage_cutoff} V`} color="text-blue-700" bgColor="bg-white" />
                  {hasValue(cell.max_charge_voltage) && (
                    <SpecCard icon={Gauge} label="Max Charge" value={`${cell.max_charge_voltage} V`} color="text-purple-700" bgColor="bg-white" />
                  )}
                </div>
              </section>

              {/* === 2. Physical Dimensions & Mass === */}
              <section className="bg-white rounded-lg p-3 border border-purple-200/50 shadow-sm">
                <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                  <div className="bg-purple-500 p-1 rounded shadow">
                    <Package className="w-3.5 h-3.5 text-white" />
                  </div>
                  Physical Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard icon={Ruler} label="Dimensions" value={formatDim()} />
                  <MetricCard icon={Weight} label="Weight" value={`${cell.cell_weight.toFixed(4)} kg`} />
                  {typeof cell.cell_volume === "number" && (
                    <MetricCard icon={Package} label="Volume" value={`${(cell.cell_volume/10000).toFixed(3)} x 10⁻⁵ m³`} />
                  )}
                </div>
              </section>

              {/* === 3. Charging & Discharging === */}
              <div className="grid md:grid-cols-2 gap-3">
                {/* Charging */}
                <section className="bg-white rounded-lg p-3 border border-green-200/50 shadow-sm">
                  <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                    <div className="bg-green-500 p-1 rounded shadow">
                      <Activity className="w-3.5 h-3.5 text-white" />
                    </div>
                    Charging Parameters
                  </h3>
                  <div className="space-y-2">
                    <DataRow
                      label="Continuous Current"
                      value={cell.max_charging_current_continuous ? `${cell.max_charging_current_continuous} A` : "Not specified"}
                      highlight={!!cell.max_charging_current_continuous}
                    />
                    <DataRow
                      label="Peak Current"
                      value={cell.max_charging_current_instantaneous ? `${cell.max_charging_current_instantaneous} A` : "Not specified"}
                      highlight={!!cell.max_charging_current_instantaneous}
                    />
                    <DataRow
                      label="Coulombic Efficiency"
                      value={`${(cell.columbic_efficiency * 100).toFixed(2)}%`}
                      highlight={true}
                    />
                  </div>
                </section>

                {/* Discharging */}
                <section className="bg-white rounded-lg p-3 border border-red-200/50 shadow-sm">
                  <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                    <div className="bg-red-500 p-1 rounded shadow">
                      <Activity className="w-3.5 h-3.5 text-white" />
                    </div>
                    Discharging Parameters
                  </h3>
                  <div className="space-y-2">
                    <DataRow
                      label="Continuous Current"
                      value={cell.max_discharging_current_continuous ? `${cell.max_discharging_current_continuous} A` : "Not specified"}
                      highlight={!!cell.max_discharging_current_continuous}
                    />
                    <DataRow
                      label="Peak Current"
                      value={cell.max_discharging_current_instantaneous ? `${cell.max_discharging_current_instantaneous} A` : "Not specified"}
                      highlight={!!cell.max_discharging_current_instantaneous}
                    />
                  </div>
                </section>
              </div>

              {/* === 4. Chemistry === */}
              <section className="bg-white rounded-lg p-3 border border-cyan-200/50 shadow-sm">
                <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                  <div className="bg-cyan-500 p-1 rounded shadow">
                    <Beaker className="w-3.5 h-3.5 text-white" />
                  </div>
                  Chemical Composition
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <ChemistryCard label="Anode Material" value={cell.anode_composition || "Not specified"} />
                  <ChemistryCard label="Cathode Material" value={cell.cathode_composition || "Not specified"} />
                </div>
              </section>

              {/* === Commercial Information === */}
              <section className="bg-white rounded-lg p-3 border border-cyan-200/50 shadow-sm">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <div className="bg-emerald-500 p-1.5 rounded shadow">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  Commercial Information
                </h3>
                <div className="bg-white rounded-lg p-4 border border-emerald-200">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Cost per Cell</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      ${cell.cost_per_cell.toFixed(2)}
                    </span>
                  </div>
                </div>
              </section>

              {/* === RC PARAMETER PLOTS === */}
              {hasRCData && (
                <section className="mt-6">
                  
                  {loadingRC && (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="mt-3">Loading RC parameter plots...</p>
                    </div>
                  )}

                  {rcError && (
                    <div className="text-center py-8 text-red-600 bg-red-50 rounded-lg">
                      {rcError}
                    </div>
                  )}

                  {rcFile && !loadingRC && !rcError && (
                    <RCParameterPlots
                      file={rcFile}
                      rcType={cell.rc_pair_type!}
                      onClose={() => setRcFile(null)} // Optional: allow closing
                    />
                  )}
                </section>
              )}
              {/* Metadata */}
              {(cell.created_at || cell.updated_at) && (
                <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
                  {cell.created_at && (
                    <div>Created: {new Date(cell.created_at).toLocaleString()}</div>
                  )}
                  {cell.updated_at && (
                    <div>Updated: {new Date(cell.updated_at).toLocaleString()}</div>
                  )}
                </div>
              )}
            </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
}


// Enhanced component designs
function SpecCard({ icon: Icon, label, value, color = "text-foreground", bgColor = "bg-muted/50" }: any) {
  return (
    <div className={`${bgColor} rounded-lg p-3 text-center border shadow-sm hover:shadow-md transition-shadow`}>
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold mt-1">{value}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-purple-600" />
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded p-2 border ${highlight ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-gray-900' : 'text-gray-500'}`}>{value}</span>
      </div>
    </div>
  );
}

function ChemistryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-cyan-200 shadow-sm">
      <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
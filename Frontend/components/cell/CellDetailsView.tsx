"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Battery, Ruler, Weight, Zap, Beaker, DollarSign,
  FileText, Gauge, Activity, ArrowUpDown, Package
} from "lucide-react";
import { useState } from "react";
import { Pencil } from "lucide-react";
import Link from "next/link"
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
  soh_file?: { name: string } | null;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  cell: Cell;
};

export default function CellDetailsView({ cell }: Props) {
  const [open, setOpen] = useState(false);

  const formatDim = () => {
    const { formFactor, dims } = cell;
    if (formFactor === "cylindrical" || formFactor === "coin") {
      return `Radius: ${dims.radius?.toFixed(1) || "-"} mm \n Height: ${dims.height.toFixed(1)} mm`;
    }
    return `Length: ${dims.length?.toFixed(1) || "-"} mm \n Width:${dims.width?.toFixed(1) || "-"} mm \n Height:${dims.height.toFixed(1)} mm`;
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
        <DialogContent className="max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center justify-between gap-4 pr-8">
              <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                <div className="bg-blue-500 p-2.5 rounded-xl shadow-lg">
                  <Battery className="w-8 h-8 text-white" />
                </div>
                {cell.name}
              </DialogTitle>
             <Link href={`/cell-builder?id=${cell.id}`}>
                <Button variant="outline" size="sm" className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                </Button>
            </Link>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary" className="text-sm px-3 py-1.5 font-medium">
                {formFactorLabel}
              </Badge>
              {cell.soh_file && (
                <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                  <FileText className="w-3 h-3 mr-1" />
                  SOH Data Available
                </Badge>
              )}
            </div>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="space-y-6 py-6">

              {/* === 1. Core Electrical Specs === */}
              <section className="bg-white rounded-2xl p-6 border border-yellow-200/50 shadow-sm">

                <h3 className="text-xl font-bold flex items-center gap-2 mb-5">
                  <div className="bg-yellow-500 p-2 rounded-lg shadow">
                    <Zap className="w-5 h-5 text-white" />
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
              <section className="bg-white rounded-2xl p-6 border border-purple-200/50 shadow-sm">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-5">
                  <div className="bg-purple-500 p-2 rounded-lg shadow">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  Physical Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard icon={Ruler} label="Dimensions" value={formatDim()} />
                  <MetricCard icon={Weight} label="Weight" value={`${cell.cell_weight.toFixed(4)} kg`} />
                  {hasValue(cell.cell_volume) && (
                    <MetricCard icon={Package} label="Volume" value={`${cell.cell_volume?.toFixed(0) / 1000} m³`} />
                  )}
                </div>
              </section>

              {/* === 3. Charging & Discharging === */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Charging */}
                <section className="bg-white rounded-2xl p-6 border border-green-200/50 shadow-sm">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <div className="bg-green-500 p-1.5 rounded-lg shadow">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    Charging Parameters
                  </h3>
                  <div className="space-y-3">
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
                <section className="bg-white rounded-2xl p-6 border border-red-200/50 shadow-sm">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <div className="bg-red-500 p-1.5 rounded-lg shadow">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    Discharging Parameters
                  </h3>
                  <div className="space-y-3">
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
              <section className="bg-white rounded-2xl p-6 border border-cyan-200/50 shadow-sm">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-5">
                  <div className="bg-cyan-500 p-2 rounded-lg shadow">
                    <Beaker className="w-5 h-5 text-white" />
                  </div>
                  Chemical Composition
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ChemistryCard label="Anode Material" value={cell.anode_composition || "Not specified"} />
                  <ChemistryCard label="Cathode Material" value={cell.cathode_composition || "Not specified"} />
                </div>
              </section>

              {/* === 5. Commercial === */}
              <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200/50 shadow-sm">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-5">
                  <div className="bg-emerald-500 p-2 rounded-lg shadow">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  Commercial Information
                </h3>
                <div className="bg-white rounded-xl p-5 border-2 border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-gray-700">Cost per Cell</span>
                    <span className="text-2xl font-bold text-emerald-600">${cell.cost_per_cell.toFixed(2)}</span>
                  </div>
                </div>
              </section>

              {cell.soh_file && (
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl p-5 border border-green-300 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 p-2 rounded-lg shadow">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-green-800">SOH Data File Attached</div>
                      <code className="text-sm bg-white px-3 py-1 rounded mt-1 inline-block border border-green-200">
                        {cell.soh_file.name}
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* === 6. Metadata === */}
              {(cell.created_at || cell.updated_at) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs text-gray-600 space-y-1.5">
                  {cell.created_at && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Created:</span>
                      <span>{new Date(cell.created_at).toLocaleString()}</span>
                    </div>
                  )}
                  {cell.updated_at && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Last Updated:</span>
                      <span>{new Date(cell.updated_at).toLocaleString()}</span>
                    </div>
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
    <div className={`${bgColor} rounded-xl p-5 text-center border-2 shadow-sm hover:shadow-md transition-shadow`}>
      <Icon className={`w-8 h-8 mx-auto mb-2 ${color}`} />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-2">{value}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border-2 border-purple-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-purple-600" />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className={`text-base font-bold ${highlight ? 'text-gray-900' : 'text-gray-500'}`}>{value}</span>
      </div>
    </div>
  );
}

function ChemistryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border-2 border-cyan-200 shadow-sm">
      <div className="text-sm font-semibold text-gray-700 mb-2">{label}</div>
      <p className="text-base font-bold text-gray-900">{value}</p>
    </div>
  );
}
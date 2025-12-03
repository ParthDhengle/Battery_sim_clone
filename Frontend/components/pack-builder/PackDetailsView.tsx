"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Battery, Zap, Package, DollarSign, Layers, Hash, Grid3X3, Table, Settings
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

type Pack = {
  _id: string;
  name: string;
  description?: string | null;
  cell: {
    name: string;
    form_factor: "cylindrical" | "prismatic";
    dims: { radius?: number; length?: number; width?: number; height: number };
    capacity: number;
    cell_voltage_upper_limit: number;
    cell_voltage_lower_limit: number;
  };
  connection_type: string;
  r_p: number;
  r_s: number;
  layers: Array<{
    grid_type: string;
    n_rows: number;
    n_cols: number;
    pitch_x: number;
    pitch_y: number;
  }>;
  options: { label_schema: string };
  constraints: { max_weight?: number | null; max_volume?: number | null };
  cost_per_cell: number;
  summary?: {
    electrical: {
      n_series: number;
      n_parallel: number;
      n_total: number;
      pack_nominal_voltage: number;
      pack_max_voltage: number;
      pack_min_voltage: number;
      pack_capacity: number;
      pack_energy_wh: number;
      pack_energy_kwh: number;
    };
    mechanical: {
      total_cells: number;
      total_pack_weight: number;
      total_pack_volume: number;
      energy_density_gravimetric: number;
      energy_density_volumetric: number;
    };
    commercial: {
      total_pack_cost: number;
      cost_per_kwh: number;
    };
  };
  created_at?: string;
  updated_at?: string;
};

type Props = {
  pack: Pack;
};

export default function PackDetailsView({ pack }: Props) {
  const [open, setOpen] = useState(false);

  const totalLayers = pack.layers.length;
  const totalCells = pack.summary?.electrical.n_total || pack.layers.reduce((s, l) => s + l.n_rows * l.n_cols, 0);

  const connectionLabel = {
    row_series_column_parallel: "Rows in Series, Columns in Parallel",
    row_parallel_column_series: "Rows in Parallel, Columns in Series",
    custom: "Custom Configuration"
  }[pack.connection_type] || pack.connection_type;

  const gridTypeLabel = (gridType: string) => {
    const labels: Record<string, string> = {
      rectangular: "Rectangular Grid",
      hexagonal: "Hexagonal Grid",
      custom: "Custom Grid"
    };
    return labels[gridType] || gridType;
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Battery className="w-3.5 h-3.5 mr-1" />
        View
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-full md:max-w-6xl lg:max-w-7xl max-h-[95vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-white">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900">
                <Battery className="w-5 h-5 text-gray-700" />
                {pack.name}
              </DialogTitle>
              <Link href={`/pack-builder?id=${pack._id}`}>
                <Button variant="outline" size="sm" className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                </Button>
              </Link>
            </div>
            {pack.description && (
              <p className="text-gray-600 mt-1 text-sm">{pack.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="text-xs px-2 py-1">
                <Layers className="w-3 h-3 mr-1" />
                {totalLayers} Layer{totalLayers > 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-1">
                <Grid3X3 className="w-3 h-3 mr-1" />
                {totalCells} Cells
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-1">
                {pack.cell.name}
              </Badge>
            </div>
          </DialogHeader>

          {/* Content - Single Scrollable Page */}
          <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 space-y-4">
            
            {/* Quick Summary Cards */}
            {pack.summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SummaryCard
                  title="Energy"
                  value={`${pack.summary.electrical.pack_energy_kwh.toFixed(2)} kWh`}
                  subtitle={`${pack.summary.electrical.pack_energy_wh.toFixed(0)} Wh`}
                  icon={Zap}
                />
                <SummaryCard
                  title="Voltage"
                  value={`${pack.summary.electrical.pack_nominal_voltage.toFixed(2)} V`}
                  subtitle={`${pack.summary.electrical.pack_min_voltage.toFixed(2)}V – ${pack.summary.electrical.pack_max_voltage.toFixed(2)}V`}
                  icon={Battery}
                />
                <SummaryCard
                  title="Cost"
                  value={`$${pack.summary.commercial.total_pack_cost.toFixed(2)}`}
                  subtitle={`$${pack.summary.commercial.cost_per_kwh.toFixed(2)}/kWh`}
                  icon={DollarSign}
                />
              </div>
            )}

            {/* Electrical Properties */}
            <Section title="Electrical Properties" icon={Zap}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailMetric label="Series Cells" value={pack.summary?.electrical.n_series || "-"} />
                <DetailMetric label="Parallel Cells" value={pack.summary?.electrical.n_parallel || "-"} />
                <DetailMetric label="Total Cells" value={pack.summary?.electrical.n_total || totalCells} />
                <DetailMetric label="Pack Voltage (Nominal)" value={`${pack.summary?.electrical.pack_nominal_voltage.toFixed(2) || "-"} V`} />
                <DetailMetric label="Pack Voltage (Max)" value={`${pack.summary?.electrical.pack_max_voltage.toFixed(2) || "-"} V`} />
                <DetailMetric label="Pack Voltage (Min)" value={`${pack.summary?.electrical.pack_min_voltage.toFixed(2) || "-"} V`} />
                <DetailMetric label="Pack Capacity" value={`${pack.summary?.electrical.pack_capacity.toFixed(2) || "-"} Ah`} />
                <DetailMetric label="Pack Energy" value={`${pack.summary?.electrical.pack_energy_wh.toFixed(2) || "-"} Wh`} />
                <DetailMetric label="Energy (Adjusted)" value={`${pack.summary?.electrical.pack_energy_wh.toFixed(2) || "-"} Wh`} />
                <DetailMetric label="R_series" value={`${(pack.r_s * 1000).toFixed(3)} mΩ`} />
                <DetailMetric label="R_parallel" value={`${(pack.r_p * 1000).toFixed(3)} mΩ`} />
                <DetailMetric label="Cell Voltage Upper" value={`${pack.cell.cell_voltage_upper_limit.toFixed(2)} V`} />
                <DetailMetric label="Cell Voltage Lower" value={`${pack.cell.cell_voltage_lower_limit.toFixed(2)} V`} />
                <DetailMetric label="Cell Capacity" value={`${pack.cell.capacity.toFixed(2)} Ah`} />
              </div>
            </Section>

            {/* Mechanical Properties */}
            <Section title="Mechanical Properties" icon={Package}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailMetric label="Total Cells" value={pack.summary?.mechanical.total_cells || totalCells} />
                <DetailMetric label="Total Weight" value={`${pack.summary?.mechanical.total_pack_weight.toFixed(3) || "-"} kg`} />
                <DetailMetric label="Pack Volume" value={`${(pack.summary?.mechanical.total_pack_volume || 0).toFixed(6)} m³`} />
                <DetailMetric label="Energy Density (Wh/kg)" value={`${pack.summary?.mechanical.energy_density_gravimetric.toFixed(2) || "-"}`} />
                <DetailMetric label="Energy Density (Wh/L)" value={`${pack.summary?.mechanical.energy_density_volumetric.toFixed(2) || "-"}`} />
                <DetailMetric label="Cell Form Factor" value={pack.cell.form_factor} />
                {pack.cell.form_factor === "cylindrical" && (
                  <>
                    <DetailMetric label="Cell Radius" value={`${pack.cell.dims.radius || "-"} mm`} />
                    <DetailMetric label="Cell Length" value={`${pack.cell.dims.length || "-"} mm`} />
                  </>
                )}
                {pack.cell.form_factor === "prismatic" && (
                  <>
                    <DetailMetric label="Cell Width" value={`${pack.cell.dims.width || "-"} mm`} />
                    <DetailMetric label="Cell Height" value={`${pack.cell.dims.height || "-"} mm`} />
                  </>
                )}
              </div>
            </Section>

            {/* Commercial Properties */}
            <Section title="Commercial Properties" icon={DollarSign}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailMetric label="Total Cost" value={`$${pack.summary?.commercial.total_pack_cost.toFixed(2) || "-"}`} />
                <DetailMetric label="Cost per kWh" value={`$${pack.summary?.commercial.cost_per_kwh.toFixed(2) || "-"}/kWh`} />
                <DetailMetric label="Cost per Cell" value={`$${pack.cost_per_cell.toFixed(2)}`} />
              </div>
            </Section>

            {/* Configuration Details */}
            <Section title="Configuration Details" icon={Settings}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <DetailMetric label="Connection Type" value={connectionLabel} wide />
                <DetailMetric label="Label Schema" value={pack.options.label_schema} />
                <DetailMetric label="Max Weight Constraint" value={pack.constraints.max_weight ? `${pack.constraints.max_weight} kg` : "None"} />
                <DetailMetric label="Max Volume Constraint" value={pack.constraints.max_volume ? `${pack.constraints.max_volume} m³` : "None"} />
              </div>
            </Section>

            <Separator className="my-2" />

            {/* Layer Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-600" />
                Layer Details & Visualization
              </h3>
              
              {pack.layers.map((layer, idx) => (
                <div key={idx} className="space-y-3">
                  {/* Layer Info Card */}
                  <div className="bg-white rounded-lg p-4 border shadow-sm">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-900">
                      Layer {idx + 1} Configuration
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <DetailMetric label="Grid Type" value={gridTypeLabel(layer.grid_type)} />
                      <DetailMetric label="Connection Type" value={connectionLabel} />
                      <DetailMetric label="Grid Size" value={`${layer.n_rows} × ${layer.n_cols}`} />
                      <DetailMetric label="Pitch X" value={`${layer.pitch_x.toFixed(2)} mm`} />
                      <DetailMetric label="Pitch Y" value={`${layer.pitch_y.toFixed(2)} mm`} />
                      <DetailMetric label="Cells in Layer" value={layer.n_rows * layer.n_cols} />
                    </div>
                  </div>

                  {/* Plot and Table */}
                  <div className="bg-white rounded-lg p-4 border shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <PackLayerPlot 
                          layer={layer} 
                          formFactor={pack.cell.form_factor} 
                          dims={pack.cell.dims} 
                          labelSchema={pack.options.label_schema} 
                          connectionType={pack.connection_type} 
                        />
                      </div>
                      <div>
                        <PackLayerTable 
                          layer={layer} 
                          formFactor={pack.cell.form_factor} 
                          dims={pack.cell.dims} 
                          labelSchema={pack.options.label_schema} 
                          connectionType={pack.connection_type} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Metadata */}
            {(pack.created_at || pack.updated_at) && (
              <div className="bg-white rounded-lg p-3 border text-xs text-gray-600">
                <div className="flex flex-wrap gap-4">
                  {pack.created_at && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Created:</span>
                      <span>{new Date(pack.created_at).toLocaleString()}</span>
                    </div>
                  )}
                  {pack.updated_at && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Updated:</span>
                      <span>{new Date(pack.updated_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Reusable Components
function SummaryCard({ title, value, subtitle, icon: Icon }: any) {
  return (
    <div className="bg-white rounded-lg p-4 border shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-gray-100 rounded">
          <Icon className="w-4 h-4 text-gray-700" />
        </div>
        <h3 className="text-xs font-medium text-gray-600">{title}</h3>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs mt-1 text-gray-500">{subtitle}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-white rounded-lg p-4 border shadow-sm">
      <h3 className="text-base font-semibold flex items-center gap-2 mb-3 text-gray-900">
        <Icon className="w-4 h-4 text-gray-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailMetric({ label, value, wide }: { label: string; value: any; wide?: boolean }) {
  return (
    <div className={`bg-gray-50 rounded p-3 border border-gray-200 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-words">{value}</p>
    </div>
  );
}

import { CellPlot } from "@/components/pack-builder/cell-plot";
import { CellDataTable } from "@/components/pack-builder/cell-data-table";

function PackLayerPlot({ layer, formFactor, dims, labelSchema, connectionType }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border h-full">
      <h5 className="font-medium text-xs mb-2 flex items-center gap-2 text-gray-700">
        <Grid3X3 className="w-3.5 h-3.5" />
        Visual Layout
      </h5>
      <CellPlot
        layer={{
          id: 1,
          nRows: layer.n_rows,
          nCols: layer.n_cols,
          pitchX: layer.pitch_x,
          pitchY: layer.pitch_y,
          gridType: layer.grid_type,
        }}
        formFactor={formFactor}
        dims={dims}
        labelSchema={labelSchema}
        connectionType={connectionType}
      />
    </div>
  );
}

function PackLayerTable({ layer, formFactor, dims, labelSchema, connectionType }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border h-full">
      <h5 className="font-medium text-xs mb-2 flex items-center gap-2 text-gray-700">
        <Table className="w-3.5 h-3.5" />
        Cell Neighbor Table
      </h5>
      <div className="overflow-x-auto max-h-80">
        <CellDataTable
          layer={{
            id: 1,
            nRows: layer.n_rows,
            nCols: layer.n_cols,
            pitchX: layer.pitch_x,
            pitchY: layer.pitch_y,
            gridType: layer.grid_type,
          }}
          formFactor={formFactor}
          dims={dims}
          labelSchema={labelSchema}
          connectionType={connectionType}
        />
      </div>
    </div>
  );
}
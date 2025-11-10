from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime

class CellDimensions(BaseModel):
    radius: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: float

class CellConfig(BaseModel):
    form_factor: Literal["cylindrical", "prismatic"]
    dims: CellDimensions
    capacity: float
    columbic_efficiency: float
    m_cell: float
    m_jellyroll: float
    cell_voltage_upper_limit: float
    cell_voltage_lower_limit: float

class LayerConfig(BaseModel):
    grid_type: str
    n_rows: int
    n_cols: int
    pitch_x: float
    pitch_y: float
    z_mode: Literal["index_pitch", "explicit"]
    z_center: Optional[float] = None

class VaryingCell(BaseModel):
    cell_index: int
    temperature: float = 300
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0

class InitialConditions(BaseModel):
    temperature: float = 300
    soc: float = 1.0
    soh: float = 1.0
    dcir_aging_factor: float = 1.0
    varying_cells: List[VaryingCell] = []

class VoltageLimits(BaseModel):
    module_upper: Optional[float] = None
    module_lower: Optional[float] = None

class PackOptions(BaseModel):
    allow_overlap: bool = False
    compute_neighbors: bool = True
    label_schema: str = "R{row}C{col}L{layer}"

class Constraints(BaseModel):
    max_weight: Optional[float] = None
    max_volume: Optional[float] = None

class CustomParallelGroup(BaseModel):
    cell_ids: str

class ElectricalMetrics(BaseModel):
    n_series: int
    n_parallel: int
    n_total: int
    v_cell_nominal: float
    pack_nominal_voltage: float
    pack_max_voltage: float
    pack_min_voltage: float
    pack_capacity: float
    pack_energy_wh: float
    pack_energy_kwh: float
    adjusted_pack_energy_wh: float
    busbar_total_resistance: float

class MechanicalMetrics(BaseModel):
    total_cells: int
    total_pack_weight: float
    total_cell_volume: float
    total_pack_volume: float
    energy_density_gravimetric: float
    energy_density_volumetric: float

class CommercialMetrics(BaseModel):
    total_pack_cost: float
    cost_per_kwh: float

class PackSummary(BaseModel):
    electrical: ElectricalMetrics
    mechanical: MechanicalMetrics
    commercial: CommercialMetrics

class PackCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cell: CellConfig
    connection_type: Literal["row_series_column_parallel", "row_parallel_column_series", "custom"]
    custom_parallel_groups: Optional[List[CustomParallelGroup]] = None
    r_p: float = 0.001
    r_s: float = 0.001
    voltage_limits: VoltageLimits
    options: PackOptions
    constraints: Constraints
    z_pitch: Optional[float] = None
    layers: List[LayerConfig]
    initial_conditions: InitialConditions
    cost_per_cell: float = 3.0

class PackUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cell: Optional[CellConfig] = None
    connection_type: Optional[Literal["row_series_column_parallel", "row_parallel_column_series", "custom"]] = None
    custom_parallel_groups: Optional[List[CustomParallelGroup]] = None
    r_p: Optional[float] = None
    r_s: Optional[float] = None
    voltage_limits: Optional[VoltageLimits] = None
    options: Optional[PackOptions] = None
    constraints: Optional[Constraints] = None
    z_pitch: Optional[float] = None
    layers: Optional[List[LayerConfig]] = None
    initial_conditions: Optional[InitialConditions] = None
    cost_per_cell: Optional[float] = None

class PackResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: Optional[str]
    cell: CellConfig
    connection_type: str
    custom_parallel_groups: Optional[List[CustomParallelGroup]]
    r_p: float
    r_s: float
    voltage_limits: VoltageLimits
    options: PackOptions
    constraints: Constraints
    z_pitch: Optional[float]
    layers: List[LayerConfig]
    initial_conditions: InitialConditions
    cost_per_cell: float
    summary: Optional[PackSummary] = None
    cells_data: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

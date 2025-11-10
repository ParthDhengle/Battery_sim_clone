export interface CellConfig {
  id?: string;
  name: string;
  formFactor: 'cylindrical' | 'prismatic';
  dims: {
    height: number;
    radius?: number;
    width?: number;
    length?: number;
  };
  capacity: number;
  columbic_Efficiency: number;  // Note: Fix casing to match (it's camelCase in code)
  m_cell: number;
  m_jellyroll: number;
  cell_voltage_upper_limit: number;
  cell_voltage_lower_limit: number;
  SOH_file?: { name: string; data: string; type: string };
  createdAt: Date;  // Use Date consistently
  updatedAt: Date;
}
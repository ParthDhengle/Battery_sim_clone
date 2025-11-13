// Frontend/components/pack-builder/cell_data_table.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CellDataTable({
  layer,
  formFactor,
  dims,
  labelSchema,
  connectionType,
  customParallelGroups,
}: {
  layer: {
    id: number
    nRows: number | string
    nCols: number | string
    pitchX: number | string
    pitchY: number | string
    gridType: string
  }
  formFactor: "cylindrical" | "prismatic"
  dims: { radius?: number; length?: number; width?: number; height: number }
  labelSchema: string
  connectionType: "row_series_column_parallel" | "row_parallel_column_series" | "custom"
  customParallelGroups?: { id: number; cellIds: string }[]
}) {
  return (
    <div className="mt-6 space-y-3 w-full">
      <p className="font-medium text-gray-800">Cell Data Table</p>
      {(() => {
        const nRows = parseInt(String(layer.nRows), 10) || 0
        const nCols = parseInt(String(layer.nCols), 10) || 0
        const pitchX = parseFloat(String(layer.pitchX)) || 0
        const pitchY = parseFloat(String(layer.pitchY)) || 0
        if (nRows <= 0 || nCols <= 0 || pitchX <= 0 || pitchY <= 0) {
          return (
            <p className="text-muted-foreground">
              Invalid layer configuration for table.
            </p>
          )
        }
        // --- Generate cell positions ---
        const positions: { x: number; y: number; label: string; row: number; col: number; group_id?: number }[] = []
        for (let row = 0; row < nRows; row++) {
          for (let col = 0; col < nCols; col++) {
            let x = col * pitchX
            let y = row * pitchY
            switch (layer.gridType) {
              case "brick_row_stagger":
                if (row % 2 === 1) x += pitchX / 2
                break
              case "brick_col_stagger":
                if (col % 2 === 1) y += pitchY / 2
                break
              case "hex_flat":
                if (row % 2 === 1) x += pitchX / 2
                break
              case "hex_pointy":
                if (col % 2 === 1) y += pitchY / 2
                break
              case "diagonal":
                x += row * (pitchX / 2)
                break
            }
            const label =
              labelSchema && labelSchema.includes("{")
                ? labelSchema
                    .replace(/{row}/g, (row + 1).toString())
                    .replace(/{col}/g, (col + 1).toString())
                    .replace(/{layer}/g, layer.id.toString())
                : `${String.fromCharCode(65 + row)}${col + 1}`
            positions.push({ x, y, label, row, col })
          }
        }
        // --- Assign group IDs ---
        if (connectionType === "row_series_column_parallel") {
          positions.forEach((p) => (p.group_id = p.col + 1));
        } else if (connectionType === "row_parallel_column_series") {
          positions.forEach((p) => (p.group_id = p.row + 1));
        } else if (connectionType === "custom" && customParallelGroups) {
          const labelToGroup = new Map<string, number>();
          customParallelGroups.forEach((g) => {
            g.cellIds
              .split(",")
              .map((s) => s.trim())
              .forEach((l) => labelToGroup.set(l, g.id));
          });
          positions.forEach((p) => (p.group_id = labelToGroup.get(p.label) || 0));
        } else {
          positions.forEach((p) => (p.group_id = 0));
        }
        // --- Create row_col to label map ---
        const rowColToLabel = new Map<string, string>();
        positions.forEach((pos) => {
          rowColToLabel.set(`${pos.row}_${pos.col}`, pos.label);
        });
        // --- Sort positions by row then col ---
        positions.sort((a, b) => a.row - b.row || a.col - b.col);
        // --- Determine stagger types ---
        const isRowStaggered = ['brick_row_stagger', 'hex_flat', 'diagonal'].includes(layer.gridType);
        const isColStaggered = ['brick_col_stagger', 'hex_pointy'].includes(layer.gridType);
        return (
          <div className="overflow-auto max-h-96 border border-gray-300 rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cell ID</TableHead>
                  <TableHead>Coordinates (X,Y)</TableHead>
                  <TableHead>Row Left</TableHead>
                  <TableHead>Row Right</TableHead>
                  <TableHead>Col Top</TableHead>
                  <TableHead>Col Bottom</TableHead>
                  <TableHead>Diag Top Left</TableHead>
                  <TableHead>Diag Top Right</TableHead>
                  <TableHead>Diag Bottom Left</TableHead>
                  <TableHead>Diag Bottom Right</TableHead>
                  <TableHead>Position Type</TableHead>
                  <TableHead>Parallel Group ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => {
                  const rowLeft =
                    isColStaggered ? "" :
                    pos.col > 0 ? rowColToLabel.get(`${pos.row}_${pos.col - 1}`) ?? "" : "";
                  const rowRight =
                    isColStaggered ? "" :
                    pos.col < nCols - 1
                      ? rowColToLabel.get(`${pos.row}_${pos.col + 1}`) ?? ""
                      : "";
                  const colTop =
                    isRowStaggered ? "" :
                    pos.row > 0 ? rowColToLabel.get(`${pos.row - 1}_${pos.col}`) ?? "" : "";
                  const colBottom =
                    isRowStaggered ? "" :
                    pos.row < nRows - 1
                      ? rowColToLabel.get(`${pos.row + 1}_${pos.col}`) ?? ""
                      : "";
                  const diagTopLeft =
                    pos.row > 0 && pos.col > 0
                      ? rowColToLabel.get(`${pos.row - 1}_${pos.col - 1}`) ?? ""
                      : "";
                  const diagTopRight =
                    pos.row > 0 && pos.col < nCols - 1
                      ? rowColToLabel.get(`${pos.row - 1}_${pos.col + 1}`) ?? ""
                      : "";
                  const diagBottomLeft =
                    pos.row < nRows - 1 && pos.col > 0
                      ? rowColToLabel.get(`${pos.row + 1}_${pos.col - 1}`) ?? ""
                      : "";
                  const diagBottomRight =
                    pos.row < nRows - 1 && pos.col < nCols - 1
                      ? rowColToLabel.get(`${pos.row + 1}_${pos.col + 1}`) ?? ""
                      : "";
                  let positionType = "Interior";
                  if (
                    (pos.row === 0 || pos.row === nRows - 1) &&
                    (pos.col === 0 || pos.col === nCols - 1)
                  ) {
                    positionType = "Corner";
                  } else if (
                    pos.row === 0 ||
                    pos.row === nRows - 1 ||
                    pos.col === 0 ||
                    pos.col === nCols - 1
                  ) {
                    positionType = "Edge";
                  }
                  const coords = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}`;
                  const groupId = pos.group_id ?? 0;
                  return (
                    <TableRow key={pos.label}>
                      <TableCell>{pos.label}</TableCell>
                      <TableCell>{coords}</TableCell>
                      <TableCell>{rowLeft}</TableCell>
                      <TableCell>{rowRight}</TableCell>
                      <TableCell>{colTop}</TableCell>
                      <TableCell>{colBottom}</TableCell>
                      <TableCell>{diagTopLeft}</TableCell>
                      <TableCell>{diagTopRight}</TableCell>
                      <TableCell>{diagBottomLeft}</TableCell>
                      <TableCell>{diagBottomRight}</TableCell>
                      <TableCell>{positionType}</TableCell>
                      <TableCell>{groupId}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })()}
    </div>
  )
}
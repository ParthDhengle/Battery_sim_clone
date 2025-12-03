// Frontend/components/pack-builder/cell_plot.tsx
import React from 'react';

export function CellPlot({
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
  const [hoveredCell, setHoveredCell] = React.useState<{
    globalIndex: number;
    groupId: number;
    position: { x: number; y: number; z: number };
    svgX: number;
    svgY: number;
  } | null>(null);

  function idToColor(id: number): string {
    if (id === 0) return "#0000FF";
    const colors = [
      "#FF4136",
      "#2ECC40",
      "#0074D9",
      "#FFDC00",
      "#B10DC9",
      "#FF851B",
      "#3D9970",
      "#001f3f",
      "#39CCCC",
      "#01FF70",
      "#85144b",
      "#F012BE",
      "#7FDBFF",
      "#FFD700",
    ];
    return colors[(id - 1) % colors.length];
  }

  return (
    <div className="mt-4 w-full">
      <p className="font-medium text-gray-800 mb-2">Layer Plot</p>
      {(() => {
        const nRows = parseInt(String(layer.nRows), 10) || 0
        const nCols = parseInt(String(layer.nCols), 10) || 0
        const pitchX = parseFloat(String(layer.pitchX)) || 0
        const pitchY = parseFloat(String(layer.pitchY)) || 0
        if (nRows <= 0 || nCols <= 0 || pitchX <= 0 || pitchY <= 0) {
          return (
            <p className="text-muted-foreground">
              Invalid layer configuration for plotting.
            </p>
          )
        }
        // --- Cell size calculation ---
        const cellSizeX =
          formFactor === "cylindrical"
            ? 2 * (dims.radius ?? 0)
            : dims.length ?? 0
        const cellSizeY =
          formFactor === "cylindrical"
            ? 2 * (dims.radius ?? 0)
            : dims.width ?? 0
        const halfX = cellSizeX / 2
        const halfY = cellSizeY / 2
        // --- Generate cell positions ---
        const positions: { x: number; y: number; label: string; row: number; col: number; group_id?: number; globalIndex: number }[] = []
        let globalIndex = 0;
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
            // --- Apply user label schema ---
            const label =
              labelSchema && labelSchema.includes("{")
                ? labelSchema
                    .replace(/{row}/g, (row + 1).toString())
                    .replace(/{col}/g, (col + 1).toString())
                    .replace(/{layer}/g, layer.id.toString())
                : `${String.fromCharCode(65 + row)}${col + 1}`
            positions.push({ x, y, label, row, col, globalIndex })
            globalIndex++;
          }
        }
        // --- Assign group IDs ---
        let seriesDirection: "row" | "column" | undefined;
        if (connectionType === "row_parallel_column_series") {
          seriesDirection = "row";
          positions.forEach((p) => (p.group_id = p.col + 1));
        } else if (connectionType === "row_series_column_parallel") {
          seriesDirection = "column";
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
        // --- Bounding box ---
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity
        positions.forEach((pos) => {
          minX = Math.min(minX, pos.x - halfX)
          maxX = Math.max(maxX, pos.x + halfX)
          minY = Math.min(minY, pos.y - halfY)
          maxY = Math.max(maxY, pos.y + halfY)
        })
        const shiftX = minX < 0 ? -minX : 0
        const shiftY = minY < 0 ? -minY : 0
        const plotWidth = maxX - minX
        const plotHeight = maxY - minY
        // --- Layout ---
        const padding = 60
        const viewWidth = plotWidth + 2 * padding
        const viewHeight = plotHeight + 2 * padding
        const plotLeft = padding
        const plotTop = padding
        const plotBottom = plotTop + plotHeight
        // --- Axis & ticks ---
        const tickSpacing = 5
        const tickLength = 1.5
        const fontSize = 5
        const xTicks: number[] = []
        const yTicks: number[] = []
        for (let tx = 0; tx <= plotWidth; tx += tickSpacing) xTicks.push(tx)
        for (let ty = 0; ty <= plotHeight; ty += tickSpacing) yTicks.push(ty)
        
        // --- Get unique parallel groups ---
        const uniqueGroups = Array.from(new Set(positions.map(p => p.group_id || 0))).sort((a, b) => a - b);
        
        return (
          <div className="w-full bg-white border border-gray-300 rounded-lg shadow-sm p-4">
            <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
              {/* Legend - Top Right Corner */}
              <div className="absolute top-2 right-2 bg-white border border-gray-300 rounded-lg shadow-md z-20 overflow-y-auto" style={{ maxWidth: '180px', maxHeight: 'calc(100% - 16px)' }}>
                <div className="p-3">
                  <h3 className="font-semibold text-xs mb-2 sticky top-0 bg-white">Legend</h3>
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-gray-700 mb-1">Parallel Groups</div>
                    {uniqueGroups.map((groupId) => (
                      <div key={groupId} className="flex items-center gap-1.5 text-xs">
                        <div
                          className="w-3 h-3 rounded-sm border border-gray-400 flex-shrink-0"
                          style={{ backgroundColor: idToColor(groupId) }}
                        />
                        <span className="text-gray-700 truncate">
                          {groupId === 0 ? "Unassigned" : `Group ${groupId}`}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs mt-2 pt-1.5 border-t">
                      <svg width="20" height="2">
                        <line x1="0" y1="1" x2="20" y2="1" stroke="black" strokeWidth="2" />
                      </svg>
                      <span className="text-gray-700">Series</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SVG Plot */}
              <svg
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
                className="border border-gray-200 bg-white rounded"
              >
                {/* Arrowhead definitions */}
                <defs>
                  <marker
                    id="arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="black" />
                  </marker>
                </defs>
                {/* Gridlines */}
                {xTicks.map((tx) => (
                  <line
                    key={`gx-${tx}`}
                    x1={plotLeft + tx}
                    y1={plotTop}
                    x2={plotLeft + tx}
                    y2={plotBottom}
                    stroke="#eee"
                    strokeWidth="0.4"
                  />
                ))}
                {yTicks.map((ty) => {
                  const svgY = plotBottom - ty
                  return (
                    <line
                      key={`gy-${ty}`}
                      x1={plotLeft}
                      y1={svgY}
                      x2={plotLeft + plotWidth}
                      y2={svgY}
                      stroke="#eee"
                      strokeWidth="0.4"
                    />
                  )
                })}
                {/* Axes */}
                <line
                  x1={plotLeft - 20}
                  y1={plotBottom}
                  x2={plotLeft + plotWidth + 20}
                  y2={plotBottom}
                  stroke="black"
                  strokeWidth="1"
                  markerEnd="url(#arrow)"
                />
                <line
                  x1={plotLeft}
                  y1={plotBottom + 20}
                  x2={plotLeft}
                  y2={plotTop - 20}
                  stroke="black"
                  strokeWidth="1"
                  markerEnd="url(#arrow)"
                />
                {/* Axis Ticks */}
                {xTicks.map((tx) => (
                  <g key={`x-${tx}`}>
                    <line
                      x1={plotLeft + tx}
                      y1={plotBottom - tickLength}
                      x2={plotLeft + tx}
                      y2={plotBottom + tickLength}
                      stroke="black"
                      strokeWidth="0.6"
                    />
                    {tx % 10 === 0 && (
                      <text
                        x={plotLeft + tx}
                        y={plotBottom + 10}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fill="#333"
                      >
                        {tx}
                      </text>
                    )}
                  </g>
                ))}
                {yTicks.map((ty) => {
                  const svgY = plotBottom - ty
                  return (
                    <g key={`y-${ty}`}>
                      <line
                        x1={plotLeft - tickLength}
                        y1={svgY}
                        x2={plotLeft + tickLength}
                        y2={svgY}
                        stroke="black"
                        strokeWidth="0.6"
                      />
                      {ty % 10 === 0 && (
                        <text
                          x={plotLeft - 8}
                          y={svgY + 2}
                          textAnchor="end"
                          fontSize={fontSize}
                          fill="#333"
                        >
                          {ty}
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* Cells */}
                {positions.map((pos, i) => {
                  const cx = plotLeft + pos.x + shiftX
                  const cy = plotBottom - (pos.y + shiftY)
                  const color = idToColor(pos.group_id ?? 0)
                  const zCoord = (layer.id - 1) * dims.height; // z coordinate based on layer
                  
                  return (
                    <g 
                      key={i}
                      onMouseEnter={() => setHoveredCell({
                        globalIndex: pos.globalIndex,
                        groupId: pos.group_id ?? 0,
                        position: { x: pos.x, y: pos.y, z: zCoord },
                        svgX: cx,
                        svgY: cy
                      })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {formFactor === "cylindrical" ? (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={dims.radius ?? 0}
                          stroke={color}
                          fill={`${color}33`}
                          strokeWidth="0.8"
                        />
                      ) : (
                        <rect
                          x={cx - halfX}
                          y={cy - halfY}
                          width={cellSizeX}
                          height={cellSizeY}
                          stroke={color}
                          fill={`${color}33`}
                          strokeWidth="0.8"
                        />
                      )}
                      <text
                        x={cx}
                        y={cy + 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="5"
                        fill="#111"
                      >
                        {pos.label}
                      </text>
                    </g>
                  )
                })}
                {/* Series Lines */}
                {seriesDirection === "row" &&
                  (() => {
                    const rowMap = new Map<number, { cx: number; cy: number; row: number }[]>();
                    positions.forEach((pos) => {
                      const cx = plotLeft + pos.x + shiftX;
                      const cy = plotBottom - (pos.y + shiftY);
                      if (!rowMap.has(pos.row)) rowMap.set(pos.row, []);
                      rowMap.get(pos.row)!.push({ cx, cy, row: pos.row });
                    });
                    return Array.from(rowMap.entries()).map(([rowNum, pts]) => {
                      pts.sort((a, b) => a.cx - b.cx);
                      if (pts.length > 1) {
                        const points = pts.map((pt) => `${pt.cx},${pt.cy}`).join(" ");
                        return (
                          <polyline
                            key={`series-row-${rowNum}`}
                            points={points}
                            stroke="black"
                            strokeWidth="1"
                            fill="none"
                          />
                        );
                      }
                      return null;
                    });
                  })()}
                {seriesDirection === "column" &&
                  (() => {
                    const colMap = new Map<number, { cx: number; cy: number; row: number }[]>();
                    positions.forEach((pos) => {
                      const cx = plotLeft + pos.x + shiftX;
                      const cy = plotBottom - (pos.y + shiftY);
                      if (!colMap.has(pos.col)) colMap.set(pos.col, []);
                      colMap.get(pos.col)!.push({ cx, cy, row: pos.row });
                    });
                    return Array.from(colMap.entries()).map(([colNum, pts]) => {
                      pts.sort((a, b) => a.row - b.row);
                      if (pts.length > 1) {
                        const points = pts.map((pt) => `${pt.cx},${pt.cy}`).join(" ");
                        return (
                          <polyline
                            key={`series-col-${colNum}`}
                            points={points}
                            stroke="black"
                            strokeWidth="1"
                            fill="none"
                          />
                        );
                      }
                      return null;
                    });
                  })()}
              </svg>
              
              {/* Hover Tooltip */}
              {hoveredCell && (
                <div
                  className="absolute bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none z-30 whitespace-nowrap"
                  style={{
                    left: `${(hoveredCell.svgX / viewWidth) * 100}%`,
                    top: `${(hoveredCell.svgY / viewHeight) * 100}%`,
                    transform: 'translate(10px, -50%)'
                  }}
                >
                  <div className="space-y-1">
                    <div className="font-semibold border-b border-gray-700 pb-1 mb-1">Cell Info</div>
                    <div><span className="text-gray-400">Global Index:</span> {hoveredCell.globalIndex}</div>
                    <div><span className="text-gray-400">Parallel Group:</span> {hoveredCell.groupId === 0 ? 'Unassigned' : hoveredCell.groupId}</div>
                    <div><span className="text-gray-400">Position:</span> ({hoveredCell.position.x.toFixed(2)}, {hoveredCell.position.y.toFixed(2)}, {hoveredCell.position.z.toFixed(2)})</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
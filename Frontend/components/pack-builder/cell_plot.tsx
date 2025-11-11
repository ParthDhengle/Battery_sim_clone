// Frontend/components/pack-builder/cell_plot.tsx
export function CellPlot({
  layer,
  formFactor,
  dims,
  labelSchema, // <-- new prop
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
  labelSchema: string // <-- user-input pattern like "R{row}C{col}L{layer}"
}) {
  return (
    <div className="mt-6 space-y-3 w-full">
      <p className="font-medium text-gray-800">Layer Plot</p>
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
        const positions: { x: number; y: number; label: string }[] = []
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
            positions.push({ x, y, label })
          }
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
        return (
          <div className="w-full aspect-[4/3]">
            <svg
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              className="border border-gray-300 bg-white rounded-lg shadow-sm"
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
                return (
                  <g key={i}>
                    {formFactor === "cylindrical" ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={dims.radius ?? 0}
                        stroke="blue"
                        fill="none"
                        strokeWidth="0.8"
                      />
                    ) : (
                      <rect
                        x={cx - halfX}
                        y={cy - halfY}
                        width={cellSizeX}
                        height={cellSizeY}
                        stroke="blue"
                        fill="none"
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
            </svg>
          </div>
        )
      })()}
    </div>
  )
}
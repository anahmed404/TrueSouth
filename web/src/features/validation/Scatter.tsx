import { scaleLinear } from "d3-scale";
import { useId, useMemo } from "react";
import type { ScatterPoint } from "./model";
import { useWidth } from "./parts";

const MARGIN = { top: 12, right: 12, bottom: 40, left: 48 };
const MAX_SIZE = 420;

type ScatterProps = {
  points: readonly ScatterPoint[];
  /** The "investigate" mark, as a fraction, drawn as a band around the diagonal. */
  mark: number | null;
  body: "sun" | "earth";
  xLabel: string;
  yLabel: string;
  /** The text that states the chart's finding; also the SVG's accessible name. */
  summary: string;
};

/**
 * Ours against NASA's, one point per site. A point on the diagonal agrees exactly; the
 * shaded band is the "investigate" mark. A site outside the mark is a CAUTION diamond with
 * its name beside it, so it never reads by colour alone. Values are fractions of 1, drawn
 * as percentages. Hand-built SVG.
 */
export function Scatter({ points, mark, body, xLabel, yLabel, summary }: ScatterProps) {
  const [ref, width] = useWidth<HTMLDivElement>(MAX_SIZE);
  const titleId = useId();
  const size = Math.min(MAX_SIZE, width);

  const drawn = useMemo(() => {
    const x = scaleLinear().domain([0, 1]).range([MARGIN.left, size - MARGIN.right]);
    const y = scaleLinear().domain([0, 1]).range([size - MARGIN.bottom, MARGIN.top]);
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    let band = "";
    if (mark !== null && mark > 0) {
      // The band between "ours = NASA's + mark" and "ours = NASA's − mark", clipped to 0–1.
      const upper: [number, number][] = [
        [0, mark],
        [1 - mark, 1],
        [1, 1],
      ];
      const lower: [number, number][] = [
        [1, 1 - mark],
        [mark, 0],
        [0, 0],
      ];
      band = [...upper, ...lower]
        .map(([px, py], index) => `${index ? "L" : "M"}${x(px).toFixed(1)},${y(py).toFixed(1)}`)
        .join("") + "Z";
    }
    return { x, y, ticks, band };
  }, [mark, size]);

  const { x, y } = drawn;
  const plotRight = size - MARGIN.right;
  const plotBottom = size - MARGIN.bottom;

  return (
    <div ref={ref} className="vl-chart vl-chart-square">
      <svg width={size} height={size} role="img" aria-labelledby={titleId} className="vl-svg">
        <title id={titleId}>{summary}</title>
        <rect
          className="vl-plot-bg"
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotRight - MARGIN.left}
          height={plotBottom - MARGIN.top}
          rx={6}
        />
        {drawn.band ? <path className="vl-band" d={drawn.band} /> : null}
        {drawn.ticks.map((tick) => (
          <g key={tick}>
            <line className="vl-grid" x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={plotBottom} />
            <line className="vl-grid" x1={MARGIN.left} x2={plotRight} y1={y(tick)} y2={y(tick)} />
            <text className="vl-tick" x={x(tick)} y={plotBottom + 16} textAnchor="middle">
              {Math.round(tick * 100)}%
            </text>
            <text className="vl-tick" x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}
        <line className="vl-diagonal" x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
        <text className="vl-axis-label" x={(MARGIN.left + plotRight) / 2} y={size - 6} textAnchor="middle">
          {xLabel}
        </text>
        <text
          className="vl-axis-label"
          transform={`translate(12 ${(MARGIN.top + plotBottom) / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {yLabel}
        </text>
        {points
          .filter((point) => !point.outside)
          .map((point) => (
            <circle key={point.key} className={`vl-dot vl-dot-${body}`} cx={x(point.x)} cy={y(point.y)} r={4.5} />
          ))}
        {points
          .filter((point) => point.outside)
          .map((point) => {
            const px = x(point.x);
            const py = y(point.y);
            const right = px < (MARGIN.left + plotRight) / 2;
            return (
              <g key={point.key} className="vl-outlier">
                <path className="vl-diamond" d={`M${px},${py - 7}L${px + 7},${py}L${px},${py + 7}L${px - 7},${py}Z`} />
                <text
                  className="vl-outlier-label"
                  x={right ? px + 12 : px - 12}
                  y={py}
                  dy="0.32em"
                  textAnchor={right ? "start" : "end"}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

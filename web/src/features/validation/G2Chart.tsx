import { scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import { useId, useMemo } from "react";
import { withUnit, formatValue } from "./format";
import { utcDay, type G2Line, type G2Point } from "./model";
import { useWidth } from "./parts";

const HEIGHT = 220;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 52 };

type G2ChartProps = {
  lines: readonly G2Line[];
  /** Gate G2's limit, in degrees, from the file. */
  limit: number;
  /** The text that states the chart's finding; also the SVG's accessible name. */
  summary: string;
};

const BODY_LABEL = { sun: "Sun", earth: "Earth" } as const;

/**
 * The largest difference from JPL Horizons in each step of the time grid, for one site:
 * one line for the Sun and one for Earth, with the limit drawn across. Hand-built SVG.
 */
export function G2Chart({ lines, limit, summary }: G2ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const titleId = useId();

  const drawn = useMemo(() => {
    const points = lines.flatMap((item) => item.points);
    const first = points[0];
    if (!first) return null;
    let start = first.time;
    let end = first.time;
    let top = limit;
    for (const point of points) {
      if (point.time < start) start = point.time;
      if (point.time > end) end = point.time;
      if (Number.isFinite(point.value) && point.value > top) top = point.value;
    }
    const x = scaleUtc()
      .domain([start, end])
      .range([MARGIN.left, Math.max(MARGIN.left + 40, width - MARGIN.right)]);
    const y = scaleLinear()
      .domain([0, top * 1.15])
      .range([HEIGHT - MARGIN.bottom, MARGIN.top])
      .nice(4);
    const path = line<G2Point>()
      .defined((point) => Number.isFinite(point.value))
      .x((point) => x(point.time))
      .y((point) => y(point.value));
    return {
      x,
      y,
      paths: lines.map((item) => ({ body: item.body, d: path(item.points) ?? "" })),
      xTicks: x.ticks(width < 520 ? 3 : 6),
      yTicks: y.ticks(4),
    };
  }, [lines, limit, width]);

  return (
    <div ref={ref} className="vl-chart">
      {drawn ? (
        <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="vl-svg">
          <title id={titleId}>{summary}</title>
          <rect
            className="vl-plot-bg"
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, drawn.x.range()[1]! - MARGIN.left)}
            height={HEIGHT - MARGIN.top - MARGIN.bottom}
            rx={6}
          />
          {drawn.yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line className="vl-grid" x1={MARGIN.left} x2={drawn.x.range()[1]} y1={drawn.y(tick)} y2={drawn.y(tick)} />
              <text className="vl-tick" x={MARGIN.left - 8} y={drawn.y(tick)} dy="0.32em" textAnchor="end">
                {withUnit(formatValue(tick, { sig: 2 }), "deg")}
              </text>
            </g>
          ))}
          {drawn.xTicks.map((tick) => (
            <text
              key={`x${tick.getTime()}`}
              className="vl-tick"
              x={drawn.x(tick)}
              y={HEIGHT - MARGIN.bottom + 18}
              textAnchor="middle"
            >
              {utcDay(tick).slice(0, 4)}
            </text>
          ))}
          <line
            className="vl-limit"
            x1={MARGIN.left}
            x2={drawn.x.range()[1]}
            y1={drawn.y(limit)}
            y2={drawn.y(limit)}
          />
          <text className="vl-limit-label" x={drawn.x.range()[1]! - 6} y={drawn.y(limit) - 6} textAnchor="end">
            Limit {withUnit(formatValue(limit), "deg")}
          </text>
          {drawn.paths.map((item) => (
            <path key={item.body} className={`vl-line vl-line-${item.body}`} d={item.d} />
          ))}
        </svg>
      ) : null}
      <ul className="vl-legend" aria-hidden="true">
        {lines.map((item) => (
          <li key={item.body}>
            <span className={`vl-key vl-key-${item.body}`} />
            {BODY_LABEL[item.body]}
          </li>
        ))}
        <li>
          <span className="vl-key vl-key-limit" />
          Limit
        </li>
      </ul>
    </div>
  );
}

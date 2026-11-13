/**
 * The horizon chart: a hand-built SVG (d3-scale, d3-shape) of the skyline across 360°, the
 * Sun's and Earth's paths over the mission window, and their discs at the scrubber's hour
 * (docs/features/panorama.md, "The horizon chart").
 *
 * Only the discs and their labels depend on the hour. The skyline, the paths, the axes and
 * the antenna mask are one memoised layer that redraws only when the site, the mission
 * window, the centre, the vertical range or the width changes, so playing the scrubber
 * moves two ellipses and nothing else.
 */

import { area, line } from "d3-shape";
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Feature } from "../../contracts/generated";
import { formatNumber } from "../../components/format";
import { formatBearing, formatDistance, formatHeight, type SkylineArrays } from "../../app/mission/timeline/why-dark";
import { wrapAzimuth } from "../../lib/geo";
import {
  azimuthAtX,
  compassTicks,
  dayTickHours,
  discShape,
  elevationTicks,
  maskVertices,
  skylineVertices,
  trackSegments,
  xOfAzimuth,
  type ChartScales,
  type CompassTick,
  type SkylineVertex,
  type TrackPoint,
} from "./geometry";
import { bodyAt, labelDetail, labelTitle, skylineReading, tickWhen, type BodyId, type BodyNow, type ChartSeries } from "./readings";

export type ChartWindow = { from: number; to: number };

export type ChartProps = {
  scales: ChartScales;
  /** Null while loading: the frame and axes are drawn with no data. */
  skyline: SkylineArrays | null;
  series: ChartSeries | null;
  window: ChartWindow | null;
  /** The scrubber's hour on the time grid, or null when it is off the grid. */
  hour: number | null;
  landingHour: number | null;
  radii: { sun: number; earth: number };
  /** The profile's antenna mask, or null when a relay carries the link. */
  maskDeg: number | null;
  features: readonly Feature[];
  marker: { azDeg: number } | null;
  /** Whether a bin can be marked: it has a stored blocker. */
  onMark: (marker: { azDeg: number } | null) => void;
  onCentreChange: (centreDeg: number) => void;
  onZoom: (factor: number, anchorDeg: number) => void;
  onResetZoom: () => void;
  utcOfHour: (hour: number) => string | null;
  /** Labels drawn beside the discs; off in a narrow box, where a line under the chart says it. */
  showLabels: boolean;
  /** The text alternative: the answer in words. */
  label: string;
};

// ── The static layer's geometry ──────────────────────────────────────────────

type Tick = { body: BodyId; hour: number; x: number; y: number };

export type Drawing = {
  vertices: SkylineVertex[];
  skylineD: string | null;
  groundD: string | null;
  skyD: string | null;
  tracks: { body: BodyId; d: string }[];
  ticks: Tick[];
  maskD: string | null;
  maskLabel: { x: number; y: number } | null;
  compass: CompassTick[];
};

/** Everything the static layer draws. Pure; it reads the stored arrays and places them. */
export function buildDrawing(
  scales: ChartScales,
  skyline: SkylineArrays | null,
  series: ChartSeries | null,
  window: ChartWindow | null,
  maskDeg: number | null,
): Drawing {
  const { x, y, frame } = scales;
  const vertices = skyline ? skylineVertices(skyline.el_deg, scales.centreDeg) : [];
  const edge = line<SkylineVertex>()
    .x((v) => x(v.offset))
    .y((v) => y(v.el))
    .digits(2);
  const ground = area<SkylineVertex>()
    .x((v) => x(v.offset))
    .y0(frame.bottom + 1)
    .y1((v) => y(v.el))
    .digits(2);
  const sky = area<SkylineVertex>()
    .x((v) => x(v.offset))
    .y0(frame.top - 400)
    .y1((v) => y(v.el))
    .digits(2);

  const tracks: Drawing["tracks"] = [];
  const ticks: Tick[] = [];
  let earthOffsets: number[] = [];
  if (series && window) {
    const path = line<TrackPoint>()
      .x((p) => x(p.offset))
      .y((p) => y(p.el))
      .digits(2);
    for (const body of ["sun", "earth"] as const) {
      const az = body === "sun" ? series.sun_az : series.earth_az;
      const el = body === "sun" ? series.sun_el : series.earth_el;
      const segments = trackSegments(az, el, window.from, window.to, scales.centreDeg);
      const d = segments.map((segment) => path(segment) ?? "").join("");
      if (d) tracks.push({ body, d });
      if (body === "earth") earthOffsets = segments.flat().map((p) => p.offset);
      for (const hour of dayTickHours(window.from, window.to)) {
        const now = bodyAt(series, body, hour);
        if (now) ticks.push({ body, hour, x: xOfAzimuth(scales, now.azDeg), y: y(now.elDeg) });
      }
    }
  }

  const mask = maskDeg !== null && vertices.length ? maskVertices(vertices, earthOffsets, maskDeg) : null;
  const first = mask?.[0];
  return {
    vertices,
    skylineD: vertices.length ? edge(vertices) : null,
    groundD: vertices.length ? ground(vertices) : null,
    skyD: vertices.length ? sky(vertices) : null,
    tracks,
    ticks,
    maskD: mask ? edge(mask) : null,
    maskLabel: first ? { x: x(first.offset) - 6, y: y(first.el) } : null,
    compass: compassTicks(scales),
  };
}

/** Below this chart width the readout hangs under the chart and the mask's word is left out. */
const NARROW_PX = 520;

// ── The layers ───────────────────────────────────────────────────────────────

/** The grid, skyline, paths, day dots, 0° line, antenna mask and axes. Not redrawn per hour. */
const StaticLayer = memo(function StaticLayer({
  scales,
  drawing,
  clipPlot,
  clipSky,
}: {
  scales: ChartScales;
  drawing: Drawing;
  clipPlot: string;
  clipSky: string;
}) {
  const { frame, y } = scales;
  const levels = elevationTicks(scales.range);
  const zeroY = y(0);
  const zeroInside = zeroY >= frame.top - 0.5 && zeroY <= frame.bottom + 0.5;
  const tracks = drawing.tracks.map((track) => (
    <path key={track.body} d={track.d} className={`pano-track pano-track-${track.body}`} />
  ));
  const dots = drawing.ticks.map((tick) => (
    <circle
      key={`${tick.body}-${tick.hour}`}
      cx={tick.x}
      cy={tick.y}
      r={tick.body === "sun" ? 2.4 : 2}
      className={`pano-dot pano-dot-${tick.body}`}
    />
  ));
  return (
    <g>
      <defs>
        <clipPath id={clipPlot}>
          <rect x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
        </clipPath>
        {drawing.skyD ? (
          <clipPath id={clipSky}>
            <path d={drawing.skyD} />
          </clipPath>
        ) : null}
      </defs>

      <g clipPath={`url(#${clipPlot})`}>
        {levels
          .filter((e) => e !== 0)
          .map((e) => (
            <line key={e} x1={frame.left} x2={frame.right} y1={y(e)} y2={y(e)} className="pano-grid" />
          ))}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((az) => {
          const gx = xOfAzimuth(scales, az);
          return <line key={az} x1={gx} x2={gx} y1={frame.top} y2={frame.bottom} className="pano-grid" />;
        })}

        {drawing.groundD ? <path d={drawing.groundD} className="pano-ground" /> : null}

        {/* The paths and day dots: faded where they pass behind the skyline, full above it. */}
        <g className="pano-faded">
          {tracks}
          {dots}
        </g>
        <g clipPath={drawing.skyD ? `url(#${clipSky})` : undefined}>
          {tracks}
          {dots}
        </g>

        {drawing.skylineD ? <path d={drawing.skylineD} className="pano-rim" /> : null}
        {zeroInside ? <line x1={frame.left} x2={frame.right} y1={zeroY} y2={zeroY} className="pano-zero" /> : null}
        {drawing.maskD ? <path d={drawing.maskD} className="pano-mask" /> : null}
      </g>
      {drawing.maskLabel && frame.width >= NARROW_PX && drawing.maskLabel.x > frame.left + 72 ? (
        <text x={drawing.maskLabel.x} y={drawing.maskLabel.y + 4} textAnchor="end" className="pano-mask-label">
          antenna mask
        </text>
      ) : null}

      <rect
        x={frame.left}
        y={frame.top}
        width={frame.right - frame.left}
        height={frame.bottom - frame.top}
        className="pano-frame"
      />
      {levels.map((e) => (
        <text key={e} x={frame.left - 6} y={y(e) + 4} textAnchor="end" className={e === 0 ? "pano-axis pano-axis-zero" : "pano-axis"}>
          {e > 0 ? `+${formatNumber(e)}°` : `${formatNumber(e)}°`}
        </text>
      ))}
      {drawing.compass.map((tick) => (
        <g key={tick.azDeg}>
          <line
            x1={tick.x}
            x2={tick.x}
            y1={frame.bottom}
            y2={frame.bottom + (tick.size === "major" ? 6 : tick.size === "mid" ? 4 : 2)}
            className={`pano-tick pano-tick-${tick.size}`}
          />
          {tick.label ? (
            <text x={tick.x} y={frame.bottom + 20} textAnchor="middle" className={`pano-compass pano-compass-${tick.size}`}>
              {tick.label}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
});

/** The marked blocker: a dashed line through the plot and a ring on the skyline. */
const MarkerLayer = memo(function MarkerLayer({
  scales,
  skyline,
  azDeg,
}: {
  scales: ChartScales;
  skyline: SkylineArrays | null;
  azDeg: number;
}) {
  const { frame, y } = scales;
  const mx = xOfAzimuth(scales, azDeg);
  const reading = skyline ? skylineReading(skyline, azDeg, []) : null;
  const my = reading && Number.isFinite(reading.elDeg) ? y(reading.elDeg) : null;
  return (
    <g className="pano-marker">
      <line x1={mx} x2={mx} y1={frame.top} y2={frame.bottom} className="pano-marker-line" />
      {my !== null && my >= frame.top && my <= frame.bottom ? <circle cx={mx} cy={my} r={6} className="pano-marker-ring" /> : null}
    </g>
  );
});

/** Discs shorter than this many pixels (half-height) get a locator ring. */
const LOCATOR_BELOW_PX = 5;

/** The two discs at the scrubber's hour: faded in full, and bright where above the skyline. */
function DiscLayer({
  scales,
  bodies,
  radii,
  clipSky,
  hasSky,
}: {
  scales: ChartScales;
  bodies: BodyNow[];
  radii: { sun: number; earth: number };
  clipSky: string;
  hasSky: boolean;
}) {
  return (
    <g>
      {bodies.map((now) => {
        const disc = discShape(scales, now.azDeg, now.elDeg, radii[now.body]);
        // A disc only a few pixels tall (the Sun at a small stretch) gets a faint dashed ring
        // around it so it can be found. The ring is a pointer, not part of the disc.
        const small = disc.ry < LOCATOR_BELOW_PX;
        return (
          <g key={now.body} className={`pano-disc pano-disc-${now.body}`}>
            {small ? <circle cx={disc.cx} cy={disc.cy} r={Math.max(disc.ry, disc.rx) + 5} className="pano-locator" /> : null}
            <ellipse cx={disc.cx} cy={disc.cy} rx={disc.rx} ry={disc.ry} className="pano-disc-hidden" />
            <ellipse
              cx={disc.cx}
              cy={disc.cy}
              rx={disc.rx}
              ry={disc.ry}
              className="pano-disc-shown"
              clipPath={hasSky ? `url(#${clipSky})` : undefined}
            />
          </g>
        );
      })}
    </g>
  );
}

// ── Labels and the readout (HTML over the SVG) ───────────────────────────────

type LabelBox = { now: BodyNow; left: number; top: number; alignRight: boolean };

const LABEL_CHAR_PX = 6.6;

/** Where the two disc labels go: above each disc, toward the chart's middle, kept inside the plot and apart. */
function placeLabels(scales: ChartScales, bodies: BodyNow[], radii: { sun: number; earth: number }): LabelBox[] {
  const { frame } = scales;
  const mid = (frame.left + frame.right) / 2;
  const boxes: (LabelBox & { width: number })[] = [];
  for (const now of bodies) {
    const disc = discShape(scales, now.azDeg, now.elDeg, radii[now.body]);
    const width = Math.max(labelTitle(now).length, labelDetail(now).length) * LABEL_CHAR_PX + 16;
    const alignRight = disc.cx > mid;
    const anchor = alignRight ? disc.cx - 10 : disc.cx + 10;
    let left = alignRight ? anchor - width : anchor;
    left = Math.min(Math.max(left, frame.left + 4), frame.right - width - 4);
    let top = Math.min(Math.max(disc.cy - disc.ry - 42, frame.top + 4), frame.bottom - 42);
    for (const other of boxes) {
      const overlapX = left < other.left + other.width && other.left < left + width;
      const overlapY = top < other.top + 40 && other.top < top + 40;
      if (overlapX && overlapY) top = other.top + 40 > frame.bottom - 42 ? other.top - 42 : other.top + 44;
    }
    boxes.push({ now, left, top, alignRight, width });
  }
  return boxes;
}

type Cursor = { kind: "sky"; azDeg: number; px: number; py: number; keyboard: boolean } | { kind: "tick"; tick: Tick; px: number; py: number };

function Readout({
  cursor,
  scales,
  skyline,
  series,
  features,
  landingHour,
  utcOfHour,
  marked,
}: {
  cursor: Cursor;
  scales: ChartScales;
  skyline: SkylineArrays | null;
  series: ChartSeries | null;
  features: readonly Feature[];
  landingHour: number | null;
  utcOfHour: (hour: number) => string | null;
  marked: boolean;
}) {
  const width = Math.min(232, scales.frame.width - 16);
  const right = cursor.px > scales.frame.width / 2;
  const left = Math.min(Math.max(right ? cursor.px - width - 14 : cursor.px + 14, 8), scales.frame.width - width - 8);
  // In a narrow box the readout would hide the whole plot: it hangs under the chart instead.
  const narrow = scales.frame.width < NARROW_PX;
  const style = { left, top: narrow ? scales.frame.height + 6 : scales.frame.top + 4, width };

  if (cursor.kind === "tick") {
    const now = series ? bodyAt(series, cursor.tick.body, cursor.tick.hour) : null;
    const utc = utcOfHour(cursor.tick.hour);
    return (
      <div className="pano-readout" style={style}>
        <p className="pano-readout-title">{cursor.tick.body === "sun" ? "Sun's path" : "Earth's path"}</p>
        <p className="pano-readout-big">{utc && landingHour !== null ? tickWhen(utc, cursor.tick.hour, landingHour) : "—"}</p>
        {now ? (
          <dl>
            <dt>Elevation</dt>
            <dd>{formatNumber(now.elDeg, 2)}°</dd>
            <dt>Disc fraction</dt>
            <dd>{formatNumber(now.frac, 2)}</dd>
          </dl>
        ) : null}
      </div>
    );
  }

  const reading = skyline ? skylineReading(skyline, cursor.azDeg, features) : null;
  return (
    <div className="pano-readout" style={style}>
      <p className="pano-readout-title">Skyline at {cursor.keyboard ? "the cursor" : "the pointer"}</p>
      <p className="pano-readout-big">
        {formatBearing(reading ? reading.azDeg : cursor.azDeg)}
      </p>
      {reading ? (
        <dl>
          <dt>Skyline elevation</dt>
          <dd>{formatNumber(reading.elDeg, 2)}°</dd>
          {reading.blocker ? (
            <>
              <dt>Distance to blocker</dt>
              <dd>{formatDistance(reading.blocker.distKm)}</dd>
              <dt>Blocker height</dt>
              <dd>{formatHeight(reading.blocker.heightM)}</dd>
              {reading.feature ? (
                <>
                  <dt>Nearest named feature</dt>
                  <dd>{reading.feature.name}</dd>
                </>
              ) : null}
            </>
          ) : null}
        </dl>
      ) : null}
      <p className="pano-readout-hint">
        {reading?.blocker
          ? marked
            ? cursor.keyboard
              ? "Marked. Enter clears the mark."
              : "Marked. Click again to clear it."
            : cursor.keyboard
              ? "Enter marks this blocker."
              : "Click to mark this blocker."
          : "No blocker is stored here: the horizon is the smooth Moon's."}
      </p>
    </div>
  );
}

// ── The chart ────────────────────────────────────────────────────────────────

const DRAG_PX = 4;
const TICK_HIT_PX = 9;
const ZOOM_STEP = 1.15;

function nearestTick(ticks: readonly Tick[], px: number, py: number): Tick | null {
  let best: Tick | null = null;
  let bestD = TICK_HIT_PX * TICK_HIT_PX;
  for (const tick of ticks) {
    const d = (tick.x - px) ** 2 + (tick.y - py) ** 2;
    if (d <= bestD) {
      best = tick;
      bestD = d;
    }
  }
  return best;
}

function cssId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function HorizonChart(props: ChartProps) {
  const { scales, skyline, series, window, hour, radii, maskDeg, marker, onMark, onCentreChange, onZoom, onResetZoom } = props;
  const { frame } = scales;
  const uid = cssId(useId());
  const clipPlot = `pano-plot-${uid}`;
  const clipSky = `pano-sky-${uid}`;
  const hintId = `pano-hint-${uid}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const drag = useRef<{ id: number; x: number; centre: number; moved: boolean } | null>(null);

  const drawing = useMemo(
    () => buildDrawing(scales, skyline, series, window, maskDeg),
    [scales, skyline, series, window, maskDeg],
  );

  const bodies = useMemo(() => {
    if (!series || hour === null) return [];
    return (["sun", "earth"] as const).map((b) => bodyAt(series, b, hour)).filter((b): b is BodyNow => b !== null);
  }, [series, hour]);

  // Scroll zooms the vertical scale. A native listener, so the page does not scroll too.
  const live = useRef({ scales, onZoom });
  live.current = { scales, onZoom };
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const box = node.getBoundingClientRect();
      const anchor = live.current.scales.y.invert(event.clientY - box.top);
      live.current.onZoom(event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, anchor);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const local = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { px: event.clientX - box.left, py: event.clientY - box.top };
  };
  const inPlot = (px: number, py: number) => px >= frame.left && px <= frame.right && py >= frame.top - 4 && py <= frame.bottom + 24;

  const hover = (px: number, py: number) => {
    if (!inPlot(px, py)) {
      setCursor(null);
      return;
    }
    const tick = nearestTick(drawing.ticks, px, py);
    setCursor(tick ? { kind: "tick", tick, px, py } : { kind: "sky", azDeg: azimuthAtX(scales, px), px, py, keyboard: false });
  };

  const markAt = (azDeg: number) => {
    if (!skyline) return;
    const reading = skylineReading(skyline, azDeg, []);
    if (!reading.blocker) return;
    const same = marker && wrapAzimuth(marker.azDeg) === reading.azDeg;
    onMark(same ? null : { azDeg: reading.azDeg });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, centre: scales.centreDeg, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === event.pointerId) {
      const dx = event.clientX - d.x;
      if (!d.moved && Math.abs(dx) > DRAG_PX) {
        d.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setCursor(null);
      }
      if (d.moved) {
        onCentreChange(wrapAzimuth(d.centre - dx / scales.pxPerDeg));
        return;
      }
    }
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      const { px, py } = local(event);
      hover(px, py);
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== event.pointerId || d.moved) return;
    const { px, py } = local(event);
    if (!inPlot(px, py)) return;
    const azDeg = azimuthAtX(scales, px);
    markAt(azDeg);
    if (event.pointerType !== "mouse") setCursor({ kind: "sky", azDeg, px, py, keyboard: false });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const start = cursor?.kind === "sky" ? cursor.azDeg : cursor?.kind === "tick" ? azimuthAtX(scales, cursor.tick.x) : scales.centreDeg;
    const step = event.shiftKey ? 0.25 : 1;
    let az: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        az = wrapAzimuth(start - step);
        break;
      case "ArrowRight":
        az = wrapAzimuth(start + step);
        break;
      case "Home":
        az = wrapAzimuth(scales.centreDeg - 180);
        break;
      case "End":
        az = wrapAzimuth(scales.centreDeg + 179.75);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        markAt(start);
        if (!cursor) az = start;
        break;
      case "Escape":
        if (cursor) {
          event.preventDefault();
          event.stopPropagation();
          setCursor(null);
        }
        return;
      case "Delete":
      case "Backspace":
        if (marker) {
          event.preventDefault();
          onMark(null);
        }
        return;
      case "+":
      case "=":
      case "ArrowUp":
        event.preventDefault();
        onZoom(1 / ZOOM_STEP, (scales.range.lo + scales.range.hi) / 2);
        return;
      case "-":
      case "_":
      case "ArrowDown":
        event.preventDefault();
        onZoom(ZOOM_STEP, (scales.range.lo + scales.range.hi) / 2);
        return;
      case "0":
        event.preventDefault();
        onResetZoom();
        return;
      default:
        return;
    }
    if (az === null) return;
    event.preventDefault();
    const px = xOfAzimuth(scales, az);
    setCursor({ kind: "sky", azDeg: az, px, py: frame.top, keyboard: true });
  };

  const cursorX = cursor ? (cursor.kind === "tick" ? cursor.tick.x : xOfAzimuth(scales, cursor.azDeg)) : null;
  const labels = props.showLabels ? placeLabels(scales, bodies, radii) : [];
  const marked =
    cursor?.kind === "sky" && marker && skyline
      ? skylineReading(skyline, cursor.azDeg, []).azDeg === wrapAzimuth(marker.azDeg)
      : false;

  return (
    <>
      <div
        ref={hostRef}
        className="pano-chart"
        style={{ height: frame.height + 2 }}
        tabIndex={0}
        role="application"
        aria-roledescription="horizon chart"
        aria-label={props.label}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && !drag.current) setCursor((c) => (c && c.kind === "sky" && c.keyboard ? c : null));
        }}
        onBlur={() => setCursor((c) => (c && c.kind === "sky" && c.keyboard ? null : c))}
        onKeyDown={onKeyDown}
      >
        <svg width={frame.width} height={frame.height} viewBox={`0 0 ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false">
          <StaticLayer scales={scales} drawing={drawing} clipPlot={clipPlot} clipSky={clipSky} />
          {marker ? <MarkerLayer scales={scales} skyline={skyline} azDeg={marker.azDeg} /> : null}
          <g clipPath={`url(#${clipPlot})`}>
            <DiscLayer scales={scales} bodies={bodies} radii={radii} clipSky={clipSky} hasSky={drawing.skyD !== null} />
          </g>
          {cursorX !== null ? <line x1={cursorX} x2={cursorX} y1={frame.top} y2={frame.bottom} className="pano-cursor" /> : null}
        </svg>

        {labels.map((box) => (
          <div
            key={box.now.body}
            className={`pano-label pano-label-${box.now.body}`}
            style={{ left: box.left, top: box.top }}
            data-align={box.alignRight ? "end" : "start"}
            aria-hidden="true"
          >
            <span className="pano-label-title">{labelTitle(box.now)}</span>
            <span className="pano-label-detail">{labelDetail(box.now)}</span>
          </div>
        ))}

        <p id={hintId} className="sr-only">
          Left and right arrows move a cursor along the skyline and read it out; with Shift they move one skyline bin.
          Enter marks the blocker under the cursor. Up and down change the vertical stretch, and 0 resets it. Drag to turn
          the view.
        </p>
        <p className="sr-only" aria-live="polite">
          {cursor?.kind === "sky" && cursor.keyboard && skyline ? keyboardAnnouncement(skyline, cursor.azDeg, props.features) : ""}
        </p>
      </div>
      {cursor ? (
        <Readout
          cursor={cursor}
          scales={scales}
          skyline={skyline}
          series={series}
          features={props.features}
          landingHour={props.landingHour}
          utcOfHour={props.utcOfHour}
          marked={marked}
        />
      ) : null}
    </>
  );
}

function keyboardAnnouncement(skyline: SkylineArrays, azDeg: number, features: readonly Feature[]): string {
  const r = skylineReading(skyline, azDeg, features);
  const parts = [`Azimuth ${formatBearing(r.azDeg)}`, `skyline ${formatNumber(r.elDeg, 2)}°`];
  if (r.blocker) parts.push(`blocker ${formatDistance(r.blocker.distKm)} away, ${formatHeight(r.blocker.heightM)} high`);
  if (r.feature) parts.push(`near ${r.feature.name}`);
  return `${parts.join(", ")}.`;
}


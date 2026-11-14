import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import { formatNumber } from "../../../components/format";
import { autoRange, elevationTicks, type ElevationRange } from "../../panorama/geometry";
import { bodyAt } from "../../panorama/readings";
import { resolveValue, type WorkedExamples } from "../placeholders";
import type { RunnerState } from "../runner";
import { clockwiseWidthDeg, resolveSkylineWindow, wrapAzimuth } from "../skyline-score";
import {
  columnAt,
  columnCount,
  columnOffsetDeg,
  emptySketch,
  handleColumns,
  handlesFrom,
  hasLine,
  nudgeHandle,
  sketchAzimuths,
  sketchFromPoints,
  sketchFromHandles,
  sketchGapDeg,
  skylineInWindow,
  strokeTo,
  type Sketch,
} from "../sketch";
import { isAnswered, type Draft } from "../step-view";
import type { Step } from "../types";
import { filledText } from "../ui/filled";
import { hourOnGrid } from "../utc";
import type { SceneStatus } from "./drag-body-stage";
import { sceneSiteId, useSceneData, type SceneData } from "./scene-data";

type SketchStep = Extract<Step, { kind: "draw-skyline" }>;

type SkylineStageProps = {
  step: SketchStep;
  runner: RunnerState;
  draft: Draft;
  examples: WorkedExamples;
  onDraft: (draft: Draft) => void;
  onStatus: (status: SceneStatus) => void;
};

const MARGIN = { left: 40, right: 12, top: 12, bottom: 28 };

function useWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  useLayoutEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    setWidth(Math.round(node.clientWidth) || 360);
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

/** The draw-skyline stage: an empty horizon frame for the step's window, the Sun as a reference, and the sketch. */
export function SkylineStage(props: SkylineStageProps) {
  const siteId = sceneSiteId(props.step.scene, props.examples);
  if (!siteId) return <SketchFrame title="Lander's eye" message="Loading the skyline…" />;
  return <SiteSkyline key={`${props.step.id}-${siteId}`} siteId={siteId} {...props} />;
}

function SketchFrame({ title, message }: { title: string; message: string }) {
  return (
    <div className="ac-sketch">
      <p className="ac-drag-title">{title}</p>
      <div className="ac-drag-empty" role="status">
        <span className="ac-drag-empty-line" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

function SiteSkyline({ siteId, ...props }: SkylineStageProps & { siteId: string }) {
  const load = useSceneData(siteId);
  const { onStatus } = props;
  useEffect(() => onStatus(load.status), [load.status, onStatus]);
  if (load.status === "error") return null;
  if (load.status === "loading") return <SketchFrame title={`Lander's eye, ${load.name}`} message="Loading the skyline…" />;
  return <SketchBoard data={load.data} {...props} />;
}

/** The hour the Sun is drawn at: the scene's current hour (the lesson's example hour). */
function referenceHour(data: SceneData, step: SketchStep, examples: WorkedExamples): number | null {
  const utc = resolveValue(step.scene.scenario.currentUtc, examples).value;
  return typeof utc === "string" ? hourOnGrid(data.grid, utc) : null;
}

function SketchBoard({ data, step, runner, draft, examples, onDraft }: SkylineStageProps & { data: SceneData }) {
  const answered = isAnswered(runner);
  const window = useMemo(() => resolveSkylineWindow(step.window, examples), [step.window, examples]);
  const widthDeg = window ? clockwiseWidthDeg(window.fromDeg, window.toDeg) : 0;
  const columns = columnCount(widthDeg);
  const real = useMemo(
    () => (window ? skylineInWindow(data.skyline.el_deg, window.fromDeg, window.toDeg) : []),
    [data.skyline.el_deg, window],
  );
  const hour = referenceHour(data, step, examples);
  const sun = hour !== null ? bodyAt(data.series, "sun", hour) : null;

  // The same vertical range the horizon chart takes for this site and hour.
  const range: ElevationRange = useMemo(
    () =>
      autoRange({
        skylineEl: data.skyline.el_deg,
        sunEl: data.series.sun_el,
        earthEl: null,
        from: hour ?? 0,
        to: (hour ?? 0) + 1,
        sunRadiusDeg: data.radii.sun,
        earthRadiusDeg: data.radii.earth,
      }),
    [data.skyline.el_deg, data.series.sun_el, hour, data.radii.sun, data.radii.earth],
  );

  // A sketch already drawn (the lesson's draft) is drawn again: on return to a half-done
  // step, and when a finished step is reviewed.
  const [sketch, setSketch] = useState<Sketch>(() =>
    window && draft?.kind === "draw-skyline" ? sketchFromPoints(draft.sketch, window.fromDeg, widthDeg, columns) : emptySketch(columns),
  );
  const [handles, setHandles] = useState<number[]>(() => handlesFrom(sketch, 0));
  const [announce, setAnnounce] = useState("");
  const last = useRef<{ column: number; elDeg: number } | null>(null);
  // The sketch as the pointer leaves it, updated at once on every move, so the stroke's end
  // commits its last segment even before React has drawn it.
  const live = useRef(sketch);
  const draw = (next: Sketch) => {
    live.current = next;
    setSketch(next);
  };

  const [hostRef, width] = useWidth();
  const height = width < 480 ? 200 : 240;
  const plot = { left: MARGIN.left, right: width - MARGIN.right, top: MARGIN.top, bottom: height - MARGIN.bottom };
  const pw = Math.max(1, plot.right - plot.left);
  const ph = plot.bottom - plot.top;
  const x = (offset: number) => plot.left + (widthDeg > 0 ? (offset / widthDeg) * pw : 0);
  const y = (el: number) => plot.top + ((range.hi - el) / (range.hi - range.lo)) * ph;
  const elAt = (py: number) => Math.min(range.hi, Math.max(range.lo, range.hi - ((py - plot.top) / ph) * (range.hi - range.lo)));

  const commit = useCallback(
    (next: Sketch) => {
      if (!window || !hasLine(next)) {
        onDraft(null);
        return;
      }
      onDraft({
        kind: "draw-skyline",
        sketch: sketchAzimuths(next, window.fromDeg, widthDeg),
        gapDeg: sketchGapDeg(next, real, widthDeg),
      });
    },
    [window, widthDeg, real, onDraft],
  );

  if (!window || real.length === 0) {
    return <SketchFrame title={`Lander's eye, ${data.name}`} message="This step's directions have no stored skyline." />;
  }

  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const offset = ((px - plot.left) / pw) * widthDeg;
    return { column: columnAt(offset, columns, widthDeg), elDeg: elAt(py) };
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (answered || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const at = point(event);
    last.current = at;
    draw(strokeTo(live.current, null, at));
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!last.current) return;
    const at = point(event);
    const from = last.current;
    last.current = at;
    draw(strokeTo(live.current, from, at));
  };
  // The stroke ends cleanly on pointerup, pointercancel and lost capture alike: it commits
  // the line, and nothing is left waiting, so the next tap (on Done) is an ordinary click.
  const onUp = () => {
    if (!last.current) return;
    last.current = null;
    const done = live.current;
    setHandles(handlesFrom(done, 0));
    commit(done);
  };

  const handleCols = handleColumns(columns, handles.length);
  const azOfColumn = (column: number) => wrapAzimuth(window.fromDeg + columnOffsetDeg(column, columns, widthDeg));
  const onHandleKey = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (answered) return;
    const next = nudgeHandle(handles, index, event.key, event.shiftKey, range);
    if (!next) return;
    event.preventDefault();
    const line = sketchFromHandles(next, columns);
    setHandles(next);
    draw(line);
    commit(line);
    setAnnounce(`Point ${index + 1}: ${formatNumber(next[index] ?? 0, 2)}°`);
  };
  const reset = () => {
    const empty = emptySketch(columns);
    draw(empty);
    setHandles(handlesFrom(empty, 0));
    onDraft(null);
    setAnnounce("Sketch cleared.");
  };

  const ticks = elevationTicks(range);
  const azTicks: number[] = [];
  for (let offset = 0; offset <= widthDeg + 1e-9; offset += 10) azTicks.push(offset);
  const sketchPath = pathOf(sketch.map((el, column) => (el === null ? null : { x: x(columnOffsetDeg(column, columns, widthDeg)), y: y(el) })));
  const realPath = pathOf(real.map((p) => ({ x: x(p.azDeg), y: y(p.elDeg) })));
  const groundPath = realPath ? `${realPath}L${x(real[real.length - 1]?.azDeg ?? widthDeg)},${plot.bottom}L${x(real[0]?.azDeg ?? 0)},${plot.bottom}Z` : null;
  const sunR = data.radii.sun;
  const sunOffset = sun ? clockwiseWidthDeg(window.fromDeg, sun.azDeg) : null;
  const sunInside = sun && sunOffset !== null && sunOffset <= widthDeg;
  const drawn = hasLine(sketch);
  const caption = step.preview ? filledText(step.preview.reveal, examples) : null;
  const handleVisible = !answered;
  const description = `An empty horizon from azimuth ${formatNumber(window.fromDeg, 2)}° to ${formatNumber(window.toDeg, 2)}°, elevation ${formatNumber(range.lo, 1)}° to ${formatNumber(range.hi, 1)}°${
    sunInside && sun ? `. The Sun is drawn at azimuth ${formatNumber(sun.azDeg, 2)}°, ${formatNumber(sun.elDeg, 2)}° up` : ""
  }.`;

  return (
    <div className="ac-sketch" data-answered={answered || undefined}>
      <p className="ac-drag-title">Lander's eye, {data.name}, towards the Sun</p>
      <div ref={hostRef} className="ac-sketch-frame" style={{ height }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
          <rect x={plot.left} y={plot.top} width={pw} height={ph} className="ac-sketch-plot" />
          {ticks.map((e) => (
            <g key={e}>
              <line x1={plot.left} x2={plot.right} y1={y(e)} y2={y(e)} className={e === 0 ? "ac-sketch-zero" : "ac-sketch-grid"} />
              <text x={plot.left - 6} y={y(e) + 4} textAnchor="end" className="ac-sketch-axis">
                {e > 0 ? `+${formatNumber(e)}°` : `${formatNumber(e)}°`}
              </text>
            </g>
          ))}
          {azTicks.map((offset) => (
            <g key={offset}>
              <line x1={x(offset)} x2={x(offset)} y1={plot.top} y2={plot.bottom} className="ac-sketch-grid" />
              <text x={x(offset)} y={plot.bottom + 18} textAnchor="middle" className="ac-sketch-axis">
                {formatNumber(wrapAzimuth(window.fromDeg + offset), 0)}°
              </text>
            </g>
          ))}
          {answered && realPath && groundPath ? (
            <g className="ac-sketch-real">
              <path d={groundPath} className="ac-sketch-ground" />
              <path d={realPath} className="ac-sketch-rim" />
            </g>
          ) : null}
          {sunInside && sun && sunOffset !== null ? (
            <g className="ac-sketch-sun">
              <ellipse
                cx={x(sunOffset)}
                cy={y(sun.elDeg)}
                rx={Math.max(2, (sunR / widthDeg) * pw)}
                ry={Math.max(2, (sunR / (range.hi - range.lo)) * ph)}
              />
              <circle cx={x(sunOffset)} cy={y(sun.elDeg)} r={9} />
              <text x={x(sunOffset) + 10} y={y(sun.elDeg) - 10} className="ac-sketch-sun-label">
                Sun
              </text>
            </g>
          ) : null}
          {sketchPath ? <path d={sketchPath} className="ac-sketch-line" /> : null}
        </svg>
        <div
          className="ac-sketch-surface"
          data-locked={answered || undefined}
          style={{ left: 0, top: 0, width, height }}
          aria-hidden="true"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        />
        {handleVisible ? (
          <div className="ac-sketch-handles" role="group" aria-label="Points of your sketch">
            {handles.map((el, index) => {
              const column = handleCols[index] ?? 0;
              return (
                <button
                  key={index}
                  type="button"
                  className="ac-sketch-handle"
                  data-drawn={drawn || undefined}
                  data-ac-slider=""
                  style={{ left: x(columnOffsetDeg(column, columns, widthDeg)), top: y(el) }}
                  role="slider"
                  aria-orientation="vertical"
                  aria-label={`Point ${index + 1} of ${handles.length}, azimuth ${formatNumber(azOfColumn(column), 0)}°`}
                  aria-valuemin={range.lo}
                  aria-valuemax={range.hi}
                  aria-valuenow={el}
                  aria-valuetext={`${formatNumber(el, 2)}°`}
                  onKeyDown={onHandleKey(index)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <p className="ac-visually-hidden" aria-live="polite">
        {announce}
      </p>

      {answered ? (
        <div className="ac-sketch-legend">
          <span>
            <svg width="28" height="8" aria-hidden="true">
              <path d="M1 4H27" className="ac-sketch-rim" />
            </svg>
            Real skyline
          </span>
          <span>
            <svg width="28" height="8" aria-hidden="true">
              <path d="M1 4H27" className="ac-sketch-line" />
            </svg>
            Your sketch
          </span>
          {caption ? <p className="ac-sketch-caption">{caption}</p> : null}
        </div>
      ) : (
        <div className="ac-sketch-tools">
          <p className="ac-keys">
            <span className="ac-only-desk">Draw one line from left to right, or Tab to a point and use </span>
            <span className="ac-only-phone">Draw one line from left to right. </span>
            <span className="ac-kbd ac-only-desk">↑</span>
            <span className="ac-kbd ac-only-desk">↓</span>
          </p>
          <button type="button" className="ac-btn ac-btn--secondary ac-btn--compact" disabled={!drawn} onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Start again
          </button>
        </div>
      )}
    </div>
  );
}

/** A path through points, broken where a point is missing. */
function pathOf(points: readonly ({ x: number; y: number } | null)[]): string | null {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d || null;
}

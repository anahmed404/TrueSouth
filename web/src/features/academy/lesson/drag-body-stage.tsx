import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Explain } from "../../../components/Explain";
import { formatNumber, formatUtc } from "../../../components/format";
import { hourIndexToUtc } from "../../../lib/time";
import { HorizonChart } from "../../panorama/chart";
import { autoRange, chartFrame, chartScales, meanAzimuth, xOfAzimuth, zoomRange, type ElevationRange } from "../../panorama/geometry";
import { BODY_NAME, bodyAt, heightWords } from "../../panorama/readings";
import {
  answerHour,
  barXOfHour,
  hourAfterKey,
  hourAtBarX,
  hourNearPointer,
  metricAt,
  resolveTimeRange,
  startHour,
  type HourRange,
  type NumberGoal,
  type PathPoint,
} from "../drag-body";
import { resolveValue, type WorkedExamples } from "../placeholders";
import type { RunnerState } from "../runner";
import { isAnswered, type Draft } from "../step-view";
import type { SkylineKind, Step } from "../types";
import { CorrectMark } from "../ui/marks";
import { filledText } from "../ui/filled";
import { sceneSiteId, useSceneData, type SceneData } from "./scene-data";

type DragStep = Extract<Step, { kind: "drag-body" }>;

export type SceneStatus = "loading" | "ready" | "error";

type DragBodyStageProps = {
  step: DragStep;
  runner: RunnerState;
  draft: Draft;
  examples: WorkedExamples;
  onDraft: (draft: Draft) => void;
  onStatus: (status: SceneStatus) => void;
};

const NO_FEATURES: never[] = [];
const LOADING_RANGE: ElevationRange = { lo: -2, hi: 4 };
const noop = () => undefined;

/** The flat skylines drawn for a `flat` or `smooth` scene, one per bin count. */
const FLAT = new Map<number, { el_deg: Float32Array; dist_km: Float32Array; lat_deg: Float32Array; lon_deg: Float32Array; height_m: Float32Array }>();

/**
 * A level skyline at 0° with no blocker, for a step that asks for the horizon without its
 * terrain. It is a drawing, never a result: every value the learner reads comes from the
 * series. Blockers are NaN, so the chart offers no blocker to mark.
 */
export function flatSkyline(bins: number) {
  let flat = FLAT.get(bins);
  if (!flat) {
    const none = new Float32Array(bins).fill(Number.NaN);
    flat = { el_deg: new Float32Array(bins), dist_km: none, lat_deg: none, lon_deg: none, height_m: none };
    FLAT.set(bins, flat);
  }
  return flat;
}

/** The width of an element, followed as it changes; 360 until measured (and in tests). */
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

const BLANK = new Map<number, Float32Array>();

/** The series with the other body's columns blank (NaN), so the chart draws one body. A drawing choice, not a value. */
function onlyBody(series: SceneData["series"], body: "sun" | "earth") {
  const n = series.sun_el.length;
  let blank = BLANK.get(n);
  if (!blank) {
    blank = new Float32Array(n).fill(Number.NaN);
    BLANK.set(n, blank);
  }
  return body === "sun"
    ? { ...series, earth_az: blank, earth_el: blank, earth_frac: blank, earth_clear: blank }
    : { ...series, sun_az: blank, sun_el: blank, sun_frac: blank, sun_clear: blank };
}

/** The step's goal with its placeholder filled, or null when it is not a number goal. */
function numberGoal(step: DragStep, examples: WorkedExamples): NumberGoal | null {
  if ("comparedTo" in step.goal) return null;
  const value = resolveValue(step.goal.value, examples).value;
  if (typeof value !== "number") return null;
  return { metric: step.goal.metric, op: step.goal.op, value, tolerance: step.goal.tolerance };
}

/** The drag-body stage: the horizon chart for the step's site and hours, with the body to drag. */
export function DragBodyStage(props: DragBodyStageProps) {
  const siteId = sceneSiteId(props.step.scene, props.examples);
  if (!siteId) return <DragFrame name={null} message="Loading the horizon…" />;
  return <SiteDragBody key={`${props.step.id}-${siteId}`} siteId={siteId} {...props} />;
}

function DragFrame({ name, message }: { name: string | null; message: string }) {
  return (
    <div className="ac-drag">
      <p className="ac-drag-title">{name ? `Lander's eye, ${name}` : "Lander's eye"}</p>
      <div className="ac-drag-empty" role="status">
        <span className="ac-drag-empty-line" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

function SiteDragBody({ siteId, ...props }: DragBodyStageProps & { siteId: string }) {
  const load = useSceneData(siteId);
  const { onStatus } = props;
  useEffect(() => onStatus(load.status), [load.status, onStatus]);
  if (load.status === "error") return null;
  if (load.status === "loading") return <DragFrame name={load.name} message="Loading the horizon…" />;
  return <DragChart data={load.data} {...props} />;
}

function DragChart({ data, step, runner, draft, examples, onDraft }: DragBodyStageProps & { data: SceneData }) {
  const body = step.body;
  const answered = isAnswered(runner);
  const goal = useMemo(() => numberGoal(step, examples), [step, examples]);
  const range = useMemo<HourRange | null>(() => {
    if (!step.scene.timeRange) return null;
    const resolved = resolveTimeRange(step.scene.timeRange, examples, data.grid);
    return resolved && !("missing" in resolved) ? resolved : null;
  }, [step.scene.timeRange, examples, data.grid]);
  const { series, grid } = data;

  const utcOf = useCallback((h: number) => {
    try {
      return hourIndexToUtc(grid, h);
    } catch {
      return null;
    }
  }, [grid]);

  // The body's own hour: local while dragging, sent to the lesson as a draft when the drag ends.
  const drafted = draft?.kind === "drag-body" ? draft.hour : null;
  const [hour, setHour] = useState<number>(() => drafted ?? (range ? startHour(series, goal, range) : 0));
  const dragging = useRef<number | null>(null);
  // The body follows the lesson's draft when it changes from outside a drag.
  useEffect(() => {
    if (drafted !== null && dragging.current === null) setHour(drafted);
  }, [drafted]);

  const draftAt = useCallback(
    (h: number): Draft => {
      const value = goal ? metricAt(series, goal.metric, h) : null;
      const utc = utcOf(h);
      if (value === null || utc === null) return null;
      return { kind: "drag-body", hour: h, utc, value, sunFrac: metricAt(series, "sun_frac", h) };
    },
    [goal, series, utcOf],
  );

  // The starting place is a draft too, so "Check" works without moving (it is a miss).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || drafted !== null || answered) return;
    seeded.current = true;
    onDraft(draftAt(hour));
  }, [drafted, answered, onDraft, draftAt, hour]);

  // The readout is announced when the body settles, not on every pixel of a drag.
  const [announced, setAnnounced] = useState<number | null>(null);
  const commit = useCallback(
    (h: number) => {
      setAnnounced(h);
      if (!answered) onDraft(draftAt(h));
    },
    [answered, onDraft, draftAt],
  );

  // ── The chart's scales: a level skyline for `flat` and `smooth`, the real one for `terrain` ─
  const terrain: SkylineKind = step.scene.skyline;
  const sky = terrain === "terrain" ? data.skyline : flatSkyline(data.skyline.el_deg.length);
  // Keyed on the two hours, not the range object, so the chart's static layer is not
  // redrawn when the lesson's examples are handed over again.
  const fromIndex = range?.fromIndex ?? null;
  const toIndex = range?.toIndex ?? null;
  const chartWindow = useMemo(
    () => (fromIndex !== null && toIndex !== null ? { from: fromIndex, to: toIndex + 1 } : null),
    [fromIndex, toIndex],
  );
  const radii = useMemo(() => ({ sun: data.radii.sun, earth: data.radii.earth }), [data.radii.sun, data.radii.earth]);
  const [hostRef, width] = useWidth();
  const frame = useMemo(() => chartFrame(width - 2), [width]);
  // The Sun circles the whole horizon in a month, so the view starts centred on where it
  // stands; Earth swings about one direction, so the view centres on its mean.
  const startAz = useRef(bodyAt(series, body, hour)?.azDeg ?? null);
  const bodyAz = body === "sun" ? series.sun_az : series.earth_az;
  const meanAz = useMemo(
    () => (body === "sun" ? startAz.current : chartWindow ? meanAzimuth(bodyAz, chartWindow.from, chartWindow.to) : null),
    [body, bodyAz, chartWindow],
  );
  // Only the dragged body is drawn: the other's path would be a second line to read.
  const shown = useMemo(() => onlyBody(series, body), [series, body]);
  const [centre, setCentre] = useState<number | null>(null);
  const centreDeg = centre ?? meanAz ?? 0;
  const auto = useMemo(
    () =>
      chartWindow
        ? autoRange({
            skylineEl: terrain === "terrain" ? sky.el_deg : null,
            // Only the dragged body sets the height, so a Sun that climbs 0.6° is not
            // flattened by Earth's swing of several degrees.
            sunEl: body === "sun" ? series.sun_el : null,
            earthEl: body === "earth" ? series.earth_el : null,
            from: chartWindow.from,
            to: chartWindow.to,
            sunRadiusDeg: radii.sun,
            earthRadiusDeg: radii.earth,
          })
        : LOADING_RANGE,
    [chartWindow, terrain, sky, series, radii, body],
  );
  const [zoom, setZoom] = useState<ElevationRange | null>(null);
  const elRange = zoom ?? auto;
  const scales = useMemo(() => chartScales(frame, centreDeg, elRange), [frame, centreDeg, elRange]);
  const onZoom = useCallback((factor: number, anchor: number) => setZoom((z) => zoomRange(z ?? auto, factor, anchor)), [auto]);
  const onResetZoom = useCallback(() => setZoom(null), []);
  const onCentreChange = useCallback((deg: number) => setCentre(deg), []);

  // ── The body's path in pixels, for the pointer ─────────────────────────────
  const points = useMemo<PathPoint[]>(() => {
    if (!range) return [];
    const out: PathPoint[] = [];
    for (let h = range.fromIndex; h <= range.toIndex; h += 1) {
      const now = bodyAt(series, body, h);
      if (now) out.push({ hour: h, x: xOfAzimuth(scales, now.azDeg), y: scales.y(now.elDeg) });
    }
    return out;
  }, [range, series, body, scales]);

  const answerAt = useMemo(() => {
    if (!answered || !range || !goal) return null;
    if (runner.phase === "correct" && drafted !== null) return drafted;
    return answerHour(series, goal, range);
  }, [answered, range, goal, runner.phase, drafted, series]);

  const local = (event: ReactPointerEvent<HTMLElement>) => {
    const box = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    // The chart's 1 px border sits between the box and the plot's pixels.
    return { px: event.clientX - box.left - 1, py: event.clientY - box.top - 1 };
  };

  if (!range || !goal) {
    return <DragFrame name={data.name} message="This step's hours are not on the stored time grid." />;
  }

  const now = bodyAt(series, body, hour);
  const utc = utcOf(hour);
  const showFrac = goal.metric.endsWith("_frac");
  const frac = showFrac ? metricAt(series, goal.metric, hour) : null;
  const handle = now ? { x: xOfAzimuth(scales, now.azDeg), y: scales.y(now.elDeg) } : null;
  const inPlot = handle && handle.y >= frame.top - 2 && handle.y <= frame.bottom + 2;
  const answerNow = answerAt !== null ? bodyAt(series, body, answerAt) : null;
  const answerUtc = answerAt !== null ? utcOf(answerAt) : null;
  const name = BODY_NAME[body];
  const spoken = (h: number) => {
    const b = bodyAt(series, body, h);
    const u = utcOf(h);
    if (!b || !u) return "";
    const share = showFrac ? `, disc fraction ${formatNumber(metricAt(series, goal.metric, h) ?? Number.NaN, 2)}` : "";
    return `${formatUtc(u)}: ${name} ${heightWords(b.elDeg)}${share}.`;
  };

  const onHandleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (answered) return;
    const next = hourAfterKey(range, hour, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    setHour(next);
    commit(next);
  };

  const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (answered || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    dragging.current = event.pointerId;
  };
  const onHandleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return;
    const { px, py } = local(event);
    const next = hourNearPointer(points, px, py, hour);
    if (next !== null && next !== hour) setHour(next);
  };
  const onHandleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    commit(hour);
  };

  const flat = terrain !== "terrain";
  const label = `Horizon chart for ${data.name}, ${flat ? "with the ground drawn level" : "with its real skyline"}. ${spoken(hour)}`;

  return (
    <div className="ac-drag">
      <p className="ac-drag-title">Lander's eye, {data.name}</p>
      <div ref={hostRef} className="ac-drag-chart">
        <HorizonChart
          scales={scales}
          skyline={sky}
          series={shown}
          window={chartWindow}
          hour={hour}
          landingHour={range.fromIndex}
          radii={radii}
          maskDeg={null}
          features={NO_FEATURES}
          marker={null}
          onMark={noop}
          onCentreChange={onCentreChange}
          onZoom={onZoom}
          onResetZoom={onResetZoom}
          utcOfHour={utcOf}
          showLabels={false}
          label={label}
        />
        {answerNow ? (
          <span
            className="ac-drag-answer"
            style={{ left: xOfAzimuth(scales, answerNow.azDeg) + 1, top: scales.y(answerNow.elDeg) + 1 }}
            aria-hidden="true"
          />
        ) : null}
        {handle && inPlot ? (
          <div
            className="ac-drag-handle"
            data-body={body}
            data-ac-slider=""
            data-locked={answered || undefined}
            style={{ left: handle.x + 1, top: handle.y + 1 }}
            role="slider"
            tabIndex={0}
            aria-label={`${name}: drag through the hours`}
            aria-valuemin={0}
            aria-valuemax={range.toIndex - range.fromIndex}
            aria-valuenow={hour - range.fromIndex}
            aria-valuetext={spoken(hour)}
            aria-readonly={answered || undefined}
            onKeyDown={onHandleKey}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          />
        ) : null}
      </div>
      {flat ? <p className="ac-drag-note">The ground is drawn level at 0°, so you see the {name}'s own height.</p> : null}
      {data.sphere && !flat ? <p className="ac-drag-note">Terrain not modelled. Showing a smooth Moon.</p> : null}

      <TimeBar range={range} hour={hour} answerAt={answerAt} locked={answered} utcOf={utcOf} onMove={setHour} onCommit={commit} />

      <dl className="ac-drag-read">
        <div>
          <dt>Time</dt>
          <dd>{utc ? formatUtc(utc) : "—"}</dd>
        </div>
        <div>
          <dt>
            <Explain term="elevation">{`${name}'s elevation`}</Explain>
          </dt>
          <dd>{now ? `${formatNumber(now.elDeg, 2)}°` : "—"}</dd>
        </div>
        {showFrac ? (
          <div>
            <dt>
              <Explain term="disc_fraction">Disc fraction</Explain>
            </dt>
            <dd>{frac !== null ? formatNumber(frac, 2) : "—"}</dd>
          </div>
        ) : null}
      </dl>
      <p className="ac-visually-hidden" aria-live="polite">
        {announced !== null ? spoken(announced) : ""}
      </p>

      {answerNow && answerUtc ? (
        <div className="ac-drag-found" role="status">
          {runner.phase === "correct" ? <CorrectMark label="Found it" /> : <span className="ac-drag-found-ring" aria-hidden="true" />}
          <p>
            <span className="ac-drag-found-when">{formatUtc(answerUtc)}</span>
            <span>
              {name} {heightWords(answerNow.elDeg)}
              {showFrac ? ` · disc fraction ${formatNumber(metricAt(series, goal.metric, answerAt ?? 0) ?? Number.NaN, 2)}` : ""}
            </span>
            {(step.readout ?? []).map((line) => (
              <span key={line} className="ac-drag-found-line">
                {filledText(line, examples)}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <p className="ac-keys ac-keys-desk">
          Drag the {name}, or focus it and use <span className="ac-kbd">←</span>
          <span className="ac-kbd">→</span> an hour · <span className="ac-kbd">Shift</span> a day ·{" "}
          <span className="ac-kbd">Home</span>
          <span className="ac-kbd">End</span> · <span className="ac-kbd">Enter</span> checks
        </p>
      )}
    </div>
  );
}

/**
 * The step's hours as a bar under the chart: the knob is the body's hour, and dragging it
 * sweeps through time in a straight line. A second way in for the pointer; the body on the
 * chart is the keyboard's, so the bar is not in the tab order.
 */
function TimeBar({
  range,
  hour,
  answerAt,
  locked,
  utcOf,
  onMove,
  onCommit,
}: {
  range: HourRange;
  hour: number;
  answerAt: number | null;
  locked: boolean;
  utcOf: (h: number) => string | null;
  onMove: (h: number) => void;
  onCommit: (h: number) => void;
}) {
  const [ref, width] = useWidth();
  const active = useRef<number | null>(null);
  const last = useRef(hour);
  last.current = hour;
  const at = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return hourAtBarX(range, box.width, event.clientX - box.left);
  };
  const first = utcOf(range.fromIndex);
  const end = utcOf(range.toIndex);
  return (
    <div className="ac-drag-time" aria-hidden="true">
      <div
        ref={ref}
        className="ac-drag-bar"
        data-locked={locked || undefined}
        onPointerDown={(event) => {
          if (locked || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          active.current = event.pointerId;
          const next = at(event);
          last.current = next;
          onMove(next);
        }}
        onPointerMove={(event) => {
          if (active.current !== event.pointerId) return;
          const next = at(event);
          if (next !== last.current) {
            last.current = next;
            onMove(next);
          }
        }}
        onPointerUp={(event) => {
          if (active.current !== event.pointerId) return;
          active.current = null;
          onCommit(last.current);
        }}
        onPointerCancel={() => (active.current = null)}
      >
        <span className="ac-drag-bar-track" />
        {answerAt !== null ? <span className="ac-drag-bar-answer" style={{ left: barXOfHour(range, width, answerAt) }} /> : null}
        <span className="ac-drag-bar-knob" style={{ left: barXOfHour(range, width, hour) }} />
      </div>
      <div className="ac-drag-bar-ends">
        <span>{first ? formatUtc(first) : ""}</span>
        <span>{end ? formatUtc(end) : ""}</span>
      </div>
    </div>
  );
}

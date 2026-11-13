import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { MissionProfile, TimeGrid } from "../../../contracts/generated";
import { BodyIcon } from "../../../components/BodyIcon";
import { Button, IconButton } from "../../../components/Button";
import { Explain } from "../../../components/Explain";
import { cx } from "../../../components/format";
import { StatusLamp } from "../../../components/StatusLamp";
import { useManifest, useSeries } from "../../../data/hooks";
import type { DecodedSeries } from "../../../data/decode/layouts";
import { useCountdowns, useEvaluation, useHourFlags, type Evaluation, type HourFlags } from "../../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../../lib/time";
import type { PanelProps } from "../../panel";
import { formatLimit, ruleFields, settingsProvenance, valueAndLimit } from "../rules";
import { SettingsTag } from "../settings-tag";
import { NO_RESULT_TEXT } from "../site-status";
import {
  bandSegments,
  dayTicks,
  hourScale,
  hourToX,
  longestOffRun,
  pillText,
  sliderValueText,
  timelineRange,
  windowText,
  xToHour,
  type HourScale,
  type Run,
  type Segment,
  type TimelineRange,
} from "./axis";
import { earthCountdown, sunCountdown, type CountdownView } from "./countdown-text";
import { speedLabel, usePlayback } from "./use-playback";

export type TimeWrite = "push" | "replace";

export type TimelineProps = PanelProps & {
  /** Folded to one row: the time, play, and both countdowns. */
  folded?: boolean;
  onToggleFold?: () => void;
  /**
   * Sets the scenario's current time. "push" adds one history entry; "replace" does not, for
   * the steps of a drag or of play after the first. Without it, `onScenarioChange` is used.
   */
  onTimeChange?: (utc: string, write: TimeWrite) => void;
};

/** The focused site, or the first selected site, as the shell's panels read it. */
export function timelineSiteId(scenario: PanelProps["scenario"]): string | null {
  return scenario.focusedSiteId ?? scenario.siteIds[0] ?? null;
}

type Hours = { landing: number; current: number } | null;

function hoursOf(grid: TimeGrid, landingUtc: string, currentUtc: string): Hours {
  try {
    return { landing: utcToHourIndex(grid, landingUtc), current: utcToHourIndex(grid, currentUtc) };
  } catch {
    return null;
  }
}

/**
 * The bottom strip's timeline: the focused site's mission window hour by hour, with three
 * days either side, the Sun and Earth bands, the longest stretches, an optional clearance
 * chart, and the scrubber that sets the current time for every view.
 */
export function Timeline(props: TimelineProps) {
  const { scenario } = props;
  const siteId = timelineSiteId(scenario);
  const manifest = useManifest();

  if (manifest.status === "error") return <TimelineMessage {...props}>{`The time grid could not load: ${manifest.error}`}</TimelineMessage>;
  if (manifest.status !== "ready") return <TimelineMessage {...props}>Loading the time grid…</TimelineMessage>;
  const grid = manifest.data.time_grid;
  const hours = hoursOf(grid, scenario.landingUtc, scenario.currentUtc);
  if (!hours) return <TimelineMessage {...props}>The landing date or the current time is outside the time grid.</TimelineMessage>;
  if (!siteId) return <TimelineMessage {...props}>Add a site to the sites rail to see its timeline.</TimelineMessage>;

  return <SiteTimeline {...props} siteId={siteId} grid={grid} hours={hours} />;
}

type SiteTimelineProps = TimelineProps & { siteId: string; grid: TimeGrid; hours: NonNullable<Hours> };

function SiteTimeline({ scenario, siteId, grid, hours, folded = false, onToggleFold, onTimeChange, onScenarioChange }: SiteTimelineProps) {
  const profile = scenario.profile;
  const range = useMemo(() => timelineRange(grid.count, hours.landing, profile.duration_days), [grid.count, hours.landing, profile.duration_days]);
  const gridStartMs = useMemo(() => Date.parse(grid.start_utc), [grid.start_utc]);
  const current = Math.min(range.end, Math.max(range.start, hours.current));

  const setHour = useCallback(
    (hour: number, write: TimeWrite) => {
      const clamped = Math.min(range.end, Math.max(range.start, hour));
      const utc = hourIndexToUtc(grid, clamped);
      if (onTimeChange) onTimeChange(utc, write);
      else onScenarioChange?.({ currentUtc: utc });
    },
    [grid, range.start, range.end, onTimeChange, onScenarioChange],
  );

  const playback = usePlayback(range, current, setHour);
  const flags = useHourFlags(siteId, profile);
  const series = useSeries(siteId);
  const evaluation = useEvaluation(siteId, profile, scenario.landingUtc);
  const countdowns = useCountdowns(siteId, profile, hourIndexToUtc(grid, current));
  const [chartOpen, setChartOpen] = useState(false);

  const flagsNow =
    flags.status === "ready"
      ? { lit: flags.data.lit[current] === 1, link: flags.data.link[current] === 1 }
      : null;
  const gridEndUtc = hourIndexToUtc(grid, grid.count - 1);
  const cards =
    countdowns.status === "ready" && flagsNow
      ? {
          sun: sunCountdown(countdowns.data, flagsNow.lit, gridEndUtc),
          earth: earthCountdown(countdowns.data, flagsNow.link, profile.relay_available, gridEndUtc),
        }
      : null;

  const playButton = (
    <IconButton
      label={playback.playing ? "Pause" : "Play"}
      hint={`· ${speedLabel(playback.speed)}`}
      icon={playback.playing ? <Pause size={14} strokeWidth={2.2} /> : <Play size={14} strokeWidth={2.2} />}
      onClick={playback.toggle}
      className="tl-play"
      aria-pressed={playback.playing}
    />
  );

  const foldButton = onToggleFold ? <FoldButton folded={folded} onToggle={onToggleFold} /> : null;

  if (folded) {
    return (
      <div className="tl tl-folded">
        <h2 className="tl-title">Timeline</h2>
        <span className="tl-folded-time tabular">{pillText(range, current, gridStartMs)}</span>
        {playButton}
        <span className="tl-folded-counts">
          {cards ? (
            <>
              <FoldedCount view={cards.sun} />
              <FoldedCount view={cards.earth} />
            </>
          ) : (
            <span className="tl-muted">Countdowns load with the site's data…</span>
          )}
        </span>
        {foldButton}
      </div>
    );
  }

  const durationTag = settingsProvenance(profile, ["duration_days"]);

  return (
    <div className="tl">
      <div className="tl-head">
        <h2 className="tl-title">
          <Explain term="timeline">Timeline</Explain>
        </h2>
        <p className="tl-window">
          <span className="tl-window-dates tabular">
            <Explain term="mission_window">Mission window</Explain> {windowText(range, gridStartMs)}
            {range.fits ? "" : " (past the end of the data)"},
          </span>{" "}
          <span className="whitespace-nowrap">
            {formatLimit(profile.duration_days, "d")} <SettingsTag settings={durationTag} />
          </span>
        </p>
        <div className="tl-controls">
          {playButton}
          <Button onClick={playback.changeSpeed} aria-label={`Play speed: ${speedLabel(playback.speed)}. Change speed`}>
            {speedLabel(playback.speed)}
          </Button>
          <button type="button" className="tl-switch" aria-pressed={chartOpen} onClick={() => setChartOpen((open) => !open)}>
            <span className="tl-switch-track" aria-hidden="true" />
            Clearance chart
          </button>
        </div>
        {foldButton}
      </div>

      {flags.status === "error" || series.status === "error" ? (
        <p className="tl-message" role="alert">
          This site's hourly data could not load: {flags.error ?? series.error}
        </p>
      ) : flags.status !== "ready" || series.status !== "ready" ? (
        <p className="tl-message" role="status">
          Loading the hourly data…
        </p>
      ) : (
        <Plot
          range={range}
          gridStartMs={gridStartMs}
          current={current}
          flags={flags.data}
          series={series.data}
          evaluation={evaluation.status === "ready" ? evaluation.data : null}
          profile={profile}
          chartOpen={chartOpen}
          setHour={setHour}
          pausePlay={playback.pause}
          flagsNow={flagsNow}
        />
      )}
    </div>
  );
}

function FoldedCount({ view }: { view: CountdownView }) {
  return (
    <span className={cx("tl-folded-count", view.soon && "is-soon")}>
      <BodyIcon body={view.body} size={14} />
      <span className="sr-only">{view.body === "sun" ? "Sun" : "Earth"}: </span>
      {view.soon ? <StatusLamp status="CAUTION" size="xs" /> : null}
      <span className="tabular">{view.sentence}</span>
    </span>
  );
}

function TimelineMessage({ children, folded, onToggleFold }: TimelineProps & { children: ReactNode }) {
  return (
    <div className={cx("tl", folded && "tl-folded")}>
      <h2 className="tl-title">Timeline</h2>
      <p className="tl-message">{children}</p>
      {onToggleFold ? <FoldButton folded={folded ?? false} onToggle={onToggleFold} /> : null}
    </div>
  );
}

/** Folds the timeline to one row and back. Its slot is what the row orders and aligns. */
function FoldButton({ folded, onToggle }: { folded: boolean; onToggle: () => void }) {
  return (
    <span className="tl-fold-slot">
      <IconButton
        label={folded ? "Unfold the timeline" : "Fold the timeline"}
        icon={folded ? <ChevronUp size={16} strokeWidth={1.8} /> : <ChevronDown size={16} strokeWidth={1.8} />}
        onClick={onToggle}
        aria-expanded={!folded}
        className="tl-fold"
      />
    </span>
  );
}

/* ── The plot: chart, bands, scrubber ─────────────────────────────────────── */

/** Plot geometry in CSS pixels. */
const GUTTER = 48;
const GUTTER_NARROW = 40;
const RIGHT = 4;
const DAY_ROW = 20;
const BAND_H = 26;
const BAND_GAP = 6;
const DATE_ROW = 18;
const CHART_H = 96;
const CHART_GAP = 12;

type PlotProps = {
  range: TimelineRange;
  gridStartMs: number;
  current: number;
  flags: HourFlags;
  series: DecodedSeries;
  evaluation: Evaluation | null;
  profile: MissionProfile;
  chartOpen: boolean;
  setHour: (hour: number, write: TimeWrite) => void;
  pausePlay: () => void;
  flagsNow: { lit: boolean; link: boolean } | null;
};

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** The longest stretches, located from the flags, numbered from the metrics. */
type Stretch = {
  kind: "dark" | "blackout";
  run: Run | null;
  hours: number;
  broken: boolean;
  label: string;
  /** "limit 6 h", or null when there is no limit to show (a relay). */
  limit: string | null;
  term: string;
  fields: ReturnType<typeof settingsProvenance>;
};

function stretches(range: TimelineRange, flags: HourFlags, evaluation: Evaluation | null, profile: MissionProfile): Stretch[] {
  if (!evaluation) return [];
  const out: Stretch[] = [];
  const dark = longestOffRun(flags.lit, range.landing, range.windowEnd);
  const darkPrinted = valueAndLimit(evaluation.metrics.longestDarkH, profile.max_dark_h, "h", 0);
  out.push({
    kind: "dark",
    run: dark,
    hours: evaluation.metrics.longestDarkH,
    broken: evaluation.vetoes.darkness.triggered,
    label: dark ? `Longest dark ${darkPrinted.value}` : "No dark hours",
    limit: `limit ${darkPrinted.limit}`,
    term: "longest_dark_h",
    fields: settingsProvenance(profile, ruleFields(profile, "darkness")),
  });
  if (profile.relay_available) {
    out.push({
      kind: "blackout",
      run: null,
      hours: 0,
      broken: false,
      label: "No blackouts with a relay",
      limit: null,
      term: "relay",
      fields: settingsProvenance(profile, ruleFields(profile, "relay")),
    });
  } else {
    const blackout = longestOffRun(flags.link, range.landing, range.windowEnd);
    const printed = valueAndLimit(evaluation.metrics.longestBlackoutH, profile.max_blackout_h, "h", 0);
    out.push({
      kind: "blackout",
      run: blackout,
      hours: evaluation.metrics.longestBlackoutH,
      broken: evaluation.vetoes.blackout.triggered,
      label: blackout ? `Longest blackout ${printed.value}` : "No blackout",
      limit: `limit ${printed.limit}`,
      term: "longest_blackout_h",
      fields: settingsProvenance(profile, ruleFields(profile, "blackout")),
    });
  }
  return out;
}

function Plot(props: PlotProps) {
  const { range, gridStartMs, current, flags, series, evaluation, profile, chartOpen, setHour, pausePlay, flagsNow } = props;
  const [ref, width] = useWidth<HTMLDivElement>();
  const narrow = width > 0 && width < 520;
  const x0 = narrow ? GUTTER_NARROW : GUTTER;
  const scale = useMemo(() => hourScale(range, x0, Math.max(0, width - x0 - RIGHT)), [range, x0, width]);
  const list = useMemo(() => stretches(range, flags, evaluation, profile), [range, flags, evaluation, profile]);

  const chartTop = 0;
  const bandsTop = chartOpen ? CHART_H + CHART_GAP : 0;
  const sunY = bandsTop + DAY_ROW;
  const earthY = sunY + BAND_H + BAND_GAP;
  const height = earthY + BAND_H + DATE_ROW;

  // Drag: the first step adds one history entry, later steps replace it.
  const drag = useRef<{ pushed: boolean; frame: number | null; x: number; left: number } | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  const applyX = useCallback(() => {
    const state = drag.current;
    if (!state) return;
    state.frame = null;
    const hour = xToHour(scale, state.x - state.left);
    if (hour === currentRef.current && state.pushed) return;
    setHour(hour, state.pushed ? "replace" : "push");
    state.pushed = true;
  }, [scale, setHour]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || scale.width <= 0) return;
    pausePlay();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    const left = event.currentTarget.getBoundingClientRect().left;
    drag.current = { pushed: false, frame: null, x: event.clientX, left };
    applyX();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    state.x = event.clientX;
    if (state.frame === null) state.frame = requestAnimationFrame(applyX);
  };

  const endDrag = () => {
    const state = drag.current;
    if (!state) return;
    if (state.frame !== null) {
      cancelAnimationFrame(state.frame);
      applyX();
    }
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 1;
    let target: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        target = current - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        target = current + step;
        break;
      case "PageDown":
        target = current - 24;
        break;
      case "PageUp":
        target = current + 24;
        break;
      case "Home":
        target = range.start;
        break;
      case "End":
        target = range.end;
        break;
      default:
        return;
    }
    event.preventDefault();
    pausePlay();
    // A held key moves many hours: only its first step adds a history entry.
    setHour(target, event.repeat ? "replace" : "push");
  };

  const x = hourToX(scale, current);
  const valueText = sliderValueText({
    range,
    hour: current,
    gridStartMs,
    lit: flagsNow?.lit ?? null,
    link: flagsNow?.link ?? null,
    relay: profile.relay_available,
  });

  return (
    <div className="tl-plot-wrap">
      {chartOpen ? <ChartLegend profile={profile} /> : null}
      <div
        ref={ref}
        className="tl-plot"
        style={{ height }}
        role="slider"
        tabIndex={0}
        aria-label="Scrubber: the current time"
        aria-valuemin={range.start - range.landing}
        aria-valuemax={range.end - range.landing}
        aria-valuenow={current - range.landing}
        aria-valuetext={valueText}
        aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
      >
        {width > 0 ? (
          <>
            {chartOpen ? (
              <ClearanceChart scale={scale} range={range} series={series} profile={profile} top={chartTop} width={width} />
            ) : null}
            <Bands
              scale={scale}
              range={range}
              gridStartMs={gridStartMs}
              flags={flags}
              sunFrac={series.sun_frac}
              stretches={list}
              top={bandsTop}
              width={width}
            />
            <div className="tl-scrub" style={{ transform: `translateX(${x}px)`, height: earthY + BAND_H + 4 }} aria-hidden="true">
              <span className="tl-scrub-knob" />
            </div>
            <ScrubPill x={x} top={bandsTop} width={width} text={pillText(range, current, gridStartMs)} />
          </>
        ) : null}
      </div>
      {width > 0 ? (
        <StretchLabels scale={scale} list={list} width={width} fits={range.fits} landing={range.landing} flow={narrow} />
      ) : null}
    </div>
  );
}

function ScrubPill({ x, top, width, text }: { x: number; top: number; width: number; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pillWidth, setPillWidth] = useState(150);
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    if (w > 0 && Math.abs(w - pillWidth) > 0.5) setPillWidth(w);
  }, [text, pillWidth]);
  const left = Math.min(Math.max(0, x - pillWidth / 2), Math.max(0, width - pillWidth));
  return (
    <span ref={ref} className="tl-pill tabular" style={{ transform: `translate(${left}px, ${top}px)` }} aria-hidden="true">
      {text}
    </span>
  );
}

/* ── Bands (drawn once per site, profile, landing and width) ─────────────── */

type BandsProps = {
  scale: HourScale;
  range: TimelineRange;
  gridStartMs: number;
  flags: HourFlags;
  sunFrac: Float64Array;
  stretches: Stretch[];
  top: number;
  width: number;
};

function segmentPath(segments: Segment[], scale: HourScale, y: number, h: number, inWindow: boolean): string {
  let d = "";
  for (const segment of segments) {
    if (segment.inWindow !== inWindow) continue;
    const xa = hourToX(scale, segment.from);
    const xb = hourToX(scale, segment.to);
    const hh = h * segment.level;
    d += `M${xa.toFixed(2)} ${(y + h - hh).toFixed(2)}H${xb.toFixed(2)}V${(y + h).toFixed(2)}H${xa.toFixed(2)}Z`;
  }
  return d;
}

const Bands = memo(function Bands({ scale, range, gridStartMs, flags, sunFrac, stretches: list, top, width, }: BandsProps) {
  const id = useId().replace(/:/g, "");
  const sunY = top + DAY_ROW;
  const earthY = sunY + BAND_H + BAND_GAP;
  const height = earthY + BAND_H + DATE_ROW;
  const plotW = scale.width;
  const x0 = scale.x0;

  const sun = useMemo(() => bandSegments(flags.lit, range, (hour) => sunFrac[hour] ?? 0), [flags.lit, range, sunFrac]);
  const earth = useMemo(() => bandSegments(flags.link, range), [flags.link, range]);
  const ticks = useMemo(() => dayTicks(range, gridStartMs, scale.slots > 0 ? plotW / scale.slots : 0), [range, gridStartMs, plotW, scale.slots]);
  const pxPerDay = scale.slots > 0 ? (plotW / scale.slots) * 24 : 0;
  const landingX = hourToX(scale, range.landing);
  const endX = hourToX(scale, Math.min(range.windowEnd, range.end + 1));
  // A day's label sits in the middle of its day, kept clear of the plot's ends.
  const labelX = (hour: number) => Math.min(Math.max(hourToX(scale, hour + 12), x0 + 16), x0 + plotW - 16);

  return (
    <svg className="tl-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-s`}>
          <rect x={x0} y={sunY} width={plotW} height={BAND_H} rx={6} />
        </clipPath>
        <clipPath id={`${id}-e`}>
          <rect x={x0} y={earthY} width={plotW} height={BAND_H} rx={6} />
        </clipPath>
      </defs>

      <text className="tl-row-label" x={0} y={sunY + BAND_H / 2 + 4}>
        Sun
      </text>
      <text className="tl-row-label" x={0} y={earthY + BAND_H / 2 + 4}>
        Earth
      </text>
      <text className="tl-axis-note" x={0} y={height - 4}>
        UTC
      </text>

      <rect className="tl-well" x={x0 + 0.5} y={sunY + 0.5} width={Math.max(0, plotW - 1)} height={BAND_H - 1} rx={6} />
      <rect className="tl-well" x={x0 + 0.5} y={earthY + 0.5} width={Math.max(0, plotW - 1)} height={BAND_H - 1} rx={6} />

      <g clipPath={`url(#${id}-s)`}>
        <path className="tl-band-sun tl-context" d={segmentPath(sun, scale, sunY, BAND_H, false)} />
        <path className="tl-band-sun" d={segmentPath(sun, scale, sunY, BAND_H, true)} />
      </g>
      <g clipPath={`url(#${id}-e)`}>
        <path className="tl-band-earth tl-context" d={segmentPath(earth, scale, earthY, BAND_H, false)} />
        <path className="tl-band-earth" d={segmentPath(earth, scale, earthY, BAND_H, true)} />
      </g>

      {pxPerDay >= 6
        ? ticks.map((tick) =>
            tick.hour > range.start && tick.hour !== range.landing ? (
              <line
                key={`g${tick.hour}`}
                className="tl-day-line"
                x1={hourToX(scale, tick.hour)}
                x2={hourToX(scale, tick.hour)}
                y1={sunY}
                y2={earthY + BAND_H}
              />
            ) : null,
          )
        : null}

      {ticks.map((tick) =>
        tick.labelled ? (
          <g key={`t${tick.hour}`}>
            <text className={cx("tl-day", tick.inWindow && "is-window")} x={labelX(tick.hour)} y={top + 13} textAnchor="middle">
              {tick.label}
            </text>
            <text className={cx("tl-date", tick.inWindow && "is-window")} x={labelX(tick.hour)} y={height - 4} textAnchor="middle">
              {tick.date}
            </text>
          </g>
        ) : null,
      )}

      <line className="tl-edge" x1={landingX} x2={landingX} y1={top + 2} y2={earthY + BAND_H + 3} />
      {range.windowEnd <= range.end + 1 ? <line className="tl-edge" x1={endX} x2={endX} y1={top + 2} y2={earthY + BAND_H + 3} /> : null}

      {list.map((stretch) => {
        if (!stretch.run) return null;
        const xa = hourToX(scale, stretch.run.from) - 2;
        const xb = hourToX(scale, stretch.run.to) + 2;
        const y = (stretch.kind === "dark" ? sunY : earthY) - 3;
        return (
          <rect
            key={stretch.kind}
            className={cx("tl-stretch", stretch.broken && "is-broken")}
            x={xa}
            y={y}
            width={Math.max(4, xb - xa)}
            height={BAND_H + 6}
            rx={7}
          />
        );
      })}
    </svg>
  );
});

/* ── Stretch labels, placed under their outlines without overlapping ─────── */

type StretchLabelsProps = {
  scale: HourScale;
  list: Stretch[];
  width: number;
  fits: boolean;
  landing: number;
  /** On a narrow plot the labels are a plain wrapping list, not placed under their outlines. */
  flow: boolean;
};

const StretchLabels = memo(function StretchLabels({ scale, list, width, fits, landing, flow }: StretchLabelsProps) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    const next = refs.current.slice(0, list.length).map((node) => node?.offsetWidth ?? 0);
    if (next.length !== widths.length || next.some((w, i) => Math.abs(w - (widths[i] ?? 0)) > 0.5)) setWidths(next);
  });

  if (!fits) return <p className="tl-stretches tl-muted">{NO_RESULT_TEXT}</p>;

  // A label with no stretch to point at starts at the landing.
  const centres = list.map((s, i) =>
    s.run ? (hourToX(scale, s.run.from) + hourToX(scale, s.run.to)) / 2 : hourToX(scale, landing) + (widths[i] ?? 0) / 2,
  );
  const placed = placeLabels(centres, widths, width, scale.x0);

  return (
    <div className={cx("tl-stretches", flow && "is-flow")} style={flow ? undefined : { height: placed.rows * 22 }}>
      {list.map((s, i) => (
        <span
          key={s.kind}
          ref={(node) => {
            refs.current[i] = node;
          }}
          className={cx("tl-stretch-label", s.broken && "is-broken")}
          style={flow ? undefined : { transform: `translate(${placed.left[i] ?? 0}px, ${(placed.row[i] ?? 0) * 22}px)` }}
        >
          {s.broken ? <StatusLamp status="NO-GO" size="xs" /> : null}
          <span className="tabular">
            {s.label}
            {s.limit ? `, ${s.limit}` : ""}
          </span>
          <SettingsTag settings={s.fields} />
          {s.limit ? <span className="tl-stretch-verdict">{s.broken ? "breaks the rule" : "passes"}</span> : null}
        </span>
      ))}
    </div>
  );
});

/**
 * Left edges and rows for labels centred under `centres` (null: start of the plot), kept
 * inside `[x0, width]` and apart. When two cannot fit side by side they take two rows.
 */
export function placeLabels(
  centres: (number | null)[],
  widths: number[],
  width: number,
  x0: number,
  gap = 16,
): { left: number[]; row: number[]; rows: number } {
  const order = centres.map((c, i) => ({ i, c: c ?? x0 })).sort((a, b) => a.c - b.c);
  const left: number[] = [];
  const row: number[] = centres.map(() => 0);
  let lastRight = -Infinity;
  let total = 0;
  for (const { i, c } of order) {
    const w = widths[i] ?? 0;
    total += w + gap;
    let l = Math.min(Math.max(x0, c - w / 2), Math.max(x0, width - w));
    if (l < lastRight + gap) l = lastRight + gap;
    left[i] = l;
    lastRight = l + w;
  }
  if (lastRight <= width || order.length < 2) return { left, row, rows: 1 };
  // Shift back from the right edge; if that collides at the left, stack instead.
  let right = width;
  for (let k = order.length - 1; k >= 0; k--) {
    const entry = order[k];
    if (!entry) continue;
    const w = widths[entry.i] ?? 0;
    const l = Math.min(left[entry.i] ?? 0, right - w);
    left[entry.i] = l;
    right = l - gap;
  }
  if (right + gap >= x0 && total - gap <= width - x0) return { left, row, rows: 1 };
  order.forEach(({ i, c }, k) => {
    const w = widths[i] ?? 0;
    left[i] = Math.min(Math.max(x0, c - w / 2), Math.max(x0, width - w));
    row[i] = k;
  });
  return { left, row, rows: order.length };
}

/* ── Clearance chart ──────────────────────────────────────────────────────── */

function ChartLegend({ profile }: { profile: MissionProfile }) {
  const maskTag = settingsProvenance(profile, ["antenna_mask_deg"]);
  return (
    <p className="tl-legend">
      <span className="tl-key">
        <span className="tl-key-line tl-key-sun" aria-hidden="true" />
        Sun <Explain term="clearance">clearance</Explain>
      </span>
      <span className="tl-key">
        <span className="tl-key-line tl-key-earth" aria-hidden="true" />
        Earth clearance
      </span>
      {profile.relay_available ? (
        <span className="tl-key tl-muted">With a relay, Earth's clearance does not decide the link.</span>
      ) : (
        <span className="tl-key">
          <span className="tl-key-line tl-key-mask" aria-hidden="true" />
          <Explain term="antenna_mask">Antenna mask</Explain> {formatLimit(profile.antenna_mask_deg, "°")} <SettingsTag settings={maskTag} />
        </span>
      )}
      <span className="tl-key tl-muted">0° is the centre on the skyline</span>
    </p>
  );
}

const NICE_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 45];

type ChartProps = {
  scale: HourScale;
  range: TimelineRange;
  series: DecodedSeries;
  profile: MissionProfile;
  top: number;
  width: number;
};

const ClearanceChart = memo(function ClearanceChart({ scale, range, series, profile, top, width }: ChartProps) {
  const chart = useMemo(() => {
    const mask = profile.relay_available ? null : profile.antenna_mask_deg;
    let lo = Math.min(0, mask ?? 0);
    let hi = Math.max(0, mask ?? 0);
    for (let h = range.start; h <= range.end; h++) {
      const s = series.sun_clear[h];
      const e = series.earth_clear[h];
      if (s !== undefined && Number.isFinite(s)) {
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
      }
      if (e !== undefined && Number.isFinite(e)) {
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    const pad = Math.max(0.1, (hi - lo) * 0.08);
    lo -= pad;
    hi += pad;
    const step = NICE_STEPS.find((s) => (hi - lo) / s <= 4) ?? 90;
    const y = (v: number) => top + 4 + (CHART_H - 8) * (1 - (v - lo) / (hi - lo));
    const line = (values: Float64Array) => {
      let d = "";
      for (let h = range.start; h <= range.end; h++) {
        const v = values[h];
        if (v === undefined || !Number.isFinite(v)) continue;
        d += `${d ? "L" : "M"}${hourToX(scale, h).toFixed(1)} ${y(v).toFixed(1)}`;
      }
      return d;
    };
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.round(v * 100) / 100);
    return { y, ticks, mask, sun: line(series.sun_clear), earth: line(series.earth_clear) };
  }, [scale, range, series, profile.relay_available, profile.antenna_mask_deg, top]);

  const x0 = scale.x0;
  const x1 = scale.x0 + scale.width;
  const sign = (v: number) => (v > 0 ? `+${v}°` : v < 0 ? `−${-v}°` : "0°");

  return (
    <svg className="tl-svg tl-chart" width={width} height={CHART_H} viewBox={`0 ${top} ${width} ${CHART_H}`} aria-hidden="true" focusable="false">
      <rect className="tl-chart-well" x={x0 + 0.5} y={top + 0.5} width={Math.max(0, scale.width - 1)} height={CHART_H - 1} rx={8} />
      {chart.ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? "tl-zero" : "tl-grid"} x1={x0} x2={x1} y1={chart.y(v)} y2={chart.y(v)} />
          <text className="tl-axis" x={x0 - 6} y={chart.y(v) + 4} textAnchor="end">
            {sign(v)}
          </text>
        </g>
      ))}
      {chart.ticks.includes(0) ? null : <line className="tl-zero" x1={x0} x2={x1} y1={chart.y(0)} y2={chart.y(0)} />}
      {chart.mask !== null ? <line className="tl-mask" x1={x0} x2={x1} y1={chart.y(chart.mask)} y2={chart.y(chart.mask)} /> : null}
      <line className="tl-edge" x1={hourToX(scale, range.landing)} x2={hourToX(scale, range.landing)} y1={top} y2={top + CHART_H} />
      <path className="tl-line-sun" d={chart.sun} />
      <path className="tl-line-earth" d={chart.earth} />
    </svg>
  );
});


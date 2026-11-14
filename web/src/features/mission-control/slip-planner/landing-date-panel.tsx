import { ChevronDown, ChevronUp } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from "react";
import { useStore } from "zustand";
import type { Scenario } from "../../../app/panel";
import { settingsProvenance } from "../../../app/mission/rules";
import { SettingsTag } from "../../../app/mission/settings-tag";
import { LandingDateControl } from "../../../app/mission/landing-date-control";
import { IconButton } from "../../../components/Button";
import { cx } from "../../../components/format";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { StatusLamp } from "../../../components/StatusLamp";
import type { Site } from "../../../contracts/generated";
import { useManifest, useSites } from "../../../data";
import { utcMidnightHours, windowLength, type Status } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import {
  ZOOMS,
  anyNextGo,
  anySiteDays,
  dayAtX,
  dayLabel,
  dayOfHour,
  dayUtc,
  followStart,
  isWholeDay,
  lastLandingDay,
  panStart,
  sliderKey,
  stripKey,
  stripMetrics,
  VARIANT_NAME,
  variantLine,
  variantMetres,
  variantOf,
  zoomDays,
  type SiteResult,
  type Zoom,
} from "./model";
import { anyReadout, FAILED_LINE, readoutText, siteReadout, type Readout } from "./readout";
import { dataStore, seriesKey } from "../../../state/data";
import { comparisonHour, slipStore } from "./slip-store";
import { StripCanvas, stripsHeight, type StripColours } from "./strips-canvas";
import { useSlipDays, type SiteDays } from "./use-slip-days";
import { useEvaluate } from "./landing-results";
import { nextGo, nextGoWords, shortDay } from "./next-go-words";
import { MOON_RADIUS_M } from "../../../lib/geo";
import "./slip-planner.css";

export type LandingWrite = "push" | "replace";

/** Shown, and read out, whenever the landing is not at 00:00 UTC (slip-planner.md, "Changing the date"). */
export const WHOLE_NOTE = "Strips show landings at 00:00 UTC.";

export type LandingDatePanelProps = {
  scenario: Scenario;
  /** Folded to one row, as the timeline folds. */
  folded: boolean;
  /** The phone: the panel fills the bottom, 3 months by default, no "next GO" column. */
  compact: boolean;
  onToggleFold?: () => void;
  /** Writes the landing date to the scenario store, the only place it lives. */
  onLandingChange: (utc: string, write: LandingWrite) => void;
  onFocusSite: (siteId: string) => void;
  /** No site selected: open the Polar map to add one. */
  onOpenMap?: () => void;
};

/** A row of the grid: "Any site", or one selected site. */
type Row =
  | { kind: "any"; key: "any"; codes: Uint8Array | null }
  | { kind: "site"; key: string; site: Site | null; siteId: string; entry: SiteDays; codes: Uint8Array | null };

const KEYS = "ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight PageUp PageDown Home End";

function readColours(el: Element): StripColours {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    plot: v("--plot", "#0e0e0f"),
    go: v("--status-go", "#45c98b"),
    caution: v("--status-caution", "#f2a33a"),
    nogo: v("--status-nogo", "#f0646d"),
    none: v("--ink-4", "#5c5c63"),
    pending: v("--hover", "#232326"),
  };
}

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

/**
 * The landing-date panel (docs/features/slip-planner.md, "The landing-date panel"): in the
 * Slip Planner it takes the timeline's slot. "Any site", one strip per selected site across
 * the six years of the time grid, the "next GO" column, and the landing-date slider.
 */
export function LandingDatePanel(props: LandingDatePanelProps) {
  const manifest = useManifest();
  const retries = useStore(slipStore, (s) => s.retries);
  if (manifest.status === "error") return <PanelMessage {...props}>{`The time grid could not load: ${manifest.error}`}</PanelMessage>;
  if (manifest.status !== "ready") return <PanelMessage {...props}>Loading the time grid…</PanelMessage>;
  const grid = manifest.data.time_grid;
  let landingHour: number;
  try {
    landingHour = utcToHourIndex(grid, props.scenario.landingUtc);
  } catch {
    return <PanelMessage {...props}>The landing date is outside the time grid.</PanelMessage>;
  }
  if (props.scenario.siteIds.length === 0) {
    return (
      <PanelMessage {...props}>
        Add a site to see its landing dates.{" "}
        {props.onOpenMap ? (
          <button type="button" className="ldp-link" onClick={props.onOpenMap}>
            Open the Polar map
          </button>
        ) : null}
      </PanelMessage>
    );
  }
  // A new key after "Retry" mounts the sweeps again: a failed sweep is remembered per mount.
  return <Dates key={retries} {...props} gridCount={grid.count} gridStartMs={Date.parse(grid.start_utc)} landingHour={landingHour} />;
}

type DatesProps = LandingDatePanelProps & { gridCount: number; gridStartMs: number; landingHour: number };

function Dates(props: DatesProps) {
  const { scenario, folded, compact, onToggleFold, onLandingChange, onFocusSite, gridCount, gridStartMs, landingHour } = props;
  const profile = scenario.profile;
  const sitesData = useSites();
  const catalog = sitesData.status === "ready" ? sitesData.data : null;
  const entries = useSlipDays(scenario.siteIds, profile);
  const evaluate = useEvaluate(scenario.siteIds, profile);
  // What a strip's words say for a 00:00 UTC day: computing, or failed, exactly while its mark
  // says so; otherwise the rail's evaluation (landing-results.ts), never the packed sweep.
  const rowResult = useCallback(
    (entry: SiteDays, day: number): SiteResult =>
      entry.state === "loading" ? { kind: "pending" } : entry.state === "error" ? { kind: "failed" } : evaluate(entry.siteId, day * 24),
    [evaluate],
  );
  const ui = useStore(slipStore);
  const dayCount = useMemo(() => utcMidnightHours(gridCount).length, [gridCount]);
  const windowHours = windowLength(profile.duration_days);
  const lastDay = lastLandingDay(gridCount, windowHours);
  const landingDay = dayOfHour(landingHour);
  const gridEndYear = new Date(gridStartMs + (gridCount - 1) * 3_600_000).getUTCFullYear();

  // The first change of date is remembered (slip-planner.md, "Before and after a slip").
  useEffect(() => {
    slipStore.getState().observeLanding(landingHour);
  }, [landingHour]);
  const fromHour = comparisonHour(ui, landingHour);
  const fromDay = fromHour === null ? null : dayOfHour(fromHour);

  // ── Rows ──
  const siteCodes = entries.map((e) => e.days?.status ?? null);
  const anyCodes = useMemo(
    () => anySiteDays(entries.map((e) => (e.state === "ready" && e.days ? e.days : e.state === "error" ? "failed" : "pending")), dayCount),
    // The entries array is the same object while no sweep changed.
    [entries, dayCount],
  );
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    if (entries.length > 1) list.push({ kind: "any", key: "any", codes: anyCodes });
    entries.forEach((entry, i) => {
      const site = catalog?.find((s) => s.id === entry.siteId) ?? null;
      list.push({ kind: "site", key: entry.siteId, site, siteId: entry.siteId, entry, codes: siteCodes[i] ?? null });
    });
    return list;
    // siteCodes is derived from entries.
  }, [entries, anyCodes, catalog]);

  // ── Visible range ──
  const zoom: Zoom = ui.zoom ?? (compact ? "3m" : "18m");
  const span = zoomDays(zoom, dayCount);
  const start = followStart(ui.start, span, landingDay, dayCount);
  useLayoutEffect(() => {
    if (start !== ui.start) slipStore.getState().setStart(start);
  }, [start, ui.start]);

  const metrics = stripMetrics(scenario.siteIds.length, compact);
  const [stripRef, width] = useWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef(new StripCanvas());
  const colours = useRef<StripColours | null>(null);
  const height = stripsHeight(rows.length, metrics.height, metrics.gap);
  const rowCodes = useMemo(() => rows.map((r) => r.codes), [rows]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      controller.current.reset();
    }
    colours.current ??= readColours(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    controller.current.update(ctx, {
      rows: rowCodes,
      start,
      span,
      width,
      rowHeight: metrics.height,
      gap: metrics.gap,
      dpr,
      colours: colours.current,
    });
  }, [rowCodes, start, span, width, height, metrics.height, metrics.gap, folded]);

  const x = useCallback((day: number) => ((day - start) / span) * width, [start, span, width]);
  const rowTop = (index: number) => index * (metrics.height + metrics.gap);
  const nameOf = useCallback(
    (siteId: string) => catalog?.find((s) => s.id === siteId)?.name ?? siteId,
    [catalog],
  );

  // ── Readouts ──
  const readoutFor = useCallback(
    (rowIndex: number, day: number): Readout => {
      const when = `${dayLabel(gridStartMs, day)} 00:00 UTC`;
      const row = rows[rowIndex];
      if (!row) return { title: when, status: null, lines: [] };
      if (day < 0 || day >= dayCount) return { title: when, status: null, lines: ["Outside the time grid."] };
      if (row.kind === "any") {
        return anyReadout(
          when,
          entries.map((e) => ({ siteId: e.siteId, name: nameOf(e.siteId), result: rowResult(e, day) })),
        );
      }
      return siteReadout(nameOf(row.siteId), when, rowResult(row.entry, day), profile);
    },
    [rows, entries, gridStartMs, dayCount, nameOf, profile, rowResult],
  );

  // ── Pointer: drag anywhere on the strips; a click also focuses that row's site ──
  const [tip, setTip] = useState<{ row: number; day: number } | null>(null);
  const [probe, setProbe] = useState<{ row: number; day: number } | null>(null);
  const drag = useRef<{ x0: number; moved: number; row: number; first: boolean; frame: number | null; x: number } | null>(null);
  const overRef = useRef<HTMLDivElement>(null);
  const rowAtY = (y: number) => {
    for (let i = 0; i < rows.length; i += 1) {
      const top = rowTop(i);
      if (y >= top - metrics.gap / 2 && y < top + metrics.height + metrics.gap / 2) return i;
    }
    return -1;
  };
  const land = useCallback(
    (day: number, write: LandingWrite) => {
      const clamped = Math.min(lastDay, Math.max(0, day));
      onLandingChange(dayUtc(gridStartMs, clamped), write);
    },
    [lastDay, gridStartMs, onLandingChange],
  );
  const applyDrag = () => {
    const d = drag.current;
    const el = overRef.current;
    if (!d || !el) return;
    d.frame = null;
    const rect = el.getBoundingClientRect();
    const day = Math.min(lastDay, Math.max(0, dayAtX(d.x - rect.left, rect.width, start, span)));
    if (day === landingDay && isWholeDay(landingHour)) return;
    land(day, d.first ? "push" : "replace");
    d.first = false;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || width <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { x0: event.clientX, moved: 0, row: rowAtY(event.clientY - rect.top), first: true, frame: null, x: event.clientX };
    setTip(null);
    applyDrag();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) {
      d.moved = Math.max(d.moved, Math.abs(event.clientX - d.x0));
      d.x = event.clientX;
      if (d.frame === null) d.frame = requestAnimationFrame(applyDrag);
      return;
    }
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const row = rowAtY(event.clientY - rect.top);
    if (row < 0) setTip(null);
    else setTip({ row, day: dayAtX(event.clientX - rect.left, rect.width, start, span) });
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    if (d.frame !== null) {
      cancelAnimationFrame(d.frame);
      applyDrag();
    }
    const row = rows[d.row];
    if (d.moved < 4 && row?.kind === "site") onFocusSite(row.siteId);
    drag.current = null;
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (span >= dayCount) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    slipStore.getState().setStart(panStart(start, span, delta, dayCount));
  };

  // ── Keys ──
  const onSliderKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const day = sliderKey(event.key, event.shiftKey, landingDay, lastDay);
    if (day === null) return;
    event.preventDefault();
    land(day, event.repeat ? "replace" : "push");
  };
  const onStripKey = (rowIndex: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    const current = probe && probe.row === rowIndex ? probe.day : landingDay;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      land(current, "push");
      const row = rows[rowIndex];
      if (row?.kind === "site") onFocusSite(row.siteId);
      return;
    }
    if (event.key === "Escape") {
      (event.currentTarget as HTMLElement).blur();
      return;
    }
    const day = stripKey(event.key, event.shiftKey, current, lastDay);
    if (day === null) return;
    event.preventDefault();
    setProbe({ row: rowIndex, day });
    if (day < start || day >= start + span) slipStore.getState().setStart(Math.max(0, Math.min(dayCount - span, day - Math.round(span / 2))));
  };

  // ── What the slider, the header and the row lamps say: the real landing ──
  // They speak of the landing itself, at its own hour, so they read the same evaluation as
  // the spots and the sites rail. Only the strips, their hovers and "next GO" speak of 00:00
  // UTC landings, and when the landing is at another hour a note says so in every layout.
  const whole = isWholeDay(landingHour);
  const landingWhen = `${dayLabel(gridStartMs, landingDay)} ${String(landingHour % 24).padStart(2, "0")}:00 UTC`;
  const nowResults = entries.map((e) => ({ siteId: e.siteId, name: nameOf(e.siteId), result: evaluate(e.siteId, landingHour) }));
  const nowAny = anyReadout(landingWhen, nowResults);
  const nowStatus = new Map(nowResults.map((r) => [r.siteId, r.result.kind === "ready" ? r.result.evaluation.status : null]));
  const nowGo = nowResults.filter((r) => r.result.kind === "ready" && r.result.evaluation.status === "GO").length;
  const nowPending = nowResults.filter((r) => r.result.kind === "pending").length;
  const valueText = [
    `Landing ${landingWhen}.`,
    `${nowGo} of ${entries.length} site${entries.length === 1 ? "" : "s"} GO for this landing${nowPending ? `, ${nowPending} still computing` : ""}.`,
    whole ? null : WHOLE_NOTE,
  ]
    .filter(Boolean)
    .join(" ");
  const anyWords = nowAny.status
    ? `${entries.length > 1 ? "Any site: " : ""}${nowAny.status} for this landing`
    : (nowAny.lines[0] ?? "");
  const ready = entries.filter((e) => e.state !== "loading").length;
  const failedCount = entries.filter((e) => e.state === "error").length;
  const retry = (siteId: string) => {
    // A series that failed to load is dropped so it loads again; the remount re-runs the sweeps.
    if (dataStore.getState().entries[seriesKey(siteId)]?.status === "error") dataStore.getState().dropSite(siteId);
    slipStore.getState().retry();
  };
  const computing = ready < entries.length;
  const weights = settingsProvenance(profile, ["weights"]);
  const wholeNote = whole ? null : <span className="ldp-whole">{WHOLE_NOTE}</span>;

  const foldButton = onToggleFold ? (
    <span className="tl-fold-slot">
      <IconButton
        label={folded ? "Unfold the landing dates" : "Fold the landing dates"}
        icon={folded ? <ChevronUp size={16} strokeWidth={1.8} /> : <ChevronDown size={16} strokeWidth={1.8} />}
        onClick={onToggleFold}
        aria-expanded={!folded}
        className="tl-fold"
      />
    </span>
  ) : null;

  const progress = computing ? (
    <div
      className="ldp-progress"
      role="progressbar"
      aria-label="Working out six years of landing dates"
      aria-valuemin={0}
      aria-valuemax={entries.length}
      aria-valuenow={ready}
    >
      <i style={{ width: `${(ready / Math.max(1, entries.length)) * 100}%` }} />
    </div>
  ) : null;

  if (folded) {
    return (
      <div className="ldp ldp-folded">
        {progress}
        <h2 className="sr-only">Landing dates</h2>
        {foldButton}
        <div className="tl-landing">
          <LandingDateControl />
        </div>
        <span className="ldp-folded-any">
          {nowAny.status ? <StatusLamp status={nowAny.status} size="xs" /> : null}
          {anyWords}
        </span>
        {wholeNote}
      </div>
    );
  }

  const knobX = x(landingDay + 0.5);
  const inView = landingDay >= start && landingDay < start + span;
  const bandRight = Math.min(width, x(landingDay + windowHours / 24));

  return (
    <div className="ldp" data-compact={compact}>
      {progress}
      <div className="tl-head ldp-head">
        {/* The control names the group "Landing date"; the panel's title is for screen readers, as in the timeline. */}
        <h2 className="sr-only">Landing dates</h2>
        {foldButton}
        {/*
          The shell's landing-date control (app/mission/landing-date-control.tsx), the same as
          at the head of the timeline: the date with its day buttons and slips, the mission
          window's end and length with its tag, and "Next GO". It reads and writes only the
          scenario store, like everything here.
        */}
        <div className={cx("tl-landing ldp-date-slot", compact && "tl-compact-landing")} data-slot="landing-date-control">
          <LandingDateControl />
        </div>
        {/* On the phone the note sits in the head; on a wider screen, over the row names. */}
        {compact ? wholeNote : null}
        <span className="ldp-key" aria-label="Key: GO is a full mark, CAUTION a half mark, NO-GO a low line. A spot's ring is its score.">
          <span aria-hidden="true">
            <i className="ldp-key-go" />
            GO full
          </span>
          <span aria-hidden="true">
            <i className="ldp-key-caution" />
            CAUTION half
          </span>
          <span aria-hidden="true">
            <i className="ldp-key-nogo" />
            NO-GO a low line
          </span>
          <span className="ldp-key-ring" aria-hidden="true">
            <svg viewBox="-8 -8 16 16" width="14" height="14">
              <circle r="6" className="ldp-ring-track" />
              <circle r="6" className="ldp-ring-arc" pathLength="100" strokeDasharray="70 100" transform="rotate(-90)" />
            </svg>
            Ring: score
          </span>
          <SettingsTag settings={weights} />
        </span>
        <div className="ldp-controls">
          <SegmentedControl
            label="Show"
            options={ZOOMS.map((z) => ({ value: z.value, label: z.label }))}
            value={zoom}
            onChange={(value) => slipStore.getState().setZoom(value)}
          />
        </div>
      </div>

      <div
        className="ldp-grid"
        style={{ gridTemplateRows: `22px ${height}px 18px` }}
      >
        {!compact && !whole ? <span className="ldp-whole ldp-whole-grid">{WHOLE_NOTE}</span> : null}
        <div className="ldp-labels" style={{ gridRow: 2, height }}>
          {rows.map((row, i) => (
            <RowLabel
              key={row.key}
              row={row}
              top={rowTop(i)}
              rowHeight={metrics.height}
              status={row.kind === "any" ? nowAny.status : (nowStatus.get(row.siteId) ?? null)}
              missing={failedCount}
              focused={row.kind === "site" && row.siteId === scenario.focusedSiteId}
              compact={compact}
              catalog={catalog}
              onFocusSite={onFocusSite}
            />
          ))}
        </div>

        <div ref={stripRef} className="ldp-strips" style={{ gridRow: "1 / 4" }}>
          <canvas ref={canvasRef} className="ldp-canvas" style={{ top: 22, width: "100%", height }} aria-hidden="true" />
          {rows.map((row, i) =>
            row.kind === "site" && row.entry.state === "loading" ? (
              <span key={`p${row.key}`} className="ldp-pending" style={{ top: 22 + rowTop(i), height: metrics.height }} aria-hidden="true" />
            ) : null,
          )}
          {rows.map((row, i) =>
            row.kind === "site" && row.entry.state === "error" ? (
              <div key={`f${row.key}`} className="ldp-failed" style={{ top: 22 + rowTop(i), height: metrics.height }}>
                <span>{FAILED_LINE}</span>
                <button type="button" className="ldp-link" onClick={() => retry(row.siteId)} aria-label={`Retry ${nameOf(row.siteId)}`}>
                  Retry
                </button>
              </div>
            ) : null,
          )}
          <div
            ref={overRef}
            className="ldp-over"
            style={{ top: 22, height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onPointerLeave={() => setTip(null)}
            onWheel={onWheel}
          >
            {rows.map((row, i) => (
              <div
                key={row.key}
                className="ldp-strip"
                data-focused={row.kind === "site" && row.siteId === scenario.focusedSiteId}
                style={{ top: rowTop(i), height: metrics.height }}
                tabIndex={compact ? -1 : 0}
                role="slider"
                aria-label={
                  row.kind === "any"
                    ? "Any site: the best status among your sites, by landing date. Arrow keys move along the strip, Enter lands on that date."
                    : `${nameOf(row.siteId)}: status by landing date. Arrow keys move along the strip, Enter lands on that date.`
                }
                aria-valuemin={0}
                aria-valuemax={lastDay}
                aria-valuenow={probe?.row === i ? probe.day : landingDay}
                aria-valuetext={readoutText(readoutFor(i, probe?.row === i ? probe.day : landingDay))}
                aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight PageUp PageDown Enter"
                onFocus={() => setProbe({ row: i, day: landingDay })}
                onBlur={() => setProbe((p) => (p?.row === i ? null : p))}
                onKeyDown={onStripKey(i)}
              />
            ))}
          </div>

          {width > 0 ? (
            <>
              {inView ? (
                <span
                  className="ldp-band"
                  style={{ left: x(landingDay), width: Math.max(1, bandRight - x(landingDay)), top: 22, height }}
                  aria-hidden="true"
                />
              ) : null}
              {fromDay !== null && fromDay >= start && fromDay < start + span ? (
                <span className="ldp-was" style={{ left: x(fromDay + 0.5), top: 18, height: height + 22 }} aria-hidden="true">
                  <span>was {shortDay(gridStartMs, fromDay)}</span>
                </span>
              ) : null}
              {probe ? (
                <span
                  className="ldp-probe"
                  style={{ left: x(probe.day), width: Math.max(3, width / span), top: 22 + rowTop(probe.row) - 2, height: metrics.height + 4 }}
                  aria-hidden="true"
                />
              ) : null}
              <Knob
                x={knobX}
                width={width}
                height={height}
                edge={landingDay < start ? "left" : landingDay >= start + span ? "right" : null}
                label={`Landing ${dayLabel(gridStartMs, landingDay)}${whole ? "" : `, ${String(landingHour % 24).padStart(2, "0")}:00`}`}
                valueText={valueText}
                lastDay={lastDay}
                landingDay={landingDay}
                onKeyDown={onSliderKey}
                onBringBack={() => slipStore.getState().setStart(null)}
              />
              <Axis start={start} span={span} width={width} gridStartMs={gridStartMs} top={22 + height} dayCount={dayCount} />
            </>
          ) : null}

          {tip || probe ? <Tip readout={readoutFor((tip ?? probe)!.row, (tip ?? probe)!.day)} x={x((tip ?? probe)!.day + 0.5)} width={width} /> : null}
        </div>

        {compact ? null : (
          <div className="ldp-next" style={{ gridRow: 2, height }}>
            {rows.map((row, i) => {
              const codes = row.codes;
              // The first 00:00 UTC landing at or after the landing: its own day when it is at
              // 00:00, else the next day, so a 00:00 result is never pinned on a later hour.
              const from = whole ? landingDay : landingDay + 1;
              // "Any site" and a site still computing say so; a found GO is final only when no
              // earlier day is still being worked out (anyNextGo).
              let text = "";
              if (row.kind === "any") {
                const next = codes ? anyNextGo(codes, from) : "computing";
                text = next === "computing" ? COMPUTING_WORD : nextGoWords(next, landingDay, gridStartMs, gridEndYear);
              } else if (row.entry.state === "loading") text = COMPUTING_WORD;
              else if (row.entry.state === "ready" && codes) text = nextGoWords(nextGo({ status: codes }, from), landingDay, gridStartMs, gridEndYear);
              return (
                <span key={row.key} className="ldp-next-cell" style={{ top: rowTop(i), height: metrics.height }}>
                  {text}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const COMPUTING_WORD = "computing…";

type RowLabelProps = {
  row: Row;
  top: number;
  rowHeight: number;
  /** The status for the landing itself, at its own hour: the same as the spot and the rail. */
  status: Status | null;
  /** Sites that could not be computed, which "Any site" leaves out. */
  missing: number;
  focused: boolean;
  /** On the phone the whole strip area is the touch target: a row name is text, not a button. */
  compact: boolean;
  catalog: readonly Site[] | null;
  onFocusSite: (siteId: string) => void;
};

const RowLabel = memo(function RowLabel({ row, top, rowHeight, status, missing, focused, compact, catalog, onFocusSite }: RowLabelProps) {
  const lamp = status ? <StatusLamp status={status} size="xs" /> : <span className="lamp-none ldp-lamp-none" aria-hidden="true" />;
  const style = { top, height: Math.max(rowHeight, 16), marginTop: Math.min(0, (rowHeight - 16) / 2) };
  if (row.kind === "any") {
    return (
      <span className="ldp-label ldp-label-any" style={style}>
        {lamp}
        <span className="ldp-name">Any site</span>
        {missing > 0 ? <span className="ldp-note">{missing} {missing === 1 ? "site" : "sites"} missing</span> : null}
      </span>
    );
  }
  const site = row.site;
  const parentId = site ? variantOf(site) : null;
  const parent = parentId ? (catalog?.find((s) => s.id === parentId) ?? null) : null;
  const name = site?.name ?? row.siteId;
  const variantText = parent && site ? variantLine(variantMetres(site, parent, MOON_RADIUS_M), parent.name) : null;
  const Tag = compact ? "span" : "button";
  return (
    <Tag
      type={compact ? undefined : "button"}
      tabIndex={compact ? undefined : -1}
      className={cx("ldp-label", parentId && "is-variant")}
      style={style}
      data-site={row.siteId}
      aria-current={focused ? "true" : undefined}
      title={variantText ? `${variantText}, chosen by TrueSouth. Focus it.` : `Focus ${name}`}
      onClick={compact ? undefined : () => onFocusSite(row.siteId)}
    >
      {lamp}
      <span className="ldp-name">{parentId ? VARIANT_NAME : name}</span>
      {parentId ? <span className="tag tag-chosen">chosen by TrueSouth</span> : null}
      {site?.terrain_tier === "sphere" ? <span className="ldp-note">terrain not modelled</span> : null}
    </Tag>
  );
});

type KnobProps = {
  x: number;
  width: number;
  height: number;
  edge: "left" | "right" | null;
  label: string;
  valueText: string;
  lastDay: number;
  landingDay: number;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onBringBack: () => void;
};

/** The landing-date slider: a Moonlight line, knob and pill across the strips, like the scrubber. */
function Knob({ x, width, height, edge, label, valueText, lastDay, landingDay, onKeyDown, onBringBack }: KnobProps) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const [pillWidth, setPillWidth] = useState(120);
  useLayoutEffect(() => {
    const w = pillRef.current?.offsetWidth ?? 0;
    if (w > 0 && Math.abs(w - pillWidth) > 0.5) setPillWidth(w);
  }, [label, pillWidth, edge]);
  const left = Math.max(0, Math.min(width, x));
  const pillLeft = Math.min(Math.max(-left, -pillWidth / 2), width - left - pillWidth);
  const text = `${edge === "left" ? "← " : ""}${label}${edge === "right" ? " →" : ""}`;
  return (
    <div
      className="ldp-knob"
      data-edge={edge ?? undefined}
      style={{ transform: `translateX(${Math.round(left)}px)`, height: height + 22 }}
      role="slider"
      tabIndex={0}
      aria-label="Landing date"
      aria-valuemin={0}
      aria-valuemax={lastDay}
      aria-valuenow={landingDay}
      aria-valuetext={valueText}
      aria-keyshortcuts={KEYS}
      onKeyDown={onKeyDown}
    >
      <span
        ref={pillRef}
        className="ldp-pill tabular"
        style={{ transform: `translateX(${Math.round(pillLeft)}px)` }}
        onPointerDown={edge ? (event) => {
          event.stopPropagation();
          onBringBack();
        } : undefined}
      >
        {text}
      </span>
      {edge ? null : <i className="ldp-line" />}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month ticks under the strips, the year at January. */
const Axis = memo(function Axis({ start, span, width, gridStartMs, top, dayCount }: { start: number; span: number; width: number; gridStartMs: number; top: number; dayCount: number }) {
  const ticks = useMemo(() => {
    const out: { x: number; text: string | null; major: boolean }[] = [];
    const pxPerMonth = (width / span) * 30.44;
    const all = span >= dayCount;
    const step = [1, 2, 3, 6, 12].find((k) => pxPerMonth * k >= (all ? 40 : 46)) ?? 12;
    let first = true;
    for (let day = start; day < start + span; day += 1) {
      const date = new Date(gridStartMs + day * 86_400_000);
      if (date.getUTCDate() !== 1) continue;
      const month = date.getUTCMonth();
      if (all && month % 3) continue;
      const tx = ((day - start) / span) * width;
      // Clear of "UTC" at the right end.
      const labelled = month % step === 0 && tx < width - 56 && (!all || month === 0);
      const text = !labelled ? null : month === 0 || all ? String(date.getUTCFullYear()) : first && pxPerMonth * step >= 64 ? `${MONTHS[month]} ${date.getUTCFullYear()}` : (MONTHS[month] ?? "");
      if (labelled) first = false;
      out.push({ x: tx, text, major: month === 0 });
    }
    return out;
  }, [start, span, width, gridStartMs, dayCount]);
  return (
    <svg className="ldp-axis" width={width} height={18} style={{ top }} aria-hidden="true" focusable="false">
      {ticks.map((t) => (
        <g key={t.x}>
          <line x1={t.x} x2={t.x} y1={0} y2={t.major ? 6 : 3} className={t.major ? "ldp-tick is-major" : "ldp-tick"} />
          {t.text ? (
            <text x={t.x + 3} y={15}>
              {t.text}
            </text>
          ) : null}
        </g>
      ))}
      <text x={width} y={15} textAnchor="end" className="ldp-axis-utc">
        UTC
      </text>
    </svg>
  );
});

function Tip({ readout, x, width }: { readout: Readout; x: number; width: number }) {
  const left = Math.max(0, Math.min(width - 280, x - 140));
  return (
    <div className="ldp-tip" role="tooltip" style={{ left }}>
      <p className="ldp-tip-title tabular">{readout.title}</p>
      {readout.status ? (
        <p className="ldp-tip-status">
          <StatusLamp status={readout.status} size="xs" />
          {readout.status}
        </p>
      ) : null}
      {readout.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function PanelMessage({ children, folded, onToggleFold }: LandingDatePanelProps & { children: ReactNode }) {
  return (
    <div className={cx("ldp", folded && "ldp-folded")}>
      <div className="tl-head ldp-head">
        <h2 className="tl-title">Landing dates</h2>
        {onToggleFold ? (
          <span className="tl-fold-slot">
            <IconButton
              label={folded ? "Unfold the landing dates" : "Fold the landing dates"}
              icon={folded ? <ChevronUp size={16} strokeWidth={1.8} /> : <ChevronDown size={16} strokeWidth={1.8} />}
              onClick={onToggleFold}
              aria-expanded={!folded}
              className="tl-fold"
            />
          </span>
        ) : null}
      </div>
      {folded ? null : <p className="tl-message">{children}</p>}
    </div>
  );
}

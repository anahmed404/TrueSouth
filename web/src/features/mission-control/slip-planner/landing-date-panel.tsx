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
import { windowText } from "../../../app/mission/timeline/axis";
import { IconButton } from "../../../components/Button";
import { Explain } from "../../../components/Explain";
import { cx } from "../../../components/format";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { StatusLamp } from "../../../components/StatusLamp";
import type { Site } from "../../../contracts/generated";
import { useManifest, useSites } from "../../../data";
import { codeStatus, nextGoDay, nextGoWords, utcMidnightHours, windowLength, type Status } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import {
  DAY_PENDING,
  ZOOMS,
  anySiteDays,
  dayAtX,
  dayLabel,
  dayOfHour,
  dayUtc,
  followStart,
  isWholeDay,
  lastLandingDay,
  metresApart,
  panStart,
  sliderKey,
  stripKey,
  stripMetrics,
  variantLine,
  variantOf,
  zoomDays,
  type Zoom,
} from "./model";
import { anyReadout, readoutText, siteReadout, type Readout } from "./readout";
import { comparisonHour, slipStore } from "./slip-store";
import { StripCanvas, stripsHeight, type StripColours } from "./strips-canvas";
import { resultAt, useSlipDays, type SiteDays } from "./use-slip-days";
import { shortDay } from "../../../lib/scoring/next-go";
import { MOON_RADIUS_M } from "../../../lib/geo";
import "./slip-planner.css";

export type LandingWrite = "push" | "replace";

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
  return <Dates {...props} gridCount={grid.count} gridStartMs={Date.parse(grid.start_utc)} landingHour={landingHour} />;
}

type DatesProps = LandingDatePanelProps & { gridCount: number; gridStartMs: number; landingHour: number };

function Dates(props: DatesProps) {
  const { scenario, folded, compact, onToggleFold, onLandingChange, onFocusSite, gridCount, gridStartMs, landingHour } = props;
  const profile = scenario.profile;
  const sitesData = useSites();
  const catalog = sitesData.status === "ready" ? sitesData.data : null;
  const entries = useSlipDays(scenario.siteIds, profile);
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
    () => anySiteDays(entries.map((e) => e.days), dayCount),
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
          entries.map((e) => ({ siteId: e.siteId, name: nameOf(e.siteId), result: resultAt(e, day * 24) })),
        );
      }
      return siteReadout(nameOf(row.siteId), when, resultAt(row.entry, day * 24), profile);
    },
    [rows, entries, gridStartMs, dayCount, nameOf, profile],
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

  // ── What the slider and the header say ──
  const goCount = entries.filter((e) => e.days?.status[landingDay] === 1).length;
  const valueText = `Landing ${dayLabel(gridStartMs, landingDay)}${isWholeDay(landingHour) ? "" : `, ${String(landingHour % 24).padStart(2, "0")}:00 UTC`}. ${goCount} of ${entries.length} site${entries.length === 1 ? "" : "s"} GO on this date.`;
  const ready = entries.filter((e) => e.state !== "loading").length;
  const computing = ready < entries.length;
  const anyNow: Status | null = codeStatus(anyCodes[landingDay] ?? 0);
  const range = { landing: landingHour, windowEnd: landingHour + windowHours };
  const weights = settingsProvenance(profile, ["weights"]);

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
        <h2 className="tl-title">Landing dates</h2>
        {foldButton}
        <span className="tl-folded-time tabular">Landing {dayLabel(gridStartMs, landingDay)}</span>
        <span className="ldp-folded-any">
          {anyNow ? <StatusLamp status={anyNow} size="xs" /> : null}
          {entries.length > 1 ? "Any site: " : ""}
          {anyNow ?? "no data"} on this date
        </span>
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
        <h2 className="tl-title">
          <Explain term="slip_planner">Landing dates</Explain>
        </h2>
        {foldButton}
        <p className="tl-window ldp-window">
          <span className="tabular">
            <Explain term="mission_window">Mission window</Explain> {windowText(range, gridStartMs)}
          </span>
          {isWholeDay(landingHour) ? null : <span className="ldp-whole"> Strips show landings at 00:00 UTC.</span>}
        </p>
        {/*
          The landing-date control (LandingDateControl, app/mission/, from the shell package)
          mounts here in the Slip Planner once it is merged, in place of the app bar's copy.
          It reads and writes the landing date through the scenario store, like everything here.
        */}
        <div className="ldp-date-slot" data-slot="landing-date-control" />
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
        <div className="ldp-labels" style={{ gridRow: 2, height }}>
          {rows.map((row, i) => (
            <RowLabel
              key={row.key}
              row={row}
              top={rowTop(i)}
              rowHeight={metrics.height}
              landingDay={landingDay}
              focused={row.kind === "site" && row.siteId === scenario.focusedSiteId}
              catalog={catalog}
              onFocusSite={onFocusSite}
            />
          ))}
        </div>

        <div ref={stripRef} className="ldp-strips" style={{ gridRow: "1 / 4" }}>
          <canvas ref={canvasRef} className="ldp-canvas" style={{ top: 22, width: "100%", height }} aria-hidden="true" />
          {rows.map((row, i) =>
            row.kind === "site" && row.entry.state === "loading" && !row.entry.days ? (
              <span key={`p${row.key}`} className="ldp-pending" style={{ top: 22 + rowTop(i), height: metrics.height }} aria-hidden="true" />
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
                label={`Landing ${dayLabel(gridStartMs, landingDay)}`}
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
              const text =
                codes && !(row.kind === "site" && row.entry.state === "loading" && !row.entry.days)
                  ? nextGoWords(nextGoDay({ status: codes }, landingDay), landingDay, gridStartMs, gridEndYear)
                  : "";
              const pendingAny = row.kind === "any" && codes ? hasPendingBefore(codes, landingDay) : false;
              return (
                <span key={row.key} className="ldp-next-cell" style={{ top: rowTop(i), height: metrics.height }}>
                  {pendingAny ? "" : text}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Any site" cannot say "next GO" while an earlier day is still being worked out. */
function hasPendingBefore(codes: Uint8Array, from: number): boolean {
  for (let day = from; day < codes.length; day += 1) {
    if (codes[day] === 1) return false;
    if (codes[day] === DAY_PENDING) return true;
  }
  return false;
}

type RowLabelProps = {
  row: Row;
  top: number;
  rowHeight: number;
  landingDay: number;
  focused: boolean;
  catalog: readonly Site[] | null;
  onFocusSite: (siteId: string) => void;
};

const RowLabel = memo(function RowLabel({ row, top, rowHeight, landingDay, focused, catalog, onFocusSite }: RowLabelProps) {
  const code = row.codes?.[landingDay] ?? 0;
  const status = code === DAY_PENDING ? null : codeStatus(code);
  const lamp = status ? <StatusLamp status={status} size="xs" /> : <span className="lamp-none ldp-lamp-none" aria-hidden="true" />;
  const style = { top, height: Math.max(rowHeight, 16), marginTop: Math.min(0, (rowHeight - 16) / 2) };
  if (row.kind === "any") {
    return (
      <span className="ldp-label ldp-label-any" style={style}>
        {lamp}
        <span className="ldp-name">Any site</span>
      </span>
    );
  }
  const site = row.site;
  const parentId = site ? variantOf(site) : null;
  const parent = parentId ? (catalog?.find((s) => s.id === parentId) ?? null) : null;
  const name = site?.name ?? row.siteId;
  const variantText = parent && site ? variantLine(metresApart(site, parent, MOON_RADIUS_M), parent.name) : null;
  return (
    <button
      type="button"
      tabIndex={-1}
      className={cx("ldp-label", parentId && "is-variant")}
      style={style}
      data-site={row.siteId}
      aria-current={focused ? "true" : undefined}
      title={variantText ? `${variantText}, chosen by TrueSouth. Focus it.` : `Focus ${name}`}
      onClick={() => onFocusSite(row.siteId)}
    >
      {lamp}
      <span className="ldp-name">{parentId ? "Best-lit variant" : name}</span>
      {parentId ? <span className="tag tag-chosen">chosen by TrueSouth</span> : null}
      {site?.terrain_tier === "sphere" ? <span className="ldp-note">terrain not modelled</span> : null}
      {row.entry.state === "error" ? <span className="ldp-note">could not load</span> : null}
    </button>
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
      const labelled = month % step === 0 && tx < width - 30 && (!all || month === 0);
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

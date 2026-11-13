/**
 * Lander's eye: the horizon chart, its control row, its legend and, in Mission Control, the
 * "Why is it dark?" card under it (docs/features/panorama.md). It takes `PanelProps`, so the
 * same component floats under the horizon in Mission Control and sits alone in a 360 px box
 * in an Academy lesson.
 *
 * Data: the site's `skyline.bin` and series, read as stored. The chart places them; it does
 * not compute where a body is or what the terrain hides (docs/decisions/0002).
 */

import { Globe } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PanelProps } from "../../app/panel";
import { WhyDarkCard, WhyDarkLine } from "../../app/mission/timeline";
import type { SkylineArrays } from "../../app/mission/timeline/why-dark";
import { isSphere } from "../../app/mission/site-status";
import { Button } from "../../components/Button";
import { Panel } from "../../components/Panel";
import { useFeatures, useManifest, useSeries, useSite, useSkyline } from "../../data/hooks";
import { useHourFlags, windowLength } from "../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { HorizonChart, type ChartWindow } from "./chart";
import {
  autoRange,
  chartFrame,
  chartScales,
  discShape,
  meanAzimuth,
  needsLocator,
  stretchWords,
  zoomRange,
  type ElevationRange,
} from "./geometry";
import { answerSentence, bodyAt, bodySentence, type ChartSeries } from "./readings";
import "./panorama.css";

export type LandersEyeProps = PanelProps & {
  /** Mission Control only: the sphere-tier state's "Show … in the System view" button. */
  onShowSystemView?: () => void;
};

/** Below this width the disc labels move off the chart into one line under it. */
const LABELS_MIN_WIDTH = 520;

/** The default range while loading: an empty frame with axes. */
const LOADING_RANGE: ElevationRange = { lo: -2, hi: 6 };

const NO_FEATURES: never[] = [];

type CentreMode = "earth" | "sun" | "north" | "free";

export default function LandersEye(props: LandersEyeProps) {
  const siteId = props.scenario.focusedSiteId ?? props.scenario.siteIds[0] ?? null;
  if (!siteId) {
    return (
      <Frame mode={props.mode} label="Lander's eye">
        <p className="pano-note">Pick a site to see its horizon.</p>
      </Frame>
    );
  }
  // A new site starts again: centred on its Earth, at its own vertical range.
  return <SiteLandersEye key={siteId} siteId={siteId} {...props} />;
}

function Frame({ mode, label, children }: { mode: PanelProps["mode"]; label: string; children: ReactNode }) {
  return mode === "mission" ? (
    <Panel as="section" className="pano pano-panel" data-mode={mode} aria-label={label}>
      {children}
    </Panel>
  ) : (
    <section className="pano" data-mode={mode} aria-label={label}>
      {children}
    </section>
  );
}

/** The width of an element, followed as it changes. 720 until it is measured (and in tests). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    setWidth(Math.round(node.clientWidth) || 720);
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A legend line, drawn with the same classes (and so the same dashes) as the chart. */
function Swatch({ className, dot = false }: { className: string; dot?: boolean }) {
  return (
    <svg className="pano-sw-svg" width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <path d="M1 4H21" className={className} />
      {dot ? <circle cx="11" cy="4" r="2.4" className="pano-dot-sun" /> : null}
    </svg>
  );
}

function safeHour(grid: Parameters<typeof utcToHourIndex>[0], utc: string): number | null {
  try {
    return utcToHourIndex(grid, utc);
  } catch {
    return null;
  }
}

function SiteLandersEye({ siteId, scenario, mode, marker, onMarkerChange, onShowSystemView }: LandersEyeProps & { siteId: string }) {
  const manifest = useManifest();
  const site = useSite(siteId);
  const series = useSeries(siteId);
  const skyline = useSkyline(siteId);
  const features = useFeatures();
  const [hostRef, width] = useWidth();
  const flags = useHourFlags(siteId, scenario.profile);

  const name = site.status === "ready" ? (site.data.site?.name ?? siteId) : siteId;
  const sphere = site.status === "ready" && isSphere(site.data.site);
  const grid = manifest.status === "ready" ? manifest.data.time_grid : null;

  // ── The hours: the scrubber's, the landing's and the mission window ─────
  const hour = grid ? safeHour(grid, scenario.currentUtc) : null;
  const landingHour = grid ? safeHour(grid, scenario.landingUtc) : null;
  const windowHours = windowLength(scenario.profile.duration_days);
  const from = landingHour;
  const to = grid && landingHour !== null ? Math.min(landingHour + windowHours, grid.count) : null;
  const window = useMemo<ChartWindow | null>(() => (from !== null && to !== null ? { from, to } : null), [from, to]);

  const data: ChartSeries | null = series.status === "ready" ? series.data : null;
  const sky: SkylineArrays | null = skyline.status === "ready" ? skyline.data : null;
  // The discs' radii are the site meta's (docs/data-contracts.md). Until it loads there are
  // none, and no disc is drawn. useSite builds a new object each render: key the radii on
  // their numbers, so the chart's memoised layers do not redraw on every scrub.
  const sunRadius = site.status === "ready" ? site.data.meta.sun_radius_deg : null;
  const earthRadius = site.status === "ready" ? site.data.meta.earth_radius_deg : null;
  const radii = useMemo(
    () => (sunRadius !== null && earthRadius !== null ? { sun: sunRadius, earth: earthRadius } : null),
    [sunRadius, earthRadius],
  );

  // ── Centre: Earth's average azimuth by default, so its loop is never split ─
  const earthMean = useMemo(() => (data && window ? meanAzimuth(data.earth_az, window.from, window.to) : null), [data, window]);
  const [centre, setCentre] = useState<{ mode: CentreMode; deg: number }>({ mode: "earth", deg: 0 });
  const centreDeg = centre.mode === "earth" ? (earthMean ?? 0) : centre.mode === "north" ? 0 : centre.deg;
  const sunNow = data && hour !== null ? bodyAt(data, "sun", hour) : null;
  const earthNow = data && hour !== null ? bodyAt(data, "earth", hour) : null;

  // ── Vertical range: from the paths and the skyline, unless zoomed ─────────
  const auto = useMemo(
    () =>
      (data || sky) && radii
        ? autoRange({
            skylineEl: sky?.el_deg ?? null,
            sunEl: data?.sun_el ?? null,
            earthEl: data?.earth_el ?? null,
            from: window?.from ?? 0,
            to: window?.to ?? 0,
            sunRadiusDeg: radii.sun,
            earthRadiusDeg: radii.earth,
          })
        : LOADING_RANGE,
    [data, sky, window, radii],
  );
  const [zoom, setZoom] = useState<ElevationRange | null>(null);
  const range = zoom ?? auto;
  const onZoom = useCallback((factor: number, anchor: number) => setZoom((z) => zoomRange(z ?? auto, factor, anchor)), [auto]);
  const onResetZoom = useCallback(() => setZoom(null), []);

  // The chart has a 1 px border on each side.
  const frame = useMemo(() => chartFrame(width - 2), [width]);
  const scales = useMemo(() => chartScales(frame, centreDeg, range), [frame, centreDeg, range]);

  // ── The marker: the caller's when it keeps one, else this view's own ──────
  const [ownMarker, setOwnMarker] = useState<{ azDeg: number } | null>(null);
  const shownMarker = onMarkerChange ? (marker ?? null) : ownMarker;
  const onMark = useCallback(
    (next: { azDeg: number } | null) => (onMarkerChange ? onMarkerChange(next) : setOwnMarker(next)),
    [onMarkerChange],
  );
  const onCentreChange = useCallback((deg: number) => setCentre({ mode: "free", deg }), []);
  const utcOfHour = useCallback(
    (h: number) => {
      if (!grid) return null;
      try {
        return hourIndexToUtc(grid, h);
      } catch {
        return null;
      }
    },
    [grid],
  );

  const label = `Lander's eye, ${name}`;

  // ── States ────────────────────────────────────────────────────────────────
  const failed = [manifest, site, series, skyline].find((r) => r.status === "error");
  if (failed) {
    return (
      <Frame mode={mode} label={label}>
        <div className="pano-state" role="alert">
          <p className="pano-state-title">No horizon data for {name}.</p>
          <p>Its skyline or its Sun and Earth positions did not load, so the chart cannot be drawn. Reload the page to try again.</p>
        </div>
      </Frame>
    );
  }

  if (sphere && mode === "mission") {
    return (
      <Frame mode={mode} label={label}>
        <div className="pano-state">
          <p className="pano-state-title">
            No terrain data for {name}, so its horizon is flat: the Moon there is a smooth sphere.
          </p>
          {onShowSystemView ? (
            <Button icon={<Globe size={14} strokeWidth={1.8} aria-hidden="true" />} onClick={onShowSystemView}>
              Show {name} in the System view
            </Button>
          ) : null}
        </div>
      </Frame>
    );
  }

  const loading = !data || !sky || !grid || !radii;
  // A disc too small to see at its true size is marked by a dashed ring; the legend and the
  // text alternative say so.
  const ringed = loading
    ? []
    : [sunNow, earthNow].filter(
        (b): b is NonNullable<typeof b> => b !== null && needsLocator(discShape(scales, b.azDeg, b.elDeg, radii[b.body])),
      );
  const ringWords = ringed.length ? `${ringed.map((b) => (b.body === "sun" ? "the Sun" : "Earth")).join(" and ")}` : null;
  const answer = loading ? "Loading the horizon." : hour === null ? "No Sun or Earth position is stored for this time." : answerSentence(sunNow, earthNow);
  const showLabels = width >= LABELS_MIN_WIDTH;
  // "Why is it dark?": on a dark or blackout hour, the one-line reason (its "Why?" opens the
  // full card), as in the approved chart card, so the panel leaves the horizon room; on a lit,
  // linked hour, the card's short "Lit and linked" line. Lit and link are the profile's rules
  // applied to the series (docs/science.md §9), never what the chart draws.
  const dark =
    flags.status === "ready" && hour !== null && (flags.data.lit[hour] !== 1 || flags.data.link[hour] !== 1);
  const centreOptions: { mode: CentreMode; label: string; disabled: boolean }[] = [
    { mode: "earth", label: "Earth", disabled: earthMean === null },
    { mode: "sun", label: "Sun", disabled: !sunNow },
    { mode: "north", label: "North", disabled: false },
  ];

  return (
    <Frame mode={mode} label={label}>
      <div className="pano-controls">
        <div className="pano-centre" role="group" aria-label="Centre the view on">
          <span className="pano-centre-label" aria-hidden="true">
            Centre on
          </span>
          <span className="seg seg-quiet">
            {centreOptions.map((option) => (
              <button
                key={option.mode}
                type="button"
                className="seg-option"
                aria-pressed={centre.mode === option.mode}
                disabled={loading || option.disabled}
                onClick={() => {
                  setCentre({ mode: option.mode, deg: option.mode === "sun" && sunNow ? sunNow.azDeg : 0 });
                }}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
        <span className="pano-stretch">
          {stretchWords(scales.stretch)}
          {zoom ? (
            <button type="button" className="pano-reset" aria-label="Reset the vertical stretch" onClick={onResetZoom}>
              Reset
            </button>
          ) : null}
        </span>
      </div>

      <div ref={hostRef} className="pano-host">
        <HorizonChart
          scales={scales}
          skyline={loading ? null : sky}
          series={loading ? null : data}
          window={window}
          hour={loading ? null : hour}
          landingHour={landingHour}
          radii={radii}
          maskDeg={scenario.profile.relay_available ? null : scenario.profile.antenna_mask_deg}
          features={features.status === "ready" ? features.data : NO_FEATURES}
          marker={shownMarker}
          onMark={onMark}
          onCentreChange={onCentreChange}
          onZoom={onZoom}
          onResetZoom={onResetZoom}
          utcOfHour={utcOfHour}
          showLabels={showLabels}
          label={`Horizon chart for ${name}. ${answer}${ringWords ? ` A dashed ring marks ${ringWords}, too small to see at this stretch.` : ""}`}
        />
        {loading ? (
          <p className="pano-loading" role="status">
            Loading the horizon…
          </p>
        ) : null}
      </div>

      {!loading && !showLabels ? (
        <p className="pano-answer" aria-hidden="true">
          {sunNow ? <span className="pano-answer-sun">{bodySentence(sunNow)}</span> : null}
          {earthNow ? <span className="pano-answer-earth">{bodySentence(earthNow)}</span> : null}
        </p>
      ) : null}

      {sphere ? <p className="pano-note">Terrain not modelled. Showing a smooth Moon.</p> : null}

      {/* The legend's lines are drawn with the chart's own strokes, so each reads by its dash
          pattern as well as its colour: dots for the Sun, solid for Earth, long dashes for the
          antenna mask. */}
      <p className="pano-legend">
        <span>
          <Swatch className="pano-track pano-track-sun" dot />
          Sun's path, one dot a day
        </span>
        <span>
          <Swatch className="pano-track pano-track-earth" />
          Earth's path
        </span>
        {scenario.profile.relay_available ? null : (
          <span>
            <Swatch className="pano-mask" />
            Antenna mask above the skyline
          </span>
        )}
        <span>A disc's faded part is below the skyline</span>
        {ringWords ? (
          <span>
            <svg className="pano-sw-svg" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" className={`pano-locator pano-locator-${ringed[0]?.body ?? "sun"}`} />
            </svg>
            A dashed ring marks {ringWords}, too small to see here
          </span>
        ) : null}
      </p>

      {mode === "mission" ? (
        dark ? (
          <WhyDarkLine scenario={scenario} mode={mode} />
        ) : (
          <WhyDarkCard scenario={scenario} mode={mode} />
        )
      ) : null}
    </Frame>
  );
}

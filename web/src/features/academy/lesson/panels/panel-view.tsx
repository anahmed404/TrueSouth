import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { formatNumber, formatUtc } from "../../../../components/format";
import { useLunaReducedMotion } from "../../../../components/luna";
import { useManifest, useSystem } from "../../../../data/hooks";
import { useHourFlags } from "../../../../lib/scoring";
import { hourIndexToUtc } from "../../../../lib/time";
import { HorizonChart } from "../../../panorama/chart";
import { autoRange, chartFrame, chartScales } from "../../../panorama/geometry";
import { answerSentence, heightWords } from "../../../panorama/readings";
import { resolveTimeRange, type HourRange } from "../../drag-body";
import { oneMonth, pipProfile, storyScene } from "../../lessons/story";
import { resolveValue, type WorkedExamples } from "../../placeholders";
import type { PanelId, RevealWhen, SceneSpec } from "../../types";
import { panelName } from "../../ui/panels";
import { hourOnGrid } from "../../utc";
import { DRAWN_EARTH_RADIUS } from "../../../three/scene/proportions";
import { sceneSiteId, useSceneData, type SceneData } from "../scene-data";
import { horizonMoment, monthBands, sunTurnDeg, systemFrames, type SystemFrame } from "./panel-data";

/**
 * A Mission Control panel shown inside a lesson: in a predict step's reveal, and on the
 * lesson-complete screen. Each draws the lesson's own stored data at the lesson's site and
 * moment (panel-data.ts); none is a stand-in. Lander's eye reuses the horizon chart; the
 * System view is a light drawing of the same directions and schematic distances as the 3D
 * view (no 3D is loaded); the timeline draws the month's bands with the timeline's band logic;
 * the countdowns are Mission Control's own, loaded only when shown.
 */

const NOOP = () => undefined;
const NO_FEATURES: never[] = [];

/** The countdowns are Mission Control's component: loaded only on a screen that shows them. */
const CountdownsPanel = lazy(() => import("./countdowns-panel"));

export type PanelViewProps = {
  panel: PanelId;
  /** The scene the panel looks at; null keeps the lesson's story scene. */
  scene: SceneSpec | null;
  /** When it looks: an hour, the month around an hour, or the month of a timeline band. */
  when: RevealWhen | null;
  examples: WorkedExamples;
  caption?: string;
};

function useWidth(fallback: number): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    setWidth(Math.round(node.clientWidth) || fallback);
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, fallback]);
  return [setNode, width];
}

/** The hour a reveal looks at, as UTC: its own hour, or the scene's current time. */
function hourOf(scene: SceneSpec, when: RevealWhen | null, examples: WorkedExamples): string | null {
  const raw = when?.kind === "hour" ? when.utc : when?.kind === "span" ? when.aroundUtc : scene.scenario.currentUtc;
  const value = resolveValue(raw, examples).value;
  return typeof value === "string" ? value : null;
}

export function PanelView({ panel, scene, when, examples, caption }: PanelViewProps) {
  const spec = scene ?? storyScene("terrain", null);
  const siteId = sceneSiteId(spec, examples);
  const utc = hourOf(spec, when, examples);
  const name = panelName(panel);
  if (!siteId || !utc) {
    return (
      <Frame title={name} caption={caption}>
        <Message>This picture needs a worked-example value that is missing, so it cannot be drawn.</Message>
      </Frame>
    );
  }
  switch (panel) {
    case "LandersEye":
      return <HorizonPanel title={name} siteId={siteId} utc={utc} bodies caption={caption} />;
    case "LocalTerrain":
      // Local terrain builds its skyline wall from this skyline; here it is unrolled, all 360°.
      return <HorizonPanel title={name} siteId={siteId} utc={utc} bodies={false} caption={caption} />;
    case "SystemView":
      return <SystemPanel title={name} siteId={siteId} aroundUtc={utc} examples={examples} caption={caption} />;
    case "Timeline":
      return <BandsPanel title={name} siteId={siteId} aroundUtc={utc} examples={examples} caption={caption} />;
    case "Countdowns":
      return (
        <Frame title={name} caption={caption}>
          <Suspense fallback={<Message>Loading the countdowns…</Message>}>
            <CountdownsPanel scene={spec} examples={examples} />
          </Suspense>
        </Frame>
      );
    default:
      return (
        <Frame title={name} caption={caption}>
          <Message>The {name} opens in Mission Control.</Message>
        </Frame>
      );
  }
}

// ── The frame ─────────────────────────────────────────────────────────────────

function Frame({
  title,
  meta,
  caption,
  children,
}: {
  title: string;
  meta?: string;
  caption?: string | undefined;
  children: ReactNode;
}) {
  return (
    <figure className="ac-mcbox">
      <div className="ac-mcbox-h">
        <span>{title}</span>
        {meta ? <span className="ac-mcbox-meta">{meta}</span> : null}
      </div>
      <div className="ac-mcbox-real">{children}</div>
      {caption ? <figcaption className="ac-mcbox-f">{caption}</figcaption> : null}
    </figure>
  );
}

function Message({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <p className="ac-mcbox-note" role={alert ? "alert" : "status"}>
      {children}
    </p>
  );
}

/** The honest words for a site whose stored data did not load. */
function failed(title: string, site: string): ReactNode {
  return (
    <Message alert>
      The {title} could not load {site}'s stored data, so this picture is missing. The words below still hold.
    </Message>
  );
}

function useMonth(examples: WorkedExamples, aroundUtc: string, grid: SceneData["grid"] | null): HourRange | null {
  return useMemo(() => {
    if (!grid) return null;
    const range = resolveTimeRange(oneMonth(aroundUtc), examples, grid);
    return range && !("missing" in range) ? range : null;
  }, [examples, aroundUtc, grid]);
}

// ── Lander's eye (and Local terrain's skyline) ────────────────────────────────

/** The stored skyline's elevations within `halfWidthDeg` of an azimuth: the bins a reveal is about. */
export function skylineNear(elDeg: ArrayLike<number>, centreDeg: number, halfWidthDeg: number): Float32Array {
  const bins = elDeg.length;
  const out: number[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    const az = (bin * 360) / bins;
    const off = Math.abs(((az - centreDeg + 540) % 360) - 180);
    const value = elDeg[bin];
    if (off <= halfWidthDeg && value !== undefined && Number.isFinite(value)) out.push(value);
  }
  return Float32Array.from(out);
}

function HorizonPanel({ title, siteId, utc, bodies, caption }: { title: string; siteId: string; utc: string; bodies: boolean; caption?: string | undefined }) {
  const load = useSceneData(siteId);
  if (load.status === "error") return <Frame title={title} caption={caption}>{failed(title, load.name)}</Frame>;
  if (load.status === "loading") {
    return (
      <Frame title={title} caption={caption}>
        <Message>Loading {load.name}'s horizon…</Message>
      </Frame>
    );
  }
  return <HorizonPicture title={title} data={load.data} utc={utc} bodies={bodies} caption={caption} />;
}

function HorizonPicture({ title, data, utc, bodies, caption }: { title: string; data: SceneData; utc: string; bodies: boolean; caption?: string | undefined }) {
  const hour = hourOnGrid(data.grid, utc);
  const [hostRef, width] = useWidth(360);
  const radii = useMemo(() => ({ sun: data.radii.sun, earth: data.radii.earth }), [data.radii.sun, data.radii.earth]);
  // A day either side of the moment, so the Sun's path shows where it came from and goes.
  const span = useMemo(
    () => (hour === null ? null : { from: Math.max(0, hour - 24), to: Math.min(data.grid.count, hour + 25) }),
    [hour, data.grid.count],
  );
  const moment = hour === null ? { sun: null, earth: null } : horizonMoment(data.series, hour);
  const centreDeg = bodies ? (moment.sun?.azDeg ?? 0) : 0;
  // The step is about the Sun and the ground in front of it: the height scale comes from the
  // Sun's day and the skyline within 45° of it, so a one-degree ridge reads as one. Earth is
  // drawn when it falls inside; the sentence under the chart says where it is either way.
  const near = useMemo(() => (bodies ? skylineNear(data.skyline.el_deg, centreDeg, 45) : data.skyline.el_deg), [bodies, data.skyline.el_deg, centreDeg]);
  const range = useMemo(
    () =>
      autoRange({
        skylineEl: near,
        sunEl: bodies ? data.series.sun_el : null,
        earthEl: null,
        from: span?.from ?? 0,
        to: span?.to ?? 0,
        sunRadiusDeg: radii.sun,
        earthRadiusDeg: radii.earth,
      }),
    [data, bodies, span, radii, near],
  );
  const frame = useMemo(() => chartFrame(width - 2), [width]);
  const scales = useMemo(() => chartScales(frame, centreDeg, range), [frame, centreDeg, range]);
  const utcOf = useCallback((h: number) => {
    try {
      return hourIndexToUtc(data.grid, h);
    } catch {
      return null;
    }
  }, [data.grid]);

  const said = bodies ? answerSentence(moment.sun, moment.earth) : "The skyline all round Pip, unrolled from north through east, south and west.";
  const alt = `${title} at ${data.name}${bodies ? `, ${formatUtc(utc)}` : ""}. ${said}`;
  return (
    <Frame title={title} meta={bodies ? `${data.name} · ${formatUtc(utc)}` : data.name} caption={caption}>
      <div ref={hostRef} className="ac-mcbox-chart">
        <HorizonChart
          scales={scales}
          skyline={data.skyline}
          series={bodies ? data.series : null}
          window={bodies ? span : null}
          hour={bodies ? hour : null}
          landingHour={span?.from ?? null}
          radii={radii}
          maskDeg={null}
          features={NO_FEATURES}
          marker={null}
          onMark={NOOP}
          onCentreChange={NOOP}
          onZoom={NOOP}
          onResetZoom={NOOP}
          utcOfHour={utcOf}
          showLabels={false}
          label={alt}
          interactive={false}
        />
      </div>
      {bodies ? <p className="ac-mcbox-read" aria-hidden="true">{said}</p> : null}
    </Frame>
  );
}

// ── System view: the Sun and Earth around the Moon over the month ────────────

/** How long the month plays, in milliseconds. */
const PLAY_MS = 6000;

function SystemPanel({
  title,
  siteId,
  aroundUtc,
  examples,
  caption,
}: {
  title: string;
  siteId: string;
  aroundUtc: string;
  examples: WorkedExamples;
  caption?: string | undefined;
}) {
  const system = useSystem();
  const manifest = useManifest();
  const site = useSceneData(siteId);
  const grid = manifest.status === "ready" ? manifest.data.time_grid : null;
  const range = useMonth(examples, aroundUtc, grid);
  if (site.status === "error" || manifest.status === "error") return <Frame title={title} caption={caption}>{failed(title, site.status === "error" ? site.name : "the time grid")}</Frame>;
  if (system.status === "error") {
    return (
      <Frame title={title} caption={caption}>
        <Message alert>
          The {title} could not load the positions of the Sun and Earth around the Moon, so this picture is missing. The words below still hold.
        </Message>
      </Frame>
    );
  }
  if (system.status !== "ready" || site.status !== "ready" || !grid) {
    return (
      <Frame title={title} caption={caption}>
        <Message>Loading where the Sun and Earth are…</Message>
      </Frame>
    );
  }
  if (!range) {
    return (
      <Frame title={title} caption={caption}>
        <Message>This month is not on the stored time grid, so it cannot be drawn.</Message>
      </Frame>
    );
  }
  return <SystemPicture title={title} system={system.data} site={site.data} range={range} caption={caption} />;
}

const VIEW = 260;
const C = VIEW / 2;
/** Pixels per Moon radius: Earth, drawn three to four Moon radii out, sits well inside the frame. */
const MOON_PX = 22;
const SUN_RING = C - 18;

function point(angleDeg: number, radius: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [C + radius * Math.sin(a), C - radius * Math.cos(a)];
}

function SystemPicture({
  title,
  system,
  site,
  range,
  caption,
}: {
  title: string;
  system: Parameters<typeof systemFrames>[0];
  site: SceneData;
  range: HourRange;
  caption?: string | undefined;
}) {
  const reduced = useLunaReducedMotion();
  const frames = useMemo(() => systemFrames(system, range), [system, range]);
  const turn = useMemo(() => sunTurnDeg(system, range), [system, range]);
  const last = frames.length - 1;
  // Played once on arrival, quietly, unless motion is reduced; then the whole month shows.
  const [at, setAt] = useState(reduced ? last : 0);
  const raf = useRef<number | null>(null);
  const play = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / PLAY_MS);
      setAt(Math.round(t * last));
      raf.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    raf.current = requestAnimationFrame(tick);
  }, [last]);
  useEffect(() => {
    if (!reduced) play();
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [reduced, play]);

  const frame: SystemFrame | undefined = frames[Math.max(0, Math.min(at, last))];
  const shown = frames.slice(0, at + 1);
  // The trace is drawn in short pieces so a jump across north does not draw a chord.
  const sunPath = shown
    .map((f, index) => {
      const [x, y] = point(f.sunAngleDeg, SUN_RING);
      const prev = shown[index - 1];
      const jump = prev ? Math.abs(((f.sunAngleDeg - prev.sunAngleDeg + 540) % 360) - 180) > 60 : true;
      return `${jump ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");
  const sunEl = frame ? site.series.sun_el[frame.hour] : undefined;
  const when = frame ? hourIndexToUtc(site.grid, frame.hour) : null;
  const first = hourIndexToUtc(site.grid, range.fromIndex);
  const end = hourIndexToUtc(site.grid, range.toIndex);
  const alt = `${title}, seen from below my south pole, from ${formatUtc(first)} to ${formatUtc(end)}: the Sun's direction turns ${formatNumber(turn, 0)}°, all the way round; Earth stays on one side, about ${formatNumber(frame?.earthDistance ?? Number.NaN, 1)} Moon radii out as the System view draws it (not to scale).`;
  const [sx, sy] = frame ? point(frame.sunAngleDeg, SUN_RING) : [C, 0];
  return (
    <Frame title={title} meta={`${site.name} · one month`} caption={caption}>
      <div className="ac-system">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label={alt}>
          <circle cx={C} cy={C} r={SUN_RING} className="ac-system-ring" />
          <text x={C} y={14} textAnchor="middle" className="ac-system-tick">
            0°
          </text>
          <text x={VIEW - 2} y={C + 16} textAnchor="end" className="ac-system-tick">
            90° E
          </text>
          <path d={sunPath} className="ac-system-sun-trace" />
          {shown.map((f) => (
            <circle key={f.hour} cx={C + f.earthX * MOON_PX} cy={C - f.earthY * MOON_PX} r={1.2} className="ac-system-earth-trace" />
          ))}
          <circle cx={C} cy={C} r={MOON_PX} className="ac-system-moon" />
          <circle cx={C} cy={C} r={2.5} className="ac-system-pip" />
          {frame ? (
            <>
              <line x1={C} y1={C} x2={sx} y2={sy} className="ac-system-sun-ray" />
              <circle cx={sx} cy={sy} r={7} className="ac-system-sun" />
              <circle cx={C + frame.earthX * MOON_PX} cy={C - frame.earthY * MOON_PX} r={MOON_PX * DRAWN_EARTH_RADIUS} className="ac-system-earth" />
            </>
          ) : null}
        </svg>
        <div className="ac-system-side">
          <p className="ac-system-when">{when ? formatUtc(when) : ""}</p>
          <p>
            <span className="ac-system-key ac-system-key--sun" aria-hidden="true" />
            Sun {sunEl !== undefined && Number.isFinite(sunEl) ? heightWords(sunEl) : "—"} at Pip
          </p>
          <p>
            <span className="ac-system-key ac-system-key--earth" aria-hidden="true" />
            Earth
          </p>
          <p className="ac-system-note">Seen from below my south pole, Pip at the centre. Not to scale: the Sun is far beyond the ring.</p>
          <button type="button" className="ac-btn ac-btn--secondary ac-btn--compact" onClick={play}>
            <Play aria-hidden="true" />
            Play the month
          </button>
        </div>
      </div>
    </Frame>
  );
}

// ── Timeline: the month's bands ──────────────────────────────────────────────

function BandsPanel({
  title,
  siteId,
  aroundUtc,
  examples,
  caption,
}: {
  title: string;
  siteId: string;
  aroundUtc: string;
  examples: WorkedExamples;
  caption?: string | undefined;
}) {
  const site = useSceneData(siteId);
  const flags = useHourFlags(siteId, pipProfile);
  const grid = site.status === "ready" ? site.data.grid : null;
  const range = useMonth(examples, aroundUtc, grid);
  const name = site.status === "ready" ? site.data.name : site.name;
  if (site.status === "error" || flags.status === "error") return <Frame title={title} caption={caption}>{failed(title, name)}</Frame>;
  if (site.status !== "ready" || flags.status !== "ready") {
    return (
      <Frame title={title} caption={caption}>
        <Message>Loading {name}'s month…</Message>
      </Frame>
    );
  }
  if (!range) {
    return (
      <Frame title={title} caption={caption}>
        <Message>This month is not on the stored time grid, so it cannot be drawn.</Message>
      </Frame>
    );
  }
  return <BandsPicture title={title} data={site.data} lit={flags.data.lit} range={range} caption={caption} />;
}

function BandsPicture({ title, data, lit, range, caption }: { title: string; data: SceneData; lit: ArrayLike<number>; range: HourRange; caption?: string | undefined }) {
  const bands = useMemo(() => monthBands(data.series, { lit }, range), [data.series, lit, range]);
  const [hostRef, width] = useWidth(340);
  const left = 52;
  const right = width - 8;
  const span = range.toIndex + 1 - range.fromIndex;
  const x = (hour: number) => left + ((hour - range.fromIndex) / span) * (right - left);
  const row = 22;
  const earthPct = (100 * bands.earthUpHours) / bands.hours;
  const first = hourIndexToUtc(data.grid, range.fromIndex).slice(0, 10);
  const last = hourIndexToUtc(data.grid, range.toIndex).slice(0, 10);
  // A percentage is written as the lesson's text writes one: whole numbers (format-example.ts).
  const alt = `${title} for ${data.name} over ${bands.hours} hours from ${first} to ${last}: Earth is in Pip's sky for ${bands.earthUpHours} of them, about ${formatNumber(earthPct, 0)}%; the Sun lights Pip by the mission's rule for ${bands.litHours}.`;
  return (
    <Frame title={title} meta={`${data.name} · one month`} caption={caption}>
      <div ref={hostRef} className="ac-bands">
        <svg width={width} height={row * 2 + 34} role="img" aria-label={alt}>
          <text x={0} y={row - 6} className="ac-bands-label">
            Sun
          </text>
          <rect x={left} y={2} width={right - left} height={row - 4} className="ac-bands-well" />
          {bands.sun.map((s) => {
            const h = (row - 4) * s.level;
            return <rect key={`s${s.from}`} x={x(s.from)} y={row - 2 - h} width={Math.max(0.5, x(s.to) - x(s.from))} height={h} className="ac-bands-sun" />;
          })}
          <text x={0} y={row * 2 - 2} className="ac-bands-label">
            Earth
          </text>
          <rect x={left} y={row + 4} width={right - left} height={row - 4} className="ac-bands-well" />
          {bands.earth.map((s) => (
            <rect key={`e${s.from}`} x={x(s.from)} y={row + 4} width={Math.max(0.5, x(s.to) - x(s.from))} height={row - 4} className="ac-bands-earth" />
          ))}
          <text x={left} y={row * 2 + 22} className="ac-bands-tick">
            {first}
          </text>
          <text x={right} y={row * 2 + 22} textAnchor="end" className="ac-bands-tick">
            {last}
          </text>
        </svg>
        <p className="ac-mcbox-read" aria-hidden="true">
          Earth in Pip's sky {bands.earthUpHours} of {bands.hours} hours, about {formatNumber(earthPct, 0)}%. Sun band: hours lit by the mission's rule, as tall as the share of the disc that shows.
        </p>
      </div>
    </Frame>
  );
}

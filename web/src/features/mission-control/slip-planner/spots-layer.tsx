import { X } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore } from "zustand";
import type { FreeSpace, SceneMode, SceneProjector, ScreenPoint } from "../../../app/scene";
import type { Scenario } from "../../../app/panel";
import { scoreText } from "../../../app/mission/rules";
import { Button, IconButton } from "../../../components/Button";
import { GLYPH, StatusLamp, type Status } from "../../../components/StatusLamp";
import type { Site } from "../../../contracts/generated";
import { useManifest, useSites } from "../../../data";
import { MapCore } from "../../polar-map/map";
import type { MapProjector } from "../../polar-map";
import { MOON_RADIUS_M } from "../../../lib/geo";
import { utcToHourIndex } from "../../../lib/time";
import { inSlipView } from "../../three/scene/slip";
import {
  bestSite,
  changed as changedResult,
  offViewWhere,
  resultStatus,
  slipSummary,
  spotPriority,
  VARIANT_NAME,
  variantLine,
  variantMetres,
  variantOf,
  type SiteResult,
} from "./model";
import { placeLabels, placeSpots, type Box } from "./placement";
import { spotReason } from "./readout";
import { comparisonHour, slipStore } from "./slip-store";
import { useEvaluate } from "./landing-results";
import "./slip-planner.css";

/** The shading's label, whenever it is on (slip-planner.md, "Honesty"). */
export const SHADING_LABEL = "NASA's average sunlight over 18.6 years, not for your date";
/** The same, when the free space is too small for the view's controls. */
export const SHADING_LABEL_SHORT = "NASA's long-term average sunlight, not for your date";

/**
 * What the foot of the free space shows: the view's controls (the switch and, with the
 * shading on, its label), or, when the free space is under 220 × 48 px, no controls but
 * still the short label while the shading is on. The shading is never on without words.
 */
export function footFor(freeSpace: Pick<FreeSpace, "width" | "height">, shading: boolean): { controls: boolean; label: string | null } {
  const small = freeSpace.width < 220 || freeSpace.height < 48;
  if (!small) return { controls: true, label: shading ? SHADING_LABEL : null };
  return { controls: false, label: shading ? SHADING_LABEL_SHORT : null };
}
export const FLAT_NOTE =
  "3D is off, so your sites are shown on the flat Polar map. The spots, the landing dates and the panels work as in 3D.";

/** The flat map places none of its own pins here: the spots are the Slip Planner's. */
const NO_SITES: readonly Site[] = [];

export type SlipPlannerSceneProps = {
  /** The scene's projector while it draws in 3D; null without it. */
  projector: SceneProjector | null;
  reduceMotion: boolean;
  mode: SceneMode;
  /** True when 3D is slow and "Try 3D anyway" can help. */
  canTryAgain: boolean;
  onTryAgain: () => void;
  freeSpace: FreeSpace;
  scenario: Scenario;
  phone: boolean;
  onFocusSite: (siteId: string) => void;
};

type SpotModel = {
  site: Site;
  now: SiteResult;
  before: SiteResult | null;
  changed: boolean;
  best: boolean;
  focused: boolean;
  parent: Site | null;
  variantText: string | null;
  priority: number;
};

/** The status, or what stands in for it: "computing", "could not compute", "no data". */
function statusWord(result: SiteResult): string {
  if (result.kind === "ready") return result.evaluation.status;
  if (result.kind === "pending") return "computing";
  if (result.kind === "failed") return "could not compute";
  return "no data";
}

function statusClass(result: SiteResult): string {
  const status = resultStatus(result);
  return status === "GO" ? "go" : status === "CAUTION" ? "caution" : status === "NO-GO" ? "nogo" : "none";
}

/**
 * The Slip Planner over the scene (docs/features/slip-planner.md, "Spots"): one spot per
 * selected site, its status and score for the landing date read from the slip sweep, the
 * close-sites rules, the off-view notes, the before-and-after plate and the view's controls.
 * In 3D the spots follow the scene's camera through its projector; with 3D off they sit on
 * the flat Polar map (features/polar-map, `MapCore`) through the map's projector: no pins or
 * crater names of its own, none of its readouts, and NASA's average sunlight following the
 * shading switch.
 */
export function SlipPlannerScene(props: SlipPlannerSceneProps) {
  const { scenario, freeSpace, phone, mode, projector, onFocusSite } = props;
  const manifest = useManifest();
  const sitesData = useSites();
  const catalog = sitesData.status === "ready" ? sitesData.data : null;
  // The rail's own evaluation (landing-results.ts): a spot always equals the sites rail, for
  // the current profile and sites, whether or not the slip sweep has finished.
  const evaluate = useEvaluate(scenario.siteIds, scenario.profile);
  const ui = useStore(slipStore);
  const grid = manifest.status === "ready" ? manifest.data.time_grid : null;
  let landingHour = -1;
  if (grid) {
    try {
      landingHour = utcToHourIndex(grid, scenario.landingUtc);
    } catch {
      landingHour = -1;
    }
  }
  const fromHour = landingHour >= 0 ? comparisonHour(ui, landingHour) : null;
  const flat = mode === "flat";
  const [mapProjector, setMapProjector] = useState<MapProjector | null>(null);
  // What the spots follow: the scene's camera in 3D, the flat map with 3D off.
  const source: SceneProjector | MapProjector | null = flat ? mapProjector : projector;

  const selected = useMemo(
    () => scenario.siteIds.map((id) => catalog?.find((s) => s.id === id)).filter((s): s is Site => Boolean(s)),
    [scenario.siteIds, catalog],
  );

  // Each site's result now and, after a slip, before it.
  const models = useMemo((): SpotModel[] => {
    const nows = selected.map((site) => ({
      siteId: site.id,
      result: landingHour >= 0 ? evaluate(site.id, landingHour) : ({ kind: "pending" } as SiteResult),
    }));
    const best = fromHour !== null ? bestSite(nows) : null;
    return selected.map((site, i) => {
      const now = nows[i]!.result;
      const before = fromHour !== null ? evaluate(site.id, fromHour) : null;
      const changed = before ? changedResult(before, now) : false;
      const parentId = variantOf(site);
      const parent = parentId ? (catalog?.find((s) => s.id === parentId) ?? null) : null;
      const focused = site.id === scenario.focusedSiteId;
      const isBest = best?.siteId === site.id;
      return {
        site,
        now,
        before,
        changed,
        best: isBest,
        focused,
        parent,
        variantText: parent ? variantLine(variantMetres(site, parent, MOON_RADIUS_M), parent.name) : null,
        priority: spotPriority({ focused, best: isBest, changed, variant: Boolean(parentId) }),
      };
    });
  }, [selected, evaluate, landingHour, fromHour, scenario.focusedSiteId, catalog]);

  const onMap = models.filter((m) => inSlipView(m.site));
  const offView = models.filter((m) => !inSlipView(m.site));

  const summary =
    fromHour !== null && grid
      ? slipSummary({
          fromHour,
          toHour: landingHour,
          gridStartMs: Date.parse(grid.start_utc),
          sites: models.map((m) => ({ siteId: m.site.id, name: m.site.name, before: m.before ?? { kind: "pending" }, after: m.now })),
          scoreText,
        })
      : null;

  // ── Placement: written straight to the elements, after every frame and every render ──
  const layerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const leadersRef = useRef<SVGSVGElement>(null);
  const spotRefs = useRef(new Map<string, HTMLButtonElement>());
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ onMap, freeSpace, phone, source, flat });
  latest.current = { onMap, freeSpace, phone, source, flat };

  const mapFrame = useMemo(
    () => ({ x: freeSpace.x, y: freeSpace.y, width: freeSpace.width, height: freeSpace.height }),
    [freeSpace.x, freeSpace.y, freeSpace.width, freeSpace.height],
  );

  const place = useCallback(() => {
    const { onMap: list, freeSpace: fs, phone: onPhone, source: from } = latest.current;
    // Until the scene or the map gives its projector, no spot is placed.
    const project = (lat: number, lon: number): ScreenPoint => (from ? from.project(lat, lon) : { x: 0, y: 0, visible: false });
    const scale = onPhone ? 44 / 32 : 1;
    const radius = 15 * scale;
    const inside = (p: ScreenPoint) => p.visible && p.x >= fs.x - 4 && p.x <= fs.x + fs.width + 4 && p.y >= fs.y - 4 && p.y <= fs.y + fs.height + 4;
    const points = list.map((m) => {
      const p = project(m.site.lat_deg, m.site.lon_deg);
      return { id: m.site.id, x: p.x, y: p.y, visible: inside(p), priority: m.priority, variant: Boolean(m.parent) };
    });
    const placed = placeSpots(points, scale);
    const order = [...list].sort((a, b) => b.priority - a.priority);
    const shown = placed.filter((p) => p.visible);
    // With 3D off the flat map has its own control plate at the foot of the free space (zoom,
    // scale and the sunlight legend): ours sit just above it, never under it.
    const footEl = footRef.current;
    if (footEl) {
      const mapFoot = latest.current.flat ? layerRef.current?.querySelector(".slip-flat-map .pm-foot") : null;
      const mapTop = mapFoot ? mapFoot.getBoundingClientRect() : null;
      footEl.style.top = mapTop && mapTop.height > 0 ? `${(mapTop.top - 8).toFixed(1)}px` : "";
    }
    // Labels keep clear of the plates at the top (notes) and the foot (summary, controls).
    const topPlates = topRef.current?.getBoundingClientRect();
    const footPlates = footRef.current?.getBoundingClientRect();
    const bounds: Box = {
      l: fs.x + 6,
      r: fs.x + fs.width - 6,
      t: Math.max(fs.y + 6, topPlates && topPlates.height > 0 ? topPlates.bottom + 4 : 0),
      b: Math.min(fs.y + fs.height - 6, footPlates && footPlates.height > 0 ? footPlates.top - 4 : Infinity),
    };
    // Measure each label while shown, then place them in priority order.
    const labels = order
      .map((m) => {
        const spot = placed.find((p) => p.id === m.site.id);
        const el = labelRefs.current.get(m.site.id);
        if (!spot?.visible || !el) return null;
        el.hidden = false;
        return { id: m.site.id, x: spot.x, y: spot.y, w: el.offsetWidth || 120, h: el.offsetHeight || 22 };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    const labelPlaces = placeLabels(labels, shown, radius, bounds);

    let svg = "";
    for (const spot of placed) {
      const el = spotRefs.current.get(spot.id);
      if (!el) continue;
      el.style.visibility = spot.visible ? "visible" : "hidden";
      if (!spot.visible) {
        const label = labelRefs.current.get(spot.id);
        if (label) label.hidden = true;
        continue;
      }
      el.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -50%)`;
      if (spot.moved) {
        const a = Math.atan2(spot.y - spot.ay, spot.x - spot.ax);
        const ex = spot.x - Math.cos(a) * (radius - 1);
        const ey = spot.y - Math.sin(a) * (radius - 1);
        const line = `x1="${spot.ax.toFixed(1)}" y1="${spot.ay.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"`;
        svg += `<line ${line} class="slip-lead-under"/><line ${line} class="slip-lead"/><circle cx="${spot.ax.toFixed(1)}" cy="${spot.ay.toFixed(1)}" r="2.6" class="slip-true"/>`;
      }
    }
    for (const lp of labelPlaces) {
      const el = labelRefs.current.get(lp.id);
      const button = spotRefs.current.get(lp.id);
      if (!el) continue;
      if (lp.kind === "hidden") {
        el.hidden = true;
        // Lamp alone: its name is on hover.
        if (button) button.title = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
        continue;
      }
      if (button) button.removeAttribute("title");
      el.hidden = false;
      el.style.transform = `translate(${lp.box.l.toFixed(1)}px, ${lp.box.t.toFixed(1)}px)`;
      if (lp.kind === "callout") {
        const line = `x1="${lp.from.x.toFixed(1)}" y1="${lp.from.y.toFixed(1)}" x2="${lp.anchor.x.toFixed(1)}" y2="${lp.anchor.y.toFixed(1)}"`;
        svg += `<line ${line} class="slip-lead-under"/><line ${line} class="slip-lead"/>`;
      }
    }
    if (leadersRef.current) leadersRef.current.innerHTML = svg;

    // The hover readout sits above its spot, inside the free space.
    const tip = hoverRef.current;
    const hovered = placed.find((p) => p.id === hoverId.current && p.visible);
    if (tip) {
      tip.hidden = !hovered;
      if (hovered) {
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        const x = Math.min(Math.max(hovered.x - w / 2, bounds.l), bounds.r - w);
        const above = hovered.y - radius - 8 - h;
        const y = above >= bounds.t ? above : hovered.y + radius + 8;
        tip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }
  }, []);
  const hoverId = useRef<string | null>(null);
  hoverId.current = hover;

  useLayoutEffect(() => {
    place();
  });
  useLayoutEffect(() => {
    if (!source) return;
    place();
    return source.subscribe(place);
  }, [source, place]);

  const hovered = hover ? models.find((m) => m.site.id === hover) : null;
  const fsFoot: CSSProperties = {
    left: freeSpace.x + freeSpace.width / 2,
    top: freeSpace.y + freeSpace.height - 8,
    maxWidth: Math.max(0, Math.min(freeSpace.width - 16, 720)),
  };
  const foot = footFor(freeSpace, ui.shading);
  const tiny = !foot.controls;

  return (
    <div ref={layerRef} className="slip-layer" data-phone={phone} data-flat={flat}>
      {flat ? (
        <div className="slip-flat-map">
          <MapCore
            scenario={scenario}
            mode="mission"
            frame={mapFrame}
            openAt={null}
            active={!freeSpace.windowOpen}
            reduceMotion={props.reduceMotion}
            sites={NO_SITES}
            showFeatureNames={false}
            overlay={ui.shading ? "sunlight" : "none"}
            readouts={false}
            onProjector={setMapProjector}
          />
        </div>
      ) : null}
      <svg ref={leadersRef} className="slip-leaders" aria-hidden="true" />
      {onMap.map((m) => (
        <Spot
          key={m.site.id}
          model={m}
          refFor={(el) => {
            if (el) spotRefs.current.set(m.site.id, el);
            else spotRefs.current.delete(m.site.id);
          }}
          onFocus={onFocusSite}
          onHover={setHover}
        />
      ))}
      {onMap.map((m) => (
        <SpotLabel
          key={m.site.id}
          model={m}
          refFor={(el) => {
            if (el) labelRefs.current.set(m.site.id, el);
            else labelRefs.current.delete(m.site.id);
          }}
        />
      ))}
      <div ref={hoverRef} className="plate slip-hover" hidden aria-hidden="true">
        {hovered ? <HoverText model={hovered} /> : null}
      </div>

      {tiny ? null : (
        <>
          <div ref={topRef} className="slip-top" style={{ left: freeSpace.x + 8, top: freeSpace.y + 8, maxWidth: Math.max(0, freeSpace.width - 16) }}>
            {flat ? (
              <div className="plate slip-note" role="note">
                <p>{FLAT_NOTE}</p>
                {props.canTryAgain ? <Button onClick={props.onTryAgain}>Try 3D anyway</Button> : null}
              </div>
            ) : null}
            {onMap.length === 0 && models.length > 0 ? (
              <p className="plate slip-note">None of your sites is near the south pole, so this view has no spots. Their landing dates are below.</p>
            ) : null}
            {models.length === 0 ? <p className="plate slip-note">Add a site to see it here. The Polar map is where you pick one.</p> : null}
            {offView.map((m) => (
              <OffViewNote key={m.site.id} model={m} onFocus={onFocusSite} />
            ))}
          </div>

          <div ref={footRef} className="slip-foot" style={fsFoot}>
            {summary ? (
              <div className="plate slip-summary" role="status">
                <p>{summary}</p>
                <IconButton
                  label="Clear the comparison"
                  icon={<X size={14} strokeWidth={1.8} />}
                  onClick={() => slipStore.getState().clearComparison(landingHour)}
                />
              </div>
            ) : null}
            <div className="plate slip-controls">
              <button
                type="button"
                className="tl-switch"
                aria-pressed={ui.shading}
                onClick={() => slipStore.getState().setShading(!ui.shading)}
              >
                <span className="tl-switch-track" aria-hidden="true" />
                Average sunlight
              </button>
              {/* With 3D off the map's own legend says it: "an 18.6-year average, not for your date". */}
              {foot.label && !flat ? <span className="slip-shading-label">{foot.label}</span> : null}
            </div>
          </div>
        </>
      )}
      {tiny && foot.label ? (
        <p className="plate slip-shading-short" style={fsFoot}>
          {foot.label}
        </p>
      ) : null}
    </div>
  );
}

const Spot = memo(function Spot({
  model,
  refFor,
  onFocus,
  onHover,
}: {
  model: SpotModel;
  refFor: (el: HTMLButtonElement | null) => void;
  onFocus: (siteId: string) => void;
  onHover: (siteId: string | null) => void;
}) {
  const { site, now, before, changed, best, focused } = model;
  const reason = spotReason(now);
  const label = [
    site.name,
    statusWord(now),
    reason,
    changed && before ? `was ${statusWord(before)}` : null,
    best ? "best on this date" : null,
    model.variantText ? `${model.variantText}, chosen by TrueSouth` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      ref={refFor}
      type="button"
      tabIndex={-1}
      className={`slip-spot is-${statusClass(now)}`}
      data-site={site.id}
      data-focused={focused}
      aria-label={label}
      onClick={() => onFocus(site.id)}
      onPointerEnter={() => onHover(site.id)}
      onPointerLeave={() => onHover(null)}
    >
      <SpotGlyph result={now} focused={focused} />
    </button>
  );
});

/** The spot, variant a: a Night disc, the score track and arc, the status lamp; the focus ring outside. */
export function SpotGlyph({ result, focused }: { result: SiteResult; focused: boolean }) {
  const status: Status | null = resultStatus(result);
  const score = result.kind === "ready" && status !== "NO-GO" ? Math.max(0, Math.min(100, result.evaluation.score)) : null;
  return (
    <svg className="slip-spot-svg" viewBox="-16 -16 32 32" aria-hidden="true" focusable="false">
      <circle r={focused ? 18.6 : 13.5} className="spot-back" />
      <circle r={12} className="spot-track" />
      {score !== null ? <circle r={12} className="spot-arc" pathLength={100} strokeDasharray={`${score} 100`} transform="rotate(-90)" /> : null}
      <circle r={8} className="spot-disc" />
      {status ? <path d={GLYPH[status]} className="spot-glyph" transform="translate(-6 -6) scale(0.5)" /> : <circle r={2} className="spot-none" />}
      {focused ? <circle r={17.5} className="spot-focus" /> : null}
    </svg>
  );
}

const SpotLabel = memo(function SpotLabel({ model, refFor }: { model: SpotModel; refFor: (el: HTMLDivElement | null) => void }) {
  const { site, now, before, changed, best, focused } = model;
  const loud = focused || best || changed;
  const status = resultStatus(now);
  return (
    <div ref={refFor} className="plate slip-label" data-focused={focused} aria-hidden="true" hidden>
      <span className="slip-label-main">
        <b>{model.parent ? VARIANT_NAME : site.name}</b>
        {loud && status ? <span className={`slip-word is-${statusClass(now)}`}>{status}</span> : null}
        {best ? <span className="slip-best">best</span> : null}
      </span>
      {model.variantText ? (
        <small>
          {model.variantText.replace(`${VARIANT_NAME}, `, "")} <span className="tag tag-chosen">chosen by TrueSouth</span>
        </small>
      ) : null}
      {focused || changed ? <small>{spotReason(now)}</small> : null}
      {changed && before ? (
        <small className="slip-was">
          was {resultStatus(before) ? <StatusLamp status={resultStatus(before)!} size="xs" /> : null}
          {statusWord(before)}
        </small>
      ) : null}
    </div>
  );
});

function HoverText({ model }: { model: SpotModel }) {
  const { site, now } = model;
  const status = resultStatus(now);
  return (
    <>
      <p className="slip-hover-title">{site.name}</p>
      {status ? (
        <p className="slip-hover-status">
          <StatusLamp status={status} size="xs" />
          {status}
          {now.kind === "ready" && status !== "NO-GO" ? <span className="tabular"> · score {scoreText(now.evaluation.score)}</span> : null}
        </p>
      ) : null}
      <p>{now.kind === "ready" && status === "NO-GO" ? `${spotReason(now)}. Score ${scoreText(now.evaluation.score)} not used.` : spotReason(now)}</p>
    </>
  );
}

function OffViewNote({ model, onFocus }: { model: SpotModel; onFocus: (siteId: string) => void }) {
  const { site, now, before, changed, focused } = model;
  const status = resultStatus(now);
  const where = `${offViewWhere(site.lat_deg)}, far off this view`;
  return (
    <button
      type="button"
      tabIndex={-1}
      className="plate slip-off"
      data-site={site.id}
      data-focused={focused}
      aria-label={`${site.name}, ${statusWord(now)}. ${where[0]?.toUpperCase()}${where.slice(1)}.`}
      onClick={() => onFocus(site.id)}
    >
      {status ? <StatusLamp status={status} size="xs" /> : <span className="lamp-none" aria-hidden="true" />}
      <span>
        <b>{site.name}</b> <span className={`slip-word is-${statusClass(now)}`}>{statusWord(now)}</span>
        {changed && before ? <small className="slip-was"> was {statusWord(before)}</small> : null}
        <small className="slip-off-where">
          {where[0]?.toUpperCase()}
          {where.slice(1)}
          {site.terrain_tier === "sphere" ? ". Terrain not modelled" : ""}
        </small>
      </span>
    </button>
  );
}

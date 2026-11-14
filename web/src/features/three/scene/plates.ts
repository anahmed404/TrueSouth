import type { CameraViewId } from "../../../app/scene";
import type { HourFlags } from "../../../lib/scoring";
import { explanations } from "../../../lib/explain";
import { sightState } from "./sight";

/**
 * What the scene may draw and which plain-words plates it shows, from the load state of each
 * file it reads. Nothing made up is ever drawn as data: without `system.bin` there is no Sun,
 * no Earth and no distance; without the focused site's series there are no sight-lines and no
 * state words; a failed terrain file shows the smooth Moon, and says so.
 */

export type LoadState = "loading" | "ready" | "error";

export type PlateInput = {
  view: CameraViewId;
  trueScale: boolean;
  /** `system.bin` and the time grid, so the current hour's row can be read. */
  system: LoadState;
  /** The focused site, or null when none is focused. */
  site: { name: string; sphere: boolean; tier?: "core80" | "wide240" | "sphere" } | null;
  /**
   * NASA's 5 m close-up of the site: "ready" only when it is drawn (closeup-ground.ts),
   * "none" when the site has none. Optional: absent means none.
   */
  closeup?: LoadState | "none";
  /** The focused site's series and its hour flags. */
  series: LoadState;
  /** The focused site's `terrain.bin`. Ignored for a sphere-tier site, which has none. */
  terrain: LoadState;
  /**
   * The focused site's apron. Ignored for a sphere-tier site. "none": the site has no apron by
   * design (a custom site): the 20 km patch is drawn alone and nothing is reported missing.
   */
  apron: LoadState | "none";
  /**
   * For a site with no apron by design: the global height map its surroundings are drawn
   * from (custom-apron.ts). Ignored otherwise.
   */
  surroundings?: "idle" | "loading" | "ready" | "failed";
  /**
   * The series' answer for the Sun at the current hour (its hour flag and disc fraction), or
   * null while it is not in. Optional: without it the decoration plate says only what is drawn.
   */
  sun?: { lit: boolean; discFraction: number } | null;
};

export type Plate = {
  id: string;
  text: string;
  /** A second, quieter line. */
  note?: string;
  /** At the foot of the free space, above the view's controls, instead of at the top. */
  place?: "foot";
  /** A button on the plate: back to the System view. */
  action?: "show-system";
  /** Announced politely, for a state that will change by itself. */
  status?: boolean;
};

export type SceneContent = {
  /** The Sun and Earth, their labels, the Sun's marker and its distance. */
  bodies: boolean;
  /** The focused site's sight-lines and their state plates. */
  sightLines: boolean;
  /** The ground around the focused site: its own terrain, the smooth Moon, or none yet. */
  ground: "terrain" | "smooth" | "none";
  /** The plates at the top of the free space, in order. */
  plates: Plate[];
};

function groundView(view: CameraViewId): boolean {
  return view === "terrain" || view === "panorama";
}

export function sceneContent(input: PlateInput): SceneContent {
  const { view, site } = input;
  const plates: Plate[] = [];
  const bodies = input.system === "ready";
  const sightLines = Boolean(site) && input.series === "ready";

  if (input.system === "error") {
    plates.push({ id: "system-error", text: "The positions of the Sun and Earth could not be loaded, so they are not drawn." });
  }

  let ground: SceneContent["ground"] = "none";
  if (groundView(view)) {
    if (!site) {
      plates.push({ id: "no-site", text: "Pick a site in the sites rail to see its ground." });
    } else if (site.sphere) {
      ground = "smooth";
      plates.push({ id: "sphere", text: `No terrain data for ${site.name}. This is the smooth Moon.`, action: "show-system" });
    } else if (input.terrain === "error") {
      ground = "smooth";
      plates.push({ id: "terrain-error", text: `The terrain for ${site.name} could not be loaded. Showing the smooth Moon.` });
    } else if (input.terrain === "loading") {
      plates.push({ id: "terrain-loading", text: `Loading the ground around ${site.name}…`, status: true });
    } else {
      ground = "terrain";
      if (input.apron === "none") {
        // No apron by design (a custom site): not an error. Its surroundings are drawn from
        // the coarse global height map (custom-apron.ts), and the plate says so, quietly; if
        // that map cannot be read, only the patch is drawn, and the plate says that instead.
        const surroundings = input.surroundings ?? "idle";
        if (surroundings === "ready") plates.push({ id: "surroundings", text: explanations.custom_site_surroundings!.text });
        else if (surroundings === "failed") {
          plates.push({
            id: "surroundings-error",
            text: `The ground around ${site.name} could not be loaded, so only the nearest ground is drawn.`,
          });
        } else plates.push({ id: "surroundings-loading", text: `Loading the ground around ${site.name}…`, status: true });
      } else {
        // A listed site: one line saying what the drawn ground is made from (groundSource).
        plates.push(groundSourcePlate(site.tier, input.closeup ?? "none"));
      }
      if (input.apron === "error") {
        plates.push({
          id: "apron-error",
          text: `The terrain beyond 10 km of ${site.name} could not be loaded. Showing the 20 km around it only.`,
        });
      }
    }
  } else if (site) {
    // The ground is built ahead of a flight down, from the same rules.
    if (site.sphere || input.terrain === "error") ground = "smooth";
    else if (input.terrain === "ready") ground = "terrain";
  }

  // Wherever the ground is drawn with shading and shadows, the series' answer and what the
  // drawing is (docs/features/local-terrain.md, "Shadows are decoration").
  // In Lander's eye the horizon bar already gives the series' answer, so the plate is one line
  // there and covers less of the horizon.
  if (groundView(view) && ground !== "none") plates.push(decorationPlate(view === "panorama" ? null : (input.sun ?? null)));

  if (site && input.series === "error" && view !== "map") {
    plates.push({ id: "series-error", text: `The Sun and Earth series for ${site.name} could not be loaded, so its sight-lines are not drawn.` });
  }

  return { bodies, sightLines, ground, plates };
}

/**
 * The plate that keeps the drawing honest. The drawn ground is coarser and nearer than the
 * 300 km skyline the series used, so its shadow at the lander can differ from the series;
 * the plate says which one is right in every case, without the browser judging the drawing.
 */
export function decorationPlate(sun: { lit: boolean; discFraction: number } | null): Plate {
  const note =
    "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.";
  if (!sun || !Number.isFinite(sun.discFraction)) return { id: "decoration", text: note, place: "foot" };
  const fraction = Math.min(1, Math.max(0, sun.discFraction));
  const text = sun.lit
    ? `The series says: lit. ${Math.round(fraction * 100)} % of the Sun's disc is above the skyline.`
    : `The series says: dark. Sun disc fraction ${fraction.toFixed(2)} above the skyline.`;
  return { id: "decoration", text, note, place: "foot" };
}

/**
 * The series' answer for the Sun at one hour, as the decoration plate states it: lit or dark
 * from the profile's hour flag (science.md §9), and the disc fraction from the series. The
 * scene passes this straight to `sceneContent`; null while the series or flags are not in.
 */
export function seriesSunAnswer(
  series: { sun_frac: ArrayLike<number> } | null | undefined,
  flags: HourFlags | null | undefined,
  hourIndex: number | null,
): { lit: boolean; discFraction: number } | null {
  if (!series || !flags || hourIndex === null) return null;
  const state = sightState(flags, hourIndex);
  if (!state) return null;
  return { lit: state.sun === "lit", discFraction: series.sun_frac[hourIndex] ?? Number.NaN };
}

/** The decoration plate's one line for a tight space or beside an open window. */
export const DECORATION_SHORT = "Shadows and ground texture are illustrative.";

/** The smallest free space for each form of the decoration plate, in CSS pixels. */
export const DISCLOSURE_ROOM = { full: { width: 360, height: 140 }, short: { width: 200, height: 56 } } as const;

/**
 * How the decoration plate is shown in a free space. The rule: wherever drawn shadows or the
 * made-up ground texture are on screen, the plate saying so is on screen too.
 *
 * - "full": the plate as `decorationPlate` gives it.
 * - "short": one line, `DECORATION_SHORT`, when the space is tight or a floating window is
 *   open (the free space is then what is still visible beside the window). Other plates and
 *   the scene's labels are hidden there; this one is not.
 * - "none": not even one line fits. The ground then drops its shadows and texture
 *   (`GroundLook.setDisclosed(false)`) for as long as this lasts, so nothing undisclosed is drawn.
 */
export function decorationDisclosure(space: { width: number; height: number; windowOpen: boolean }): "full" | "short" | "none" {
  const { full, short } = DISCLOSURE_ROOM;
  if (!space.windowOpen && space.width >= full.width && space.height >= full.height) return "full";
  if (space.width >= short.width && space.height >= short.height) return "short";
  return "none";
}

/**
 * Which plates the overlay shows at the top and at the foot of the free space. `hidden` is
 * the overlay's own rule for a tight space or an open window, which hides every other plate;
 * the decoration plate follows `decorationDisclosure` instead.
 */
export function visiblePlates(
  plates: readonly Plate[],
  space: { width: number; height: number; windowOpen: boolean },
  hidden: boolean,
): { top: Plate[]; foot: Plate[] } {
  const disclosure = decorationDisclosure(space);
  const foot: Plate[] = [];
  const top: Plate[] = [];
  for (const plate of plates) {
    if (plate.id === "decoration") {
      if (disclosure === "full" && !hidden) foot.push(plate);
      else if (disclosure !== "none") foot.push({ id: "decoration", text: DECORATION_SHORT, place: "foot" });
    } else if (!hidden) {
      (plate.place === "foot" ? foot : top).push(plate);
    }
  }
  return { top, foot };
}

/**
 * The focused site's apron state for the plates, from its load and the scene's metadata.
 * The data layer answers "not available" both when no apron is listed for the site and when a
 * listed file is missing; only the metadata tells them apart. Not listed (a custom site, or a
 * sphere-tier site) is "none", by design; listed but not available is a real "error".
 */
export function apronLoadState(
  status: "loading" | "ready" | "error",
  data: unknown,
  listed: boolean,
): LoadState | "none" {
  if (status !== "ready") return status;
  if (data === "not available") return listed ? "error" : "none";
  return "ready";
}

/**
 * What a listed site's drawn ground is made from, in one line. The rule: the close-up's line
 * when NASA's 5 m close-up is drawn ("ready"); otherwise the terrain tier's line (240 m for
 * wide240, 80 m for core80). While a close-up loads, or if it fails, the 80 m ground is what is
 * drawn, and the line says so. Custom sites and the smooth Moon keep their own sentences
 * (sceneContent).
 */
export function groundSourcePlate(tier: "core80" | "wide240" | "sphere" | undefined, closeup: LoadState | "none"): Plate {
  const key = closeup === "ready" ? "closeup_ground" : tier === "wide240" ? "terrain_ground_wide240" : "terrain_ground_core80";
  return { id: "ground-source", text: explanations[key]!.text };
}

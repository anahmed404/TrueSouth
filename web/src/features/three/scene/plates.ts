import type { CameraViewId } from "../../../app/scene";

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
  site: { name: string; sphere: boolean } | null;
  /** The focused site's series and its hour flags. */
  series: LoadState;
  /** The focused site's `terrain.bin`. Ignored for a sphere-tier site, which has none. */
  terrain: LoadState;
  /** The focused site's apron. Ignored for a sphere-tier site. */
  apron: LoadState;
};

export type Plate = {
  id: string;
  text: string;
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

  if (view === "system" && bodies) {
    plates.push({
      id: "scale",
      text: input.trueScale ? "True scale. Every direction is true." : "Distances not to scale. Every direction is true.",
    });
  }
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

  if (site && input.series === "error" && view !== "map") {
    plates.push({ id: "series-error", text: `The Sun and Earth series for ${site.name} could not be loaded, so its sight-lines are not drawn.` });
  }

  return { bodies, sightLines, ground, plates };
}

import type { ComponentType } from "react";
import type { ExplainTerm } from "../../lib/explain";
import type { PanelProps } from "../panel";
import Compare from "../../features/mission-control/compare";
import SlipPlanner from "../../features/mission-control/slip-planner";
import LandersEye from "../../features/panorama";
import PolarMap from "../../features/polar-map";
import LocalTerrain from "../../features/three/local-terrain";
import SystemView from "../../features/three/system-view";

export type ViewId = "slip" | "map" | "system" | "terrain" | "panorama" | "compare";

export type ViewDefinition = {
  id: ViewId;
  /** The glossary name, exactly as in CONTEXT.md. */
  name: string;
  /** The tab's second line: what the view is for, in a few words. */
  caption: string;
  /** The explain.ts entry whose first sentence describes the view. */
  term: ExplainTerm;
  /** True for the views you turn by dragging. They carry the "3D" badge. */
  is3d: boolean;
  Panel: ComponentType<PanelProps>;
};

/**
 * The six Mission Control views, in tab order. The captions are the tab lines from
 * design/variants/direction-c2.md; the descriptions come from explain.ts.
 */
export const VIEWS: readonly ViewDefinition[] = [
  { id: "slip", name: "Slip Planner", caption: "Every landing date", term: "slip_planner", is3d: false, Panel: SlipPlanner },
  { id: "map", name: "Polar map", caption: "Pick and nudge sites", term: "polar_map", is3d: false, Panel: PolarMap },
  { id: "system", name: "System view", caption: "Moon, Earth and Sun", term: "system_view", is3d: true, Panel: SystemView },
  { id: "terrain", name: "Local terrain", caption: "The ground at the site", term: "local_terrain", is3d: true, Panel: LocalTerrain },
  { id: "panorama", name: "Lander's eye", caption: "The horizon from the site", term: "landers_eye", is3d: false, Panel: LandersEye },
  { id: "compare", name: "Compare", caption: "Sites side by side", term: "compare", is3d: false, Panel: Compare },
];

/** The view a new visitor lands on: step 3 of the workflow, finding dates. */
export const DEFAULT_VIEW: ViewId = "slip";

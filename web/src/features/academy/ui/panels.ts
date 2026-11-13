import { explanations } from "../../../lib/explain";
import type { PanelId, StepKind } from "../types";

/** A Mission Control panel's name, as CONTEXT.md writes it, and its explain.ts key. */
const PANELS: Record<PanelId, { name: string; term: string }> = {
  SystemView: { name: "System view", term: "system_view" },
  LandersEye: { name: "Lander's eye", term: "landers_eye" },
  LocalTerrain: { name: "Local terrain", term: "local_terrain" },
  Timeline: { name: "Timeline", term: "timeline" },
  Countdowns: { name: "Countdowns", term: "countdown" },
  PolarMap: { name: "Polar map", term: "polar_map" },
  Compare: { name: "Compare", term: "compare" },
  SlipPlanner: { name: "Slip Planner", term: "slip_planner" },
  MissionControl: { name: "Mission Control", term: "mission_control" },
};

export const PANEL_IDS: readonly PanelId[] = Object.keys(PANELS) as PanelId[];

export function panelName(panel: PanelId): string {
  return PANELS[panel].name;
}

/** The panel's plain-language explanation, from explain.ts (the one source). */
export function panelExplanation(panel: PanelId): string | null {
  return explanations[PANELS[panel].term]?.text ?? null;
}

/** The three step kinds that embed a panel, what the learner does, and which panel. */
export const PENDING_STEPS: Partial<Record<StepKind, { action: string; panel: PanelId }>> = {
  "drag-body": { action: "Dragging the Sun or Earth", panel: "LandersEye" },
  "draw-skyline": { action: "Drawing the skyline", panel: "LandersEye" },
  "drop-pin": { action: "Dropping a pin", panel: "PolarMap" },
};

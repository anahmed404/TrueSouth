import { createStore } from "zustand/vanilla";
import type { CameraViewId } from "../../../app/scene";

/**
 * The scene's Labels toggle (docs/features/system-view.md, "Controls"): on by default; off, the
 * name tags on the scene (a site's name tag, the sight-line notes, Earth's and the Sun's names,
 * "Lander not to scale", and the Slip Planner's site tags) are hidden, so a zoomed-out view is
 * not covered. The site markers, the sight lines, the off-screen pointers at the edge and every
 * plate stay. Not part of the scenario or the link; kept for the session only, like "Sharper
 * Moon". Shared here because the toggle sits in the System view's row while the Slip Planner's
 * tags are drawn by its own layer.
 */
export type LabelsState = { on: boolean; setOn: (on: boolean) => void };

export const labelsStore = createStore<LabelsState>()((set) => ({
  on: true,
  setOn: (on) => set({ on }),
}));

/**
 * The value of a layer's `data-labels` attribute, which the CSS reads to hide the tags.
 * Lander's eye keeps its labels whatever the toggle says (out of the toggle's scope).
 */
export function labelsAttr(view: CameraViewId, on: boolean): "on" | "off" {
  return on || view === "panorama" ? "on" : "off";
}

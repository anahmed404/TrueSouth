/**
 * The Slip Planner (work package MC7; docs/features/slip-planner.md): a camera view. The
 * shell mounts the two halves: the spots over the scene, and the landing-date panel in the
 * timeline's slot. The camera's pose and the fixed light are the scene's
 * (features/three/scene/slip.ts).
 */
export { LandingDatePanel, type LandingDatePanelProps, type LandingWrite } from "./landing-date-panel";
export { SlipPlannerScene, SHADING_LABEL, FLAT_NOTE, type SlipPlannerSceneProps } from "./spots-layer";
export { slipStore } from "./slip-store";

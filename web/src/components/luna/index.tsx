/*
  Luna, the Academy's guide. Spec: docs/academy/luna.md.
  Her look lives only in ./art (see the comment at the top of ./art/index.ts).
*/
import { Luna } from "./Luna";

export { Luna, useLunaReducedMotion, type LunaProps } from "./Luna";
export { LunaSays, type LunaSaysProps } from "./LunaSays";
export { LunaCelebration, type LunaCelebrationProps } from "./LunaCelebration";
export { LunaGallery } from "./LunaGallery";
export { MOODS, isMood, type Mood } from "./moods";
export type { CelebrationKind } from "./motion-plan";

export default Luna;

import type { LunaMoodArt } from "../art-contract";
import { BLUSH, FEATURE_FILL, GlossyEyes, Sparkle } from "./shapes";

/* Sheet pose 1: wide round eyes, a big open happy mouth. */
export const cheering: LunaMoodArt = {
  label: "Luna, cheering with her mouth wide open",
  eyes: <GlossyEyes rx={8.5} ry={10} iris={5.8} lookY={-0.5} dy={-1} />,
  mouth: (
    <g>
      <path className={FEATURE_FILL} d="M37 61 Q50 63 63 61 Q61 79 50 79 Q39 79 37 61 Z" />
      <path className={BLUSH} d="M43.5 75.5 Q50 70 56.5 75.5 Q54 79 50 79 Q46 79 43.5 75.5 Z" />
    </g>
  ),
  extras: (
    <g>
      <Sparkle x={13} y={20} r={6} />
      <Sparkle x={88} y={14} r={4.5} />
    </g>
  ),
};

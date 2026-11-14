import type { LunaMoodArt } from "../art-contract";
import { BLUSH, FEATURE_LINE, GLINT, GlossyEyes, LINE } from "./shapes";

/* Sheet pose 4: eyes looking up to one side, the tip of the tongue out in concentration. */
export const thinking: LunaMoodArt = {
  label: "Luna, thinking it over",
  eyes: <GlossyEyes lookX={1.8} lookY={-2} />,
  brows: <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M57 34 Q63 29 69 33" />,
  mouth: (
    <g>
      <path className={BLUSH} d="M51 65.5 Q51 72.5 55.5 72.5 Q59.5 72 58.5 64.5 Z" />
      <path className={FEATURE_LINE} strokeWidth={LINE} d="M42 65 Q50 67.5 60 63.5" />
    </g>
  ),
  extras: (
    <g className={GLINT}>
      <circle cx={78} cy={17} r={2.5} />
      <circle cx={86} cy={9} r={3.5} />
    </g>
  ),
};

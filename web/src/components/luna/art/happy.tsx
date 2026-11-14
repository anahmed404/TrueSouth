import type { LunaMoodArt } from "../art-contract";
import { Blush, FEATURE_LINE, LINE, Sparkle } from "./shapes";

/* Sheet pose 2: eyes closed in smiling arcs, a small smile, soft cheeks, a sparkle or two. */
export const happy: LunaMoodArt = {
  label: "Luna, smiling with her eyes closed",
  eyes: (
    <path className={FEATURE_LINE} strokeWidth={LINE} d="M30 50 Q37 41 44 50 M56 50 Q63 41 70 50" />
  ),
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M43 63 Q50 70 57 63" />,
  extras: (
    <g>
      <Blush />
      <Sparkle x={14} y={18} r={5} />
      <Sparkle x={87} y={13} r={4} />
    </g>
  ),
  blinks: false,
};

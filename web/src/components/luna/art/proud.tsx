import type { LunaMoodArt } from "../art-contract";
import { Blush, FEATURE_FILL, GlossyEyes, Heart } from "./shapes";

/* Sheet pose 5: beaming, an open smile, soft cheeks and a heart or two. */
export const proud: LunaMoodArt = {
  label: "Luna, beaming with pride",
  eyes: <GlossyEyes lookY={-1.5} />,
  mouth: <path className={FEATURE_FILL} d="M40 62 Q50 64 60 62 Q58 73 50 73 Q42 73 40 62 Z" />,
  extras: (
    <g>
      <Blush />
      <Heart x={14} y={16} s={6} tilt={-12} />
      <Heart x={86} y={11} s={4.5} tilt={12} />
    </g>
  ),
};

import type { LunaMoodArt } from "../art-contract";
import { FEATURE_FILL, GlossyEyes, TEAR } from "./shapes";

/* Sheet pose 6: humming to herself, eyes up and aside, a small "o" mouth, one music note. */
export const idle: LunaMoodArt = {
  label: "Luna, humming while she waits",
  eyes: <GlossyEyes lookX={-2} lookY={-2.5} />,
  mouth: <ellipse className={FEATURE_FILL} cx={50} cy={66} rx={3.2} ry={3.8} />,
  extras: (
    <g className={TEAR}>
      <ellipse cx={81} cy={20} rx={3.4} ry={2.6} transform="rotate(-20 81 20)" />
      <path d="M83.4 19.5 V6 Q89 7 89.5 12.5 Q87 9.5 85.4 9.8 V19.5 Z" />
    </g>
  ),
};

import type { LunaMoodArt } from "../art-contract";
import { FEATURE_FILL, FEATURE_LINE, GlossyEyes, LINE } from "./shapes";

/* Derived from sheet pose 1: the same wide eyes, raised brows, a small round mouth, no smile. */
export const surprised: LunaMoodArt = {
  label: "Luna, surprised",
  eyes: <GlossyEyes rx={8.5} ry={10} iris={5} dy={-1} />,
  brows: (
    <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M33 32 Q38 27 44 30 M56 30 Q62 27 67 32" />
  ),
  mouth: <ellipse className={FEATURE_FILL} cx={50} cy={69} rx={4.2} ry={5.2} />,
};

import type { LunaMoodArt } from "../art-contract";
import { FEATURE_FILL, FEATURE_LINE, LINE } from "./shapes";

export const cheering: LunaMoodArt = {
  label: "Luna, cheering",
  eyes: (
    <path className={FEATURE_LINE} strokeWidth={LINE} d="M32 50 Q38 42 44 50 M56 50 Q62 42 68 50" />
  ),
  mouth: <path className={FEATURE_FILL} d="M35 59 Q50 82 65 59 Z" />,
  extras: (
    <g className="fill-sun">
      <path d="M14 18 L16 24 L22 26 L16 28 L14 34 L12 28 L6 26 L12 24 Z" />
      <path d="M86 14 L87.5 18.5 L92 20 L87.5 21.5 L86 26 L84.5 21.5 L80 20 L84.5 18.5 Z" />
    </g>
  ),
  blinks: false,
};

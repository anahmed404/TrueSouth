import type { LunaMoodArt } from "../art-contract";
import { FEATURE_FILL, FEATURE_LINE, LINE, RoundEyes } from "./shapes";

export const surprised: LunaMoodArt = {
  label: "Luna, surprised",
  eyes: <RoundEyes r={7} dy={-1} />,
  brows: (
    <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M31 34 Q38 28 45 33 M55 33 Q62 28 69 34" />
  ),
  mouth: <ellipse className={FEATURE_FILL} cx={50} cy={67} rx={5.5} ry={6.5} />,
};

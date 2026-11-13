import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE, RoundEyes } from "./shapes";

export const thinking: LunaMoodArt = {
  label: "Luna, thinking it over",
  eyes: <RoundEyes r={5} dx={2} dy={-3} />,
  brows: <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M56 35 Q62 31 68 34" />,
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M44 66 L57 63" />,
  extras: (
    <g className="fill-text">
      <circle cx={76} cy={18} r={2.5} />
      <circle cx={84} cy={11} r={3.5} />
    </g>
  ),
};

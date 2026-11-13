import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE } from "./shapes";

export const proud: LunaMoodArt = {
  label: "Luna, proud",
  eyes: (
    <path className={FEATURE_LINE} strokeWidth={LINE} d="M32 48 Q38 42 44 48 M56 48 Q62 42 68 48" />
  ),
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M38 61 Q52 72 64 58" />,
  extras: (
    <g>
      <circle className="fill-raised stroke-text" cx={78} cy={80} r={10} strokeWidth={2} />
      <path
        className="fill-sun"
        d="M78 73 L80 78 L85 78.5 L81 81.5 L82.5 86.5 L78 83.5 L73.5 86.5 L75 81.5 L71 78.5 L76 78 Z"
      />
    </g>
  ),
  blinks: false,
};

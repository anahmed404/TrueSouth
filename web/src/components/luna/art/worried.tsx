import type { LunaMoodArt } from "../art-contract";
import { EYE_X, EYE_Y, FEATURE_LINE, GlossyEyes, LINE, TEAR } from "./shapes";

/* Sheet pose 8: large wet eyes with a tear welling along each lower lid, a small frown. */
export const worried: LunaMoodArt = {
  label: "Luna, worried, her eyes welling up",
  eyes: (
    <g>
      <GlossyEyes rx={8} ry={9.5} iris={5.8} lookY={1} />
      {EYE_X.map((cx) => (
        <path
          key={cx}
          className={TEAR}
          d={`M${cx - 7} ${EYE_Y + 4} Q${cx} ${EYE_Y + 13} ${cx + 7} ${EYE_Y + 4} Q${cx} ${EYE_Y + 8.5} ${cx - 7} ${EYE_Y + 4} Z`}
        />
      ))}
    </g>
  ),
  brows: <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M33 37 L43 33 M57 33 L67 37" />,
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M44 69 Q50 63.5 56 69" />,
};

import type { LunaMoodArt } from "../art-contract";
import { EYE_X, EYE_Y, FEATURE_FILL, FEATURE_LINE, LINE } from "./shapes";

/* Sheet pose 3: heavy half-closed lids over the irises, a short flat mouth. */
export const sleepy: LunaMoodArt = {
  label: "Luna, sleepy with heavy eyelids",
  eyes: (
    <g>
      {EYE_X.map((cx) => (
        <g key={cx}>
          <path
            className="fill-luna-sparkle stroke-luna-feature"
            strokeWidth={2}
            d={`M${cx - 7.5} ${EYE_Y + 1} A7.5 8 0 0 0 ${cx + 7.5} ${EYE_Y + 1} Z`}
          />
          <path className={FEATURE_FILL} d={`M${cx - 5} ${EYE_Y + 1} A5 5 0 0 0 ${cx + 5} ${EYE_Y + 1} Z`} />
          <path className={FEATURE_LINE} strokeWidth={LINE} d={`M${cx - 8.5} ${EYE_Y + 1} H${cx + 8.5}`} />
        </g>
      ))}
    </g>
  ),
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE * 0.9} d="M45 66 H55" />,
  extras: (
    <path
      className="fill-none stroke-luna-sparkle [stroke-linecap:round] [stroke-linejoin:round]"
      strokeWidth={2.5}
      d="M74 14 H83 L74 23 H83 M86 4 H91 L86 9 H91"
    />
  ),
};

import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE } from "./shapes";

export const sleepy: LunaMoodArt = {
  label: "Luna, sleepy",
  eyes: (
    <path className={FEATURE_LINE} strokeWidth={LINE} d="M32 49 Q38 55 44 49 M56 49 Q62 55 68 49" />
  ),
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M46 65 Q50 67 54 65" />,
  extras: (
    <path
      className="fill-none stroke-text [stroke-linecap:round] [stroke-linejoin:round]"
      strokeWidth={2.5}
      d="M74 14 H83 L74 23 H83 M86 4 H91 L86 9 H91"
    />
  ),
  blinks: false,
};

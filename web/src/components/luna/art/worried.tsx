import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE, RoundEyes } from "./shapes";

export const worried: LunaMoodArt = {
  label: "Luna, worried",
  eyes: <RoundEyes r={5} dy={1} />,
  brows: (
    <path className={FEATURE_LINE} strokeWidth={LINE * 0.8} d="M31 38 L43 34 M57 34 L69 38" />
  ),
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M40 69 Q45 63 50 67 Q55 71 60 65" />,
  extras: <path className="fill-accent" d="M78 34 Q83 42 83 45 A5 5 0 0 1 73 45 Q73 42 78 34 Z" />,
};

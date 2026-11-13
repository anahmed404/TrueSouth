import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE, RoundEyes } from "./shapes";

export const idle: LunaMoodArt = {
  label: "Luna, calm and waiting",
  eyes: <RoundEyes />,
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M43 64 Q50 68 57 64" />,
};

import type { LunaMoodArt } from "../art-contract";
import { FEATURE_LINE, LINE, RoundEyes } from "./shapes";

export const happy: LunaMoodArt = {
  label: "Luna, smiling",
  eyes: <RoundEyes />,
  mouth: <path className={FEATURE_LINE} strokeWidth={LINE} d="M37 61 Q50 75 63 61" />,
};

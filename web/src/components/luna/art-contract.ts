import type { ReactNode } from "react";
import type { Mood } from "./moods";

/**
 * The shape every Luna art set must have. `art/index.ts` exports one value of this
 * type; the components in this folder only ever read it through `resolveMoodArt`.
 *
 * Coordinates are in the art set's own `viewBox`. Colours must come from theme tokens
 * (Tailwind `fill-*` / `stroke-*` classes or `var(--token)`), never literal values.
 */
export type LunaArtSet = {
  /** SVG viewBox for every layer, for example "0 0 100 100". */
  viewBox: string;
  /** The face-less moon, drawn once and kept still while moods change. */
  body: ReactNode;
  /** Surface detail (craters). Dropped at small sizes so the face stays readable. */
  detail?: ReactNode;
  moods: Record<Mood, LunaMoodArt>;
};

/**
 * One mood. Parts with the same name cross-fade into each other when the mood
 * changes, so keep the part split (brows, eyes, mouth, extras) in final art too.
 */
export type LunaMoodArt = {
  /** Text alternative, for example "Luna, smiling". Read by screen readers. */
  label: string;
  /** Blinks squash this part vertically about its own centre. */
  eyes: ReactNode;
  mouth: ReactNode;
  brows?: ReactNode;
  /** Anything else: cheeks, tears, sparkles, "z". */
  extras?: ReactNode;
  /** False when the eyes are already closed, so a blink would look wrong. */
  blinks?: boolean;
};

export const PART_NAMES = ["brows", "eyes", "mouth", "extras"] as const;
export type PartName = (typeof PART_NAMES)[number];

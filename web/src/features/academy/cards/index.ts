import { sampleCard } from "../lessons/sample";
import type { UnderTheHoodCard } from "../types";
import { l1Card } from "./l1";
import { l2Card } from "./l2";
import { l3Card } from "./l3";
import { l4Card } from "./l4";

/** The Under-the-hood cards that are written, by card id. Lessons 5 to 8 have none yet. */
export const LESSON_CARDS: readonly UnderTheHoodCard[] = [l1Card, l2Card, l3Card, l4Card];

export const CARDS: Readonly<Record<string, UnderTheHoodCard>> = Object.fromEntries(
  [sampleCard, ...LESSON_CARDS].map((card) => [card.id, card]),
);

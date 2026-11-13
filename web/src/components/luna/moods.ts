/**
 * Luna's moods, from the "Moods" table in docs/academy/luna.md.
 * Add a mood there first, then here, then give it art in `art/`.
 */
export const MOODS = [
  "idle",
  "happy",
  "thinking",
  "cheering",
  "worried",
  "surprised",
  "sleepy",
  "proud",
] as const;

export type Mood = (typeof MOODS)[number];

/** When each mood is used, copied from the spec. Shown in the gallery. */
export const MOOD_USE: Record<Mood, string> = {
  idle: "Waiting for the learner",
  happy: "Greeting, introducing an idea",
  thinking: "Asking a question",
  cheering: "A correct answer; lesson complete",
  worried: "A wrong answer; Pip in danger",
  surprised: "A reveal that overturns a guess",
  sleepy: "Pip is in darkness",
  proud: "Awarding a mission patch",
};

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value);
}

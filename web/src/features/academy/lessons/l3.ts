import type { Lesson } from "../types";
import { todo } from "./story";

/**
 * Lesson 3, "The Moon is round". Typed skeleton. Not in the catalog yet.
 * Quoted lines are copied from docs/academy/lessons.md. `TODO(words):` marks a description.
 */
const tip = "2.2° of mountain / **Just the tip** / Nothing. Reveal: a side view of the curved Moon.";
const denom = "R / **2R** / R²";
const slide = "Goal: 20 km. A live readout shows the drop.";
const bug =
  "Lines: (1) the ridge is 1,000 m above Pip; (2) it is 60 km away; **(3) it looks atan(1000 ÷ 60000) = 0.95° tall**; (4) the Sun is 0.8° up, so it is blocked. Line 3 forgot the drop: 1,036 m at 60 km. The ridge is below Pip's horizon.";
const why = "**Because the Sun is only 1–2° up** / Because my mountains are small / It doesn't";

export const lesson3 = {
  id: "l3_horizon",
  title: "The Moon is round",
  tagline: "The ground curves away, so far mountains sink below the horizon.",
  patch: { name: "Horizon Hunter", art: "l3_horizon" },
  unlocks: "LocalTerrain",
  recap: "The ground curves away, so far mountains sink below the horizon.",
  card: "l3_horizon",
  steps: [
    {
      id: "l3-tip",
      luna: {
        mood: "thinking",
        says: "A mountain 5 km tall stands 130 km from Pip. On a flat Moon it would look 2.2° tall. What does Pip really see?",
      },
      hint: todo(tip),
      explain: todo(tip),
      kind: "predict",
      options: ["2.2° of mountain", "Just the tip", "Nothing"],
      answer: 1,
      reveal: {
        kind: "illustration",
        illustration: "curved-moon-side",
        caption: todo("a side view of the curved Moon."),
      },
    },
    {
      id: "l3-drop",
      luna: { mood: "thinking", says: "How far the ground drops away: drop = distance² ÷ ( ? )" },
      hint: todo(denom),
      explain: todo(denom),
      kind: "fill-formula",
      tex: "distance² ÷ ( ? )",
      options: ["R", "2R", "R²"],
      answer: 1,
    },
    {
      id: "l3-distance",
      luna: { mood: "thinking", says: "Slide the distance until the ground has dropped 115 m." },
      hint: todo(slide),
      explain: todo(slide),
      kind: "tune-slider",
      slider: {
        kind: "number",
        min: 0,
        max: 130,
        step: 1,
        unit: "km",
        label: "distance",
        readout: {
          label: "drop",
          stops: [
            { at: 20, text: "{{example.l3.drop_at_20km_m}} m" },
            { at: 60, text: "{{example.l3.drop_at_60km_m}} m" },
            { at: 130, text: "{{example.l3.drop_at_130km_m}} m" },
          ],
        },
      },
      goal: { metric: "distance_km", op: "==", value: 20 },
      answerLabel: "20 km",
    },
    {
      id: "l3-bug",
      luna: { mood: "thinking", says: "This calculation says Pip is in shadow. One line is wrong." },
      hint: todo(bug),
      explain: "Line 3 forgot the drop: 1,036 m at 60 km. The ridge is below Pip's horizon.",
      kind: "spot-bug",
      lines: [
        "the ridge is 1,000 m above Pip",
        "it is 60 km away",
        "it looks atan(1000 ÷ 60000) = 0.95° tall",
        "the Sun is 0.8° up, so it is blocked",
      ],
      buggyLine: 2,
    },
    {
      id: "l3-why",
      luna: { mood: "thinking", says: "Why does a third of a degree matter so much here?" },
      hint: todo(why),
      explain: todo(why),
      kind: "choice",
      options: ["Because the Sun is only 1–2° up", "Because my mountains are small", "It doesn't"],
      answer: 0,
    },
  ],
} as const satisfies Lesson;

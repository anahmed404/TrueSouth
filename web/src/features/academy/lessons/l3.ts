import { MOON_RADIUS_M } from "../../../lib/geo/constants";
import type { Lesson } from "../types";
import { todo } from "./story";

/**
 * Lesson 3, "The Moon is round". Typed skeleton. Not in the catalog yet.
 * Quoted lines are copied from docs/academy/lessons.md. `TODO(words):` marks a description.
 */
const tipReveal =
  "a side view of the curved Moon. At 130 km the ground has dropped {{example.l3.drop_at_130km_m}} m, so only the top of the mountain shows.";
const tip = `2.2° of mountain / **Just the tip** / Nothing. Reveal: ${tipReveal}`;
const denom = "R / **2R** / R²";
const slide = "Goal: 20 km. A live readout shows the drop.";
const bug =
  "Lines: (1) the ridge is 1,000 m above Pip; (2) it is 60 km away; **(3) it looks atan(1000 ÷ 60000) = 0.95° tall**; (4) the Sun is 0.5° up, so it is blocked. Line 3 forgot the drop: {{example.l3.drop_at_60km_m}} m at 60 km. The ridge is below Pip's horizon.";
const whyLuna =
  "At 20 km the drop is a third of a degree. That is a big slice of a Sun that never gets above {{example.l1.sun_el_max_deg}}°.";
const why = `**Because the Sun never gets above {{example.l1.sun_el_max_deg}}° this month** / Because my mountains are small / It doesn't. Luna: "${whyLuna}"`;

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
        caption: todo(tipReveal),
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
      luna: { mood: "thinking", says: "Slide the distance until the ground has dropped {{example.l3.drop_at_20km_m}} m." },
      hint: todo(slide),
      explain: todo(slide),
      kind: "tune-slider",
      slider: {
        kind: "number",
        min: 0,
        max: 60,
        step: 1,
        unit: "km",
        label: "distance",
        readout: { kind: "curvature-drop", label: "drop", radiusM: MOON_RADIUS_M },
      },
      goal: { metric: "distance_km", op: "==", value: 20, tolerance: 1 },
      answerLabel: "20 km",
    },
    {
      id: "l3-bug",
      luna: { mood: "thinking", says: "This calculation says Pip is in shadow. One line is wrong." },
      hint: todo(bug),
      explain: "Line 3 forgot the drop: {{example.l3.drop_at_60km_m}} m at 60 km. The ridge is below Pip's horizon.",
      kind: "spot-bug",
      lines: [
        "the ridge is 1,000 m above Pip",
        "it is 60 km away",
        "it looks atan(1000 ÷ 60000) = 0.95° tall",
        "the Sun is 0.5° up, so it is blocked",
      ],
      buggyLine: 2,
    },
    {
      id: "l3-why",
      luna: { mood: "thinking", says: "Why does a third of a degree matter so much here?" },
      hint: todo(why),
      explain: whyLuna,
      kind: "choice",
      options: ["Because the Sun never gets above {{example.l1.sun_el_max_deg}}° this month", "Because my mountains are small", "It doesn't"],
      answer: 0,
    },
  ],
} as const satisfies Lesson;

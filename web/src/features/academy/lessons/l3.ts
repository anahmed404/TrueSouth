import { MOON_RADIUS_M } from "../../../lib/geo/constants";
import type { Lesson } from "../types";

/**
 * Lesson 3, "The Moon is round". Every line is copied from docs/academy/lessons.md,
 * section 3 and its "Words" list; change the words there first. The 5 km mountain, the
 * 1,000 m ridge and the distances are the doc's teaching examples, not worked examples.
 */
const tipReveal =
  "A side view of the curved Moon. At 130 km the ground has dropped {{example.l3.drop_at_130km_m}} m, so only the top of the mountain shows.";
const whyLuna =
  "At 20 km the drop is a third of a degree. That is a big slice of a Sun that never gets above {{example.l1.sun_el_max_deg}}°.";

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
      hint: "On a ball the ground falls away as you look farther out. How much could fall away in 130 km?",
      explain: "At 130 km the ground has dropped {{example.l3.drop_at_130km_m}} m. Most of the mountain is hidden below my horizon.",
      kind: "predict",
      options: ["2.2° of mountain", "Just the tip", "Nothing"],
      answer: 1,
      reveal: {
        kind: "illustration",
        illustration: "curved-moon-side",
        caption: tipReveal,
      },
    },
    {
      id: "l3-drop",
      luna: { mood: "thinking", says: "How far the ground drops away: drop = distance² ÷ ( ? )" },
      hint: "My radius R is in it, and the drop has to come out in metres.",
      explain: "Twice my radius, 2R. At 20 km that is a drop of {{example.l3.drop_at_20km_m}} m.",
      kind: "fill-formula",
      tex: "distance² ÷ ( ? )",
      options: ["R", "2R", "R²"],
      answer: 1,
    },
    {
      id: "l3-distance",
      luna: { mood: "thinking", says: "Slide the distance until the ground has dropped {{example.l3.drop_at_20km_m}} m." },
      hint: "The drop grows fast: twice the distance, four times the drop. Watch the readout as you slide.",
      explain: "At 20 km the ground has dropped {{example.l3.drop_at_20km_m}} m. Seen from Pip, that is a third of a degree.",
      kind: "tune-slider",
      slider: {
        kind: "number",
        min: 0,
        max: 60,
        step: 1,
        unit: "km",
        label: "Distance",
        readout: { kind: "curvature-drop", label: "drop", radiusM: MOON_RADIUS_M },
      },
      // Exactly 20 km: at 19 km and 21 km the readout itself shows a different drop.
      goal: { metric: "distance_km", op: "==", value: 20 },
      answerLabel: "20 km",
    },
    {
      id: "l3-bug",
      luna: { mood: "thinking", says: "This calculation says Pip is in shadow. One line is wrong." },
      hint: "Find the line that works out an angle. Did it remember that the ground curves away?",
      explain: "Line 3 forgot the drop: {{example.l3.drop_at_60km_m}} m at 60 km. The ridge is below Pip's horizon.",
      kind: "spot-bug",
      title: "A flat-Moon calculation, line by line",
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
      hint: "Compare a third of a degree with how high the Sun gets here this month.",
      explain: whyLuna,
      kind: "choice",
      options: ["Because the Sun never gets above {{example.l1.sun_el_max_deg}}° this month", "Because my mountains are small", "It doesn't"],
      answer: 0,
    },
  ],
} as const satisfies Lesson;

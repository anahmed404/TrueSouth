import type { Lesson } from "../types";
import { oneMonth, storyScene, todo } from "./story";

/**
 * Lesson 1, "Where's the Sun?". Typed skeleton. Not registered in the catalog:
 * the panel steps are not playable until those panels exist.
 * Wording in quotes is copied from docs/academy/lessons.md. A `TODO(words):` string
 * is the doc's description, for a writer to replace.
 */
const flatMonth = storyScene("flat", oneMonth("{{example.l1.example_utc}}"));

const highest =
  "Lander's eye view with a flat skyline. The best the learner can find is {{l1.sun_el_max_deg}}° (2.0°).";
const directions = "Only east and west / **All the way round** / Only north. Reveal: the System view plays one month.";
const formula = "**1.54°, my tilt** / 23.4° / 5.1°. At 89.46°S that gives 2.08°.";

export const lesson1 = {
  id: "l1_sun",
  title: "Where's the Sun?",
  tagline: "At the south pole the Sun never climbs; it circles the horizon.",
  patch: { name: "Sun Chaser", art: "l1_sun" },
  unlocks: "SystemView",
  recap: "At the south pole the Sun never climbs; it circles the horizon.",
  card: "l1_sun",
  steps: [
    {
      id: "l1-height",
      luna: {
        mood: "thinking",
        says: "At my equator the midday Sun is almost overhead. How high does it get at my south pole?",
      },
      hint: todo("Overhead / About 45° / **Under 2°**"),
      explain: todo("Overhead / About 45° / **Under 2°**"),
      kind: "choice",
      options: ["Overhead", "About 45°", "Under 2°"],
      answer: 2,
    },
    {
      id: "l1-highest",
      luna: { mood: "thinking", says: "Drag the Sun through a whole month. Find its highest moment." },
      hint: todo(highest),
      explain: todo(highest),
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: flatMonth,
      goal: { metric: "sun_el_deg", op: "==", value: "{{example.l1.sun_el_max_deg}}" },
      answerLabel: "{{example.l1.sun_el_max_deg}}°",
    },
    {
      id: "l1-directions",
      luna: { mood: "thinking", says: "Over that month, which directions does the Sun visit?" },
      hint: todo(directions),
      explain: todo(directions),
      kind: "predict",
      options: ["Only east and west", "All the way round", "Only north"],
      answer: 1,
      reveal: {
        kind: "panel",
        panel: "SystemView",
        caption: todo("the System view plays one month."),
        scene: flatMonth,
        when: oneMonth("{{example.l1.example_utc}}"),
      },
    },
    {
      id: "l1-formula",
      luna: { mood: "thinking", says: "Highest Sun ≈ 90° − latitude + ( ? )" },
      hint: todo(formula),
      explain: "At 89.46°S that gives 2.08°.",
      kind: "fill-formula",
      tex: "90° − latitude + ( ? )",
      options: ["1.54°, my tilt", "23.4°", "5.1°"],
      answer: 0,
    },
    {
      id: "l1-north",
      luna: { mood: "thinking", says: "If you stood exactly on my south pole, which way is north?" },
      hint: todo('East / Up / **Every direction**. Luna: "That is why this tool is called TrueSouth."'),
      explain: "That is why this tool is called TrueSouth.",
      kind: "choice",
      options: ["East", "Up", "Every direction"],
      answer: 2,
    },
  ],
} as const satisfies Lesson;

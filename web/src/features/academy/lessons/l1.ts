import type { Lesson } from "../types";
import { oneMonth, storyScene } from "./story";

/**
 * Lesson 1, "Where's the Sun?". Every line is copied from docs/academy/lessons.md, section
 * 1 and its "Words" list; change the words there first. Numbers from the data are
 * `{{example.…}}` placeholders. The 1.54° tilt is the doc's rule of thumb, not a
 * worked-example value.
 */
const flatMonth = storyScene("flat", oneMonth("{{example.l1.example_utc}}"));

const highestLuna =
  "This month the Sun climbs only to {{example.l1.sun_el_max_deg}}°, and sinks to {{example.l1.sun_el_min_deg}}°. It skims my horizon.";
/**
 * The highest-Sun rule of thumb, docs/science.md §3.4: 90° − |latitude| + 1.54°. It is an
 * estimate, not a limit (the stored six years reach a little higher at the story site), so
 * Luna says "about 2°" and never words it as a limit.
 */
const formulaLuna =
  "My tilt is about 1.54°; 23.4° is Earth's tilt, and 5.1° is the tilt of my orbit. That rule of thumb says about 2° at Pip's latitude in the best season. This month the Sun only gets to {{example.l1.sun_el_max_deg}}°. Both are true: one is an estimate for the best season, the other is this month.";

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
        says: "On me, the Moon, a day lasts about a month, and midday is when the Sun is highest. At my equator the midday Sun is almost overhead. How high does it get at my south pole?",
      },
      hint: "My south pole is as far from my equator as you can go. Picture the Sun near the edge of the sky.",
      explain: "At my south pole the Sun stays low, skimming the horizon. Pip sees it side-on, never overhead.",
      kind: "choice",
      options: ["Overhead", "About 45°", "Under 3°"],
      answer: 2,
      // Pip under a sky ruler, so "how high" is an angle before the question asks it.
      stage: { scene: "sky-ruler", caption: "Pip, our lander", angles: [90, 45, "{{example.l1.sun_el_max_deg}}"] },
    },
    {
      id: "l1-highest",
      luna: { mood: "thinking", says: "Here is one month at Connecting Ridge, where Pip landed: the dotted line is the Sun's path. Drag the Sun to its highest moment, and watch its elevation, its height in degrees, below." },
      hint: "The Sun's height changes slowly. Drag back and forth near the top of its path.",
      explain: highestLuna,
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: flatMonth,
      // Within half the series' stored step of 0.01°: the hours that read as the highest.
      goal: { metric: "sun_el_deg", op: "==", value: "{{example.l1.sun_el_max_deg}}", tolerance: 0.005 },
      answerLabel: "{{example.l1.sun_el_max_deg}}°",
      preview: { reveal: highestLuna },
    },
    {
      id: "l1-directions",
      luna: { mood: "thinking", says: "Over that month, one of my days, which compass directions does the Sun visit?" },
      hint: "This month the Sun stays low the whole time. Where can a low Sun go?",
      explain: "All the way round. This month the Sun's direction circles the whole horizon; it stays low, and for part of the month it is just below level.",
      kind: "predict",
      options: ["Only east and west", "All the way round", "Only north"],
      answer: 1,
      reveal: {
        kind: "panel",
        panel: "SystemView",
        caption:
          "Over the month the Sun's direction goes all the way round Pip's compass. Its height stays between {{example.l1.sun_el_min_deg}}° and {{example.l1.sun_el_max_deg}}°, so for part of the month it is just below level.",
        scene: flatMonth,
        when: oneMonth("{{example.l1.example_utc}}"),
      },
    },
    {
      id: "l1-formula",
      luna: { mood: "thinking", says: "How far south you are is counted in degrees: 0° at my equator, 90° at my pole. Highest Sun ≈ (90° − how far south you are) + ( ? )" },
      hint: "The missing piece is a small angle of my own: how far my equator tilts from my path around the Sun.",
      explain: formulaLuna,
      kind: "fill-formula",
      tex: "(90° − how far south you are) + ( ? )",
      options: ["1.54°, my tilt", "23.4°", "5.1°"],
      answer: 0,
    },
    {
      id: "l1-north",
      luna: { mood: "thinking", says: "If you stood exactly on my south pole, which way is north?" },
      hint: "Stand on the very point I spin around. Every step you take leads away from it.",
      explain: "Every step away from my south pole is a step north. That is why this tool is called TrueSouth.",
      kind: "choice",
      options: ["East", "Up", "Every direction"],
      answer: 2,
    },
  ],
} as const satisfies Lesson;

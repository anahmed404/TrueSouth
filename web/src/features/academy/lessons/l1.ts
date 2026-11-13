import type { Lesson } from "../types";
import { oneMonth, storyScene } from "./story";

/**
 * Lesson 1, "Where's the Sun?". Every line is copied from docs/academy/lessons.md, section
 * 1 and its "Words" list; change the words there first. Numbers from the data are
 * `{{example.…}}` placeholders. The 1.54° tilt and its 2.08° result are the doc's rule of
 * thumb, not worked-example values.
 */
const flatMonth = storyScene("flat", oneMonth("{{example.l1.example_utc}}"));

const highestLuna =
  "This month the Sun climbs only to {{example.l1.sun_el_max_deg}}°, and sinks to {{example.l1.sun_el_min_deg}}°. It skims my horizon.";
const formulaLuna =
  "At Pip's latitude that gives 2.08°, the most my Sun can reach here in the best season. This month it only gets to {{example.l1.sun_el_max_deg}}°; both numbers are true.";

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
      hint: "My south pole is as far from my equator as you can go. Picture the Sun near the edge of the sky.",
      explain: "At my south pole the Sun stays low, skimming the horizon. Pip sees it side-on, never overhead.",
      kind: "choice",
      options: ["Overhead", "About 45°", "Under 3°"],
      answer: 2,
    },
    {
      id: "l1-highest",
      luna: { mood: "thinking", says: "Drag the Sun through a whole month. Find its highest moment." },
      hint: "The Sun's height changes slowly. Drag back and forth near the top of its path.",
      explain: highestLuna,
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: flatMonth,
      goal: { metric: "sun_el_deg", op: "==", value: "{{example.l1.sun_el_max_deg}}" },
      answerLabel: "{{example.l1.sun_el_max_deg}}°",
      preview: {
        says: "Soon you'll drag the Sun through a whole month here, to find its highest moment. For now, here's what you would find.",
        reveal: highestLuna,
      },
    },
    {
      id: "l1-directions",
      luna: { mood: "thinking", says: "Over that month, which directions does the Sun visit?" },
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
      luna: { mood: "thinking", says: "Highest Sun ≈ 90° − latitude + ( ? )" },
      hint: "The missing piece is a small angle of my own: how far my spin axis leans.",
      explain: formulaLuna,
      kind: "fill-formula",
      tex: "90° − latitude + ( ? )",
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

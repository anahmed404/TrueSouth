import type { Scenario } from "../../../app/panel";
import type { WorkedExamples } from "../placeholders";
import type { Lesson, UnderTheHoodCard } from "../types";
import { sampleProfile } from "./sample-profile";

/**
 * Sample lesson for the step runner. A5 replaces it.
 * It is not one of the eight lessons, and it states no fact about the Moon.
 */
export const SAMPLE_LESSON_ID = "sample";

const scenario: Scenario = {
  profile: sampleProfile,
  siteIds: ["sample-site"],
  focusedSiteId: "sample-site",
  landingUtc: "2028-01-01T00:00:00Z",
  currentUtc: "2028-01-01T00:00:00Z",
};

export const sampleExamples = {
  "sample.label": "alpha",
} as const satisfies WorkedExamples;

export const sampleCard: UnderTheHoodCard = {
  id: "sample",
  idea: "This sample shows the step runner. It does not teach a formula. A5 replaces it.",
  formula: "There is no formula in this sample.",
  formulaSection: "This sample cites no section.",
  workedExample: "The sample label is {{example.sample.label}}.",
  inTheCode: { fn: "reduceRunner", file: "web/src/features/academy/runner.ts" },
  whatCanGoWrong: "Treating this sample as one of the eight lessons.",
};

export const sampleLesson = {
  id: SAMPLE_LESSON_ID,
  title: "Sample lesson",
  tagline: "A sample the runner can play. A5 replaces it.",
  patch: { name: "Sample patch", art: "sample" },
  unlocks: "SystemView",
  recap: "A step can be right the first time, right on the second try, or shown after two misses.",
  card: sampleCard.id,
  steps: [
    {
      id: "label",
      luna: { mood: "thinking", says: "Which label is {{example.sample.label}}?" },
      hint: "It is the second label.",
      explain: "Alpha is the sample label.",
      pip: { power: 80, link: true },
      kind: "choice",
      options: ["beta", "alpha"],
      answer: 1,
    },
    {
      id: "order",
      luna: { mood: "thinking", says: "Which of these two words comes first in the alphabet?" },
      hint: "Start at the beginning of the alphabet.",
      explain: "Apple comes before nibble.",
      kind: "predict",
      options: ["nibble", "apple"],
      answer: 1,
      reveal: {
        panel: "SystemView",
        caption: "A sample reveal. No mission view plays here.",
      },
    },
    {
      id: "marker",
      luna: { mood: "happy", says: "Move the marker with the arrow keys, then check." },
      hint: "Any marker position passes in this sample.",
      explain: "The marker is set.",
      kind: "drag-body",
      body: "sun",
      scene: { scenario },
      goal: { metric: "sample_marker", op: ">=", value: 0 },
    },
    {
      id: "sketch",
      luna: { mood: "thinking", says: "Make any sketch, then check. This sample accepts every sketch." },
      hint: "Press Sketch, then Check.",
      explain: "Every sketch passes.",
      kind: "draw-skyline",
      scene: { scenario },
      azFrom: 0,
      azTo: 1,
    },
    {
      id: "pin",
      luna: { mood: "thinking", says: "Place the pin, then check." },
      hint: "Press Place the pin, then Check.",
      explain: "The pin is placed.",
      kind: "drop-pin",
      map: { siteIds: ["sample-site"] },
      goal: { metric: "sample_pin", op: "==", value: 1 },
    },
    {
      id: "slider",
      luna: { mood: "thinking", says: "Move the slider with the arrow keys, then check." },
      hint: "Any slider position passes in this sample.",
      explain: "The slider is set.",
      kind: "tune-slider",
      slider: { min: 0, max: 2, step: 1, unit: "steps" },
      goal: { metric: "sample_slider", op: ">=", value: 0 },
    },
    {
      id: "sum",
      luna: { mood: "thinking", says: "Pick the missing piece. This is a toy sum." },
      hint: "What do you add to 1 to get 2?",
      explain: "1 + 1 = 2.",
      kind: "fill-formula",
      tex: "1 + ? = 2",
      options: ["0", "1"],
      answer: 1,
    },
    {
      id: "bug",
      luna: { mood: "thinking", says: "One of these lines is wrong. Which one?" },
      hint: "2 + 2 is not 5.",
      explain: "2 + 2 is 4, so the last line is wrong.",
      kind: "spot-bug",
      lines: ["Start at 2.", "Add 2.", "The total is 5."],
      buggyLine: 2,
    },
  ],
} as const satisfies Lesson;

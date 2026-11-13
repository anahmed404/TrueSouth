import type { Scenario } from "../../../app/panel";
import type { WorkedExamples } from "../placeholders";
import type { Lesson, UnderTheHoodCard } from "../types";
import { sampleProfile } from "./sample-profile";

/**
 * Sample lesson for the step runner and the lesson screen. A5 replaces it.
 * It is not one of the eight lessons, and it states no fact about the Moon: its questions
 * are about angles, the alphabet and sums. It has one step of every kind, so every state
 * of every step can be seen. The last three kinds embed Mission Control panels and are
 * work package A3; until then the screen shows a placeholder and lets the learner skip.
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
  "sample.right_angle_deg": 90,
  "sample.slider_target": 3,
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
  patch: { name: "Sample", art: "sample" },
  unlocks: "SystemView",
  recap: "A step can be right the first time, right on the second try, or shown after two misses.",
  card: sampleCard.id,
  steps: [
    {
      id: "angle",
      luna: {
        mood: "thinking",
        says: "This sample asks about angles, not about me. Which of these stands straight up from the ground?",
      },
      hint: "Straight up is as far from the flat ground as an angle can get.",
      explain: "Straight up is {{example.sample.right_angle_deg}}° from the horizon.",
      pip: { power: 80, link: true },
      kind: "choice",
      options: ["About 45°", "{{example.sample.right_angle_deg}}°", "Under 2°"],
      answer: 1,
      stage: {
        scene: "sky-ruler",
        caption: "Pip, on flat ground",
        angles: [45, "{{example.sample.right_angle_deg}}", 2],
      },
    },
    {
      id: "order",
      luna: { mood: "thinking", says: "Guess first: which of these two words comes first in the alphabet?" },
      hint: "Start at the beginning of the alphabet.",
      explain: "Apple starts with a, the first letter.",
      pip: { power: 64 },
      kind: "predict",
      options: ["nibble", "apple"],
      answer: 1,
      reveal: { text: "Sorted from a to z, apple comes before nibble." },
    },
    {
      id: "sum",
      luna: { mood: "thinking", says: "Pick the missing piece. This is a toy sum." },
      hint: "What do you add to 1 to get 2?",
      explain: "1 + 1 = 2.",
      kind: "fill-formula",
      tex: "1 + ? = 2",
      options: ["0", "1", "2"],
      answer: 1,
    },
    {
      id: "bug",
      luna: { mood: "thinking", says: "One of these lines is wrong. Which one?" },
      hint: "2 + 2 is not 5.",
      explain: "2 + 2 is 4, so the last line is wrong.",
      kind: "spot-bug",
      title: "A toy sum, line by line",
      lines: ["Start at 2.", "Add 2.", "The total is 5."],
      buggyLine: 2,
    },
    {
      id: "slider",
      luna: { mood: "thinking", says: "Move the slider to {{example.sample.slider_target}} steps, then check." },
      hint: "Count the steps from the left: the goal is {{example.sample.slider_target}}.",
      explain: "The slider is at {{example.sample.slider_target}} steps.",
      pip: { power: 40, link: false },
      kind: "tune-slider",
      slider: { min: 0, max: 5, step: 1, unit: "steps", label: "Steps" },
      goal: { metric: "sample_slider", op: "==", value: "{{example.sample.slider_target}}" },
      answerLabel: "{{example.sample.slider_target}} steps",
    },
    {
      id: "marker",
      luna: { mood: "happy", says: "Here you would drag the Sun along its path." },
      hint: "Any marker position passes in this sample.",
      explain: "The marker is set.",
      kind: "drag-body",
      body: "sun",
      scene: { scenario },
      goal: { metric: "sample_marker", op: ">=", value: 0 },
    },
    {
      id: "sketch",
      luna: { mood: "thinking", says: "Here you would sketch the skyline." },
      hint: "Every sketch passes.",
      explain: "Every sketch passes; closer sketches earn more.",
      kind: "draw-skyline",
      scene: { scenario },
      azFrom: 0,
      azTo: 1,
    },
    {
      id: "pin",
      luna: { mood: "thinking", says: "Here you would drop a pin on the map." },
      hint: "Any pin passes in this sample.",
      explain: "The pin is placed.",
      kind: "drop-pin",
      map: { siteIds: ["sample-site"] },
    },
  ],
} as const satisfies Lesson;

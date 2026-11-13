import type { Scenario } from "../../../app/panel";
import type { WorkedExamples } from "../placeholders";
import type { Lesson, UnderTheHoodCard } from "../types";
import { sampleProfile } from "./sample-profile";

/**
 * Sample lesson for the step runner and the lesson screen. A5 replaces it.
 * It is not one of the eight lessons, and its steps state no fact about the Moon: its
 * questions are about angles, the alphabet and sums. Its card is real (see `sampleCard`). It has one step of every kind, so every state
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

/** Section 4 of docs/science.md, which the sample card quotes. */
const section4 = { number: "4", title: "How high a piece of terrain looks" } as const;

/**
 * The sample card. Unlike the sample's steps it is real: it quotes section 4 of
 * docs/science.md, and its worked example uses lesson 3's keys from
 * `worked_examples.json`, so every part of the renderer can be seen with real data. One
 * key, `sample.sun_el_deg`, is missing on purpose, to show the "value not built yet" chip.
 * A5 writes the eight lessons' own cards.
 */
export const sampleCard: UnderTheHoodCard = {
  id: "sample",
  idea:
    "This sample card shows every part a card can hold, with a real formula. The Moon is round, so the ground falls away below a level line as you look farther out. Far terrain sinks towards the horizon, and with the Sun this low, that small drop can decide light or shadow.",
  formulas: [
    {
      id: "drop",
      lead: "How far the round Moon drops away below a level line, at a ground distance $s$:",
      tex: "s^2/2R",
      display: "inline",
      reading: "s squared, divided by two times R.",
      section: section4,
      symbols: [
        { tex: "s", meaning: "Distance along the ground to the terrain point", unit: "m" },
        { tex: "R", meaning: "The Moon's radius, the size of its reference sphere", unit: "m" },
      ],
    },
    {
      id: "elevation",
      lead: "How high a piece of terrain looks, when it is much closer than the Moon's radius:",
      tex: String.raw`e \approx \arctan\left(\frac{(z - z_0 - h_{obs}) - \dfrac{s^2}{2R}}{s}\right)`,
      display: "block",
      reading:
        "The elevation e is about the angle whose tangent is: the terrain's height above your eyes, take away the drop, all divided by the distance.",
      section: section4,
      symbols: [
        { tex: "e", meaning: "The terrain's [[elevation]]: how far above level it looks", unit: "rad" },
        { tex: "z", meaning: "The terrain point's height above the reference sphere", unit: "m" },
        { tex: "z_0", meaning: "The ground's height under the observer", unit: "m" },
        { tex: "h_{obs}", meaning: "How high the observer's eyes are above the ground", unit: "m" },
        { tex: "s", meaning: "Distance along the ground to the terrain point", unit: "m" },
        { tex: "R", meaning: "The Moon's radius, the size of its reference sphere", unit: "m" },
      ],
    },
    {
      id: "dip",
      lead: "On flat ground, the horizon itself sits a little below level for an observer at height $h$:",
      tex: String.raw`-\arccos\left(\tfrac{R}{R+h}\right) \approx -\sqrt{2h/R}`,
      display: "block",
      reading:
        "Minus the angle whose cosine is R divided by R plus h. That is close to minus the square root of two h divided by R.",
      section: section4,
      symbols: [{ tex: "h", meaning: "The observer's height above flat ground", unit: "m" }],
    },
  ],
  workedExample: {
    title: "one skyline bin, at azimuth {{example.l3.example_bin_az}}°",
    intro: "One [[skyline_bin|skyline bin]]. The terrain point that sets it is its [[blocker]].",
    rows: [
      { label: "Distance along the ground, $s$", value: "{{example.l3.example_dist_km}} km" },
      { label: "Height above Pip's eyes, $z - z_0 - h_{obs}$", value: "{{example.l3.example_height_m}} m" },
      {
        label: "Putting them into the formula",
        tex: String.raw`e \approx \arctan\left(\frac{ {{example.l3.example_height_m}}\,\text{m} - \dfrac{s^2}{2R} }{s}\right), \quad s = {{example.l3.example_dist_km}}\,\text{km}`,
      },
      { label: "It would look, on a flat Moon", value: "{{example.l3.example_el_flat_deg}}°" },
      { label: "It looks, on the round Moon, $e$", value: "{{example.l3.example_el_true_deg}}°" },
      { label: "For scale: the drop at 20 km", value: "{{example.l3.drop_at_20km_m}} m" },
      { label: "The Sun's height at that hour", value: "{{example.sample.sun_el_deg}}°" },
    ],
    outro:
      "On the round Moon the ridge looks {{compare:l3.example_el_true_deg,l3.example_el_flat_deg|lower than|higher than|as high as}} on a flat Moon: {{example.l3.example_el_true_deg}}° against {{example.l3.example_el_flat_deg}}°.",
  },
  inTheCode: [
    {
      fn: "elevation_angle",
      file: "science/src/truesouth/skyline.py",
      does: "Works out the exact angle for one terrain point, with the round Moon in it.",
    },
  ],
  whatCanGoWrong: [
    "A flat-Moon calculation, with no $s^2/2R$ term, puts far ridges in the sky that are really below the horizon.",
    "The short formula drifts at long range, so the code uses the exact one from the same section.",
    "Mixing kilometres and metres: $s$ and $R$ must be in the same unit.",
  ],
  compare: [["l3.example_el_flat_deg", "l3.example_el_true_deg"]],
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
      reveal: { kind: "text", text: "Sorted from a to z, apple comes before nibble." },
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
      slider: { kind: "number", min: 0, max: 5, step: 1, unit: "steps", label: "Steps" },
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
      panel: "LandersEye",
      scene: { scenario, skyline: "terrain", timeRange: null },
      goal: { metric: "sample_marker", op: ">=", value: 0 },
    },
    {
      id: "sketch",
      luna: { mood: "thinking", says: "Here you would sketch the skyline." },
      hint: "Every sketch passes.",
      explain: "Every sketch passes; closer sketches earn more.",
      kind: "draw-skyline",
      scene: { scenario, skyline: "terrain", timeRange: null },
      window: { kind: "between", from: 0, to: 10 },
    },
    {
      id: "pin",
      luna: { mood: "thinking", says: "Here you would drop a pin on the map." },
      hint: "Any pin passes in this sample.",
      explain: "The pin is placed.",
      kind: "drop-pin",
      map: { view: "polar", siteIds: ["sample-site"], sitesKey: null, aside: null },
    },
  ],
} as const satisfies Lesson;

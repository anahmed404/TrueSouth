import type { Lesson, SceneSpec, SkylineKind, TimeRange } from "../types";
import { hoursAround, storyScenario, todo } from "./story";

/**
 * Lesson 2, "Mountains steal sunlight". Typed skeleton. Not in the catalog yet.
 * Quoted lines are copied from docs/academy/lessons.md. `TODO(words):` marks a description.
 * The view looks from the lesson 2 site, which is not always the story site.
 */
function lesson2Scene(skyline: SkylineKind, timeRange: TimeRange | null): SceneSpec {
  return {
    scenario: {
      ...storyScenario,
      siteIds: ["{{example.l2.site_id}}"],
      focusedSiteId: "{{example.l2.site_id}}",
    },
    skyline,
    timeRange,
  };
}

const terrain = lesson2Scene("terrain", null);
const sunDrag = lesson2Scene("terrain", hoursAround("{{example.l2.example_utc}}", 24));

const shadow =
  "Sunlight / **Shadow**. Reveal: the Lander's eye view at that hour. The ridge looks {{l2.ridge_el_deg}}° tall.";
const pieces = "**its height above you** / its height above sea level / its width";
const sketch = "The real skyline is laid over the sketch. Closer sketches earn more XP; every sketch passes.";
const disc = "Goal: `sun_frac < 0.5`. Pip's power meter follows the visible share.";

export const lesson2 = {
  id: "l2_skyline",
  title: "Mountains steal sunlight",
  tagline: "With the Sun that low, the terrain's skyline decides light or shadow.",
  patch: { name: "Skyline Sketcher", art: "l2_skyline" },
  unlocks: "LandersEye",
  recap: "With the Sun that low, the terrain's skyline decides light or shadow.",
  card: "l2_skyline",
  steps: [
    {
      id: "l2-shadow",
      luna: {
        mood: "thinking",
        says: "The Sun is {{example.l2.sun_el_deg}}° up. A ridge {{example.l2.ridge_dist_km}} km away stands {{example.l2.ridge_rise_m}} m above Pip. Sunlight or shadow?",
      },
      hint: todo(shadow),
      explain: todo(shadow),
      kind: "predict",
      options: ["Sunlight", "Shadow"],
      answer: 1,
      reveal: {
        kind: "panel",
        panel: "LandersEye",
        caption: todo("the Lander's eye view at that hour. The ridge looks {{l2.ridge_el_deg}}° tall."),
        scene: terrain,
        when: { kind: "hour", utc: "{{example.l2.example_utc}}" },
      },
    },
    {
      id: "l2-angle",
      luna: { mood: "thinking", says: "How tall a ridge looks: angle = atan( ? ÷ distance )" },
      hint: todo(pieces),
      explain: todo(pieces),
      kind: "fill-formula",
      tex: "atan( ? ÷ distance )",
      options: ["its height above you", "its height above sea level", "its width"],
      answer: 0,
    },
    {
      id: "l2-sketch",
      luna: { mood: "thinking", says: "Sketch the skyline you think Pip sees in this direction." },
      hint: todo(sketch),
      explain: todo(sketch),
      kind: "draw-skyline",
      scene: terrain,
      window: { kind: "centred", centre: "{{example.l2.sun_az_deg}}", halfWidthDeg: 30 },
    },
    {
      id: "l2-disc",
      luna: { mood: "thinking", says: "The Sun is a disc, not a dot. Find a moment when more than half of it is hidden." },
      hint: todo(disc),
      explain: todo(disc),
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: sunDrag,
      goal: { metric: "sun_frac", op: "<", value: 0.5 },
      readout: ["{{example.l2.site_name}}"],
      follow: { power: "sun-fraction" },
    },
    {
      id: "l2-near",
      luna: {
        mood: "thinking",
        says: "Which blocks more sky: a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away?",
      },
      hint: todo('**The near ridge** / The far mountain. Luna: "Surprised? The next lesson explains why."'),
      explain: "Surprised? The next lesson explains why.",
      kind: "choice",
      options: ["The near ridge", "The far mountain"],
      answer: 0,
    },
  ],
} as const satisfies Lesson;

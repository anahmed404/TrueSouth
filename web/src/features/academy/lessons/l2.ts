import type { Lesson, SceneSpec, SkylineKind, TimeRange } from "../types";
import { hoursAround, storyScenario } from "./story";

/**
 * Lesson 2, "Mountains steal sunlight". Every line is copied from docs/academy/lessons.md,
 * section 2 and its "Words" list; change the words there first.
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

const moved =
  "I moved us to {{example.l2.site_name}}, where a ridge in the Sun's direction stands above Pip. From a high ridge like Connecting Ridge, distant ground mostly lies below Pip's eyes.";

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
        says: "From {{example.l2.site_name}}, the Sun is {{example.l2.sun_el_deg}}° up. In the Sun's direction, a ridge {{example.l2.ridge_dist_km}} km away stands {{example.l2.ridge_rise_m}} m above Pip. Sunlight or shadow?",
      },
      hint: "Compare two angles: how high the Sun is, and how tall the ridge looks from Pip.",
      explain: moved,
      kind: "predict",
      options: ["Sunlight", "Shadow"],
      answer: 1,
      reveal: {
        kind: "panel",
        panel: "LandersEye",
        caption:
          "The Lander's eye view at that hour. From Pip the ridge looks {{example.l2.ridge_el_deg}}° tall, and the Sun is {{example.l2.sun_el_deg}}° up.",
        scene: terrain,
        when: { kind: "hour", utc: "{{example.l2.example_utc}}" },
      },
    },
    {
      id: "l2-angle",
      luna: { mood: "thinking", says: "How tall a ridge looks: angle = atan( ? ÷ distance )" },
      hint: "Start from Pip's eyes. What matters is how far the ridge rises from there.",
      explain: "Its height above you. What counts is how far the ridge rises above Pip's eyes, not above some far-off reference.",
      kind: "fill-formula",
      tex: "atan( ? ÷ distance )",
      options: ["its height above you", "its height above sea level", "its width"],
      answer: 0,
    },
    {
      id: "l2-sketch",
      luna: { mood: "thinking", says: "Sketch the skyline you think Pip sees from {{example.l2.site_name}}, towards the Sun." },
      hint: "Start with the ridge from the first step, then guess where the ground falls away on each side.",
      explain: "Every sketch counts. The closer yours is to the real skyline, the more XP it earns.",
      kind: "draw-skyline",
      scene: terrain,
      window: { kind: "centred", centre: "{{example.l2.sun_az_deg}}", halfWidthDeg: 30 },
      preview: {
        says: "Soon you'll sketch the skyline you think Pip sees here, then see the real one laid over it. For now, here's the real one, towards the Sun.",
        reveal:
          "Towards the Sun, at azimuth {{example.l2.sun_az_deg}}°, the skyline stands {{example.l2.ridge_el_deg}}° high. That is the ridge from the first step.",
      },
    },
    {
      id: "l2-disc",
      luna: { mood: "thinking", says: "The Sun is a disc, not a dot. Find a moment when more than half of it is hidden." },
      hint: "Look for a moment when the Sun's centre sits just below the skyline.",
      explain: "More than half the disc is behind the ridge. Pip's power falls with the share that shows, not all at once.",
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: sunDrag,
      goal: { metric: "sun_frac", op: "<", value: 0.5 },
      readout: ["{{example.l2.site_name}}"],
      follow: { power: "sun-fraction" },
      preview: {
        says: "Soon you'll drag the Sun here and watch Pip's power follow the share of its disc that shows. For now, here's the hour from the first step.",
        reveal:
          "At that hour, the share of the Sun's disc above the skyline is {{example.l2.sun_frac}}, where 0 is fully hidden and 1 is fully clear.",
      },
    },
    {
      id: "l2-near",
      luna: {
        mood: "thinking",
        says: "Looking the same way, which blocks more sky: a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away?",
      },
      hint: "Height matters, but so does distance. Think about how tall each one looks from Pip.",
      explain: "Surprised? The next lesson explains why.",
      kind: "choice",
      options: ["The near ridge", "The far mountain"],
      answer: 0,
    },
  ],
} as const satisfies Lesson;

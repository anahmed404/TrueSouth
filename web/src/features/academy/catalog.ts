import type { PanelId } from "./types";

export type LessonSummary = {
  id: string;
  title: string;
  tagline: string;
  patchName: string;
  unlocks: PanelId;
};

/**
 * The eight lessons, in path order. Titles, taglines and mission patch names
 * are the ones in docs/academy/lessons.md. A5 and A6 fill in the steps.
 */
export const LESSONS: readonly LessonSummary[] = [
  {
    id: "l1_sun",
    title: "Where's the Sun?",
    tagline: "At the south pole the Sun never climbs; it circles the horizon.",
    patchName: "Sun Chaser",
    unlocks: "SystemView",
  },
  {
    id: "l2_skyline",
    title: "Mountains steal sunlight",
    tagline: "With the Sun that low, the terrain's skyline decides light or shadow.",
    patchName: "Skyline Sketcher",
    unlocks: "LandersEye",
  },
  {
    id: "l3_horizon",
    title: "The Moon is round",
    tagline: "The ground curves away, so far mountains sink below the horizon.",
    patchName: "Horizon Hunter",
    unlocks: "LocalTerrain",
  },
  {
    id: "l4_link",
    title: "Phone home",
    tagline: "From the pole, Earth bobs above and below the horizon each month.",
    patchName: "Signal Keeper",
    unlocks: "Timeline",
  },
  {
    id: "l5_slope",
    title: "Don't tip over",
    tagline: "Slope decides whether a lander stays upright, and slope depends on the ruler.",
    patchName: "Steady Feet",
    unlocks: "PolarMap",
  },
  {
    id: "l6_tradeoffs",
    title: "Trade-offs",
    tagline: "Hard limits rule sites out; preferences rank what is left.",
    patchName: "Decision Maker",
    unlocks: "Compare",
  },
  {
    id: "l7_slip",
    title: "The slip",
    tagline: "The date matters as much as the place.",
    patchName: "Time Bender",
    unlocks: "SlipPlanner",
  },
  {
    id: "l8_mission",
    title: "Final mission",
    tagline: "Put it together and choose where and when Pip lands.",
    patchName: "Mission Planner",
    unlocks: "MissionControl",
  },
];

export const CATALOG_IDS: readonly string[] = LESSONS.map((lesson) => lesson.id);

/** Mission patch earned for finishing all eight lessons. */
export const ALL_EIGHT_PATCH_ID = "all-eight";

/** The ninth mission patch's name, for finishing all eight lessons. */
export const ALL_EIGHT_PATCH_NAME = "True South";

/** All nine patches in shelf order: the eight lessons', then True South. */
export const PATCH_SHELF: readonly { id: string; name: string }[] = [
  ...LESSONS.map((lesson) => ({ id: lesson.id, name: lesson.patchName })),
  { id: ALL_EIGHT_PATCH_ID, name: ALL_EIGHT_PATCH_NAME },
];

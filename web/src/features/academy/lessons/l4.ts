import type { Lesson } from "../types";
import { oneMonth, storyScene } from "./story";

/**
 * Lesson 4, "Phone home". Every line is copied from docs/academy/lessons.md, section 4 and
 * its "Words" list; change the words there first. The 5° and 15% are the doc's own rules,
 * not worked-example values.
 */
const month = storyScene("smooth", oneMonth("{{example.l4.example_utc}}"));

const rulesLuna =
  "In this month a 5° margin gives Pip a link only {{example.l4.link_pct_mask5}}% of the time, far short of half, so line 3 calls the site NO-GO. Judge the mission's own days, not the whole month. Lesson 7.";
const range =
  "This month Earth climbs to {{example.l4.earth_el_max_deg}}° at its highest and sinks to {{example.l4.earth_el_min_deg}}° at its lowest.";

export const lesson4 = {
  id: "l4_link",
  title: "Phone home",
  tagline: "From the pole, Earth bobs above and below the horizon each month.",
  patch: { name: "Signal Keeper", art: "l4_link" },
  unlocks: ["Timeline", "Countdowns"],
  recap: "From the pole, Earth bobs above and below the horizon each month.",
  card: "l4_link",
  steps: [
    {
      id: "l4-bob",
      luna: {
        mood: "thinking",
        says: "Pip can talk to Earth only while Earth is in Pip's sky. From Apollo 11's site, Earth hangs high in the sky all the time. From my south pole?",
      },
      hint: "Earth hangs over the middle of my near side. My south pole is at the very edge of that face.",
      explain: "Seen from my pole, Earth sits on the edge of the sky. My slow wobble lifts it up and lowers it again.",
      kind: "choice",
      options: ["It is always overhead", "It never appears", "It bobs up and down at the horizon"],
      answer: 2,
    },
    {
      id: "l4-highest",
      luna: { mood: "thinking", says: "Drag Earth through the same month. Find its highest moment." },
      hint: "Earth rises and sinks slowly over the month. Drag back and forth near the top.",
      explain: `${range} Below 0° it is below level; whether Pip still sees it depends on the ground in that direction.`,
      kind: "drag-body",
      body: "earth",
      panel: "LandersEye",
      scene: month,
      readout: ["highest {{example.l4.earth_el_max_deg}}°", "lowest {{example.l4.earth_el_min_deg}}°"],
      // Within half the series' stored step of 0.01°: the hours that read as the highest.
      goal: { metric: "earth_el_deg", op: "==", value: "{{example.l4.earth_el_max_deg}}", tolerance: 0.005 },
      answerLabel: "{{example.l4.earth_el_max_deg}}°",
      preview: { reveal: range },
    },
    {
      id: "l4-up",
      luna: { mood: "thinking", says: "Over this month, how much of the time is Earth above Pip's horizon?" },
      hint: "This month Earth spends part of the time above the horizon and part below it.",
      explain: "About {{example.l4.earth_up_pct}}% of this month. The rest of the time Earth is hidden behind Pip's horizon, and Pip cannot call home.",
      kind: "predict",
      options: ["Always", "Almost never", "About {{example.l4.earth_up_pct}}%"],
      answer: 2,
      reveal: {
        kind: "panel",
        panel: "Timeline",
        caption: "The timeline's Earth band for the month: Earth is above Pip's horizon about {{example.l4.earth_up_pct}}% of the time.",
        scene: null,
        when: { kind: "band", band: "earth" },
      },
    },
    {
      id: "l4-margin",
      luna: {
        mood: "thinking",
        says: "Pip's antenna needs Earth to clear the ground by a margin, called the antenna mask. Raise the margin until Pip can talk less than 15% of this month; that share is the link time below.",
      },
      hint: "The higher the margin, the less often Earth clears it. Keep raising it and watch the link time.",
      explain:
        "From {{example.l4.mask_for_15pct_deg}}° up, Pip can talk less than 15% of this month. A bigger margin is kinder to the radio, but it costs link time.",
      kind: "tune-slider",
      slider: {
        kind: "number",
        min: 0,
        max: 10,
        step: 0.5,
        unit: "°",
        label: "Margin",
        readout: {
          kind: "example-list",
          label: "link time",
          key: "l4.link_pct_by_mask",
          origin: 0,
          step: 0.5,
        },
        follow: { link: "link-up", source: "readout" },
      },
      // Any margin at or above the first one under 15% answers the question as asked.
      goal: { metric: "antenna_mask_deg", op: ">=", value: "{{example.l4.mask_for_15pct_deg}}" },
      answerLabel: "{{example.l4.mask_for_15pct_deg}}° or more",
    },
    {
      id: "l4-bug",
      luna: {
        mood: "thinking",
        says: "TrueSouth calls a landing NO-GO when it breaks one of the mission's hard rules. An early TrueSouth used these rules and called every polar site NO-GO. Which rule made them all fail?",
      },
      hint: "Which rule asks for more than Earth gave this month? Think about how long Earth stays high.",
      explain: rulesLuna,
      kind: "spot-bug",
      title: "The early link rules",
      lines: [
        "Earth must clear the skyline",
        "by at least 5°",
        "for at least half of every month",
        "or the site is NO-GO",
      ],
      buggyLine: 2,
    },
  ],
} as const satisfies Lesson;

import type { Lesson } from "../types";
import { oneMonth, storyScene, todo } from "./story";

/**
 * Lesson 4, "Phone home". Typed skeleton. Not in the catalog yet.
 * Quoted lines are copied from docs/academy/lessons.md. `TODO(words):` marks a description.
 */
const month = storyScene("smooth", oneMonth("{{example.l4.example_utc}}"));

const bob = "It is always overhead / It never appears / **It bobs up and down at the horizon**";
const readouts = "Readouts: highest {{example.l4.earth_el_max_deg}}°, lowest {{example.l4.earth_el_min_deg}}°.";
const share = "Always / Almost never / **About {{example.l4.earth_up_pct}}%**. Reveal: the timeline's Earth band.";
const margin = "Goal: about {{example.l4.mask_for_15pct_deg}}°. Readout: link time. Pip's link meter follows.";
const rulesLuna =
  "A 5° margin held for half of every month can never be met: with a 5° margin Pip can talk only {{example.l4.link_pct_mask5}}% of the time. Judge the mission's own days, not the whole month. Lesson 7.";
const rules = `Lines: (1) Earth must clear the skyline; (2) by at least 5°; **(3) for at least half of every month**; (4) or the site is NO-GO. Luna: "${rulesLuna}"`;

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
        says: "From Apollo 11's site, Earth hangs high in the sky all the time. From my south pole?",
      },
      hint: todo(bob),
      explain: todo(bob),
      kind: "choice",
      options: ["It is always overhead", "It never appears", "It bobs up and down at the horizon"],
      answer: 2,
    },
    {
      id: "l4-highest",
      luna: { mood: "thinking", says: "Drag Earth through a month. Find its highest moment." },
      hint: todo(readouts),
      explain: todo(readouts),
      kind: "drag-body",
      body: "earth",
      panel: "LandersEye",
      scene: month,
      readout: ["highest {{example.l4.earth_el_max_deg}}°", "lowest {{example.l4.earth_el_min_deg}}°"],
      goal: { metric: "earth_el_deg", op: "==", value: "{{example.l4.earth_el_max_deg}}" },
    },
    {
      id: "l4-up",
      luna: { mood: "thinking", says: "Over a month, how much of the time is Earth above Pip's horizon?" },
      hint: todo(share),
      explain: todo(share),
      kind: "predict",
      options: ["Always", "Almost never", "About {{example.l4.earth_up_pct}}%"],
      answer: 2,
      reveal: {
        kind: "panel",
        panel: "Timeline",
        caption: todo("the timeline's Earth band."),
        scene: null,
        when: { kind: "band", band: "earth" },
      },
    },
    {
      id: "l4-margin",
      luna: {
        mood: "thinking",
        says: "Pip's antenna needs Earth to clear the ground by some margin. Raise the margin until Pip can talk less than 15% of the time.",
      },
      hint: todo(margin),
      explain: todo(margin),
      kind: "tune-slider",
      slider: {
        kind: "number",
        min: 0,
        max: 10,
        step: 0.5,
        unit: "°",
        label: "margin",
        readout: {
          kind: "example-list",
          label: "link time",
          key: "l4.link_pct_by_mask",
          origin: 0,
          step: 0.5,
        },
        follow: { link: "link-up", source: "readout" },
      },
      goal: { metric: "antenna_mask_deg", op: "==", value: "{{example.l4.mask_for_15pct_deg}}", tolerance: 1 },
      answerLabel: "{{example.l4.mask_for_15pct_deg}}°",
    },
    {
      id: "l4-bug",
      luna: {
        mood: "thinking",
        says: "An early TrueSouth used these rules and called every polar site NO-GO. Which rule can never be met here?",
      },
      hint: todo(rules),
      explain: rulesLuna,
      kind: "spot-bug",
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

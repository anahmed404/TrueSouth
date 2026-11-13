import type { UnderTheHoodCard } from "../types";

const section32 = { number: "3.2", title: "From the global pull to any site" } as const;

/**
 * Lesson 4's card: Earth bobs at the horizon, and a link needs clearance (docs/academy/
 * lessons.md, lesson 4, "Card"). Formulas are quoted from docs/science.md §3.2 and §3.4; the link
 * rule of §9 is code, not TeX, so it is quoted as code in the worked example.
 */
export const l4Card: UnderTheHoodCard = {
  id: "l4_link",
  idea:
    "Earth hangs almost still over the middle of my near side, and my south pole sits at the edge of that face. My slow wobble, [[libration]], makes the [[sub_earth_point|sub-Earth point]] wander, so from Pip Earth bobs above and below the horizon each month. Pip can call home only while Earth clears the skyline by the profile's [[antenna_mask|antenna mask]].",
  formulas: [
    {
      id: "direction",
      lead: "Earth's direction from Pip: Earth's position above the sub-Earth point, take away Pip's own position.",
      tex: String.raw`\hat d = \frac{\vec b - \vec r}{|\vec b - \vec r|}`,
      display: "block",
      reading: "The direction d is Earth's position b take away Pip's position r, divided by the length of that difference.",
      section: section32,
      symbols: [
        { tex: String.raw`\hat d`, meaning: "The direction from Pip to Earth, of length one", unit: null },
        { tex: String.raw`\vec b`, meaning: "Earth's position, measured from my centre", unit: "m" },
        { tex: String.raw`\vec r`, meaning: "Pip's position, measured from my centre", unit: "m" },
      ],
    },
    {
      id: "shift",
      lead: "Pip stands on my surface, not at my centre, so Earth's direction from Pip differs from its direction from my centre by at most about",
      tex: String.raw`\arcsin\left(\frac{R}{D}\right) \approx 0.26°`,
      display: "block",
      reading: "The angle whose sine is my radius divided by Earth's distance: about a quarter of a degree. It is largest when Earth sits at the horizon, as it does for the polar sites.",
      section: { number: "3.4", title: "Two rules of thumb the Academy quotes" },
      symbols: [
        { tex: "R", meaning: "My radius", unit: "m" },
        { tex: "D", meaning: "Earth's distance from me", unit: "m" },
      ],
    },
    {
      id: "radius",
      lead: "How big Earth's disc looks, from its radius $R_b$ and its distance:",
      tex: String.raw`\rho_b = \arcsin\left(\frac{R_b}{|\vec b - \vec r|}\right)`,
      display: "block",
      reading: "The disc's angular radius rho is the angle whose sine is the body's radius divided by its distance from Pip.",
      section: section32,
      symbols: [
        { tex: String.raw`\rho_b`, meaning: "How wide the disc looks, from its centre to its edge", unit: "rad" },
        { tex: "R_b", meaning: "The body's radius", unit: "m" },
      ],
    },
  ],
  workedExample: {
    title: "one hour near the antenna mask, at {{example.l4.example_utc}} UTC",
    intro:
      "Connecting Ridge, at the story month's hour whose Earth [[clearance]] is closest to Pip's antenna mask, which the IM-2 Athena profile tags as assumed.",
    rows: [
      { label: "Earth's [[azimuth]]", value: "{{example.l4.example_earth_az}}°" },
      { label: "Earth's [[elevation]]", value: "{{example.l4.example_earth_el}}°" },
      { label: "Earth's clearance above the skyline", value: "{{example.l4.example_earth_clear}}°" },
      { label: "An hour is a [[link]] when (science notes, section 9)", value: "`earth_clear ≥ antenna_mask_deg`" },
      { label: "Link time over the story month, with no margin", value: "{{example.l4.link_pct_mask0}}%" },
      { label: "With a 1° margin", value: "{{example.l4.link_pct_mask1}}%" },
      { label: "With a 5° margin", value: "{{example.l4.link_pct_mask5}}%" },
    ],
    outro:
      "Clearance is measured from the skyline, not from the level line. Where the skyline sits below level, Earth can clear it by more than its own elevation.",
  },
  inTheCode: [
    {
      fn: "topocentric",
      file: "science/src/truesouth/ephemeris.py",
      does: "Turns the sub-Earth point and Earth's distance into Earth's direction from any site.",
    },
    {
      fn: "hourFlags",
      file: "web/src/lib/scoring/scoring.ts",
      does: "Marks each hour lit or dark, and link or blackout, under the mission profile.",
    },
  ],
  whatCanGoWrong: [
    "Fixed thresholds copied from another latitude. A rule such as \"Earth well above the horizon\" suits Apollo 11's site, where Earth hangs high; at my pole Earth stays near the horizon, so the rule throws away sites that work.",
    "Measuring the mask from the wrong line. The antenna mask is clearance above the skyline; measured from the level line, it lets terrain block the signal or throws away hours that work.",
    "Judging the whole month. Pip needs a link during its own mission window, not for half of every month. That is lesson 7.",
  ],
};

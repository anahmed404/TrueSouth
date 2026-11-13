import type { FormulaSymbol, UnderTheHoodCard } from "../types";
import { approxElevation } from "./l2";

const section4 = { number: "4", title: "How high a piece of terrain looks" } as const;

const height: FormulaSymbol = {
  tex: "h",
  meaning: "A height: the observer's above flat ground (the dip), or a peak's above the observer (the far limit)",
  unit: "m",
};

/**
 * Lesson 3's card: the Moon is round (docs/academy/lessons.md, lesson 3, "Card"). Formulas
 * are quoted from docs/science.md §4 and §5. Its worked example is the story site's most
 * distant blocker, whose height above Pip is negative; the outro says so and why.
 */
export const l3Card: UnderTheHoodCard = {
  id: "l3_horizon",
  idea:
    "I am round, so the ground falls away below a level line as you look farther out. Far terrain sinks towards the horizon, and far enough away even a tall mountain drops out of sight. With the Sun this low, that small drop can decide light or shadow.",
  formulas: [
    {
      id: "exact",
      lead: "Exactly: an observer at radius $R_0$ looks at a terrain point at radius $R_1$, a ground distance $s$ away, with $\\gamma = s/R$.",
      tex: String.raw`\tan e = \frac{R_1\cos\gamma - R_0}{R_1\sin\gamma}`,
      display: "block",
      reading: "The tangent of the elevation e is: R one times the cosine of gamma, take away R nought, all divided by R one times the sine of gamma.",
      section: section4,
      symbols: [
        { tex: "e", meaning: "The terrain's [[elevation]]: how far above level it looks", unit: "rad" },
        { tex: "R_1", meaning: "The terrain point's distance from my centre", unit: "m" },
        { tex: "R_0", meaning: "The observer's eyes' distance from my centre", unit: "m" },
        { tex: String.raw`\gamma`, meaning: "The ground distance as an angle at my centre", unit: "rad" },
      ],
    },
    {
      ...approxElevation,
      lead: "When $s$ is much smaller than $R$, the exact formula becomes the simple one, with the drop $s^2/2R$ in it:",
    },
    {
      id: "dip",
      lead: "Even flat ground has its horizon a little below level, for an observer at height $h$:",
      tex: String.raw`-\arccos\left(\tfrac{R}{R+h}\right) \approx -\sqrt{2h/R}`,
      display: "block",
      reading: "Minus the angle whose cosine is R divided by R plus h. That is close to minus the square root of two h divided by R.",
      section: section4,
      symbols: [height],
    },
    {
      id: "far",
      lead: "A peak $h$ above the observer sinks below the horizon beyond",
      tex: String.raw`\sqrt{2Rh}`,
      display: "inline",
      reading: "the square root of two times R times h.",
      section: { number: "5", title: "The skyline" },
      symbols: [height],
    },
  ],
  workedExample: {
    title: "the most distant blocker, at azimuth {{example.l3.example_bin_az}}°",
    intro: "One [[skyline_bin|skyline bin]] of Connecting Ridge's skyline: the one whose [[blocker]] is farthest from Pip.",
    rows: [
      { label: "Distance along the ground, $s$", value: "{{example.l3.example_dist_km}} km" },
      { label: "Height above Pip's eyes, $z - z_0 - h_{obs}$", value: "{{example.l3.example_height_m}} m" },
      {
        label: "Putting them into the simple formula",
        tex: String.raw`e \approx \arctan\left(\frac{ {{example.l3.example_height_m}}\,\text{m} - \dfrac{s^2}{2R} }{s}\right), \quad s = {{example.l3.example_dist_km}}\,\text{km}`,
      },
      { label: "It would look, on a flat Moon", value: "{{example.l3.example_el_flat_deg}}°" },
      { label: "It looks, on the round Moon, $e$", value: "{{example.l3.example_el_true_deg}}°" },
      { label: "For scale: the drop at 20 km", value: "{{example.l3.drop_at_20km_m}} m" },
    ],
    outro:
      "In the real data the height above Pip is negative. Pip stands on a high ridge, so this far ground lies below Pip's eyes; it still sets the skyline here because nothing in that direction looks higher. On the round Moon it looks {{compare:l3.example_el_true_deg,l3.example_el_flat_deg|lower than|higher than|as high as}} on a flat Moon: {{example.l3.example_el_true_deg}}° against {{example.l3.example_el_flat_deg}}°.",
  },
  inTheCode: [
    {
      fn: "elevation_angle",
      file: "science/src/truesouth/skyline.py",
      does: "Works out the exact angle for one terrain point, with the round Moon in it.",
    },
    {
      fn: "compute_skyline",
      file: "science/src/truesouth/skyline.py",
      does: "Looks out from the site in every direction and keeps the highest angle in each bin.",
    },
  ],
  whatCanGoWrong: [
    "A flat-Moon calculation, with no $s^2/2R$ term, puts far ridges in the sky that are really below the horizon.",
    "Using the simple formula at long range. It drifts as the distance grows, so the code uses the exact one from the same section.",
    "Mixing kilometres and metres: $s$ and $R$ must be in the same unit.",
  ],
  compare: [["l3.example_el_flat_deg", "l3.example_el_true_deg"]],
};

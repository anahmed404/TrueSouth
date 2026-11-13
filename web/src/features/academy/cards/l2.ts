import type { CardFormula, UnderTheHoodCard } from "../types";

const section4 = { number: "4", title: "How high a piece of terrain looks" } as const;

/** §4's formula for terrain closer than my radius. Lessons 2 and 3 quote it. */
export const approxElevation: CardFormula = {
  id: "elevation",
  lead: "How high a piece of terrain looks, at a ground distance $s$. Leave out the drop $s^2/2R$ and this is the flat version from the lesson: height above you, over distance.",
  tex: String.raw`e \approx \arctan\left(\frac{(z - z_0 - h_{obs}) - \dfrac{s^2}{2R}}{s}\right)`,
  display: "block",
  reading:
    "The elevation e is about the angle whose tangent is: the terrain's height above your eyes, take away the drop, all divided by the distance.",
  section: section4,
  symbols: [
    { tex: "e", meaning: "The terrain's [[elevation]]: how far above level it looks", unit: "rad" },
    { tex: "z", meaning: "The terrain point's height above my reference sphere", unit: "m" },
    { tex: "z_0", meaning: "The ground's height under the observer", unit: "m" },
    { tex: "h_{obs}", meaning: "How high the observer's eyes are above the ground", unit: "m" },
    { tex: "s", meaning: "Distance along the ground to the terrain point", unit: "m" },
    { tex: "R", meaning: "My radius, the size of my reference sphere", unit: "m" },
  ],
};

/**
 * Lesson 2's card: the skyline decides light or shadow (docs/academy/lessons.md, lesson 2,
 * "Card"). Formulas are quoted from docs/science.md §4, §5 and §6.
 */
export const l2Card: UnderTheHoodCard = {
  id: "l2_skyline",
  idea:
    "With the Sun this low, the terrain decides. In each direction the [[skyline]] is the highest angle of any terrain that way, and Pip is in sunlight only while the Sun clears it. The Sun is a disc, not a point, so it can be partly hidden: the [[disc_fraction|disc fraction]] says how much of it shows.",
  formulas: [
    approxElevation,
    {
      id: "switch",
      lead: "The skyline is built two ways. Close to Pip, rays are marched out along each [[skyline_bin|skyline bin]]; beyond the switch distance, every map pixel is visited, so no peak can slip between two rays:",
      tex: String.raw`s_{switch} = \frac{\text{pixel size}}{\tan 0.25°} \approx 229 \times \text{pixel size}`,
      display: "block",
      reading: "The switch distance is the pixel size divided by the tangent of a quarter of a degree: about 229 times the pixel size.",
      section: { number: "5", title: "The skyline" },
      symbols: [{ tex: "s_{switch}", meaning: "The distance where one map pixel is as wide as one skyline bin", unit: "m" }],
    },
    {
      id: "disc",
      lead: "How much of a disc shows: cut it into thin upright strips, and add up the part of each strip that stands above the skyline $H$.",
      tex: String.raw`f = \frac{\sum_i \operatorname{clamp}\big(e_c + c_i - H(A_i),\ 0,\ 2c_i\big)}{\sum_i 2c_i}`,
      display: "block",
      reading:
        "The disc fraction f is the sum over the strips of the part of each strip above the skyline, kept between zero and the strip's full height, divided by the sum of the strips' full heights.",
      section: { number: "6", title: "How much of a disc is visible" },
      symbols: [
        { tex: "f", meaning: "The [[disc_fraction|disc fraction]]: 0 fully hidden, 1 fully clear", unit: null },
        { tex: "e_c", meaning: "The elevation of the disc's centre", unit: "rad" },
        { tex: "c_i", meaning: "Half the height of strip i", unit: "rad" },
        { tex: "H(A_i)", meaning: "The skyline's elevation at strip i's azimuth", unit: "rad" },
      ],
    },
  ],
  workedExample: {
    title: "the hour from step 1, at {{example.l2.site_name}}",
    intro:
      "At {{example.l2.example_utc}} UTC. The skyline in the Sun's direction is one [[skyline_bin|skyline bin]], set by its [[blocker]].",
    rows: [
      { label: "The Sun's [[azimuth]]", value: "{{example.l2.sun_az_deg}}°" },
      { label: "The Sun's elevation, $e_c$", value: "{{example.l2.sun_el_deg}}°" },
      { label: "The blocker's distance along the ground, $s$", value: "{{example.l2.ridge_dist_km}} km" },
      { label: "The blocker's height above Pip's eyes, $z - z_0 - h_{obs}$", value: "{{example.l2.ridge_rise_m}} m" },
      {
        label: "The flat version, for comparison",
        tex: String.raw`\arctan\left(\frac{ {{example.l2.ridge_rise_m}}\,\text{m} }{ {{example.l2.ridge_dist_km}}\,\text{km} }\right)`,
      },
      { label: "The skyline in that bin, on the round Moon, $H$", value: "{{example.l2.ridge_el_deg}}°" },
      { label: "The share of the Sun's disc that shows, $f$", value: "{{example.l2.sun_frac}}" },
    ],
    outro:
      "The Sun's centre is {{compare:l2.sun_el_deg,l2.ridge_el_deg|below|above|level with}} the skyline: {{example.l2.sun_el_deg}}° against {{example.l2.ridge_el_deg}}°.",
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
      does: "Builds a site's skyline, near field and far field, and keeps each bin's blocker.",
    },
    {
      fn: "visible_fraction",
      file: "science/src/truesouth/discs.py",
      does: "Cuts the disc into strips and adds up the part above the skyline.",
    },
  ],
  whatCanGoWrong: [
    "A peak slipping between two rays. Far from Pip, neighbouring rays are far apart, so a narrow peak can fall between them. That is why the far field visits every map pixel instead.",
    "Treating the Sun as a dot. With its centre just below the skyline its top can still shine, and with its centre just above, part of it is hidden. TrueSouth counts the share that shows.",
    "Measuring a ridge's height above a reference instead of above Pip's eyes. Only $z - z_0 - h_{obs}$ sets the angle.",
  ],
};

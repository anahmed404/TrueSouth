import type { UnderTheHoodCard } from "../types";

/**
 * Lesson 1's card: where the Sun is, from the sub-solar point (docs/academy/lessons.md,
 * lesson 1, "Card"). Formulas are quoted from docs/science.md §14, §3.4 and §3.2. §3.1 has
 * no formula: it is the Horizons pull that gives the sub-solar point, named in the text.
 */
export const l1Card: UnderTheHoodCard = {
  id: "l1_sun",
  idea:
    "The [[sub_solar_point|sub-solar point]] is the place on me where the Sun is straight overhead. TrueSouth asks JPL Horizons for it at every hour of the time grid (science notes, section 3.1). My equator is tilted only a little to my path around the Sun (science notes, section 3.4), so that point always stays near my equator, and seen from my south pole the Sun sits near the horizon all year. As I turn, the point goes round my equator, so the Sun circles Pip's horizon instead of climbing.",
  formulas: [
    {
      id: "one-line",
      lead: "A site's Sun [[elevation]] follows from the sub-solar point alone:",
      tex: String.raw`\sin e = \sin\varphi\sin\varphi_S + \cos\varphi\cos\varphi_S\cos(\lambda - \lambda_S)`,
      display: "block",
      reading:
        "The sine of the Sun's elevation e is: the sine of the site's latitude times the sine of the sub-solar latitude, plus the cosine of the site's latitude times the cosine of the sub-solar latitude times the cosine of the gap between their east longitudes.",
      section: { number: "14", title: "System view coordinates" },
      symbols: [
        { tex: "e", meaning: "The Sun's [[elevation]] at the site", unit: "rad" },
        { tex: String.raw`\varphi`, meaning: "The site's [[latitude]]", unit: "rad" },
        { tex: String.raw`\varphi_S`, meaning: "The sub-solar point's latitude", unit: "rad" },
        { tex: String.raw`\lambda`, meaning: "The site's [[east_longitude|east longitude]]", unit: "rad" },
        { tex: String.raw`\lambda_S`, meaning: "The sub-solar point's east longitude", unit: "rad" },
      ],
    },
    {
      id: "highest",
      lead: "A rule of thumb for the most the Sun's centre can rise, in the best season, on a smooth sphere. It ignores the terrain, the observer's height and the Sun's disc:",
      tex: String.raw`E_{max} \approx 90° - |\varphi| + 1.54°`,
      display: "block",
      reading:
        "The highest the Sun gets is about 90 degrees, minus how far the site is from the equator, plus the tilt of my equator to my path around the Sun.",
      section: { number: "3.4", title: "Two rules of thumb the Academy quotes" },
      symbols: [
        { tex: "E_{max}", meaning: "The most the Sun's centre can rise above level, in the best season", unit: "°" },
        { tex: String.raw`\varphi`, meaning: "The site's [[latitude]]", unit: "°" },
      ],
    },
    {
      id: "direction",
      lead: "The exact direction, which TrueSouth stores, starts from Pip's own position, not from my centre:",
      tex: String.raw`\hat d = \frac{\vec b - \vec r}{|\vec b - \vec r|}`,
      display: "block",
      reading: "The direction d is the Sun's position b take away Pip's position r, divided by the length of that difference.",
      section: { number: "3.2", title: "From the global pull to any site" },
      symbols: [
        { tex: String.raw`\hat d`, meaning: "The direction from Pip to the Sun, of length one", unit: null },
        { tex: String.raw`\vec b`, meaning: "The Sun's position, measured from my centre", unit: "m" },
        { tex: String.raw`\vec r`, meaning: "Pip's position, measured from my centre", unit: "m" },
      ],
    },
  ],
  workedExample: {
    title: "one hour at Pip's site, at {{example.l1.example_utc}} UTC",
    intro: "Connecting Ridge, at the hour when the Sun is highest in the story month.",
    rows: [
      { label: "Pip's latitude, $\\varphi$", value: "{{example.l1.site_lat_deg}}°" },
      { label: "The sub-solar latitude, $\\varphi_S$", value: "{{example.l1.example_subsolar_lat}}°" },
      { label: "The sub-solar east longitude, $\\lambda_S$", value: "{{example.l1.example_subsolar_lon}}°" },
      {
        label: "Putting them into the one-line formula",
        tex: String.raw`\sin e = \sin({{example.l1.site_lat_deg}}^\circ)\sin({{example.l1.example_subsolar_lat}}^\circ) + \cos({{example.l1.site_lat_deg}}^\circ)\cos({{example.l1.example_subsolar_lat}}^\circ)\cos(\lambda - {{example.l1.example_subsolar_lon}}^\circ)`,
      },
      {
        label: "The rule of thumb at Pip's latitude, for the best season",
        tex: String.raw`E_{max} \approx 90° - |{{example.l1.site_lat_deg}}°| + 1.54°`,
      },
      { label: "The Sun's [[azimuth]], as stored", value: "{{example.l1.example_sun_az}}°" },
      { label: "The Sun's elevation, as stored, $e$", value: "{{example.l1.example_sun_el}}°" },
    ],
    outro:
      "The one-line formula gives about the same height. The stored numbers come from the exact direction, which also counts how high Pip stands above my centre.",
  },
  inTheCode: [
    {
      fn: "topocentric",
      file: "science/src/truesouth/ephemeris.py",
      does: "Turns the sub-solar point into the Sun's direction from any site.",
    },
    {
      fn: "sunElevationDeg",
      file: "web/src/lib/geo/system.ts",
      does: "The one-line formula, used to light the System view.",
    },
  ],
  whatCanGoWrong: [
    "Mixing east and west longitudes. TrueSouth writes [[east_longitude|east longitude]] everywhere, from 0 to 360; a west longitude in its place puts the Sun on the wrong side of Pip's sky.",
    "Assuming my pole has half a month of light, then half a month of dark, as my equator does. Here the Sun circles the horizon, so light or shadow depends on the terrain in each direction. That is lesson 2.",
  ],
};

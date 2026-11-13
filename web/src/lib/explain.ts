/**
 * Academy track owns this file (work package A7).
 *
 * Plain-language text for every glossary term, keyed by term in snake_case, for
 * `<Explain term="antenna_mask" />`. The same text serves Mission Control tooltips and the
 * Academy.
 *
 * Rules for an entry (docs/tracks/academy.md, "Rules for this track"):
 * - One or two plain sentences, for a reader with no background.
 * - No formula. A formula lives in docs/science.md, nowhere else.
 * - No jargon that is not itself an entry here.
 * - No measured value for a particular site or mission. Those come from data.
 * - The glossary's own words (CONTEXT.md), exactly. British spelling.
 *
 * Adding a glossary term? Add it to CONTEXT.md first, then here, then to the lists in
 * explain.test.ts.
 */

/** The ids of the eight Academy lessons, as in web/src/features/academy/catalog.ts. */
export type ExplainLessonId =
  | "l1_sun"
  | "l2_skyline"
  | "l3_horizon"
  | "l4_link"
  | "l5_slope"
  | "l6_tradeoffs"
  | "l7_slip"
  | "l8_mission";

export type TermExplanation = {
  text: string;
  /** For a camera view: a one-line hint of its controls, shown under the text in the popover. */
  controls?: string;
  /** The Academy lesson that teaches this term, where one clearly does. */
  lesson?: ExplainLessonId;
};

const entries = {
  // ── The product ────────────────────────────────────────────────────────────
  mission_control: {
    text: "The planner mode of TrueSouth. You choose a mission profile and some sites, find landing dates, and inspect each site hour by hour.",
    lesson: "l8_mission",
  },
  academy: {
    text: "The guided mode of TrueSouth: eight short lessons, about ten to fifteen minutes in all. They build up the ideas that Mission Control uses.",
  },
  luna: {
    text: "The moon character who guides you through the Academy. She speaks as the Moon itself and works things out alongside you.",
  },
  pip: {
    text: "The small lander you try to keep alive in the Academy story. Pip is made up, but the sites, the maps and the numbers you see are real.",
  },

  // ── Places ─────────────────────────────────────────────────────────────────
  site: {
    text: "One point on the Moon, given by its latitude, its east longitude and a name.",
  },
  catalog_site: {
    text: "A site that TrueSouth ships with its data already worked out, so its results appear straight away.",
  },
  custom_site: {
    text: "A site you create by clicking the polar map or typing a latitude and east longitude. TrueSouth works it out on request, so it takes a moment to appear.",
  },
  latitude: {
    text: "How far a place is north or south of the Moon's equator, in degrees. South is negative, so the south pole is at minus 90.",
  },
  east_longitude: {
    text: "How far east of the Moon's prime meridian a place is, in degrees from 0 to 360. The prime meridian is the pole-to-pole line through the middle of the face we see from Earth.",
  },
  local_frame: {
    text: "The view from standing at a site, with east, north and up as your three directions. Every azimuth and elevation in TrueSouth is measured in it.",
  },
  terrain_tier: {
    text: "How much terrain data a site has: core80 uses a map with squares 80 metres across, wide240 uses a coarser one with squares 240 metres across, and sphere has none and treats the Moon as smooth.",
  },
  core80: {
    text: "The sharpest terrain tier. Its map has squares 80 metres across and covers everything from 80 degrees south to the south pole, which is enough for the skyline, the slope and the Local terrain.",
  },
  wide240: {
    text:
      "A coarser terrain tier, with squares 240 metres across, covering everything from 60 degrees south to the south pole. It supplies far-away terrain, and it is the only terrain data for sites between 60 and 80 degrees south.",
  },
  sphere: {
    text: "The terrain tier for a site with no terrain data. TrueSouth treats the Moon as perfectly smooth there and says so with the note \"terrain not modelled\".",
  },
  ground_height: {
    text: "How high the ground at the site stands, in metres, above the Moon's reference sphere, a smooth ball with a radius of 1,737,400 metres. It is not the same as elevation, which here means an angle above the horizon.",
  },
  nearby_range: {
    text: "For a sunlit peak, the lowest and highest average sunlight found within about 160 metres of the listed point. A wide range means a small move changes the answer a lot.",
  },
  best_lit_variant: {
    text: "A second version of a sunlit-peak site, placed by TrueSouth at the best-lit spot close to the listed point. It is not a published site, and its sunlight is an upper reading.",
  },
  still_picture: {
    text: "A fixed image shown in place of the 3D scene when this device cannot draw it smoothly. The panels, the timeline and every result still work.",
  },
  close_up_dem: {
    text: "A very sharp DEM, with squares 5 metres across, that exists for only a few sites. It is used for slope and for the close-up 3D view.",
    lesson: "l5_slope",
  },
  dem: {
    text: "Digital elevation model: a grid that records how high the ground is, square by square. Think of it as a height map.",
    lesson: "l5_slope",
  },
  named_feature: {
    text:
      "A crater or mountain with an official name from the International Astronomical Union. TrueSouth uses these names to label the map and to name the nearest landmark when terrain blocks the Sun or Earth.",
  },

  // ── Directions and visibility ──────────────────────────────────────────────
  azimuth: {
    text: "Compass direction, as an angle clockwise from north. East is 90 degrees, south is 180 and west is 270.",
    lesson: "l1_sun",
  },
  elevation: {
    text: "How high something appears above the flat horizontal, as an angle: 0 degrees is level with your feet and 90 is straight up. Negative means below level.",
    lesson: "l1_sun",
  },
  skyline: {
    text: "The outline of the terrain against the sky, seen from a site: for each azimuth, the elevation that the highest ground in that direction reaches. Near the south pole the Sun climbs only a degree or two, so a hill one degree high can hide it.",
    lesson: "l2_skyline",
  },
  skyline_bin: {
    text: "One narrow slice of the skyline. TrueSouth cuts the full circle of azimuths into 1,440 slices, each a quarter of a degree wide, and stores one elevation for each.",
  },
  blocker: {
    text: "The terrain point that sets the skyline in one skyline bin: the one that reaches the highest elevation as seen from the site. A small ridge nearby can beat a tall mountain far away, so it is not always the tallest ground.",
    lesson: "l2_skyline",
  },
  blocker_height: {
    text: "How high the blocker stands above the Moon's reference sphere, a smooth ball with a radius of 1,737,400 metres. The higher and nearer it is, the more of the sky it hides.",
    lesson: "l2_skyline",
  },
  clearance: {
    text: "How far a body's centre sits above the skyline at its azimuth, as an angle. Positive means the centre is above the terrain, and negative means terrain stands in front of it.",
    lesson: "l4_link",
  },
  disc_fraction: {
    text: "How much of the Sun's or Earth's round face shows above the skyline, from 0 (all hidden) to 1 (all clear). A disc fraction of 0.5 means half of it is hidden.",
    lesson: "l2_skyline",
  },
  sub_solar_point: {
    text: "The spot on the Moon where the Sun is straight overhead right now. It travels once around the Moon every month, carrying daylight with it.",
    lesson: "l1_sun",
  },
  sub_earth_point: {
    text: "The spot on the Moon where Earth is straight overhead right now. Standing there, you would see Earth at the very top of the sky.",
    lesson: "l4_link",
  },
  libration: {
    text: "The Moon always shows nearly the same face to Earth, but it rocks slowly back and forth. This makes the sub-Earth point wander, so Earth bobs up and down in the lunar sky.",
    lesson: "l4_link",
  },

  // ── Time ───────────────────────────────────────────────────────────────────
  utc: {
    text: "Coordinated Universal Time, the world's standard clock time. Every time in TrueSouth is in UTC, so it never depends on where you are.",
  },
  time_grid: {
    text: "The fixed list of hourly moments, in UTC, that all TrueSouth data uses. It runs from the start of 2026 to the end of 2031.",
  },
  series: {
    text: "One site's hour-by-hour record of where the Sun and Earth are in its sky: azimuth, elevation, disc fraction and clearance. Everything TrueSouth says about a site's light and radio contact is worked out from it.",
  },
  global_ephemeris: {
    text: "A table, called an ephemeris, of where the Sun and Earth sit above the Moon and how far away they are, hour by hour. It was taken once from Horizons, and every site's sky is worked out from it.",
  },
  landing_date: {
    text: "The UTC moment a mission touches down. Changing it moves the whole mission window.",
    lesson: "l7_slip",
  },
  mission_window: {
    text: "The stretch of time from the landing date until the mission ends, as long as the profile's duration. Every metric is measured over this window and nothing outside it.",
    lesson: "l7_slip",
  },
  slip: {
    text: "Moving the landing date later (or earlier) by some days, as happens when a launch is delayed. The same site can change from GO to NO-GO after a slip, because the Sun and Earth have moved on.",
    lesson: "l7_slip",
  },

  // ── Mission logic ──────────────────────────────────────────────────────────
  mission_profile: {
    text: "The settings that describe a mission: how long it lasts, how much darkness it survives, how it talks to Earth, how steep a slope it can land on, and which of these matter most. TrueSouth judges every site against it.",
    lesson: "l6_tradeoffs",
  },
  preset: {
    text: "A mission profile named after a real mission, such as VIPER or Artemis, with its figures already filled in. Each figure is tagged sourced or assumed.",
  },
  sourced: {
    text: "A profile value taken from a published document, shown with a link to it. You can check it for yourself.",
  },
  assumed: {
    text: "A profile value we chose ourselves because the mission has published none, shown with an \"assumed\" tag. Treat it as a reasonable guess, and change it if you know better.",
  },
  lit: {
    text: "An hour when the site has enough sunlight under the profile's rule: the Sun's disc fraction reaches the profile's minimum and, for some profiles, the Sun is also high enough.",
    lesson: "l2_skyline",
  },
  dark: {
    text: "An hour that is not lit. Without sunlight a lander lives on its batteries, so the longest unbroken dark stretch is what matters.",
    lesson: "l2_skyline",
  },
  link: {
    text:
      "An hour when the lander can talk to Earth under the profile's rule: Earth's centre clears the skyline by at least the antenna mask, or the profile has a relay.",
    lesson: "l4_link",
  },
  blackout: {
    text: "An hour with no link: Earth is hidden or too low, and no relay passes the signal on. The lander cannot talk to home until the blackout ends.",
    lesson: "l4_link",
  },
  antenna_mask: {
    text: "The minimum clearance Earth's centre needs before a link counts. It is a safety margin, so that Earth barely peeking above the skyline does not count as contact.",
    lesson: "l4_link",
  },
  relay: {
    text: "A spacecraft circling the Moon that passes signals between a lander and Earth. With a relay, Earth does not have to be in view, so the profile never has a blackout.",
  },
  dte: {
    text:
      "Direct to Earth: a radio link between the lander and Earth with no relay in between. It only works while Earth's centre clears the skyline by at least the antenna mask.",
  },
  metric: {
    text: "A measured fact about a mission window, such as the longest dark stretch in hours. The vetoes and utilities are worked out from metrics.",
    lesson: "l6_tradeoffs",
  },
  veto: {
    text: "A hard rule that a mission window breaks. A single veto makes the status NO-GO, however good everything else looks.",
    lesson: "l6_tradeoffs",
  },
  utility: {
    text: "A rating from 0 to 1 for one criterion: slope, power or comms (talking to Earth). Nearer 1 is better, and the three utilities feed the score.",
    lesson: "l6_tradeoffs",
  },
  score: {
    text: "A number from 0 to 100 that blends the three utilities, giving more weight to what the profile cares about most. It ranks windows that pass every veto, and it never rescues one that does not.",
    lesson: "l6_tradeoffs",
  },
  status: {
    text: "The verdict for a mission window: GO, CAUTION or NO-GO. Any veto makes it NO-GO, and otherwise the score decides between GO and CAUTION.",
    lesson: "l6_tradeoffs",
  },
  go: {
    text: "The status when no veto triggers and the score reaches the GO threshold, which is a team setting. The mission window looks workable.",
    lesson: "l6_tradeoffs",
  },
  caution: {
    text: "The status when no veto triggers but the score is below the GO threshold. The mission could work, but it is marginal.",
    lesson: "l6_tradeoffs",
  },
  no_go: {
    text: "The status when at least one veto triggers, so the mission window breaks a hard rule. A high score cannot overrule it.",
    lesson: "l6_tradeoffs",
  },
  scenario: {
    text: "One Mission Control setup: a mission profile, a set of sites, a landing date and a current time. Every view shows the same scenario.",
  },
  selected_sites: {
    text: "The sites in your current scenario, up to eight. They are listed beside the views and each one gets a row in the Slip Planner.",
  },
  focused_site: {
    text: "The one selected site that the detail views are showing. Click a site in the list to focus it.",
  },

  // ── Slope ──────────────────────────────────────────────────────────────────
  slope: {
    text: "How steep the ground is at the site, as an angle. The answer depends on the distance it is measured over, so TrueSouth always states that distance.",
    lesson: "l5_slope",
  },
  slope_baseline_m: {
    text: "The distance, in metres, over which a slope was measured. A longer one smooths out small bumps, so slopes with different baselines should not be compared.",
    lesson: "l5_slope",
  },

  // ── Views ──────────────────────────────────────────────────────────────────
  slip_planner: {
    text: "Your sites at the south pole, each showing whether a landing on the date below would be GO, CAUTION or NO-GO, with a strip for every site across six years of landing dates. Use it to see how far a launch can slip, or which other site works on the new date.",
    lesson: "l7_slip",
  },
  system_view: {
    text: "A 3D view you can turn by dragging, showing the Moon, Earth and Sun from outside, so you can see where your site is, where daylight falls and where Earth sits. Distances are squeezed by default so everything fits, but every direction is true.",
    controls:
      "Drag to turn the Moon freely in any direction, over the poles. Right-drag, Shift-drag or two fingers slide; scroll or pinch zooms toward the pointer; double-click centres a spot. South pole shows the whole polar region, level.",
    lesson: "l1_sun",
  },
  polar_map: {
    text: "A flat map of the Moon's south pole region, seen from above, where you pick sites and nudge a pin to see how much a small move changes the light.",
    lesson: "l5_slope",
  },
  local_terrain: {
    text: "A 3D view you can turn by dragging, showing the ground around one site as if you hovered above it, lit by the Sun as it is at the current time. Its shadows are only for understanding: whether an hour is lit comes from the series.",
    controls: "Drag to turn about the site; scroll or pinch to move closer or further.",
    lesson: "l3_horizon",
  },
  skyline_wall: {
    text: "A dark ring around the Local terrain whose top edge follows the skyline of mountains too far away to be drawn. It lets those distant mountains cast their shadows on the ground you can see.",
    lesson: "l3_horizon",
  },
  landers_eye: {
    text:
      "What you would see standing at the site and turning in a full circle, unrolled into a flat 2D strip with the Sun and Earth drawn at their true angles above the skyline. Its left and right ends are the same direction, and vertical angles are stretched to make small differences easy to see.",
    lesson: "l2_skyline",
  },
  compare: {
    text: "Compare puts your selected sites side by side, for one mission profile and landing date. It shows which one wins, and why.",
    lesson: "l6_tradeoffs",
  },
  timeline: {
    text: "Two strips for the focused site's mission window, hour by hour: one shows when it is lit and the other when it has a link. The scrubber slides along them.",
    lesson: "l4_link",
  },
  countdown: {
    text:
      "The time from the current time to the next sunset, sunrise, Earthset or Earthrise. These follow the profile's rules, not the moment the Sun or Earth touches the horizon.",
    lesson: "l4_link",
  },
  sunset: {
    text: "The next moment the Sun's disc fraction falls below the profile's minimum, so the site stops being lit. It is not the moment the Sun touches the horizon.",
    lesson: "l2_skyline",
  },
  sunrise: {
    text: "The next moment the Sun's disc fraction rises to the profile's minimum, so the site becomes lit again. It is not the moment the Sun first appears.",
    lesson: "l2_skyline",
  },
  earthset: {
    text: "The next moment Earth's clearance falls below the antenna mask, so the link is lost. Earth may still be visible just above the skyline.",
    lesson: "l4_link",
  },
  earthrise: {
    text: "The next moment Earth's clearance rises to the antenna mask, so the link comes back. It is when contact is possible, not when Earth first shows.",
    lesson: "l4_link",
  },
  scrubber: {
    text: "The time slider shared by every view. Move it and the Sun, Earth, shadows and countdowns all jump to that moment.",
  },

  // ── Academy ────────────────────────────────────────────────────────────────
  lesson: {
    text: "One of the eight short Academy units, about five steps each. Each teaches a single idea, and you can play them in any order.",
  },
  step: {
    text: "One screen of a lesson: a question to answer or something to try. Luna asks, you have a go, and she tells you what happened.",
  },
  under_the_hood: {
    text: "An optional card in each lesson with the full formula, a worked example and a link to the code. Opening it costs nothing, and you can skip it.",
  },
  worked_example: {
    text: "The numbers in an Under the hood card, followed one step at a time. They come from running the real science code, so they match what the app shows.",
  },
  xp: {
    text: "Points earned for each step: the most for answering right first time, fewer after a hint, and a few even if you needed to be shown the answer.",
  },
  mission_patch: {
    text: "The badge you earn for finishing a lesson. Finish all eight lessons and you earn one more.",
  },

  // ── Data ───────────────────────────────────────────────────────────────────
  horizons: {
    text: "An online service from NASA's Jet Propulsion Laboratory that calculates where planets, moons and the Sun are at any moment. TrueSouth takes the Sun's and Earth's positions from it.",
  },
  lola: {
    text: "The laser altimeter on NASA's Lunar Reconnaissance Orbiter, which measures the height of the ground by timing laser pulses bounced off it. TrueSouth's terrain heights come from its maps.",
  },
  pgda: {
    text: "NASA Goddard's Planetary Geodesy Data Archive, the public website that publishes the LOLA maps TrueSouth uses. Geodesy is the measuring of a planet's shape.",
  },

  // ── Mission profile fields ─────────────────────────────────────────────────
  id: {
    text: "The profile's short internal name, used in links and files. It does not affect any result.",
  },
  name: {
    text: "The profile's display name, usually that of the real mission it models.",
  },
  based_on: {
    text: "The real mission that this profile is modelled on.",
  },
  duration_days: {
    text: "How long the mission lasts, in days. It sets the length of the mission window.",
    lesson: "l7_slip",
  },
  min_sun_fraction: {
    text: "The disc fraction the Sun must reach for an hour to count as lit. A value of 0.5, for example, means at least half of the Sun must show above the skyline.",
    lesson: "l2_skyline",
  },
  ops_sun_el_min_deg: {
    text:
      "An optional minimum Sun elevation for operations, in degrees. When set, an hour counts as lit only if the Sun's centre is at least this high as well as reaching the required disc fraction.",
  },
  max_dark_h: {
    text: "The longest unbroken stretch of dark hours the mission survives. Zero means it must stay lit the whole time.",
    lesson: "l6_tradeoffs",
  },
  relay_available: {
    text: "Whether a relay exists to pass signals to Earth. If so, the mission never has a blackout.",
  },
  antenna_mask_deg: {
    text: "The clearance, in degrees, that Earth's centre needs for a link to count. A larger antenna mask is stricter and means more blackout.",
    lesson: "l4_link",
  },
  max_blackout_h: {
    text: "The longest unbroken blackout the mission tolerates, in hours. It does not apply when the profile has a relay.",
    lesson: "l4_link",
  },
  max_slope_deg: {
    text: "The steepest slope the lander can be put down on, in degrees. A steeper site triggers the slope veto.",
    lesson: "l5_slope",
  },
  slope_ideal_deg: {
    text: "The slope at or below which the slope utility is a perfect 1. Between this and the maximum slope the utility falls steadily to 0.",
    lesson: "l6_tradeoffs",
  },
  landing_sun_el_min_deg: {
    text: "The lowest Sun elevation allowed at touchdown, in degrees, if the profile sets one. Landing with the Sun lower than this triggers a veto.",
  },
  landing_sun_el_max_deg: {
    text: "The highest Sun elevation allowed at touchdown, in degrees, if the profile sets one. Landing with the Sun higher than this triggers a veto.",
  },
  weights: {
    text: "How much slope, power and comms each count towards the score. They can be any numbers from zero up and are rescaled to add up to one, so only their proportions matter.",
    lesson: "l6_tradeoffs",
  },
  provenance: {
    text: "For each profile value, where it comes from: sourced, with a link and a quote, or assumed, with the reason we chose it.",
  },

  // ── Metrics ────────────────────────────────────────────────────────────────
  sun_fraction_mean: {
    text: "The average disc fraction of the Sun over the mission window, from 0 to 1. It sums up how sunny the whole mission is.",
    lesson: "l6_tradeoffs",
  },
  lit_fraction: {
    text: "The share of the mission window's hours that are lit. It counts hours, so an hour with just enough Sun counts the same as a brilliant one.",
    lesson: "l6_tradeoffs",
  },
  longest_dark_h: {
    text: "The longest unbroken run of dark hours in the mission window, in hours. The darkness veto checks it against the profile.",
    lesson: "l6_tradeoffs",
  },
  link_fraction: {
    text: "The share of the mission window's hours that have a link.",
    lesson: "l4_link",
  },
  longest_blackout_h: {
    text: "The longest unbroken run of blackout hours in the mission window, in hours. The blackout veto checks it against the profile.",
    lesson: "l6_tradeoffs",
  },
  landing_sun_el_deg: {
    text: "The Sun's elevation at the moment of landing, in degrees. A low value means long shadows at touchdown.",
  },
  landing_lit: {
    text: "Whether the site is lit at the moment of landing: yes or no. Touching down in the dark triggers a veto.",
  },

  // ── Vetoes ─────────────────────────────────────────────────────────────────
  veto_slope: {
    text: "Triggers when the site's slope is steeper than the profile's maximum slope, because the lander could tip over.",
    lesson: "l5_slope",
  },
  veto_darkness: {
    text: "Triggers when the longest dark stretch is longer than the profile's maximum dark hours, because the mission would not survive it.",
    lesson: "l6_tradeoffs",
  },
  veto_blackout: {
    text: "Triggers when the profile has no relay and the longest blackout is longer than the mission tolerates.",
    lesson: "l6_tradeoffs",
  },
  veto_landing_dark: {
    text: "Triggers when the site is not lit at the moment of landing.",
  },
  veto_landing_sun_low: {
    text: "Triggers when the Sun is lower at touchdown than the profile allows.",
  },
  veto_landing_sun_high: {
    text: "Triggers when the Sun is higher at touchdown than the profile allows.",
  },

  // ── Utilities ──────────────────────────────────────────────────────────────
  utility_slope: {
    text: "How good the slope is, from 0 to 1: a perfect 1 at or below the ideal slope, falling to 0 at the maximum slope.",
    lesson: "l6_tradeoffs",
  },
  utility_power: {
    text: "How good the power situation is, from 0 to 1. It starts from the average sunniness and is reduced as the longest dark stretch nears the most the mission survives.",
    lesson: "l6_tradeoffs",
  },
  utility_comms: {
    text: "How good the contact with Earth is, from 0 to 1. It is 1 with a relay, and otherwise it is the share of hours with a link, reduced as the longest blackout nears the most the mission tolerates.",
    lesson: "l6_tradeoffs",
  },
} as const satisfies Record<string, TermExplanation>;

/** Every term that has an explanation. Use it to make a misspelt `<Explain term>` a compile error. */
export type ExplainTerm = keyof typeof entries;

/**
 * Plain-language explanations, keyed by term. Typed as a plain record so that components
 * can look up a term they only know as a string. Use `ExplainTerm` for a checked key.
 */
export const explanations: Readonly<Record<string, TermExplanation>> = entries;

/** True when `term` has an explanation. */
export function isExplainTerm(term: string): term is ExplainTerm {
  return Object.prototype.hasOwnProperty.call(entries, term);
}

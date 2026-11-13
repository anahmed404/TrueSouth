# The eight lessons

The Academy's content, step by step. Mechanics and step types are in
[`overview.md`](overview.md).

- Each lesson is about five steps and about 90 seconds.
- **Bold** marks the correct answer.
- `{{…}}` marks a number filled from `worked_examples.json`. Numbers written out here are
  design values from our first Horizons run (Connecting Ridge, December 2026, smooth
  Moon); the build replaces them with values for the story's site and dates.
- "Card" lists what the lesson's Under-the-hood card covers, by section of
  [`../science.md`](../science.md).

Story scenario for every lesson unless stated: Pip, profile `im2_athena`, at Connecting
Ridge, in 2028.

---

## 1. Where's the Sun?

**Idea:** at the south pole the Sun never climbs; it circles the horizon.
**Patch:** Sun Chaser. **Unlocks:** System view.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `choice` | "At my equator the midday Sun is almost overhead. How high does it get at my south pole?" | Overhead / About 45° / **Under 2°** |
| 2 | `drag-body` (Sun) | "Drag the Sun through a whole month. Find its highest moment." | Lander's eye view with a flat skyline. The best the learner can find is {{l1.sun_el_max_deg}}° (2.0°). |
| 3 | `predict` | "Over that month, which directions does the Sun visit?" | Only east and west / **All the way round** / Only north. Reveal: the System view plays one month. |
| 4 | `fill-formula` | "Highest Sun ≈ 90° − latitude + ( ? )" | **1.54°, my tilt** / 23.4° / 5.1°. At 89.46°S that gives 2.08°. |
| 5 | `choice` | "If you stood exactly on my south pole, which way is north?" | East / Up / **Every direction**. Luna: "That is why this tool is called TrueSouth." |

**Card:** sub-solar point and the Moon's 1.54° tilt (§3.1); direction to the Sun from any
site (§3.2); the one-line elevation formula (§14). Worked example: one hour at Pip's site,
from sub-solar point to azimuth and elevation. What can go wrong: mixing east and west
longitudes; assuming the pole has 14 days of light then 14 of dark.

**Keys:** `l1.sun_el_max_deg`, `l1.sun_el_min_deg`, `l1.site_lat_deg`,
`l1.example_utc`, `l1.example_subsolar_lat`, `l1.example_subsolar_lon`,
`l1.example_sun_az`, `l1.example_sun_el`.

---

## 2. Mountains steal sunlight

**Idea:** with the Sun that low, the terrain's skyline decides light or shadow.
**Patch:** Skyline Sketcher. **Unlocks:** Lander's eye.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "The Sun is {{l2.sun_el_deg}}° up. A ridge {{l2.ridge_dist_km}} km away stands {{l2.ridge_rise_m}} m above Pip. Sunlight or shadow?" | Sunlight / **Shadow**. Reveal: the Lander's eye view at that hour. The ridge looks {{l2.ridge_el_deg}}° tall. |
| 2 | `fill-formula` | "How tall a ridge looks: angle = atan( ? ÷ distance )" | **its height above you** / its height above sea level / its width |
| 3 | `draw-skyline` | "Sketch the skyline you think Pip sees in this direction." | The real skyline is laid over the sketch. Closer sketches earn more XP; every sketch passes. |
| 4 | `drag-body` (Sun) | "The Sun is a disc, not a dot. Find a moment when more than half of it is hidden." | Goal: `sun_frac < 0.5`. Pip's power meter follows the visible share. |
| 5 | `choice` | "Which blocks more sky: a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away?" | **The near ridge** / The far mountain. Luna: "Surprised? The next lesson explains why." |

**Card:** elevation angle of terrain (§4, the flat version first); the skyline and its two
methods (§5); disc fraction (§6). Worked example: the step-1 hour, from the skyline bin to
"blocked". What can go wrong: a peak slipping between two rays; treating the Sun as a dot.

**Keys:** `l2.example_utc`, `l2.sun_el_deg`, `l2.sun_az_deg`, `l2.ridge_dist_km`,
`l2.ridge_rise_m`, `l2.ridge_el_deg`, `l2.ridge_feature`, `l2.sun_frac`.

---

## 3. The Moon is round

**Idea:** the ground curves away, so far mountains sink below the horizon.
**Patch:** Horizon Hunter. **Unlocks:** Local terrain, with the skyline wall.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "A mountain 5 km tall stands 130 km from Pip. On a flat Moon it would look 2.2° tall. What does Pip really see?" | 2.2° of mountain / **Just the tip** / Nothing. Reveal: a side view of the curved Moon. |
| 2 | `fill-formula` | "How far the ground drops away: drop = distance² ÷ ( ? )" | R / **2R** / R² |
| 3 | `tune-slider` | "Slide the distance until the ground has dropped 115 m." | Goal: 20 km. A live readout shows the drop. |
| 4 | `spot-bug` | "This calculation says Pip is in shadow. One line is wrong." | Lines: (1) the ridge is 1,000 m above Pip; (2) it is 60 km away; **(3) it looks atan(1000 ÷ 60000) = 0.95° tall**; (4) the Sun is 0.8° up, so it is blocked. Line 3 forgot the drop: 1,036 m at 60 km. The ridge is below Pip's horizon. |
| 5 | `choice` | "Why does a third of a degree matter so much here?" | **Because the Sun is only 1–2° up** / Because my mountains are small / It doesn't |

**Card:** the exact formula and how the simple one follows from it (§4); the flat-Moon
horizon dip; why 300 km is far enough (§5). Worked example: the blocker for one real bin,
with and without curvature. What can go wrong: a flat-Moon calculation; using the simple
formula at long range.

**Keys:** `l3.drop_at_20km_m`, `l3.drop_at_60km_m`, `l3.drop_at_130km_m`,
`l3.example_bin_az`, `l3.example_dist_km`, `l3.example_height_m`,
`l3.example_el_flat_deg`, `l3.example_el_true_deg`.

---

## 4. Phone home

**Idea:** from the pole, Earth bobs above and below the horizon each month.
**Patch:** Signal Keeper. **Unlocks:** timeline and countdowns.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `choice` | "From Apollo 11's site, Earth hangs high in the sky all the time. From my south pole?" | It is always overhead / It never appears / **It bobs up and down at the horizon** |
| 2 | `drag-body` (Earth) | "Drag Earth through a month. Find its highest moment." | Readouts: highest {{l4.earth_el_max_deg}}° (6.0°), lowest {{l4.earth_el_min_deg}}° (−7.3°). |
| 3 | `predict` | "Over a month, how much of the time is Earth above Pip's horizon?" | Always / About two-thirds / **About {{l4.earth_up_pct}}%** (38%). Reveal: the timeline's Earth band. |
| 4 | `tune-slider` | "Pip's antenna needs Earth to clear the ground by some margin. Raise the margin until Pip can talk less than 15% of the time." | Goal: about 5°. Readout: link time. Pip's link meter follows. |
| 5 | `spot-bug` | "An early TrueSouth used these rules and called every polar site NO-GO. Which rule can never be met here?" | Lines: (1) Earth must clear the skyline; (2) by at least 5°; **(3) for at least half of every month**; (4) or the site is NO-GO. Even with no margin, Earth is up only 38% of the time. Luna: "Judge the mission's own days, not the whole month. Lesson 7." |

**Card:** sub-Earth point, libration and distance (§3.1); the exact direction to Earth,
including the 0.26° shift from standing off-centre (§3.2); link and antenna mask (§9).
Worked example: one hour, from sub-Earth point to clearance to link. What can go wrong:
fixed thresholds copied from another latitude; measuring the mask from the wrong line.

**Keys:** `l4.earth_el_max_deg`, `l4.earth_el_min_deg`, `l4.earth_up_pct`,
`l4.link_pct_mask0`, `l4.link_pct_mask1`, `l4.link_pct_mask5`, `l4.example_utc`,
`l4.example_earth_az`, `l4.example_earth_el`, `l4.example_earth_clear`.

---

## 5. Don't tip over

**Idea:** slope decides whether a lander stays upright, and slope depends on the ruler.
**Patch:** Steady Feet. **Unlocks:** the slope overlay.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "In 2025 a real lander called Athena reached Mons Mouton, close to its target. What happened?" | It landed upright / **It ended on its side in a small crater** / It missed me. Reveal: the real site on the map, with the source. |
| 2 | `fill-formula` | "slope = atan( rise ÷ ? )" | **run** / height / area |
| 3 | `drop-pin` | "Green is gentle, red is steep. Put Pip somewhere under 10°." | Goal: slope ≤ 10° on the close-up map. |
| 4 | `tune-slider` | "Measure the same spot with a longer ruler. Set the ruler NASA uses for crewed landers." | Readout: {{l5.slope_10m_deg}}° at 10 m, {{l5.slope_100m_deg}}° at 100 m, {{l5.slope_160m_deg}}° at 160 m. Goal: 100 m. |
| 5 | `choice` | "Our map of most of my pole has 80 m pixels. Can it see a 20 m crater like the one that caught Athena?" | Yes / **No**. Luna: "So TrueSouth is a planning aid. It finds good regions; cameras find the safe spot." |

**Card:** slope from a plane fit and from pixel differences, and why the baseline must be
stated (§8); the projection's stretch (§2.3). Worked example: one site's slope by each
method. What can go wrong: comparing slopes with different baselines; trusting a coarse
map for small hazards.

**Keys:** `l5.slope_10m_deg`, `l5.slope_100m_deg`, `l5.slope_160m_deg`,
`l5.example_site`, `l5.plane_a`, `l5.plane_b`.

---

## 6. Trade-offs

**Idea:** hard limits rule sites out; preferences rank what is left.
**Patch:** Decision Maker. **Unlocks:** the focused-site panel and Compare.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `choice` | "A site has sunlight 95% of the time, with one 60-hour dark stretch. Pip survives 6 hours of dark. GO?" | GO / **NO-GO** |
| 2 | `choice` | "Which of these is a hard limit, not a preference?" | More sunlight is better / A gentler slope is better / **Pip tips over above 10°** |
| 3 | `tune-slider` | "Both sites pass every limit. Change what you care about until site B ranks first." | A slider between power and comms weight. Goal: B's score above A's. |
| 4 | `predict` | "NASA's VIPER rover hides in a 'safe haven' while Earth is out of view. What must a safe haven have?" | Flat ground only / **No more than 50 hours of darkness** / A view of Earth. Reveal: the sourced rule. |
| 5 | `choice` | "A site scores 91 but breaks one hard limit. Its status?" | GO / CAUTION / **NO-GO**. Luna: "A score never hides a veto." |

**Card:** metrics (§9); vetoes, utilities, score and status (§10). Worked example: one
window, every metric, every utility, the final score. What can go wrong: averaging a hard
limit away; penalising the same thing twice; weights that silently fail to add up.

**Keys:** `l6.site_a`, `l6.site_b`, `l6.a_score`, `l6.b_score`, `l6.example_metrics.*`,
`l6.example_utilities.*`, `l6.example_score`.

---

## 7. The slip

**Idea:** the date matters as much as the place.
**Patch:** Time Bender. **Unlocks:** Slip Planner.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "Pip's site is GO for landing on {{l7.go_date}}. The launch slips three weeks. Still GO?" | Still GO / **NO-GO**. Reveal: the Slip Planner row, with the marker moving. |
| 2 | `choice` | "What changed in three weeks?" | The slope / **Earth sank below the skyline for most of the mission** / My size |
| 3 | `tune-slider` | "Slide the landing date to the next GO day." | Goal: {{l7.next_go_date}}. |
| 4 | `choice` | "Earth's ups and downs repeat about every…" | Day / **27 days** / Year |
| 5 | `choice` | "Or keep the date and move. Which site is GO on the slipped date?" | The learner reads a three-row Slip Planner. Answer: **{{l7.alt_site}}**. |

**Card:** the mission window and its metrics (§9); the sweep over every landing date
(§11). Worked example: the same site on two dates, metric by metric. What can go wrong:
judging a month where the mission lasts ten days; a window one hour too long or short.

**Keys:** `l7.go_date`, `l7.slip_date`, `l7.slip_vetoes`, `l7.slip_blackout_h`,
`l7.next_go_date`, `l7.alt_site`.

---

## 8. Final mission

**Idea:** put it together and choose where and when Pip lands.
**Patch:** Mission Planner. **Unlocks:** Mission Control, with Pip's mission loaded.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `drop-pin` | "Four candidate sites. Pick Pip's." | Any site is accepted. A small Slip Planner shows all four. |
| 2 | `tune-slider` | "Now pick the landing date. Find a GO." | Goal: status GO for the chosen site. If the site has no GO date in range, Luna says so and offers the best CAUTION date or a different site. |
| 3 | `choice` | "Pip has landed. Read the countdown: how long until sunset?" | Three readings; the learner picks the one the countdown card shows. |
| 4 | `predict` | "Will Pip have a link to Earth for the whole mission?" | Yes / No. Reveal: the timeline for the learner's own choice. |
| 5 | `predict` | "Did you rediscover where NASA wants to go?" | Reveal: the polar map with the learner's site, NASA's average-sunlight map and the Artemis candidate regions. |

**The reveal is honest.** If the learner's GO site lies in or near a NASA candidate region,
Luna says so. If it does not, Luna says that too and gives the reason: NASA weighs things
we do not model, such as science value and finer hazard maps.

**Lesson complete:** the ninth patch, total XP, and "Open Mission Control" with the
learner's site, date and profile loaded.

**Card:** how every piece connects, as one diagram from Horizons and LOLA to a status;
links to all seven earlier cards; the limits in §15.

**Keys:** `l8.candidates`, `l8.region_overlap.*`.

---

## Choosing the story's site and dates

`build-worked-examples` picks the examples by rule, so they stay true when data changes:

- **Lesson 2's hour:** the first hour in 2028 at the story site where the Sun's clearance
  is between −0.5° and −0.1° and the blocker is more than 5 km away.
- **Lesson 7's dates:** the first GO landing date in 2028 whose date three weeks later is
  NO-GO because of a blackout.
- **Lesson 7's alternative site:** a polar catalog site that is GO on the slipped date.
- **Lesson 8's candidates:** four polar catalog sites, at least one with a GO date in 2028
  and at least one with none.

If a rule finds nothing, the build stops and names the rule. Then either the story site
changes or an assumed profile value is tuned, as described in
[`../mission-profiles.md`](../mission-profiles.md).

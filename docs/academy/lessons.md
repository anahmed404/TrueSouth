# The eight lessons

The Academy's content, step by step. Mechanics and step types are in
[`overview.md`](overview.md).

- Each lesson is about five steps and about 90 seconds.
- **Bold** marks the correct answer.
- `{{…}}` marks a number filled from `worked_examples.json`. In lessons 1 to 4 every
  value that has a key is written as its placeholder, so the words stay true if the data
  is rebuilt. Numbers still written out there are teaching examples (a 5 km mountain, a
  1,000 m ridge) or the tilt rule of thumb in lesson 1, and are not read from the data.
  Numbers written out in lessons 5 to 8 are design values from our first Horizons run
  (Connecting Ridge, December 2026, smooth Moon); they are replaced when those lessons are
  written.
- "Card" lists what the lesson's Under-the-hood card covers, by section of
  [`../science.md`](../science.md).

Story scenario for every lesson unless stated: Pip, profile `im2_athena`, at Connecting
Ridge, in 2028. Lesson 2 states its exception: Pip looks from `{{l2.site_name}}`.

---

## 1. Where's the Sun?

**Idea:** at the south pole the Sun never climbs; it circles the horizon.
**Patch:** Sun Chaser. **Unlocks:** System view.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `choice` | "At my equator the midday Sun is almost overhead. How high does it get at my south pole?" | Overhead / About 45° / **Under 3°** |
| 2 | `drag-body` (Sun) | "Drag the Sun through a whole month. Find its highest moment." | Lander's eye view with a flat skyline. The best the learner can find is {{l1.sun_el_max_deg}}°. Luna: "This month the Sun climbs only to {{l1.sun_el_max_deg}}°, and sinks to {{l1.sun_el_min_deg}}°. It skims my horizon." |
| 3 | `predict` | "Over that month, which directions does the Sun visit?" | Only east and west / **All the way round** / Only north. Reveal: the System view plays one month. |
| 4 | `fill-formula` | "Highest Sun ≈ 90° − latitude + ( ? )" | **1.54°, my tilt** / 23.4° / 5.1°. At Pip's latitude that gives 2.08°. Luna: "That 2.08° is the most my Sun can reach here, in the best season. This month it only gets to {{l1.sun_el_max_deg}}°. Both numbers are true." |
| 5 | `choice` | "If you stood exactly on my south pole, which way is north?" | East / Up / **Every direction**. Luna: "That is why this tool is called TrueSouth." |

**Words.** The lines the table does not quote, as the app shows them. A hint follows a
first miss (a predict step has one guess, so its hint is not shown). An explanation
follows the answer, right or shown. A panel step's "until it is ready" lines replace
Luna's question while its panel is not built (work package A3); the step then earns no
XP and does not count for the stars.

1. Hint: "My south pole is as far from my equator as you can go. Picture the Sun near the edge of the sky." Explanation: "At my south pole the Sun stays low, skimming the horizon. Pip sees it side-on, never overhead."
2. Hint: "The Sun's height changes slowly. Drag back and forth near the top of its path." Explanation: Luna's line in the table. Until it is ready, Luna: "Soon you'll drag the Sun through a whole month here, to find its highest moment. For now, here's what you would find." Reveal: Luna's line in the table.
3. Hint: "The Sun is low all month long. Where can a low Sun go?" Explanation: "All the way round. Here the Sun circles the whole horizon about once a month, and stays low the whole time." Reveal caption: "Over the month the Sun goes all the way round Pip's compass, while its height stays between {{l1.sun_el_min_deg}}° and {{l1.sun_el_max_deg}}°."
4. Hint: "The missing piece is a small angle of my own: how far my spin axis leans." Explanation: Luna's line in the table.
5. Hint: "Stand on the very point I spin around. Every step you take leads away from it." Explanation: "Every step away from my south pole is a step north. That is why this tool is called TrueSouth."

**Card:** sub-solar point and the Moon's 1.54° tilt (§3.1); direction to the Sun from any
site (§3.2); the one-line elevation formula (§14). Worked example: one hour at Pip's site,
from sub-solar point to azimuth and elevation. What can go wrong: mixing east and west
longitudes; assuming the pole has 14 days of light then 14 of dark.
The 1.54° tilt is not in `docs/science.md` (§3.1 is the Horizons pull, with no tilt
formula), so the card names the tilt in words and quotes no number for it.

**Keys:** `l1.sun_el_max_deg`, `l1.sun_el_min_deg`, `l1.site_lat_deg`,
`l1.example_utc`, `l1.example_subsolar_lat`, `l1.example_subsolar_lon`,
`l1.example_sun_az`, `l1.example_sun_el`.

---

## 2. Mountains steal sunlight

**Idea:** with the Sun that low, the terrain's skyline decides light or shadow.
**Patch:** Skyline Sketcher. **Unlocks:** Lander's eye.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "From {{l2.site_name}}, the Sun is {{l2.sun_el_deg}}° up. A ridge {{l2.ridge_dist_km}} km away stands {{l2.ridge_rise_m}} m above Pip. Sunlight or shadow?" | Sunlight / **Shadow**. Luna: "I moved us to {{l2.site_name}}. From a high ridge like Connecting Ridge, distant ground lies below Pip, so a Sun above the flat horizon is hidden only by ground close by." Reveal: the Lander's eye view at that hour. The ridge looks {{l2.ridge_el_deg}}° tall. |
| 2 | `fill-formula` | "How tall a ridge looks: angle = atan( ? ÷ distance )" | **its height above you** / its height above sea level / its width |
| 3 | `draw-skyline` | "Sketch the skyline you think Pip sees from {{l2.site_name}}, in this direction." | The real skyline is laid over the sketch. Closer sketches earn more XP; every sketch passes. |
| 4 | `drag-body` (Sun) | "The Sun is a disc, not a dot. Find a moment when more than half of it is hidden." | Goal: `sun_frac < 0.5`. Pip's power meter follows the visible share. |
| 5 | `choice` | "Which blocks more sky: a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away?" | **The near ridge** / The far mountain. Luna: "Surprised? The next lesson explains why." |

**Words.** The lines the table does not quote, as the app shows them. A hint follows a
first miss (a predict step has one guess, so its hint is not shown). An explanation
follows the answer, right or shown. A panel step's "until it is ready" lines replace
Luna's question while its panel is not built (work package A3); the step then earns no
XP and does not count for the stars.

1. Hint: "Compare two angles: how high the Sun is, and how tall the ridge looks from Pip." Explanation: Luna's line in the table. Reveal caption: "The Lander's eye view at that hour. From Pip the ridge looks {{l2.ridge_el_deg}}° tall, and the Sun is {{l2.sun_el_deg}}° up."
2. Hint: "Start from Pip's eyes. What matters is how far the ridge rises from there." Explanation: "Its height above you. What counts is how far the ridge rises above Pip's eyes, not above some far-off reference."
3. Hint: "Start with the ridge from the first step, then guess where the ground falls away on each side." Explanation: "Every sketch counts. The closer yours is to the real skyline, the more XP it earns." Until it is ready, Luna: "Soon you'll sketch the skyline you think Pip sees here, then see the real one laid over it. For now, here's the real one, towards the Sun." Reveal: "Towards the Sun, at azimuth {{l2.sun_az_deg}}°, the skyline stands {{l2.ridge_el_deg}}° high. That is the ridge from the first step."
4. Hint: "Look for a moment when the Sun's centre sits just below the skyline." Explanation: "More than half the disc is behind the ridge. Pip's power falls with the share that shows, not all at once." Until it is ready, Luna: "Soon you'll drag the Sun here and watch Pip's power follow the share of its disc that shows. For now, here's the hour from the first step." Reveal: "At that hour, the share of the Sun's disc above the skyline is {{l2.sun_frac}}, where 0 is fully hidden and 1 is fully clear."
5. Hint: "Height matters, but so does distance. Think about how tall each one looks from Pip." Explanation: Luna's line in the table.

**Exact settings:** Steps 1 to 4 look from the site `l2.site_id` (`{{l2.site_name}}`), not from the story site. Step 3 is a 60° azimuth window centred on `l2.sun_az_deg` (−30° to +30°, wrapping at 0°/360°). Step 4 drags the 48 hours centred on `l2.example_utc` (−24 h to +24 h), clamped to the time grid.

**Card:** elevation angle of terrain (§4, the flat version first); the skyline and its two
methods (§5); disc fraction (§6). Worked example: the step-1 hour, from the skyline bin to
"blocked". What can go wrong: a peak slipping between two rays; treating the Sun as a dot.

**Keys:** `l2.site_id`, `l2.site_name`, `l2.example_utc`, `l2.sun_el_deg`, `l2.sun_az_deg`, `l2.ridge_dist_km`,
`l2.ridge_rise_m`, `l2.ridge_el_deg`, `l2.ridge_feature`, `l2.sun_frac`.

---

## 3. The Moon is round

**Idea:** the ground curves away, so far mountains sink below the horizon.
**Patch:** Horizon Hunter. **Unlocks:** Local terrain, with the skyline wall.

| # | Kind | Luna asks | Answer and what happens |
| :--- | :--- | :--- | :--- |
| 1 | `predict` | "A mountain 5 km tall stands 130 km from Pip. On a flat Moon it would look 2.2° tall. What does Pip really see?" | 2.2° of mountain / **Just the tip** / Nothing. Reveal: a side view of the curved Moon. At 130 km the ground has dropped {{l3.drop_at_130km_m}} m, so only the top of the mountain shows. |
| 2 | `fill-formula` | "How far the ground drops away: drop = distance² ÷ ( ? )" | R / **2R** / R² |
| 3 | `tune-slider` | "Slide the distance until the ground has dropped {{l3.drop_at_20km_m}} m." | Goal: 20 km. A live readout shows the drop. |
| 4 | `spot-bug` | "This calculation says Pip is in shadow. One line is wrong." | Lines: (1) the ridge is 1,000 m above Pip; (2) it is 60 km away; **(3) it looks atan(1000 ÷ 60000) = 0.95° tall**; (4) the Sun is 0.5° up, so it is blocked. Line 3 forgot the drop: {{l3.drop_at_60km_m}} m at 60 km. The ridge is below Pip's horizon. |
| 5 | `choice` | "Why does a third of a degree matter so much here?" | **Because the Sun never gets above {{l1.sun_el_max_deg}}° this month** / Because my mountains are small / It doesn't. Luna: "At 20 km the drop is a third of a degree. That is a big slice of a Sun that never gets above {{l1.sun_el_max_deg}}°." |

**Words.** The lines the table does not quote, as the app shows them. A hint follows a
first miss (a predict step has one guess, so its hint is not shown). An explanation
follows the answer, right or shown. A panel step's "until it is ready" lines replace
Luna's question while its panel is not built (work package A3); the step then earns no
XP and does not count for the stars.

1. Hint: "On a ball the ground falls away as you look farther out. How much could fall away in 130 km?" Explanation: "At 130 km the ground has dropped {{l3.drop_at_130km_m}} m. Most of the mountain is hidden below my horizon." The reveal caption is the table's reveal.
2. Hint: "My radius R is in it, and the drop has to come out in metres." Explanation: "Twice my radius, 2R. At 20 km that is a drop of {{l3.drop_at_20km_m}} m."
3. Hint: "The drop grows fast: twice the distance, four times the drop. Watch the readout as you slide." Explanation: "At 20 km the ground has dropped {{l3.drop_at_20km_m}} m. Seen from Pip, that is a third of a degree."
4. Title: "A flat-Moon calculation, line by line". Hint: "Find the line that works out an angle. Did it remember that the ground curves away?" Explanation: "Line 3 forgot the drop: {{l3.drop_at_60km_m}} m at 60 km. The ridge is below Pip's horizon."
5. Hint: "Compare a third of a degree with how high the Sun gets here this month." Explanation: Luna's line in the table.

**Exact settings:** Step 3 slides distance from 0 to 60 km in steps of 1 km. The goal is 20 km, right within ±1 km. The live readout is the drop s²/2R from science.md §4, using the Moon's radius from the manifest.

**Card:** the exact formula and how the simple one follows from it (§4); the flat-Moon
horizon dip; why 300 km is far enough (§5). Worked example: the blocker for one real bin,
with and without curvature: the most distant blocker, at azimuth {{l3.example_bin_az}}°,
{{l3.example_dist_km}} km away. Its height above Pip is negative ({{l3.example_height_m}} m):
from a high ridge the far ground lies below Pip, and the card says so. What can go wrong: a flat-Moon calculation; using the simple
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
| 2 | `drag-body` (Earth) | "Drag Earth through a month. Find its highest moment." | Readouts: highest {{l4.earth_el_max_deg}}°, lowest {{l4.earth_el_min_deg}}°. |
| 3 | `predict` | "Over a month, how much of the time is Earth above Pip's horizon?" | Always / Almost never / **About {{l4.earth_up_pct}}%**. Reveal: the timeline's Earth band. |
| 4 | `tune-slider` | "Pip's antenna needs Earth to clear the ground by some margin. Raise the margin until Pip can talk less than 15% of the time." | Goal: {{l4.mask_for_15pct_deg}}° or more. Readout: link time. Pip's link meter follows. |
| 5 | `spot-bug` | "An early TrueSouth used these rules and called every polar site NO-GO. Which rule can never be met here?" | Lines: (1) Earth must clear the skyline; (2) by at least 5°; **(3) for at least half of every month**; (4) or the site is NO-GO. Luna: "A 5° margin held for half of every month can never be met: with a 5° margin Pip can talk only {{l4.link_pct_mask5}}% of the time. Judge the mission's own days, not the whole month. Lesson 7." |

**Words.** The lines the table does not quote, as the app shows them. A hint follows a
first miss (a predict step has one guess, so its hint is not shown). An explanation
follows the answer, right or shown. A panel step's "until it is ready" lines replace
Luna's question while its panel is not built (work package A3); the step then earns no
XP and does not count for the stars.

1. Hint: "Earth hangs over the middle of my near side. My south pole is at the very edge of that face." Explanation: "Seen from my pole, Earth sits on the edge of the sky. My slow wobble lifts it up and lowers it again."
2. Hint: "Earth rises and sinks slowly over the month. Drag back and forth near the top." Explanation: "This month Earth climbs to {{l4.earth_el_max_deg}}° at its highest and sinks to {{l4.earth_el_min_deg}}° at its lowest. Below 0° it is under the horizon, out of Pip's sight." Until it is ready, Luna: "Soon you'll drag Earth through a month here, to find its highest moment. For now, here's what you would find." Reveal: "This month Earth climbs to {{l4.earth_el_max_deg}}° at its highest and sinks to {{l4.earth_el_min_deg}}° at its lowest."
3. Hint: "Earth spends part of each month above the horizon and part below it." Explanation: "About {{l4.earth_up_pct}}%. The rest of the month Earth is below Pip's horizon, and Pip cannot call home." Reveal caption: "The timeline's Earth band for the month: Earth is above Pip's horizon about {{l4.earth_up_pct}}% of the time."
4. Hint: "The higher the margin, the less often Earth clears it. Keep raising it and watch the link time." Explanation: "From {{l4.mask_for_15pct_deg}}° up, Pip can talk less than 15% of the time. A bigger margin is kinder to the radio, but it costs link time."
5. Title: "The early link rules". Hint: "Which rule asks for more than Earth can give? Think about how long Earth stays high in a month." Explanation: Luna's line in the table.

**Exact settings:** Step 4 slides the margin from 0° to 10° in steps of 0.5°. The goal is any margin at or above `{{l4.mask_for_15pct_deg}}`, the first at which link time is under 15%; a lower margin is a miss, because link time there is still 15% or more. Link time at each step is read from `l4.link_pct_by_mask`. Pip's link meter follows that readout. The lesson unlocks both the timeline and the countdowns.

**Card:** sub-Earth point, libration and distance (§3.1); the exact direction to Earth,
including the 0.26° shift from standing off-centre (§3.2); link and antenna mask (§9).
Worked example: one hour, from sub-Earth point to clearance to link. What can go wrong:
fixed thresholds copied from another latitude; measuring the mask from the wrong line.
The 0.26° shift is not in `docs/science.md`, and there is no sub-Earth key for the example
hour, so the card describes the shift in words and starts its worked example at Earth's
azimuth and elevation. The link rule of §9 is quoted as code, not TeX.

**Keys:** `l4.earth_el_max_deg`, `l4.earth_el_min_deg`, `l4.earth_up_pct`,
`l4.link_pct_mask0`, `l4.link_pct_mask1`, `l4.link_pct_mask5`, `l4.link_pct_by_mask`,
`l4.mask_for_15pct_deg`, `l4.example_utc`,
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
| 1 | `predict` | "Pip's site is GO for landing on {{l7.go_date}}. The launch slips three weeks. Still GO?" | Still GO / **NO-GO**. Reveal: the Slip Planner's landing-date strip for Pip's site, with the landing-date line moving. |
| 2 | `choice` | "What changed in three weeks?" | The slope / **Earth sank below the skyline for most of the mission** / My size |
| 3 | `tune-slider` | "Slide the landing date to the next GO day." | Goal: {{l7.next_go_date}}. |
| 4 | `choice` | "Earth's ups and downs repeat about every…" | Day / **27 days** / Year |
| 5 | `choice` | "Or keep the date and move. Which site is GO on the slipped date?" | The learner reads a Slip Planner with three strips, one per site. Answer: **{{l7.alt_site}}**. |

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
| 1 | `drop-pin` | "Four candidate sites. Pick Pip's." | Any site is accepted. A small Slip Planner shows all four as spots. |
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

## Worked examples: exact definitions

**Status.** Final for lessons 1 to 4, with the changes listed under "Decided on
2026-11-13" below, which replace the matching rules and rows. For lessons 5 to 8, which
are outside the deadline, the rules and rows remain a proposal.
The readings use the stored derived data, without changing a site or a profile.

### Decided on 2026-11-13

The lessons were written with design values before the real data existed. Where the real
data does not support a lesson's story, the lesson changes; the data, the sites and the
mission profile do not. The team lead agreed these on 2026-11-13.

1. **Lesson 2's example needs a ridge that stands above Pip.** The lesson says "The Sun
   is … up. A ridge … stands … above Pip." The rule becomes: the first hour in 2028 with
   `sun_el` above 0, `sun_clear` from −0.5 to −0.1 degrees inclusive, and the nearest
   bin's blocker more than 5 km away and higher than the observer. Search the story site
   first, then the other catalog sites in the group `sunlit_peak` in order of id, never a
   best-lit variant; take the first site where such an hour exists. Two new keys record
   the choice: `l2.site_id` and `l2.site_name`. Every other `l2.*` key is read at that
   site and hour. On today's data the story site has no such hour in 2028: from a high
   ridge, distant ground is below Pip, so a Sun above level is hidden only by ground
   close by. `shackleton_rim` and `malapert_peak` both have one (for example
   2028-01-21T19:00:00Z at `shackleton_rim`: the Sun 0.18° up, a ridge 10.0 km away and
   82 m above Pip). Luna's lines for lesson 2 name the site with `{{l2.site_name}}`.
   If no site has such an hour, the build stops and names this rule.
2. **Lesson 3's worked example is the most distant blocker.** The Lesson 3 bin is the
   story site's skyline bin whose blocker is farthest away; a tie goes to the lowest
   azimuth. On today's data that is azimuth 259.00°, 89.3 km away. The rows for
   `l3.example_*` are otherwise unchanged. A blocker's height above the observer may be
   negative: from a high ridge the far ground is below Pip, and the card says so.
3. **Lesson 4 takes all its numbers from the data.** Earth is above the horizon for
   about 60% of the story month, not 38%, and a 5° margin still leaves about 26% link
   time. Two new keys: `l4.link_pct_by_mask`, a list of 21 percentages, the direct-link
   share of the story month for antenna masks of 0°, 0.5°, … 10° (science section 9, no
   relay); and `l4.mask_for_15pct_deg`, the smallest of those masks whose share is below
   15 percent (today 6.5°). If no mask up to 10° gets below 15 percent, the build stops
   and names this rule. Step 4's slider reads its link time from the list and its goal
   from the new key (see lesson 4's "Exact settings").
4. **Keys that cannot be computed are null.** The `WorkedExamples` contract allows null
   for every key of lessons 5 to 8 that the table marks "No" under "Can be computed
   today". No key of lessons 1 to 4 may be null. The web app shows a null as "value not
   built yet".
5. **The story landing rule and the story month stand as written below:** the first GO
   midnight in 2028 at `connecting_ridge` for `im2_athena` (today 2028-01-01T00:00:00Z),
   and the 720 hours from it. The story site is the catalog site, not its best-lit
   variant.

**Lesson text that must change to match** (wording is the lesson writer's job):

- Lesson 1: the design value "2.0°" for the highest Sun is replaced by
  `{{l1.sun_el_max_deg}}` wherever it appears. *Done.* Step 4 also says the 2.08° rule of
  thumb is the best-season maximum and this month is lower; step 1's right answer is now
  "Under 3°", because "Under 2°" is false for the best season (2.08°).
- Lesson 2, steps 1 and 3: Luna says which site Pip is looking from. *Done.* Step 1 also
  says why the lesson moved there.
- Lesson 4, step 2: the readouts' design values (6.0°, −7.3°) are examples only; the
  placeholders carry the real ones. *Done.*
- Lesson 4, step 3: the wrong option "About two-thirds" is too close to the real answer
  and is replaced by one that is clearly wrong, such as "Almost never". *Done.*
- Lesson 4, step 5 (*done*; step 4's goal is now `{{l4.mask_for_15pct_deg}}` too): the explanation "Even with no margin, Earth is up only 38% of the
  time" is false on the real data. The rule that can never be met is the 5° margin for
  half of every month: with a 5° margin Pip can talk `{{l4.link_pct_mask5}}`% of the
  time.

### The rules and the table

**One story scenario.** The site is `connecting_ridge` and the profile is `im2_athena`.
Those choices come from this document, [the overview](overview.md) and
[decision 0010](../decisions/0010-fictional-story-real-data.md).
Proposed landing rule: take the first 00:00 UTC landing date in 2028 that is GO for that
site and profile. If none is GO, take the first that is CAUTION. If neither exists,
report that no story landing date was found. Do not replace the site or profile.
Evaluate with the stored site slope and [science sections 9–10](../science.md#9-mission-metrics).
On today's data this selects **2028-01-01T00:00:00Z**, GO, score **100**, with no vetoes.
There are 24 GO, 0 CAUTION and 342 NO-GO midnight landing dates at the story site in 2028.

**Time spans.** The story month is the 720 stored hours starting at the story landing
hour: [2028-01-01T00:00:00Z, 2028-01-31T00:00:00Z). Lessons 1 and 4 use that month.
The mission window uses the profile's duration and science section 9. Here it is 240 hours,
ending at 2028-01-11T00:00:00Z, exclusive. Lesson 2 keeps its existing whole-2028 rule.
Lesson 7 keeps its own landing-date rule above. All selections use complete windows.
Ties in hours go to the earliest UTC hour. Ties in sites go to the smallest id.

**Shared selections.** Use decoded series values. A Sun azimuth's nearest skyline bin
is selected by rounding its bin position half up and wrapping at 360 degrees.
This bin identifies a stored blocker; it does not replace the interpolated clearance.

- Lesson 1 hour: the hour with the highest `sun_el` in the story month.
- Lesson 2 hour: the first hour in 2028 with `sun_clear` from −0.5 to −0.1 degrees,
  inclusive, and the nearest bin's blocker more than 5 km away. Today it is
  2028-03-02T18:00:00Z, bin 958. If none exists, report the missing selection.
- Lesson 3 bin: the nearest bin at the first hour in the story month with `sun_frac`
  equal to zero and `sun_el` at least zero. Today it is bin 384 at 2028-01-15T09:00:00Z.
  If none exists, report the missing selection. This is a proposal, not a search for
  the most striking curvature example.
- Lesson 4 hour: the story-month hour whose `earth_clear` is closest to the story
  profile's antenna mask. Today it is 2028-01-26T23:00:00Z.
- Lesson 6 sites: evaluate every polar catalog site at the story landing hour with
  the story profile. Keep sites with no veto. Sort by descending score, then id.
  A is the first and B is the second. Report each missing selection. Today A is
  `connecting_ridge`; B does not exist. The worked metric and utility example uses
  the story site's mission window, even if A later differs from the story site.
- Lesson 7 landing: take the first midnight in 2028 that is GO at the story site
  and becomes NO-GO 21 days later with the blackout veto triggered. The next GO
  date is the first midnight after that slipped date, within 2028. The alternative
  is the smallest polar catalog id that is GO at that slipped date. Report any
  missing selection; do not move the date to obtain an alternative.
- Lesson 8 candidates: choose the lexicographically first sorted tuple of four
  distinct polar catalog ids with at least one having a GO midnight in 2028 and
  at least one having none. The overlap example uses the smallest id among those
  four that has a GO midnight. This is a fixed example, not the learner's choice.
  For overlap, use official Artemis polygons, including their boundaries. Unwrap
  ring longitudes around the site's east longitude before the point-in-polygon
  test. Choose the smallest region name among containing polygons. If no polygon
  contains the point, use the text `None` and false. Missing polygons mean unknown,
  not false. Approximate DEM footprints are not official region outlines.

In the table, **series** means `sites/<id>/series.bin`, decoded with its `meta.json`.
**Skyline** means that site's `skyline.bin`. Both live under `data/derived/`.
Every row also reads `manifest.json` for the time grid, units and observer height as needed.
**Profile** means the unchanged `im2_athena` entry in `profiles.json`, including its
provenance. The 10-day duration is sourced; its limits, mask and weights are assumed
as tagged in that file. Computable means the needed inputs exist today. It does not
mean that the lesson's claim is supported. Values are rounded here only for reading.

| Key | Lesson | Unit | Exact definition | Stored arrays or fields read | Can be computed today | Today's value | Does the data support the story? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `l1.sun_el_max_deg` | 1 | deg | Maximum Sun elevation in the story month. | Story series `sun_el`. | Yes. | 0.63 | Yes: below 2 degrees. The old 2.0 design value is replaced. |
| `l1.sun_el_min_deg` | 1 | deg | Minimum Sun elevation in the story month. | Story series `sun_el`. | Yes. | −0.25 | Yes: the Sun stays near the horizon. |
| `l1.site_lat_deg` | 1 | deg north | Latitude of the story site. | `sites.json`: `lat_deg`. | Yes. | −89.4555 | Yes: an extreme south-pole site. |
| `l1.example_utc` | 1 | UTC | Timestamp of the Lesson 1 hour. | Story series `sun_el`; time grid. | Yes. | 2028-01-01T00:00:00Z | Yes: a real hour in the story month. |
| `l1.example_subsolar_lat` | 1 | deg north | Stored sub-solar latitude at the Lesson 1 hour. | `system.bin`: `subsolar_lat`. | Yes. | −0.629889011383 | Yes: real input to the direction calculation. |
| `l1.example_subsolar_lon` | 1 | deg east | Stored sub-solar east longitude at the Lesson 1 hour. | `system.bin`: `subsolar_lon`. | Yes. | 133.227935791 | Yes: real input to the direction calculation. |
| `l1.example_sun_az` | 1 | deg | Stored Sun azimuth at the Lesson 1 hour. | Story series `sun_az`. | Yes. | 270.60 | Yes. Use the site's stored height in any reproduction of science section 3.2. |
| `l1.example_sun_el` | 1 | deg | Stored Sun elevation at the Lesson 1 hour. | Story series `sun_el`. | Yes. | 0.63 | Yes. The stored value includes series quantisation. |
| `l2.example_utc` | 2 | UTC | Timestamp of the Lesson 2 hour. | Story series `sun_clear`, `sun_az`; skyline `dist_km`. | Yes. | 2028-03-02T18:00:00Z | Partly: it matches the rule but the selected terrain is below Pip. |
| `l2.sun_el_deg` | 2 | deg | Sun elevation at the Lesson 2 hour. | Story series `sun_el`. | Yes. | −1.28 | No: the prompt says the Sun is up. |
| `l2.sun_az_deg` | 2 | deg | Sun azimuth at the Lesson 2 hour. | Story series `sun_az`. | Yes. | 239.51 | Yes: it identifies the direction of the example. |
| `l2.ridge_dist_km` | 2 | km | Blocker ground distance in the Lesson 2 nearest bin. | Story skyline `dist_km`. | Yes. | 41.811321259 | Yes: greater than 5 km. |
| `l2.ridge_rise_m` | 2 | m | Blocker height above the observer, using the height difference in science section 4. | Skyline `height_m`; `sites.json` elevation; observer height. | Yes. | −344.339329986 | No: the terrain does not stand above Pip. |
| `l2.ridge_el_deg` | 2 | deg | Stored elevation of the Lesson 2 nearest bin. | Story skyline `el_deg`. | Yes. | −1.160828233 | Partly: it hides most of the Sun, but is not a ridge above the horizontal. |
| `l2.ridge_feature` | 2 | text | Use the literal label `Unnamed terrain`; this selection has no sourced feature association. | Lesson 2 blocker selection only. | Yes. | Unnamed terrain | Yes as an honest fallback label, not an official name. |
| `l2.sun_frac` | 2 | fraction | Visible Sun disc at the Lesson 2 hour. | Story series `sun_frac`. | Yes. | 0.2249 | Yes for more than half hidden; no for fully hidden. |
| `l3.drop_at_20km_m` | 3 | m | Section 4's approximate curvature drop at 20 km, using the manifest Moon radius. | `manifest.json`: `moon_radius_m`. | Yes. | 115.114538966 | Yes: about 115 m. |
| `l3.drop_at_60km_m` | 3 | m | The same section 4 drop at 60 km. | `manifest.json`: `moon_radius_m`. | Yes. | 1036.030850696 | Yes: about 1,036 m. |
| `l3.drop_at_130km_m` | 3 | m | The same section 4 drop at 130 km. | `manifest.json`: `moon_radius_m`. | Yes. | 4863.589271325 | Yes: most of a hypothetical 5 km mountain's height. |
| `l3.example_bin_az` | 3 | deg | Centre azimuth of the Lesson 3 bin, using its stored bin count. | Story series `sun_frac`, `sun_el`, `sun_az`; skyline layout. | Yes. | 96.00 | Yes, but this rule selects nearby terrain rather than a distant mountain. |
| `l3.example_dist_km` | 3 | km | Ground distance of that bin's blocker. | Story skyline `dist_km`. | Yes. | 0.079999998212 | Yes as a real blocker; it is only about 80 m away. |
| `l3.example_height_m` | 3 | m | Blocker height above the observer, as for Lesson 2. | Skyline `height_m`; story site elevation; observer height. | Yes. | 0.587305756 | Yes. The height is relative to Pip, not to the reference sphere. |
| `l3.example_el_flat_deg` | 3 | deg | Use the flat version of section 4 with that blocker's ground distance and height above the observer. | Same blocker and observer fields. | Yes. | 0.420619217 | Yes: higher than the true curved result. |
| `l3.example_el_true_deg` | 3 | deg | Read that bin's stored curved-Moon elevation. Do not recompute it from quantised blocker fields. | Story skyline `el_deg`. | Yes. | 0.418870151 | Yes, though the example's curvature effect is small. |
| `l4.earth_el_max_deg` | 4 | deg | Maximum Earth elevation in the story month. | Story series `earth_el`. | Yes. | 6.22 | Yes: Earth rises and falls near the horizon. |
| `l4.earth_el_min_deg` | 4 | deg | Minimum Earth elevation in the story month. | Story series `earth_el`. | Yes. | −7.53 | Yes. |
| `l4.earth_up_pct` | 4 | percent | Percentage of story-month hours with any visible Earth disc: `earth_frac` strictly greater than zero. | Story series `earth_frac`. | Yes. | 59.722222222 | No for the fixed 38 percent wording. The placeholder can show the real share. |
| `l4.link_pct_mask0` | 4 | percent | Percentage of story-month hours satisfying science section 9's direct-link rule with a 0-degree mask and no relay. | Story series `earth_clear`. | Yes. | 55.694444444 | No for the statement that even no margin gives only 38 percent. |
| `l4.link_pct_mask1` | 4 | percent | The same direct-link share with a 1-degree mask. | Story series `earth_clear`. | Yes. | 51.527777778 | Yes: raising the mask reduces link time. |
| `l4.link_pct_mask5` | 4 | percent | The same direct-link share with a 5-degree mask. | Story series `earth_clear`. | Yes. | 25.833333333 | No: 5 degrees does not reduce link time below 15 percent. |
| `l4.example_utc` | 4 | UTC | Timestamp of the Lesson 4 hour. | Story series `earth_clear`; profile mask. | Yes. | 2028-01-26T23:00:00Z | Yes: a reproducible hour near the mask. |
| `l4.example_earth_az` | 4 | deg | Earth azimuth at the Lesson 4 hour. | Story series `earth_az`. | Yes. | 138.61 | Yes. |
| `l4.example_earth_el` | 4 | deg | Earth elevation at the Lesson 4 hour. | Story series `earth_el`. | Yes. | 0.28 | Yes. |
| `l4.example_earth_clear` | 4 | deg | Earth clearance at the Lesson 4 hour. | Story series `earth_clear`. | Yes. | 1.01 | Yes: a link passes the assumed 1-degree mask. |
| `l5.slope_10m_deg` | 5 | deg | The lesson asks for a slope over 10 m. No method for that baseline is specified in science section 8. Do not invent one. | Would need close-up terrain; method unresolved. | No: no close-up data and no 10 m definition. | Unavailable | Not established. Lesson 5 is outside the deadline. |
| `l5.slope_100m_deg` | 5 | deg | Apply the close-up plane fit in science section 8 at the story site. | Would need original 5 m close-up heights and local east/north coordinates. | No: the close-up DEM is absent. | Unavailable | Not established. |
| `l5.slope_160m_deg` | 5 | deg | Read the story site's stored polar slope; require its baseline to be 160 m. | `sites.json`: `slope.deg`, `slope.baseline_m`. | Yes. | 4.052094097 | Yes for a coarse slope, but the three-ruler comparison is incomplete. |
| `l5.example_site` | 5 | site id | Use the story site. | `sites.json`: `id`. | Yes. | connecting_ridge | Yes as a proposed example; no close-up measurement exists. |
| `l5.plane_a` | 5 | rise/run | East coefficient of the same section 8 close-up plane fit used for the 100 m slope. | Would need original close-up heights and local east/north coordinates. | No: close-up data and fit coefficients are absent. | Unavailable | Not established. |
| `l5.plane_b` | 5 | rise/run | North coefficient of that same plane fit. | Same absent close-up inputs. | No: close-up data and fit coefficients are absent. | Unavailable | Not established. |
| `l6.site_a` | 6 | site id | First site in the Lesson 6 ordering. | Polar `sites.json`; each site's series; profile. | Yes. | connecting_ridge | Only A is available; the pair is not supported. |
| `l6.site_b` | 6 | site id | Second site in the Lesson 6 ordering. | Same site evaluations. | No: only one polar site passes every veto at the story hour. | Unavailable | No: there is no eligible B at that date. |
| `l6.a_score` | 6 | score, 0–100 | Score for A at the story landing hour under the unchanged profile. | A's series; stored slope; profile; science sections 9–10. | Yes. | 100 | No for a reversible ranking: A's utilities are already all 1. |
| `l6.b_score` | 6 | score, 0–100 | Score for B at that same landing hour and profile. | B's series and slope; profile. | No: B was not selected. | Unavailable | No: the proposed pair cannot be scored. |
| `l6.example_metrics.sun_fraction_mean` | 6 | fraction | Section 9 mean Sun disc fraction in the story mission window. | Story series `sun_frac`; profile duration. | Yes. | 1 | Yes: the chosen mission window has full sunlight. |
| `l6.example_metrics.lit_fraction` | 6 | fraction | Section 9 share of lit hours in that mission window. | Story series `sun_frac`, `sun_el`; profile. | Yes. | 1 | Yes. |
| `l6.example_metrics.longest_dark_h` | 6 | h | Section 9 longest consecutive dark stretch in that mission window. | Same lit flags and profile. | Yes. | 0 | Yes: within the assumed 6 h limit. |
| `l6.example_metrics.link_fraction` | 6 | fraction | Section 9 share of linked hours in that mission window. | Story series `earth_clear`; profile. | Yes. | 1 | Yes. |
| `l6.example_metrics.longest_blackout_h` | 6 | h | Section 9 longest consecutive blackout in that mission window. | Same link flags and profile. | Yes. | 0 | Yes: within the assumed 12 h limit. |
| `l6.example_metrics.landing_sun_el_deg` | 6 | deg | Stored Sun elevation at the story landing hour. | Story series `sun_el`. | Yes. | 0.63 | Yes. The profile has no landing elevation veto. |
| `l6.example_metrics.landing_lit` | 6 | boolean | Section 9 lit flag at the story landing hour. | Story series `sun_frac`, `sun_el`; profile. | Yes. | true | Yes. |
| `l6.example_utilities.slope` | 6 | fraction | Section 10 slope utility for the story site's stored slope. | `sites.json`: slope; profile limits. | Yes. | 1 | Yes for the score; it leaves no room to improve A by reweighting. |
| `l6.example_utilities.power` | 6 | fraction | Section 10 power utility for that mission window. | Story metrics above; profile. | Yes. | 1 | Yes for the score; the trade-off example is absent. |
| `l6.example_utilities.comms` | 6 | fraction | Section 10 comms utility for that mission window. | Story metrics above; profile. | Yes. | 1 | Yes for the score; the trade-off example is absent. |
| `l6.example_score` | 6 | score, 0–100 | Section 10 score for the story mission window with stored slope and unchanged profile. | Story metrics, utilities and profile weights. | Yes. | 100 | Yes: GO and no vetoes. |
| `l7.go_date` | 7 | UTC | Lesson 7 landing selected by its rule above. | Story series and slope; profile; 2028 midnight grid. | Yes. | 2028-01-01T00:00:00Z | Yes: GO, score 100. |
| `l7.slip_date` | 7 | UTC | Move the selected Lesson 7 landing exactly 21 UTC days later. | Selected GO date; time grid. | Yes. | 2028-01-22T00:00:00Z | Yes: NO-GO, score 40, with several vetoes. |
| `l7.slip_vetoes` | 7 | list of ids | Triggered veto ids on the slipped mission window, in the section 10 order. | Story series and slope; profile. | Yes. | darkness, blackout, landing_dark | Partly: blackout is a cause, not the only cause. |
| `l7.slip_blackout_h` | 7 | h | Longest blackout in that slipped mission window, from section 9. | Story series `earth_clear`; profile. | Yes. | 119 | Yes: far above the assumed 12 h limit. |
| `l7.next_go_date` | 7 | UTC | First GO midnight strictly after the slipped date, within 2028. | Story series and slope; profile; midnight grid. | Yes. | 2028-01-27T00:00:00Z | Yes: a later GO date exists. |
| `l7.alt_site` | 7 | site id | First GO polar catalog id at the slipped date, ordered by id. | All polar series and stored slopes; profile. | No: zero polar sites are GO at that date. | Unavailable | No: the alternative-site answer does not exist. |
| `l8.candidates` | 8 | list of ids | The four-site tuple selected above. | All polar series and slopes; profile; 2028 midnight grid. | Yes. | artemis_de_gerlache_rim_2; artemis_haworth; artemis_malapert; artemis_nobile_rim_2 | Yes under the lesson's explicit no-GO fallback. Only the last has GO dates. |
| `l8.region_overlap.site_id` | 8 | site id | First candidate id with a GO midnight in 2028. | Candidate tuple and the same midnight evaluations. | Yes. | artemis_nobile_rim_2 | Yes as the proposed fixed example; its overlap is unknown. |
| `l8.region_overlap.region_name` | 8 | text | Name of the official containing region selected above, or `None` when a completed geometry test finds none. | Candidate coordinates; official Artemis polygon rings and names. | No: official outlines are absent. | Unavailable | Not established; a catalog region label is not evidence of containment. |
| `l8.region_overlap.overlaps` | 8 | boolean | True exactly when that completed official-polygon test contains the selected site, including boundaries. | Same official polygon rings and site coordinates. | No: official outlines are absent. | Unavailable | Not established. Never write false for missing data. |

### Story values the data does not support

- Lesson 2's existing rule finds a Sun elevation of −1.28 degrees, terrain 344.339330 m
  below the observer, and a Sun disc fraction of 0.2249. This is not the stated example
  of a ridge above Pip with the Sun up. It does show more than half the disc hidden.
- Lesson 3's proposed first hidden-Sun bin is about 80 m away. Its flat and curved
  elevations are 0.420619217 and 0.418870151 degrees. This is a true but small curvature
  example, not the distant-mountain example described by the opening illustration.
- In Lesson 4's 720 hours, any Earth is visible for 59.722222 percent, not the fixed
  38 percent in the text. A zero-degree mask permits a link for 55.694444 percent.
  A 5-degree mask still permits 25.833333 percent, above the step's 15 percent target.
- Lesson 5's 10 m and 100 m readings and plane coefficients cannot be measured today.
  The coarse 160 m reading is 4.052094097 degrees. It cannot supply the missing rulers.
- At the proposed story hour, only one polar site passes every veto. There is no Lesson 6
  B. A is Connecting Ridge, score 100, with slope, power and comms utilities all 1.
  Reweighting cannot make a second site's score exceed 100 with these utilities.
- Lesson 7's slipped date is NO-GO for darkness (61 h, assumed limit 6 h), blackout
  (119 h, assumed limit 12 h), and landing in darkness. The link fraction is 0.504166667,
  so Earth is not below the link threshold for most of the mission. No polar catalog
  site is GO on that slipped date. The first later GO is 2028-01-27T00:00:00Z.
- Lesson 8's four candidates have 0, 0, 0 and 15 GO midnights in 2028, respectively.
  Its documented fallback handles the first three. The NASA-region reveal is not
  established without official outlines. No overlap result is claimed.

No site, hour, slope, profile limit or weight was changed to repair these stories.

### Contract changes this needs

The current `WorkedExamples` model requires every value and has no unknown state.
A later contract proposal should allow null for the following nine keys, with a reason
recorded alongside the value in an agreed format. Omission would also need an explicit
contract change. Zero, false, an empty name and an unrelated site are not substitutes.

- `l5.slope_10m_deg`: missing data and an undefined 10 m method.
- `l5.slope_100m_deg`: missing close-up data.
- `l5.plane_a` and `l5.plane_b`: missing close-up plane fit.
- `l6.site_b` and `l6.b_score`: no second eligible site at the proposed story hour.
- `l7.alt_site`: no GO polar alternative on the selected slipped date.
- `l8.region_overlap.region_name` and `l8.region_overlap.overlaps`: missing official outlines.

This package changes no contract. Missing future selections must still name their failed
rule. A future contract discussion should cover those failures rather than silently
using a different hour or scenario.

### Questions for review

- Accept this first-GO story landing rule and its 720-hour month?
- Accept the proposed hour, blocker, A/B and candidate ordering rules, despite the
  unsupported stories listed above, or revise the lesson before implementation?
- Define Lesson 5's 10 m slope in science section 8 before any implementation.
- Approve a missing-value representation before building all required keys. Lessons 5
  to 8 remain outside the deadline; they are documented here for the later package.

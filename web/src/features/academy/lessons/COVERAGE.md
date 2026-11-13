# Lessons 1 to 8: can the step types express them?

One row per step in [`docs/academy/lessons.md`](../../../../../docs/academy/lessons.md).
"Expressible" is after the type change in `web/src/features/academy/types.ts`.
Lessons 1 to 4 are written in `l1.ts` to `l4.ts` and open from the path (`lessons/index.ts`).
Their panel steps (`drag-body`, `draw-skyline`, `drop-pin`) wait for work package A3; until
then each shows its `preview`: Luna says what the learner will do there, the stage shows the
real answer, and Continue moves on for no XP and no effect on the stars. Lessons 5 to 8 are
not written yet.
37 of the 40 steps can be expressed. Lesson 8 steps 3, 4 and 5 cannot: each right answer
depends on the site and the date the learner chose earlier, and a goal is a fixed value or a
fixed comparison, not a value computed from earlier answers. The types would need a goal
whose expected value is taken from those earlier answers once the worked examples for that
pair exist. Where the lesson doc is still open, the point is under Questions.

Placeholders in the doc are written `{{l1.sun_el_max_deg}}`. In lesson text they are
`{{example.l1.sun_el_max_deg}}`, which is the form `overview.md` fills from `worked_examples.json`.

| Lesson | Step | Kind | What it shows | What the learner does | What counts as right | Reveal | Worked-example keys | Panel | Expressible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 Where's the Sun? | 1 | choice | Three heights | Picks one | Index 2, "Under 3°" | none | none | none | Yes. `options`, `answer` |
| 1 | 2 | drag-body | Lander's eye, flat skyline, one month | Drags the Sun to its highest moment | `sun_el_deg == {{example.l1.sun_el_max_deg}}` | none | `l1.sun_el_max_deg`, `l1.example_utc` (the month's anchor) | LandersEye | Yes. `panel`, `scene.skyline: "flat"`, `scene.timeRange` span `one-month`, `goal` |
| 1 | 3 | predict | Three direction phrases | One guess | Index 1, "All the way round" | System view plays one month | `l1.example_utc` | SystemView | Yes. `reveal.kind: "panel"`, `when` span `one-month`, `scene` |
| 1 | 4 | fill-formula | `90° − latitude + ( ? )` | Picks the missing piece | Index 0, "1.54°, my tilt" | none | none in the step (see Questions) | none | Yes. `tex`, `options`, `answer` |
| 1 | 5 | choice | Three directions for north | Picks one | Index 2, "Every direction" | none | none | none | Yes. `options`, `answer`. Explain is Luna's line |
| 2 Mountains steal sunlight | 1 | predict | Sun and ridge, two outcomes | One guess | Index 1, "Shadow" | Lander's eye at that hour | `l2.sun_el_deg`, `l2.ridge_dist_km`, `l2.ridge_rise_m`, `l2.ridge_el_deg`, `l2.example_utc` | LandersEye | Yes. `reveal.when` kind `hour`, `scene.skyline: "terrain"` |
| 2 | 2 | fill-formula | `atan( ? ÷ distance )` | Picks the missing piece | Index 0, "its height above you" | none | none | none | Yes. `tex`, `options`, `answer` |
| 2 | 3 | draw-skyline | The direction's skyline | Sketches it | Closeness via `skylineGapDeg` over a 60° window centred on the Sun's azimuth. Every sketch passes | The real skyline is the overlay, not a separate reveal | `l2.sun_az_deg` | LandersEye (the step's scene) | Yes. `window.kind: "centred"`, `centre` the key, `halfWidthDeg: 30`. Wraps at 0°/360° |
| 2 | 4 | drag-body | The Sun as a disc | Drags to a hidden moment | `sun_frac < 0.5` | none | `l2.example_utc` (the centre of the 48 hours) | LandersEye | Yes. `scene.timeRange` kind `hours`, `halfHours: 24`, clamped to the time grid. `follow.power: "sun-fraction"` |
| 2 | 5 | choice | Near ridge or far mountain | Picks one | Index 0, "The near ridge" | none | none | none | Yes. `options`, `answer` |
| 3 The Moon is round | 1 | predict | Flat-Moon height, three outcomes | One guess | Index 1, "Just the tip" | A side view of the curved Moon | none | none. Not a Mission Control panel | Yes. `reveal.kind: "illustration"`, `illustration: "curved-moon-side"` |
| 3 | 2 | fill-formula | `distance² ÷ ( ? )` | Picks the denominator | Index 1, "2R" | none | none | none | Yes. `tex`, `options`, `answer` |
| 3 | 3 | tune-slider | Distance, live drop | Slides to the drop of 115 m | `distance_km == 20`, exactly | none | none (the drop is s²/2R, not a looked-up key) | none | Yes. `slider` 0 to 60 km, step 1, no tolerance, `readout.kind: "curvature-drop"` |
| 3 | 4 | spot-bug | Four calculation lines | Picks the wrong line | `buggyLine` 2, the flat `atan` line | none | none (1,036 m is written out; `l3.drop_at_60km_m` exists) | none | Yes. `lines`, `buggyLine` |
| 3 | 5 | choice | Why a third of a degree matters | Picks one | Index 0, "Because the Sun never gets above {{l1.sun_el_max_deg}}° this month" | none | none | none | Yes. `options`, `answer` |
| 4 Phone home | 1 | choice | Three pictures of Earth from the pole | Picks one | Index 2, "It bobs up and down at the horizon" | none | none | none | Yes. `options`, `answer` |
| 4 | 2 | drag-body | Earth for a month, highest and lowest readouts | Drags to the highest moment | `earth_el_deg == {{example.l4.earth_el_max_deg}}` | none | `l4.earth_el_max_deg`, `l4.earth_el_min_deg`, `l4.example_utc` | LandersEye | Yes. `readout`, `scene.skyline: "smooth"`, `timeRange` span `one-month`. See Questions |
| 4 | 3 | predict | Three shares of the month | One guess | Index 2, "About {{example.l4.earth_up_pct}}%" | The timeline's Earth band | `l4.earth_up_pct` | Timeline | Yes. `reveal.when` kind `band`, `band: "earth"` |
| 4 | 4 | tune-slider | Antenna margin, link-time readout | Raises the margin | `antenna_mask_deg >= {{example.l4.mask_for_15pct_deg}}` | none | `l4.link_pct_by_mask`, `l4.mask_for_15pct_deg` | none | Yes. Slider 0° to 10°, step 0.5°, `readout.kind: "example-list"`, `follow.source: "readout"`. Unlocks Timeline and Countdowns |
| 4 | 5 | spot-bug | Four link rules | Picks the rule that cannot be met | `buggyLine` 2, "for at least half of every month" | none | none (38% is written out; `l4.earth_up_pct` exists) | none | Yes. `lines`, `buggyLine` |
| 5 Don't tip over | 1 | predict | What happened to Athena | One guess | Index 1, "It ended on its side in a small crater" | The real site on the map, with the source | none | PolarMap | Yes. `reveal.kind: "panel"`, `caption` for the source |
| 5 | 2 | fill-formula | `slope = atan( rise ÷ ? )` | Picks the missing piece | Index 0, "run" | none | none | none | Yes. `tex`, `options`, `answer` |
| 5 | 3 | drop-pin | Close-up map, green and red | Drops a pin on gentle ground | `slope_deg <= 10`, checked by the evaluator from the pin | none | none | close-up (`map.view: "closeup"`) | Yes. `map.view`, `goal` optional-or-set, attempt is coordinates or a site id |
| 5 | 4 | tune-slider | Slope at three baselines | Sets the ruler to the NASA length | The slider value is 100 m | none | `l5.slope_10m_deg`, `l5.slope_100m_deg`, `l5.slope_160m_deg` | none | Yes. `slider.kind: "number"`, `readout.stops` at 10, 100 and 160. See Questions for the range |
| 5 | 5 | choice | Can an 80 m map see a 20 m crater | Picks yes or no | Index 1, "No" | none | none | none | Yes. `options`, `answer` |
| 6 Trade-offs | 1 | choice | A sunny site with a 60-hour dark stretch | Picks GO or NO-GO | Index 1, "NO-GO" | none | none | none | Yes. `options`, `answer` |
| 6 | 2 | choice | Limit or preference | Picks one | Index 2, "Pip tips over above 10°" | none | none | none | Yes. `options`, `answer` |
| 6 | 3 | tune-slider | A weight between power and comms | Moves the weight until B ranks first | `score_b > score_a` | none | `l6.site_a`, `l6.site_b`, `l6.a_score`, `l6.b_score` are the story's sites; the live scores come from the evaluator, not from those static keys | none | Yes. `slider.kind: "number"`, `goal.comparedTo`. See Questions for the weight range |
| 6 | 4 | predict | What a safe haven needs | One guess | Index 1, "No more than 50 hours of darkness" | The sourced rule, as text | none | none | Yes. `reveal.kind: "text"` |
| 6 | 5 | choice | A high score that breaks a limit | Picks a status | Index 2, "NO-GO" | none | none | none | Yes. `options`, `answer` |
| 7 The slip | 1 | predict | GO, then a three-week slip | One guess | Index 1, "NO-GO" | Slip Planner row, marker moving | `l7.go_date`, `l7.slip_date` | SlipPlanner | Yes. `reveal.kind: "panel"`, `when` kind `range` from `l7.go_date` to `l7.slip_date` |
| 7 | 2 | choice | What changed | Picks one | Index 1, Earth sank below the skyline | none | none | none | Yes. `options`, `answer` |
| 7 | 3 | tune-slider | Landing dates | Slides to the next GO day | `landing_utc == {{example.l7.next_go_date}}` | none | `l7.next_go_date` | SlipPlanner (`slider.panel`) | Yes. `slider.kind: "date"`, `minUtc`, `maxUtc`, `stepDays`. A missing key is "cannot be checked yet" |
| 7 | 4 | choice | The repeat period | Picks one | Index 1, "27 days" | none | none | none | Yes. `options`, `answer` |
| 7 | 5 | choice | Three Slip Planner rows | Picks the GO site | The option equal to `{{example.l7.alt_site}}` | none | `l7.alt_site` | SlipPlanner | Yes. `answer: { equals: "{{example.l7.alt_site}}" }`. See Questions: the three rows are not named |
| 8 Final mission | 1 | drop-pin | Four candidates and a small Slip Planner | Picks any site | No goal: any pin passes | none | `l8.candidates` | PolarMap, `map.aside: "SlipPlanner"`, `map.sitesKey: "l8.candidates"` | Yes. Optional `goal`, `sitesKey` |
| 8 | 2 | tune-slider | Landing dates for the chosen site | Finds a GO | `status == "GO"`, `prior` the site id from step 1 | none | none for the live status | SlipPlanner | Yes. `slider.kind: "date"`, `goal.prior`, `unreachable` with offers `best-caution-date` and `change-site`. See Questions for Luna's words |
| 8 | 3 | choice | Three countdown readings | Picks the one the card shows | The reading for the learner's own site and date | none | none static | Countdowns | No. The right reading depends on the site and date chosen in steps 1 and 2. A goal cannot yet be computed from earlier answers |
| 8 | 4 | predict | Yes or no for a link all mission | One guess | Whichever option equals the link result for the learner's own choice | Timeline for that choice | none static | Timeline | No. Right and wrong depend on the earlier site and date. The reveal can name a panel; the goal cannot follow the choice |
| 8 | 5 | predict | Did you rediscover NASA's regions | The doc gives no options and no bold answer | The honest line, from whether the learner's site overlaps a region | Polar map with the learner's site, the average-sunlight map, and the Artemis regions | `l8.region_overlap.*` is one fixed site, not the pin the learner dropped | PolarMap | No. The overlap has to be computed from the site the learner dropped. The contract key is not that function |

40 steps. 5 per lesson. 37 can be expressed with the fields above. Lesson 8 steps 3, 4 and 5 cannot, because each goal depends on the learner's earlier site and date. A goal today is a fixed value, a tolerance, or a comparison of two metrics. It can name an earlier answer as `prior`, but it cannot compute the expected countdown, link, or region overlap from that answer. The types would need a goal whose expected value is derived from those earlier answers.

## Questions

The lesson doc and `docs/academy/overview.md` do not say which of these to pick. The skeletons use a field that can hold the answer, and a `TODO(words):` string where the doc describes rather than quotes. They do not invent the missing words.

1. Lesson 1 step 2, lesson 1 step 3, and lesson 4 step 2 say "a whole month" or "plays one month" and do not name the month's UTC endpoints. The story says "in 2028". The only UTC keys are `l1.example_utc` and `l4.example_utc`. Quote: "Drag the Sun through a whole month." Quote: "Reveal: the System view plays one month." The skeletons use `{ kind: "span", span: "one-month", aroundUtc }` with that lesson's example hour.

2. Lesson 1 step 4 writes numbers that have no worked-example keys. Quote: "**1.54°, my tilt** / 23.4° / 5.1°. At 89.46°S that gives 2.08°." `l1.site_lat_deg` exists; 1.54, 23.4, 5.1, 89.46 and 2.08 do not. The skeleton copies the doc. Resolved in A5: the 1.54° tilt and the rule are quoted from `docs/science.md` §3.4, and Luna says the rule gives "about 2°", an estimate for the best season, with no 2.08 typed.

3. Decided. Lesson 2 step 3 is a 60° window centred on `l2.sun_az_deg`. See **Exact settings** in the lesson doc.

4. Decided. Lesson 2 step 4 drags the 48 hours centred on `l2.example_utc`, clamped to the time grid.

5. Decided. Lesson 3 step 3 is 0 to 60 km, step 1 km, goal exactly 20 km, and the readout is s²/2R.

6. Decided. Lesson 4 step 4 is 0° to 10°, step 0.5°, goal any margin at or above `{{example.l4.mask_for_15pct_deg}}`, with a link-time readout read from `l4.link_pct_by_mask`.

7. Decided. Lesson 4 unlocks both the timeline and the countdowns. `unlocks` can be one panel or a list.

8. Lesson 4 step 2 does not say flat, smooth or terrain. Quote: "Drag Earth through a month. Find its highest moment." The skeleton uses `skyline: "smooth"`.

9. Lesson 5 step 4 does not give min, max or step. Quote: "Readout: {{l5.slope_10m_deg}}° at 10 m, {{l5.slope_100m_deg}}° at 100 m, {{l5.slope_160m_deg}}° at 160 m. Goal: 100 m." The type can hold a number slider and three readout stops. The range is not chosen here.

10. Lesson 6 step 3 does not give the weight slider's min, max or step. Quote: "A slider between power and comms weight. Goal: B's score above A's." The type holds that as `goal.comparedTo`. The range is not chosen here.

11. Lesson 6 says "Unlocks: the focused-site panel and Compare." There is no panel id for a focused-site panel. The catalog uses Compare.

12. Lesson 7 step 5 does not name the three rows. Quote: "The learner reads a three-row Slip Planner. Answer: **{{l7.alt_site}}**." The type can mark the right option with `answer: { equals }`. The other two labels are not in the doc.

13. Lesson 8 step 2 describes the fallback and does not give Luna's words. Quote: "If the site has no GO date in range, Luna says so and offers the best CAUTION date or a different site." The type has `unreachable.says` and `unreachable.offer`. The words would be `TODO(words):`.

14. Not expressible, with lesson 8 steps 4 and 5. Quote: "Three readings; the learner picks the one the countdown card shows." The right one depends on the learner's site and date. The types have no goal computed from earlier answers.

15. Not expressible. Quote: "Reveal: the polar map with the learner's site, NASA's average-sunlight map and the Artemis candidate regions." `l8.region_overlap.*` is one site in the contract, not a function of the pin the learner dropped.

16. Lesson 2 step 5, lesson 3 step 1 and lesson 3 step 4 write distances and heights as design numbers. Quote: "a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away". Quote: "A mountain 5 km tall stands 130 km from Pip. On a flat Moon it would look 2.2° tall." The skeletons copy them. Some of the same facts have keys (`l3.drop_at_130km_m`, `l3.drop_at_60km_m`) and the doc still writes the number.

17. Decided. The story landing is the first GO midnight in 2028 at `connecting_ridge` for `im2_athena`, read from `story.landing_utc`; the story month is the 720 hours from it.

18. Decided. Every hint and explanation is written, and quoted in the lesson doc's "Words" lists. A predict step still carries a hint, which is never shown (one guess). Luna's mood is not in the lesson doc; questions use `thinking`.

# Lessons 1 to 8: can the step types express them?

One row per step in [`docs/academy/lessons.md`](../../../../../docs/academy/lessons.md).
"Expressible" is after the type change in `web/src/features/academy/types.ts`.
Lessons 1 to 4 have typed skeletons in `l1.ts` to `l4.ts`. Lessons 5 to 8 are not written yet;
the last column says which fields would hold them. Where the lesson doc is ambiguous or
disagrees with [`docs/academy/overview.md`](../../../../../docs/academy/overview.md), the row
still names the fields, and the open point is under Questions. Nothing in those rows is a guess
presented as a decision.

Placeholders in the doc are written `{{l1.sun_el_max_deg}}`. In lesson text they are
`{{example.l1.sun_el_max_deg}}`, which is the form `overview.md` fills from `worked_examples.json`.

| Lesson | Step | Kind | What it shows | What the learner does | What counts as right | Reveal | Worked-example keys | Panel | Expressible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 Where's the Sun? | 1 | choice | Three heights | Picks one | Index 2, "Under 2°" | none | none | none | Yes. `options`, `answer` |
| 1 | 2 | drag-body | Lander's eye, flat skyline, one month | Drags the Sun to its highest moment | `sun_el_deg == {{example.l1.sun_el_max_deg}}` | none | `l1.sun_el_max_deg`, `l1.example_utc` (the month's anchor) | LandersEye | Yes. `panel`, `scene.skyline: "flat"`, `scene.timeRange` span `one-month`, `goal` |
| 1 | 3 | predict | Three direction phrases | One guess | Index 1, "All the way round" | System view plays one month | `l1.example_utc` | SystemView | Yes. `reveal.kind: "panel"`, `when` span `one-month`, `scene` |
| 1 | 4 | fill-formula | `90° − latitude + ( ? )` | Picks the missing piece | Index 0, "1.54°, my tilt" | none | none in the step (see Questions) | none | Yes. `tex`, `options`, `answer` |
| 1 | 5 | choice | Three directions for north | Picks one | Index 2, "Every direction" | none | none | none | Yes. `options`, `answer`. Explain is Luna's line |
| 2 Mountains steal sunlight | 1 | predict | Sun and ridge, two outcomes | One guess | Index 1, "Shadow" | Lander's eye at that hour | `l2.sun_el_deg`, `l2.ridge_dist_km`, `l2.ridge_rise_m`, `l2.ridge_el_deg`, `l2.example_utc` | LandersEye | Yes. `reveal.when` kind `hour`, `scene.skyline: "terrain"` |
| 2 | 2 | fill-formula | `atan( ? ÷ distance )` | Picks the missing piece | Index 0, "its height above you" | none | none | none | Yes. `tex`, `options`, `answer` |
| 2 | 3 | draw-skyline | The direction's skyline | Sketches it | Closeness via `skylineGapDeg` over `azFrom`–`azTo`. Every sketch passes | The real skyline is the overlay, not a separate reveal | `l2.sun_az_deg` | LandersEye (the step's scene) | Yes. `scene.skyline: "terrain"`, `azFrom`, `azTo` as placeholders. See Questions for the window |
| 2 | 4 | drag-body | The Sun as a disc | Drags to a hidden moment | `sun_frac < 0.5` | none | none (0.5 is the goal in the doc) | LandersEye | Yes. `goal`, `follow.power: "sun-fraction"` |
| 2 | 5 | choice | Near ridge or far mountain | Picks one | Index 0, "The near ridge" | none | none | none | Yes. `options`, `answer` |
| 3 The Moon is round | 1 | predict | Flat-Moon height, three outcomes | One guess | Index 1, "Just the tip" | A side view of the curved Moon | none | none. Not a Mission Control panel | Yes. `reveal.kind: "illustration"`, `illustration: "curved-moon-side"` |
| 3 | 2 | fill-formula | `distance² ÷ ( ? )` | Picks the denominator | Index 1, "2R" | none | none | none | Yes. `tex`, `options`, `answer` |
| 3 | 3 | tune-slider | Distance, live drop | Slides to the drop of 115 m | `distance_km == 20` | none | `l3.drop_at_20km_m`, `l3.drop_at_60km_m`, `l3.drop_at_130km_m` | none | Yes. `slider.kind: "number"`, `readout.stops` looked up, not computed. See Questions for min, max, step |
| 3 | 4 | spot-bug | Four calculation lines | Picks the wrong line | `buggyLine` 2, the flat `atan` line | none | none (1,036 m is written out; `l3.drop_at_60km_m` exists) | none | Yes. `lines`, `buggyLine` |
| 3 | 5 | choice | Why a third of a degree matters | Picks one | Index 0, "Because the Sun is only 1–2° up" | none | none | none | Yes. `options`, `answer` |
| 4 Phone home | 1 | choice | Three pictures of Earth from the pole | Picks one | Index 2, "It bobs up and down at the horizon" | none | none | none | Yes. `options`, `answer` |
| 4 | 2 | drag-body | Earth for a month, highest and lowest readouts | Drags to the highest moment | `earth_el_deg == {{example.l4.earth_el_max_deg}}` | none | `l4.earth_el_max_deg`, `l4.earth_el_min_deg`, `l4.example_utc` | LandersEye | Yes. `readout`, `scene.skyline: "smooth"`, `timeRange` span `one-month`. See Questions |
| 4 | 3 | predict | Three shares of the month | One guess | Index 2, "About {{example.l4.earth_up_pct}}%" | The timeline's Earth band | `l4.earth_up_pct` | Timeline | Yes. `reveal.when` kind `band`, `band: "earth"` |
| 4 | 4 | tune-slider | Antenna margin, link-time readout | Raises the margin | `antenna_mask_deg == 5` | none | `l4.link_pct_mask0`, `l4.link_pct_mask1`, `l4.link_pct_mask5` | none | Yes. `slider.kind: "number"`, `readout`, `follow.link: "link-up"`. See Questions for "about" |
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
| 8 | 3 | choice | Three countdown readings | Picks the one the card shows | `answer: { equals }` the countdown metric for the learner's site and date | none | none static | Countdowns | Yes. `answer.equals` or a goal the evaluator checks. See Questions: the three readings are not listed |
| 8 | 4 | predict | Yes or no for a link all mission | One guess | Whichever option equals the link result for the learner's own choice | Timeline for that choice | none static | Timeline | Yes. `reveal.kind: "panel"`, `scene` from the earlier answers, `answer: { equals }` |
| 8 | 5 | predict | Did you rediscover NASA's regions | The doc gives no options and no bold answer | The honest line, from whether the site overlaps a region | Polar map with the learner's site, the average-sunlight map, and the Artemis regions | `l8.region_overlap.overlaps`, `l8.region_overlap.region_name`, `l8.region_overlap.site_id` | PolarMap | Yes. `reveal.overlays`: `learner-site`, `nasa-average-sunlight`, `artemis-regions`, and `reveal.honest`. See Questions |

40 steps. 5 per lesson. All 40 can be expressed with the fields above. Lessons 1 to 4 are exported from `l1.ts` to `l4.ts` and are not in the catalog.

## Questions

The lesson doc and `docs/academy/overview.md` do not say which of these to pick. The skeletons use a field that can hold the answer, and a `TODO(words):` string where the doc describes rather than quotes. They do not invent the missing words.

1. Lesson 1 step 2, lesson 1 step 3, and lesson 4 step 2 say "a whole month" or "plays one month" and do not name the month's UTC endpoints. The story says "in 2028". The only UTC keys are `l1.example_utc` and `l4.example_utc`. Quote: "Drag the Sun through a whole month." Quote: "Reveal: the System view plays one month." The skeletons use `{ kind: "span", span: "one-month", aroundUtc }` with that lesson's example hour.

2. Lesson 1 step 4 writes numbers that have no worked-example keys. Quote: "**1.54°, my tilt** / 23.4° / 5.1°. At 89.46°S that gives 2.08°." `l1.site_lat_deg` exists; 1.54, 23.4, 5.1, 89.46 and 2.08 do not. The skeleton copies the doc.

3. Lesson 2 step 3 does not give `azFrom` and `azTo`. Quote: "Sketch the skyline you think Pip sees in this direction." The only azimuth key in the lesson is `l2.sun_az_deg`. The skeleton sets both ends to that key.

4. Lesson 2 step 4 says "Find a moment" and does not say which span the learner drags. Quote: "Find a moment when more than half of it is hidden." The skeleton reuses one month around `l2.example_utc`.

5. Lesson 3 step 3 does not give the slider's min, max or step. Quote: "Goal: 20 km. A live readout shows the drop." The skeleton uses 0 to 130 km in steps of 1 km so the three worked drops (20, 60, 130) sit on the slider. The readout looks those drops up. It does not compute `distance² / 2R`.

6. Lesson 4 step 4 says "about 5°" and does not say how wide "about" is. Quote: "Goal: about 5°." The skeleton uses exact equality with 5 and no `tolerance`. The readout stops are the keys at 0°, 1° and 5°.

7. Lesson 4's heading says "Unlocks: timeline and countdowns." A lesson has one `unlocks` panel. The catalog already uses Timeline. The skeleton uses Timeline.

8. Lesson 4 step 2 does not say flat, smooth or terrain. Quote: "Drag Earth through a month. Find its highest moment." The skeleton uses `skyline: "smooth"`.

9. Lesson 5 step 4 does not give min, max or step. Quote: "Readout: {{l5.slope_10m_deg}}° at 10 m, {{l5.slope_100m_deg}}° at 100 m, {{l5.slope_160m_deg}}° at 160 m. Goal: 100 m." The type can hold a number slider and three readout stops. The range is not chosen here.

10. Lesson 6 step 3 does not give the weight slider's min, max or step. Quote: "A slider between power and comms weight. Goal: B's score above A's." The type holds that as `goal.comparedTo`. The range is not chosen here.

11. Lesson 6 says "Unlocks: the focused-site panel and Compare." There is no panel id for a focused-site panel. The catalog uses Compare.

12. Lesson 7 step 5 does not name the three rows. Quote: "The learner reads a three-row Slip Planner. Answer: **{{l7.alt_site}}**." The type can mark the right option with `answer: { equals }`. The other two labels are not in the doc.

13. Lesson 8 step 2 describes the fallback and does not give Luna's words. Quote: "If the site has no GO date in range, Luna says so and offers the best CAUTION date or a different site." The type has `unreachable.says` and `unreachable.offer`. The words would be `TODO(words):`.

14. Lesson 8 step 3 does not list the three readings. Quote: "Three readings; the learner picks the one the countdown card shows." The right one depends on the learner's site and date.

15. Lesson 8 step 5 gives no options and no bold answer. Quote: "Reveal: the polar map with the learner's site, NASA's average-sunlight map and the Artemis candidate regions." The honest paragraph is not a line of dialogue. `l8.region_overlap.*` is one site in the contract, not a function of the pin the learner dropped.

16. Lesson 2 step 5, lesson 3 step 1 and lesson 3 step 4 write distances and heights as design numbers. Quote: "a 300 m ridge 12 km away, or a 3,000 m mountain 150 km away". Quote: "A mountain 5 km tall stands 130 km from Pip. On a flat Moon it would look 2.2° tall." The skeletons copy them. Some of the same facts have keys (`l3.drop_at_130km_m`, `l3.drop_at_60km_m`) and the doc still writes the number.

17. The story scenario says "in 2028" and does not name the landing day. Quote: "Story scenario for every lesson unless stated: Pip, profile `im2_athena`, at Connecting Ridge, in 2028." The skeletons use `2028-01-01T00:00:00Z`.

18. `overview.md` says a predict step has no hint. The step type still requires `hint`, and the lesson doc does not write hints. The skeletons put the step's answer cell in `TODO(words):` until a writer replaces it. Luna's mood is not in the lesson doc; the skeletons use `thinking`.

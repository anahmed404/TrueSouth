# Development log

What has been built, what is blocked, and how AI tools were used.

## How to use this file

- Add an entry when you finish a work package, hit a blocker, or change a contract.
- **Write only in your own track's section.** That keeps four people's entries from
  colliding when branches merge.
- Newest entries go at the top of your section.
- Say **verified** only when the work package's checks have passed. Otherwise say
  **built, not verified**.
- Keep entries short. Details belong in the pull request.

Entry format:

```markdown
#### YYYY-MM-DD · <work package id> · <one-line summary>
- **Who:** <name>
- **AI use:** <tool> — <what it produced> — <how you checked it>
- **State:** verified | built, not verified | blocked
- **Changed:** <folders or key files>
- **Notes:** <anything the next person must know; measured numbers; open questions>
```

The **AI use** line is required. Space Apps asks teams to disclose how AI was used, and
these lines are collected into the submission (work package A11).

- Name the tool and what it produced. "Codex wrote the first version of `skyline.py`" is
  useful. "Used AI for coding" is not.
- Say how a human checked it: which tests, which review.
- List AI-generated images, audio or video separately, with the tool that made them.
- NASA data and logos are never AI-generated or altered.

Tools the team uses: Claude Code, Codex, Cursor, Antigravity.

## Status board

Ids are from [`docs/build-plan.md`](docs/build-plan.md). The team lead updates this at
each integration checkpoint.

| Milestone | State |
| :--- | :--- |
| M0 Foundations | complete, 2026-11-13: S0 to S2, MC0 to MC2, T0, A0 and A1 verified; 151 Python and 1,058 web tests pass; the app loads all five fixture sites |
| M1 Thin slice | done in substance: the panels and the timeline run on real data for all 20 catalog sites (S3 to S9, MC3 to MC5 verified); validation against NASA is published (S12) |
| M2 Mission Control complete on catalog data | in progress: the space-first shell (MC4c) is in review and the 3D scene (T1, T2) is being built; the Polar map, Local terrain, Lander's eye, Slip Planner and Compare follow it |
| M3 Everything | not started |
| M4 Tuned and submitted | not started |

## Science

#### 2026-11-13 · S12b · Worked examples from the stored series
- **Who:** Cursor implementation agent
- **AI use:** Cursor, grok-4.7 — wrote the selection tests first, then the worked-example command, the contract keys and the smallest Academy wiring — human and orchestrator review pending.
- **State:** verified (322 Python tests and 1,581 web tests, typecheck, build and schema regeneration pass on the merge with main; the orchestrator recomputed lessons 1 to 4 from the stored series with its own script and every value matches, including all 21 link shares)
- **Changed:** `WorkedExamples` in `contracts.py` (story keys, lesson 2 site, the 21 mask shares, nullable lessons 5–8 keys), `worked_examples.py`, `commands/build_worked_examples.py`, the synthetic fixture, regenerated schema and TypeScript types, parser and lesson wiring for those keys, `data/derived/academy/worked_examples.json`, this entry.
- **Checks:** `uv run pytest`: 308 passed, exit 0. `pnpm --dir web typecheck`: exit 0. `pnpm --dir web test`: 1,507 passed, exit 0. `pnpm --dir web build`: exit 0. A second `build-worked-examples` on the real derived tree was byte-identical. Regenerating the schema and types after the contract edit left no further diff.
- **Notes:** The story is `connecting_ridge` with `im2_athena`, landing 2028-01-01T00:00:00Z (GO, score 100). The story month is the 720 hours through 2028-01-31T00:00:00Z, exclusive. The mission window ends 2028-01-11T00:00:00Z, exclusive. Lesson 2 looks from `malapert_peak` (Malapert Massif peak) at 2028-01-04T17:00:00Z. Connecting Ridge has no 2028 hour that passes the rule: the 345 hours with the Sun up and clearance from −0.5° to −0.1° are blocked by ground 0.08–0.12 km away. de Gerlache Rim and the peak near Shackleton also have none, so Malapert is the first site in the search order that has one. The spot checks agree, including Shackleton's own first hour 2028-01-21T19:00:00Z and the first mask below 15 percent at 6.5°.

| Key | Value | Null |
| :--- | :--- | :--- |
| `l1.sun_el_max_deg` | 0.63° | no |
| `l1.sun_el_min_deg` | −0.25° | no |
| `l1.site_lat_deg` | −89.4555° | no |
| `l1.example_utc` | 2028-01-01T00:00:00Z | no |
| `l1.example_subsolar_lat` | −0.63° | no |
| `l1.example_subsolar_lon` | 133.23° | no |
| `l1.example_sun_az` | 270.60° | no |
| `l1.example_sun_el` | 0.63° | no |
| `l2.site_id` | malapert_peak | no |
| `l2.site_name` | Malapert Massif peak | no |
| `l2.example_utc` | 2028-01-04T17:00:00Z | no |
| `l2.sun_el_deg` | 0.54° | no |
| `l2.sun_az_deg` | 90.25° | no |
| `l2.ridge_dist_km` | 9.0 km | no |
| `l2.ridge_rise_m` | 179 m | no |
| `l2.ridge_el_deg` | 1.0° | no |
| `l2.ridge_feature` | Unnamed terrain | no |
| `l2.sun_frac` | 0 | no |
| `l3.drop_at_20km_m` | 115 m | no |
| `l3.drop_at_60km_m` | 1,036 m | no |
| `l3.drop_at_130km_m` | 4,864 m | no |
| `l3.example_bin_az` | 259.00° | no |
| `l3.example_dist_km` | 89.3 km | no |
| `l3.example_height_m` | −1,578 m | no |
| `l3.example_el_flat_deg` | −1.01° | no |
| `l3.example_el_true_deg` | −2.48° | no |
| `l4.earth_el_max_deg` | 6.22° | no |
| `l4.earth_el_min_deg` | −7.53° | no |
| `l4.earth_up_pct` | 60% | no |
| `l4.link_pct_by_mask` | 56, 54, 52, 49, 47, 45, 42, 38, 34, 30, 26, 21, 16, 11, 0, 0, 0, 0, 0, 0, 0 | no |
| `l4.link_pct_mask0` | 56% | no |
| `l4.link_pct_mask1` | 52% | no |
| `l4.link_pct_mask5` | 26% | no |
| `l4.mask_for_15pct_deg` | 6.5° | no |
| `l4.example_utc` | 2028-01-26T23:00:00Z | no |
| `l4.example_earth_az` | 138.61° | no |
| `l4.example_earth_el` | 0.28° | no |
| `l4.example_earth_clear` | 1.01° | no |
| `l5.slope_10m_deg` | — | yes |
| `l5.slope_100m_deg` | — | yes |
| `l5.slope_160m_deg` | 4.05° | no |
| `l5.example_site` | connecting_ridge | no |
| `l5.plane_a` | — | yes |
| `l5.plane_b` | — | yes |
| `l6.site_a` | connecting_ridge | no |
| `l6.site_b` | — | yes |
| `l6.a_score` | 100 | no |
| `l6.b_score` | — | yes |
| `l6.example_metrics.sun_fraction_mean` | 1 | no |
| `l6.example_metrics.lit_fraction` | 1 | no |
| `l6.example_metrics.longest_dark_h` | 0 h | no |
| `l6.example_metrics.link_fraction` | 1 | no |
| `l6.example_metrics.longest_blackout_h` | 0 h | no |
| `l6.example_metrics.landing_sun_el_deg` | 0.63° | no |
| `l6.example_metrics.landing_lit` | true | no |
| `l6.example_utilities.slope` | 1 | no |
| `l6.example_utilities.power` | 1 | no |
| `l6.example_utilities.comms` | 1 | no |
| `l6.example_score` | 100 | no |
| `l7.go_date` | 2028-01-01T00:00:00Z | no |
| `l7.slip_date` | 2028-01-22T00:00:00Z | no |
| `l7.slip_vetoes` | darkness, blackout, landing_dark | no |
| `l7.slip_blackout_h` | 119 h | no |
| `l7.next_go_date` | 2028-01-27T00:00:00Z | no |
| `l7.alt_site` | — | yes |
| `l8.candidates` | artemis_de_gerlache_rim_2, artemis_haworth, artemis_malapert, artemis_nobile_rim_2 | no |
| `l8.region_overlap.site_id` | artemis_nobile_rim_2 | no |
| `l8.region_overlap.region_name` | — | yes |
| `l8.region_overlap.overlaps` | — | yes |
| `story.site_id` | connecting_ridge | no |
| `story.profile_id` | im2_athena | no |
| `story.landing_utc` | 2028-01-01T00:00:00Z | no |
| `story.month_end_utc` | 2028-01-31T00:00:00Z | no |
| `story.window_end_utc` | 2028-01-11T00:00:00Z | no |

#### 2026-11-13 · S13 · Docker build, with a minimal API
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the catalog API, Dockerfile, compose file and tests — checked with pytest, a local web build, and a real container run
- **State:** verified (308 Python tests and the web tests pass on the merge with main; reviewed by Gemini (approve): non-root, healthy, traversal refused, 199 MB image; follow-ups applied: data files revalidate, dot names refused, health lists aprons)
- **Changed:** `api/src/truesouth_api/` (health, static files, SPA fallback, one 501 stub), `api/tests/test_app.py`, `Dockerfile`, `compose.yaml`, `.dockerignore`, the Production and catalog-only API sections of `docs/architecture.md`.
- **Out of scope:** custom sites, date jobs, rate limits, the sensitivity grid. `GET` and `HEAD /api/custom/…` return 501 with "Custom sites are not available in this version." `POST /api/sites/custom`, `GET /api/sites/custom/{id}` and `POST /api/sensitivity` are not registered: nothing in `web/src` calls them, so they 404 as JSON. No init service, because it would download NASA maps for custom-site terrain. The science package is not installed in the image.
- **Numbers:** build context 53.03 MB. Successful `docker compose -p truesouth-s13 build` 58.8 s (the Python virtualenv layer was already cached; `uv sync` itself took 23.3 s when it ran). Image `truesouth-s13:catalog` 187,491,888 bytes. Startup to healthy 8.3 s. Live health `status` ok. `sites/connecting_ridge/series.bin` 841,344 bytes, matches disk. `maps/hillshade_4k.webp` 1,279,620 bytes, matches disk. `/mission` and `/academy/sample` return the app HTML. A missing data file is `text/plain` 404 `Not found`. Mission console had no errors. Academy console had one 404 for `/data/academy/worked_examples.json`, which is not in the derived tree (`worked_examples: false`). Removed container `truesouth-s13-truesouth-1`, network `truesouth-s13_default`, and image `truesouth-s13:catalog`.
- **Checks:** `uv run pytest` 263 passed, 1 warning, exit 0, 44.47 s. `pnpm --dir web build` exit 0 (run outside Docker). Merged `origin/main` before the final checks. Did not touch the glossary test fixed on main.

#### 2026-11-13 · S12 · Validation comparisons and worked-example definition proposal
- **Who:** Codex implementation agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — wrote synthetic tests before implementation, validation calculations and CLI, the derived validation evidence, and the Academy definition proposal; ran offline pytest and read-only real-data measurements — and Cursor, grok-4.7 — fixed the review findings on pixel indexing, skyline convergence, the G2 raw azimuth, unmeasured gates and specific explanations — human and orchestrator review pending.
- **State:** verified (orchestrator ran 294 Python and 1,504 web tests, typecheck, build and schema export on the merge with main; Antigravity, gemini-4-hydrogen reproduced every R1, R2 and R3 row with separate code, reran validate byte for byte and ran thirteen mutations; the three that survived now fail tests added by Cursor, grok-4.7, which also made the unmeasured gates and the explanations honest)
- **Review fixes:** Cursor, grok-4.7 made the review fixes. Tests now catch a flipped reference row, a coarse skyline compared with itself, and a G2 gate that uses raw compass azimuth. G10 and G11 are null rather than failed. Outside-mark explanations quote this run's own pixels, and Chandrayaan-3's Not run reason names the maps that were tried. `uv run pytest`: 282 passed. Web typecheck, 1,500 web tests and the production build passed. Regenerating types left no diff. Comparison values in `validation.json` are unchanged. State remains built, not verified.
- **Changed:** `science/src/truesouth/validation.py`, `commands/validate.py`, two new test files, `data/derived/validation.json`, the proposed section at the end of `docs/academy/lessons.md`, this entry.
- **Checks:** `uv run pytest`: 237 passed in 66.85 s; real process exit code 0, captured in the log and read back. New synthetic checks cover known fractions, exact marks, scale/offset/masks, 120 m fallback, unavailable references including `.part`, shared geometry gates, G1 parser fault detection, G2 near-zenith bearings and full body coverage, flat/tilted convergence, atomic failure preservation, and fixed-timestamp byte identity. Real `uv run truesouth validate --generated-utc 2026-11-13T00:00:00Z`: exit 0, including the completed R3 slope map. All new/edited files use UTF-8 without BOM and LF. No shared NASA data was written or downloaded.
- **Notes:** Built read-only NASA pixel sampling, pure R1/R2/R3/R5 comparisons, measured G1-G9, G2 daily charts and raw-azimuth diagnostics, and an atomic `validate --generated-utc` command. Published the real validation file. Added the 65-key worked-example definition proposal with real-data readings. No worked-example command or Academy output is included.

NASA slope TIF: 241,594,035 bytes; Float32; 80 m pixels; scale 1; offset 0; NaN no-data; lunar south-polar stereographic on a 1,737,400 m sphere. Its unit and baseline tags are absent. [NASA product 90](https://pgda.gsfc.nasa.gov/products/90) identifies LDSM values as degrees; the file does not establish its measurement baseline, so it is not assumed equal to ours (160 m). All 13 core80 sites were compared. R1/R2 cover the 14 sites in their tables. Chandrayaan-3 and the five sphere sites have no reference pixel. R5 uses the first three sunlit_peak ids, sorted by id, recomputing both resolutions.

G10 and G11 are not measured from Python: passed=false, samples=0; the mandatory measured=0 is explicitly labelled a contract placeholder in detail. Their checks live in the web test/types checks. G1-G9 passed. A measured hard-gate failure still writes the evidence and returns nonzero. An unavailable comparison is omitted and printed in the Not run list. No contracts, terrain, profiles or tolerances changed.

**R1: mean Sun disc fraction.** Difference is ours minus reference.

| Site | Ours | Reference | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `artemis_de_gerlache_rim_2` | 0.363024798 | 0.372960000 | -0.009935202 | no |
| `artemis_haworth` | 0.123245445 | 0.084880000 | +0.038365445 | no |
| `artemis_malapert` | 0.297243637 | 0.281600000 | +0.015643637 | no |
| `artemis_mouton` | 0.216295185 | 0.204240000 | +0.012055185 | no |
| `artemis_nobile_rim_1` | 0.307241229 | 0.297320000 | +0.009921229 | no |
| `artemis_nobile_rim_2` | 0.411448218 | 0.416120000 | -0.004671782 | no |
| `connecting_ridge` | 0.598582287 | 0.661080000 | -0.062497713 | no |
| `de_gerlache_rim` | 0.607358328 | 0.612960000 | -0.005601672 | no |
| `im1_odysseus` | 0.393990556 | 0.355680000 | +0.038310556 | no |
| `im2_athena` | 0.453739913 | 0.451040000 | +0.002699913 | no |
| `luna25_target` | 0.455682358 | 0.458080000 | -0.002397642 | no |
| `malapert_peak` | 0.727993601 | 0.748360000 | -0.020366399 | no |
| `peak_near_shackleton` | 0.601720921 | 0.361280000 | +0.240440921 | yes |
| `shackleton_rim` | 0.746861726 | 0.695640000 | +0.051221726 | no |

**R2: share of hours with any Earth.** Difference is ours minus reference.

| Site | Ours | Reference | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `artemis_de_gerlache_rim_2` | 0.548436787 | 0.547840000 | +0.000596787 | no |
| `artemis_haworth` | 0.441769360 | 0.439400000 | +0.002369360 | no |
| `artemis_malapert` | 0.537482885 | 0.524120000 | +0.013362885 | no |
| `artemis_mouton` | 0.418473300 | 0.391400000 | +0.027073300 | no |
| `artemis_nobile_rim_1` | 0.367393123 | 0.344960000 | +0.022433123 | no |
| `artemis_nobile_rim_2` | 0.689087935 | 0.687840000 | +0.001247935 | no |
| `connecting_ridge` | 0.549140423 | 0.556880000 | -0.007739577 | no |
| `de_gerlache_rim` | 0.581792941 | 0.563160000 | +0.018632941 | no |
| `im1_odysseus` | 1.000000000 | 1.000000000 | +0.000000000 | no |
| `im2_athena` | 0.931424007 | 0.920800000 | +0.010624007 | no |
| `luna25_target` | 1.000000000 | 1.000000000 | +0.000000000 | no |
| `malapert_peak` | 0.624904914 | 0.634640000 | -0.009735086 | no |
| `peak_near_shackleton` | 0.411513008 | 0.375960000 | +0.035553008 | no |
| `shackleton_rim` | 0.518389624 | 0.496840000 | +0.021549624 | no |

**R3: polar-map slope, degrees.** Difference is ours minus reference.

| Site | Ours | Reference | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `artemis_de_gerlache_rim_2` | 10.824032502 | 11.181346893 | -0.357314392 | no |
| `artemis_haworth` | 3.860687452 | 3.665967464 | +0.194719988 | no |
| `artemis_malapert` | 3.276886675 | 3.869591236 | -0.592704561 | no |
| `artemis_mouton` | 7.482868018 | 7.675848484 | -0.192980466 | no |
| `artemis_nobile_rim_1` | 15.734712742 | 15.801492691 | -0.066779949 | no |
| `artemis_nobile_rim_2` | 4.349376581 | 4.289270878 | +0.060105703 | no |
| `connecting_ridge` | 4.052094097 | 3.325883389 | +0.726210708 | no |
| `de_gerlache_rim` | 2.154988323 | 1.122872591 | +1.032115732 | no |
| `im1_odysseus` | 11.510853833 | 11.191024780 | +0.319829053 | no |
| `im2_athena` | 2.684766518 | 2.219825983 | +0.464940535 | no |
| `malapert_peak` | 4.070659005 | 4.130123138 | -0.059464133 | no |
| `peak_near_shackleton` | 1.839560375 | 1.883983254 | -0.044422880 | no |
| `shackleton_rim` | 1.151163668 | 2.384227753 | -1.233064085 | no |

**R5: skyline convergence RMS, degrees.** Difference is ours minus reference.

| Site | Ours | Reference | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `connecting_ridge` | 0.120816809 | 0.000000000 | +0.120816809 | yes |
| `de_gerlache_rim` | 0.014725153 | 0.000000000 | +0.014725153 | no |
| `malapert_peak` | 0.038990643 | 0.000000000 | +0.038990643 | no |

**Gates.** G2 covers 20 sites, 2 bodies and 52,584 hours: 2,103,360 site/body hours, with 40 daily charts of 2,191 maxima each.

Compared directions from stored Float32 system.bin at ground height 0 plus 2 m (science section 3.3); each azimuth sky angle and elevation is gated at 0.02 deg. az: max 0.00600724942124 deg at im1_odysseus/earth 2027-01-07T22:00:00Z, RMS 0.00263495075648 deg. el: max 0.00600637441696 deg at apollo11/earth 2027-02-06T15:00:00Z, RMS 0.00108412583568 deg. sky: max 0.00602921260851 deg at apollo11/earth 2027-01-07T22:00:00Z, RMS 0.00284926143678 deg. raw: max 0.0823560453039 deg at apollo11/sun 2031-10-14T01:00:00Z. Raw compass azimuth is diagnostic only: 28 site/body hours above 0.02 deg; daily chart uses full sky separation.

| Gate | Measured | Limit | Unit | Samples | State |
| :--- | ---: | ---: | :--- | ---: | :--- |
| G1 | 0 | 0 | difference | 315504 | pass |
| G2 | 0.00600724942124 | 0.02 | deg | 2103360 | pass |
| G3 | 3.08864400722e-09 | 0.01 | m | 2232 | pass |
| G4 | 8.98041993269e-08 | 0.001 | deg | 1440 | pass |
| G5 | 1.57429624892e-13 | 0.001 | deg | 2 | pass |
| G6 | 1.386391002e-13 | 0.02 | deg | 2 | pass |
| G7 | 0.0013027560869 | 0.005 | fraction | 24012 | pass |
| G8 | 4.1915316551e-07 | 0.001 | deg | 18 | pass |
| G9 | 0.00499960023978 | 0.005 | deg | 80056 | pass |
| G10 | 0 | 1e-09 | difference | 0 | not measured |
| G11 | 0 | 0 | difference | 0 | not measured |

**Not run (exact command list).**

```text
R1 apollo11: sphere-tier site outside the polar reference maps
R1 apollo17: sphere-tier site outside the polar reference maps
R1 blue_ghost1: sphere-tier site outside the polar reference maps
R1 chandrayaan3: reference pixel is no-data or outside both maps
R1 change4: sphere-tier site outside the polar reference maps
R1 change6: sphere-tier site outside the polar reference maps
R2 apollo11: sphere-tier site outside the polar reference maps
R2 apollo17: sphere-tier site outside the polar reference maps
R2 blue_ghost1: sphere-tier site outside the polar reference maps
R2 chandrayaan3: reference pixel is no-data or outside both maps
R2 change4: sphere-tier site outside the polar reference maps
R2 change6: sphere-tier site outside the polar reference maps
R4: close-up reference maps are not downloaded
R6: the sensitivity grid is not built in this version
```

**Story values the data does not support.**

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

Every one of the 65 proposed keys has a definition, source arrays, availability, real reading where possible and story-support note in `docs/academy/lessons.md`. Story landing: 2028-01-01T00:00:00Z, Connecting Ridge, unchanged im2_athena, GO score 100. Nine keys cannot be computed under the proposal.

**Spec questions for the orchestrator.**

- Accept this first-GO story landing rule and its 720-hour month?
- Accept the proposed hour, blocker, A/B and candidate ordering rules, despite the
  unsupported stories listed above, or revise the lesson before implementation?
- Define Lesson 5's 10 m slope in science section 8 before any implementation.
- Approve a missing-value representation before building all required keys. Lessons 5
  to 8 remain outside the deadline; they are documented here for the later package.

#### 2026-11-13 · S16 · Scene image files and aprons
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the scene builder, contracts, tests, fixture scene and web loader — checked with pytest, vitest, the real NASA build, landmark boxes and a byte comparison to the prototype; human review pending. No AI-generated imagery.
- **State:** verified (the orchestrator, Claude Fable 5.2, ran 263 Python and 1,498 web tests, typecheck, build and schema export on the merge with main; decoded three aprons and compared 141 cells with the terrain store at independently computed positions (largest difference 0.25 m, the encoding step is 0.5 m; a transposed grid would not match); checked Tycho, Copernicus and two maria on the Moon map; replaced input modification times with content hashes so the committed metadata is the same on every machine)
- **Changed:** `scene_assets.py`, `build-scene-assets`, `fetch-raw` texture group, `contracts.py`, generated schema and types, `data/derived/scene/`, `data/fixtures/scene/`, web `data/` loader, `docs/data-contracts.md`, `docs/architecture.md`. One line in `cli.py` registers the command; discovery is not automatic.
- **Notes:** Build 29.1 s. `scene/` is 8,658,276 bytes (derived 50,785,847 before, 59,444,123 after). Largest file `moon_8k_e.webp` is 1,557,786 bytes. A second run printed "up to date" and the folder hash was unchanged. `moon_4k.webp`, `hillshade_core_2048.webp`, `earth_2k.jpg` and `cap_slope.webp` match the prototype pixel for pixel. The height PNG differs in 20 of 1,036,800 pixels, each by 1. Connecting Ridge apron centre is 1,950.5 m against elevation 1,950.256 m (0.244 m). Largest difference against `terrain.bin` on the 121 shared vertices is 0.244 m. The ±10 km patch edge is not an apron node; the nearest ring is ±9,375 m. The 2K TIFF is not downloaded. Checks this session: pytest 263 passed; web typecheck exit 0; web tests 1,498 passed in 53 files; web build exit 0; `gen:types` left git status unchanged. All exit codes 0.

#### 2026-11-13 · S15A · Sunlit-peak placement, decision 0012 part A
- **Who:** Codex implementation agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — wrote contract fields, placement module and tests;
  checked synthetic geometry, real skyline/series integration, full automated suites
  and the read-only Connecting Ridge run; human review pending
- **State:** verified (orchestrator ran 251 Python and 1,494 web tests, typecheck and type generation on the merge with main; Cursor, grok-4.7 checked the candidate geometry independently to a millimetre, reproduced Connecting Ridge and de Gerlache rim on real data and ran ten mutations; its two findings were fixed by the orchestrator)
- **Changed:** `contracts.py`, pure `placement.py`, new Science tests, generated schema
  and TypeScript types, `parseSites` and its tests; fixture sites gained only three null fields.
- **Checks:** `uv run pytest`: 250 passed; web tests: 1,334 passed in 42 files;
  web typecheck and production build passed. All exit codes 0. Schema/types regenerated;
  fixture regeneration changed no other values or files. Merged `origin/main` before checks.
- **Real data:** Connecting Ridge, both prepared maps and committed `system.bin`, 13
  candidates, none skipped. Mean `sun_frac`: min 0.397490348, max 0.869614946;
  listed coordinates 0.598582298 (the containing pixel centre is 0.599433535).
  Best: −89.451160220°, 222.857279836° E, offset 148.536579 m;
  map Δx −139.901063 m, Δy −49.907993 m. Agrees with decision 0012's rounded
  0.397–0.870, listed 0.599, best −89.45116° / 222.8573° E, 149 m, −140 m / −50 m.
  520.46 s total, including 13 candidate calculations (480.69 s) and the listed point.
  Other four sunlit peaks not rerun; no real-data outputs committed.
- **Part B:** Inject `mean_for_point(point)` into `evaluate_placement`; cache each
  candidate's own ground, skyline, unquantised series and mean, keyed by map pixel and
  input/method versions (about 13 skylines per site, roughly 40 s each). Cache the listed
  coordinates separately. Attach the range to both records; `build_variant` returns
  partial Site fields for normal derived-field processing, never a CatalogSite.
  Exact sunlight and distance ties use smallest row, then column. No spec questions.

#### 2026-11-13 · S8 part 2 · Catalog slopes and terrain meshes
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote tests first, implemented build-sites wiring, and ran real-data builds and checks — human and orchestrator review pending
- **State:** verified (orchestrator ran the 212 tests on the merge with main and rebuilt Connecting Ridge byte for byte; Antigravity, gemini-4-hydrogen validated every derived file against the contracts, recomputed tiers, slopes and all 15 meshes independently, rebuilt three sites byte for byte and ran six mutations, all caught)
- **Changed:** science/src/truesouth/commands/build_sites.py, science/tests/test_build_sites_s7.py, data/derived/ sites and catalog, this entry.
- **Notes:** All 20 sites built in 593.193 s; per-site build times appear below. Derived tree: 50,785,780 bytes. Mean sun_frac and hourly shares use the decoded series; missing mesh vertices count nonfinite up coordinates. A dash means unavailable. All 15 terrain-site slopes match direct polar_slope results exactly. Connecting Ridge series and skyline match main byte-for-byte and its slope is 4.052094 degrees over 160 m. Chandrayaan-3 is wide240, 0.860984 degrees over 480 m; IM-2 is core80. All five sphere sites have null slope and terrain, and no terrain.bin. Mesh centres have relative up within 4.657e-10 m of zero (roundoff), so match the site's ground height. Forced repeats of Connecting Ridge and Chandrayaan-3 reproduced all eight site files byte-for-byte. Close-up data remains unavailable. No spec questions. uv run pytest: 212 passed in 47.36 s, exit 0.

| Site | Tier | Ground m | Slope deg / baseline m | Mean sun_frac | Any Sun % | Earth clearance >= 1 deg % | Missing skyline samples | Missing mesh vertices | Folder bytes | Time s |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| apollo11 | sphere | - | - | 0.502535 | 50.396 | 100.000 | 0 | - | 871152 | 0.073 |
| apollo17 | sphere | - | - | 0.502515 | 50.396 | 100.000 | 0 | - | 871153 | 0.061 |
| artemis_de_gerlache_rim_2 | core80 | -88.834 | 10.824033 / 160 | 0.363025 | 37.477 | 45.501 | 0 | 0 | 1927994 | 41.529 |
| artemis_haworth | core80 | 1628.032 | 3.860687 / 160 | 0.123245 | 15.377 | 34.322 | 0 | 0 | 1927983 | 40.972 |
| artemis_malapert | core80 | 4784.771 | 3.276887 / 160 | 0.297244 | 34.826 | 44.422 | 0 | 0 | 1927985 | 44.179 |
| artemis_mouton | core80 | 6398.160 | 7.482868 / 160 | 0.216295 | 25.538 | 31.707 | 0 | 0 | 1927983 | 37.497 |
| artemis_nobile_rim_1 | core80 | 5945.618 | 15.734713 / 160 | 0.307241 | 31.557 | 24.977 | 0 | 0 | 1927989 | 42.814 |
| artemis_nobile_rim_2 | core80 | 1009.324 | 4.349377 / 160 | 0.411448 | 41.853 | 58.611 | 0 | 0 | 1927989 | 42.160 |
| blue_ghost1 | sphere | - | - | 0.501886 | 50.323 | 100.000 | 0 | - | 871155 | 0.072 |
| chandrayaan3 | wide240 | 529.723 | 0.860984 / 480 | 0.480968 | 48.513 | 100.000 | 0 | 0 | 1927981 | 26.799 |
| change4 | sphere | - | - | 0.498581 | 50.065 | 0.000 | 0 | - | 871151 | 0.071 |
| change6 | sphere | - | - | 0.498633 | 50.051 | 0.000 | 0 | - | 871152 | 0.070 |
| connecting_ridge | core80 | 1950.256 | 4.052094 / 160 | 0.598582 | 65.746 | 45.607 | 0 | 0 | 1927984 | 47.317 |
| de_gerlache_rim | core80 | 1779.196 | 2.154988 / 160 | 0.607358 | 66.853 | 48.827 | 0 | 0 | 1927984 | 39.583 |
| im1_odysseus | core80 | 2591.948 | 11.510854 / 160 | 0.393991 | 40.048 | 100.000 | 0 | 0 | 1927981 | 32.729 |
| im2_athena | core80 | 5321.502 | 2.684767 / 160 | 0.453740 | 47.077 | 73.787 | 0 | 0 | 1927980 | 36.984 |
| luna25_target | wide240 | 309.643 | 2.627285 / 480 | 0.455682 | 45.984 | 100.000 | 0 | 0 | 1927980 | 28.900 |
| malapert_peak | core80 | 4969.078 | 4.070659 / 160 | 0.727994 | 78.457 | 52.923 | 0 | 0 | 1927982 | 42.998 |
| peak_near_shackleton | core80 | 1454.988 | 1.839560 / 160 | 0.601721 | 62.093 | 30.701 | 0 | 0 | 1927988 | 39.479 |
| shackleton_rim | core80 | 1732.866 | 1.151164 / 160 | 0.746862 | 79.847 | 42.511 | 0 | 0 | 1927983 | 45.826 |

#### 2026-11-13 · S8 part 1 · Slope (gate G8) and the terrain mesh
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote `slope.py`, `terrain_mesh.py` and their synthetic tests, and ran pytest and the real-map measurements — a human has not reviewed it yet
- **State:** verified (orchestrator ran the 207 tests on the merge with main; Codex, gpt-6.1-sol reproduced the formulas, all 66,049 mesh vertices and the real-map slopes independently and ran sixteen mutations; its five must-fix findings were fixed and confirmed by mutation)
- **Changed:** `science/src/truesouth/slope.py`, `science/src/truesouth/terrain_mesh.py`, `science/tests/test_slope.py`, `science/tests/test_terrain_mesh.py`, this entry. No `build-sites` wiring and no derived files.
- **Notes:** `uv run pytest`: 167 passed in 27.96 s, exit 0. Gate G8 largest error: polar method 4.1915316551e-7° (limit 0.001°) on 10° planes at 80 m and 240 m, near the pole and 5° from it, toward north, east and northeast; close-up plane fit 7.1054273576e-15° on 5 m samples of the same tilts. A flat map is 0°, a 30° plane is 30°, and shifting the plane up or down by thousands of metres stays inside the gate. On `z = tan(6°) N + 1.5e-8 N³`, the 160 m central difference and the 100 m plane fit differ by 0.0043898283°, inside a bound of 0.0043922341° derived from that curvature, the two baselines, the projection, the 5 m grid and float32 rounding.
- **Orientation check:** A peak 2,500 m east and 3,750 m north of a synthetic site lands on vertex row 10, column 20 of a 33² mesh. Transposing the height array moved it to index 670 (row 20, column 10) and the test failed. Flipping rows moved it to index 746 (row 22). Flipping columns moved it to index 342 (column 12). The source was restored; the full suite above is after that restore.
- **Real maps:** Polar method only. Times are one call, in seconds. Connecting Ridge (−89.4555°, 222.6192° E): 80 m 4.052094° over 160 m in 0.000243 s; 240 m 1.991463° over 480 m in 0.000072 s. Shackleton rim (−89.7742°, 203.4952° E): 80 m 1.151164° in 0.000060 s; 240 m 4.454930° in 0.000054 s. Shackleton floor (−89.67°, 129.2° E): 80 m 2.365936° in 0.000051 s; 240 m 1.238693° in 0.000049 s. IM-2 Athena (−84.7906°, 29.1957° E): 80 m 2.684767° in 0.000052 s; 240 m 2.755079° in 0.000053 s. Source text is `LDEM_80S_80MPP_ADJ.TIF, central difference` or the 240 m filename with the same ending.
- **Connecting Ridge mesh:** 0.043742 s. Four float64 arrays, each 257×257 (2,113,568 bytes together). Height −1,223.036944 m to 1,957.920478 m. The vertex nearest the site is row 128, column 128, at east 0 and north 0, height 1,950.256444 m, the same as `DemStore.sample` at the site. No missing vertices. Encoded `terrain.bin` is 1,056,784 bytes. Not committed.
- **Connecting Ridge, how far the slope moves:** 80 m method, then 240 m method, in degrees. The site is 4.052094 / 1.991463. 40 m north 3.260658 / 1.991464; south 4.052094 / 1.991463; east 1.891420 / 1.991463; west 3.664335 / 1.991463. 80 m north 3.260658 / 1.991464; south 4.052093 / 1.991463; east 1.891420 / 1.991463; west 3.664335 / 1.991463. 160 m north 1.529932 / 0.707606; south 4.346043 / 1.991463; east 3.205657 / 2.940337; west 5.228331 / 4.419065. On the 80 m map a 40 m step can stay on the same pixel (south, no change) or leave it (east, 4.05° to 1.89°). The 240 m value barely moves inside 80 m and still moves by a few degrees at 160 m.
- **Spec notes for part 2:** `polar_slope(prepared_map, lat_deg, lon_deg)` returns `Slope` or None. Pass `store.core` or `store.wide`; it does not choose. Sphere tier, an off-map site, or a missing site pixel or neighbour is None, not 0. The site pixel is the nearest centre (`np.rint`). Baseline is `2p`. `closeup_slope(east_m, north_m, height_m)` fits the 50 m neighbourhood and returns baseline 100 m, or None when fewer than three valid pixels remain or they do not determine a plane. `terrain_mesh(store, lat_deg, lon_deg)` and `closeup_mesh(prepared_map, lat_deg, lon_deg)` return the four `terrain.bin` arrays on `.arrays`, plus `height_m`, `lat_deg`, `lon_deg`, `missing_count` and `site_height_m`. `closeup_mesh` only samples a south-polar `PreparedMap`. Per-vertex `slope_deg` is the section 13 overlay slope: the gradient of terrain height on the (E, N) grid, not the curved `up` coordinate and not the section 8 pixel slope. The caller gates on `site_tier`, not on map coverage.
- **Review fixes:** The review fixes were made. Close-up tests now require the intercept, and mesh slopes of a tilted plane are checked on the interior and the rim, including missing heights. Section 8 records the nearest-pixel tie and section 13 records the overlay slope. `closeup_slope` no longer takes a radius. `polar_slope` rejects |latitude| above 89.999°. Part 2 must gate meshes on `site_tier`: at (−59°, 45° E) the tier is sphere but `terrain_mesh` still returns a mesh. State remains built, not verified.

#### 2026-11-13 · S7 · Real Connecting Ridge disc fractions, series and dataset
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — wrote synthetic tests first, then disc integration, series computation and build-sites; ran pytest, both real-map builds and the diagnostics below — human and orchestrator review pending.
- **State:** verified (the orchestrator, Claude Fable 5.2, ran the tests on the merge with main and compared the real series with NASA's average maps; Antigravity, gemini-4-argon derived the disc fraction independently (largest error 0.0013 against the 0.005 limit), ran eight mutations, rebuilt the real site byte for byte in 31 s and reproduced the NASA comparison; the one surviving mutation, nearest-bin clearance, now fails a test added by the orchestrator)
- **Changed:** `science/src/truesouth/discs.py`, `series.py`, `commands/build_sites.py`, `science/tests/`, `data/derived/` (system.bin unchanged), this entry.
- **Checks:** `uv run pytest`: 177 passed in 34.77 s. G7 maximum error 0.0013027560869 (limit 0.005), across 2,001 offsets including d = -1, -0.5, 0, 0.5, 1, four Sun/Earth radii and three skyline heights. G9 on the real grid: 0.00499999734121204°, 4.9998632326409e-05 fraction. Synthetic pipeline checks validate contracts, repeat and forced byte identity, retaining earlier sites, input changes, sphere tier, and write/rename failure recovery. Tests need no real maps or network.
- **Repeatability:** Forced real rebuild 40.827071 s (42.186142 s including process startup); all nine derived files byte-identical, including unchanged system.bin. A fresh incremental invocation skips the site and preserves identical bytes.
- **Real build:** Connecting Ridge (-89.4555°, 222.6192°E), both prepared NASA maps read only; 40.859410 s (target <120 s), ground 1950.256444244 m; 52,584 hourly samples, 2026-2031. Mean angular radii Sun 0.266450575713°, Earth 0.950672581493°; skyline -2.639793653° to 1.681117796°, blockers 0.080000 to 89.251431821 km, missing samples 0. Site files 871,160 bytes; all `data/derived/` 2,151,529 bytes including the existing 1,262,016-byte system.bin.
- **Sun (decoded files, as read by the web):** mean sun_frac 0.598582287388 (59.858229%); hours sun_frac ≥ 0.5: 60.004944%; any Sun: 65.746235%. Longest sun_frac < 0.5 stretch 521 h, [2029-03-23T15:00:00Z, 2029-04-14T08:00:00Z). The supplied published CR1 figure is 92.27% at 2 m over 19 years (Gläser et al. 2014); ours is lower by 32.411771 percentage points over six years. These are different averaging spans; the measured gap is large and is not treated as agreement. No tuning or production terrain exclusion.
- **Measured diagnosis:** reran the unchanged skyline while reducing every candidate at distance ≥ each cutoff (retaining the next-highest candidate, not deleting only the winning blocker). Ignoring terrain closer than 100 / 250 / 500 m gives mean sun_frac 0.632551109063 / 0.782445085982 / 0.828245892582 (63.255111 / 78.244509 / 82.824589%). Corresponding lit shares 63.332953 / 78.299483 / 83.068994%; any-Sun shares 68.914499 / 83.510193 / 87.260383%. These diagnostic series are unquantised and not committed; production unquantised mean 0.598582298387. Of 20,939 centre-hidden hours (decoded sun_clear < 0), nearest-bin blockers are <1 km for 19,925, >10 km for 612, and 1-10 km for 402. Attribution uses the nearest bin's stored blocker; clearance itself interpolates adjacent bins. This supports local terrain as a major contributor, not a complete explanation of the published discrepancy. Diagnostic pass 36.030117 s.
- **Earth (decoded files):** clearance ≥ 1° link share 45.607029%; any Earth 54.914042%. Longest blackout 382 h, [2026-05-23T00:00:00Z, 2026-06-07T22:00:00Z), using the 1° antenna mask.
- **IM-2 Athena daily sweep:** `scoring.slip_sweep`, midnight UTC, slope=None; 2,182 complete landing dates: 95 GO, 17 CAUTION, 2,070 NO-GO; final 9 dates have no full window. Veto counts (overlap): darkness 1,411, blackout 1,905, landing_dark 872; slope, landing_sun_low and landing_sun_high 0. Slope is unassessed.
- **Spot checks:** unquantised geometry; H is interpolated, while blocker data comes from the nearest bin (listed below). All positions are latitude and east longitude; heights are metres above the reference sphere.

| Hour UTC | Sun az / el (°) | H / clearance (°) | sun_frac | Blocker bin (°) / distance (km) / height (m) | Blocker lat / east lon (°) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-12T15:00:00Z (lit) | 280.747816064 / 1.656637536 | -2.631571027 / 4.288208563 | 1.000000000000 | 280.75 / 0.160000000 / 1944.901886206 | -89.454491183 / 222.074713162 |
| 2028-04-15T07:00:00Z (dark) | 69.215248385 / -1.359343212 | 1.404283449 / -2.763626661 | 0.000000000000 | 69.25 / 0.080000000 / 1954.221468841 | -89.454559719 / 222.878361615 |
| 2027-03-14T13:00:00Z (partly_hidden) | 237.723497796 / -1.130757823 | -1.127949503 / -0.002808319 | 0.500003573729 | 237.75 / 42.079555840 / 1635.240722656 | -88.809143867 / 123.250016428 |

- **Spec questions / choices:** (1) Equal-width strip midpoints strictly inside (-rho,rho); skyline extrema handle fully clear/hidden discs before any cosine division, with machine-epsilon protection only for artificial partial discs at the zenith. (2) `build_series` accepts ground metres, a skyline elevation vector and global arrays, and returns columns plus grid-mean body radii; all hours vectorised, bodies sequential for bounded memory. Elevations are within +/-90 degrees and clearance within +/-180, so neither can exceed the Int16 angular range; invalid encoder input raises instead of clipping. (3) Site tier uses the documented latitude helper; map coverage chooses each terrain sample. Missing required polar terrain raises, while sphere uses ground 0 for ephemeris, null elevation in Site and NaN blockers. (4) Incremental checks conservatively include both available maps/sidecars, system.bin, catalog sites and pipeline Python sources, plus valid existing metadata/file sizes; changed input invalidates the site. (5) On Windows publication renames the previous complete directory to a backup, then renames the staged complete directory into place; errors restore the backup and the next invocation recovers interrupted publication. There is a brief directory-unavailable interval, never a partly populated published site. JSON files replace atomically; sites.json merges existing entries in sorted-id order. (6) `--generated-utc` is the only file clock time; committed value 2026-11-13T00:00:00Z, otherwise current UTC. Slope and meshes await S8 (slope/terrain/closeup null, has_closeup false); tool links use the documented home pages pending MC9. (7) Whole-grid statistics and daily scoring use decoded bytes; spots and cutoff diagnostics use unquantised geometry. Longest stretches are half-open UTC intervals, daily dates are midnight UTC, incomplete final mission windows have no result. R1/R2, validation.json, maps and Academy worked examples remain their later work packages; no synthetic validation claims are inserted.

#### 2026-11-13 · S9 · Polar map images and lookup grids
- **Who:** Codex (gpt-6.1-terra), for the orchestrator
- **AI use:** Codex — implemented the map pipeline and synthetic tests — automated tests and real-data checks run by the agent; human review pending.
- **State:** verified (the orchestrator, Claude Fable 5.2, read the code, ran the 156 tests on the merge with main, shaded the 80 m map independently (correlation 0.987 with the stored hillshade; near 0 when flipped or transposed), recomputed five lookup cells from NASA's 60 m maps (agree within 0.002), and looked at the images with catalog pins drawn on them)
- **Changed:** science map functions, build-maps command, tests, and data/derived/maps/.
- **Notes:** The initial encoding and light-direction questions were settled in #47. Real build 98.3 s; output 16,217,806 bytes; 8K relief 3,897,152 bytes. Connecting Ridge sunlight 0.541 and Earth visibility 0.490; Shackleton floor sunlight 0.000. Missing lookup cells 0% in both layers. Twelve near-seam samples differ by up to 0.01316 sunlight and 0.12388 Earth visibility between source resolutions. Synthetic orientation mutations and repeatability checks passed; full pytest: 156 passed, exit 0.

#### 2026-11-13 · S6 · Terrain skylines and blocker geometry
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — wrote synthetic geometry tests first, then chunked skyline computation and interpolation — agent ran pytest and both real-map benchmarks; human and orchestrator review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, ran the tests and computed real skylines with both NASA maps, 33 s per site; Antigravity, gemini-4-argon checked the geometry by hand and on synthetic terrain, found the far-field tests could not detect a flipped map, fixed by the orchestrator, and measured how strongly a skyline depends on where a site sits within an 80 m pixel, which is recorded as an open method question)
- **Changed:** `science/src/truesouth/skyline.py`, `science/tests/test_skyline.py`, this entry
- **Notes:** `uv run pytest`: 116 passed in 17.36 s. G4 maximum error 8.98041993269e-8° (limit 0.001°); G5 near 1.57429624892e-13° and far 2.30926389122e-14° (limit 0.001°); G6 at 80 m switch 8.26005930321e-14° and at 240 m switch 1.386391002e-13° (limit 0.02°). Synthetic coverage includes isolated far pixels, local-frame directions near and away from the pole, wrap interpolation, curvature, 300 km cutoff, contiguous map boundaries, missing data, sphere arrays, chunk invariance and R5 settings. No real maps or network required by tests.
- **Real map:** Separate Windows processes, default settings, available 80 m map only. Connecting Ridge (−89.4555°, 222.6192°E): ground 1,950.256444 m; 23.275581 s; peak working set 324.097656 MiB, peak committed memory 578.707031 MiB; elevation range −2.639794° to +1.681118°; near/far bins 1,165/275; nearest/farthest blocker 0.080000/89.251432 km; missing samples 0. Shackleton rim (−89.7742°, 203.4952°E): ground 1,732.866331 m; 21.720325 s; peak working set 322.492188 MiB, peak committed memory 578.558594 MiB; elevation range −2.548318° to +1.083636°; near/far bins 882/558; nearest/farthest blocker 0.040000/135.263855 km; missing samples 0. Search limit 300 km for both. Peaks include the interpreter and memory-mapped pages; committed memory includes allocations backed by the page file.
- **Cardinal blockers:** Values are azimuth → skyline elevation; ground distance; blocker height; latitude, east longitude. Connecting Ridge: 0° → +0.954605°; 0.080000 km; 1,953.592790 m; −89.452861769°, 222.619200000°E. 90° → +0.740407°; 0.080000 km; 1,953.293311 m; −89.455493609°, 222.896813569°E. 180° → −0.604280°; 0.560000 km; 1,946.433825 m; −89.473967616°, 222.619200000°E. 270° → −1.968455°; 59.382335 km; 925.888428 m; −87.968400807°, 148.053761819°E. Shackleton rim: 0° → −1.180621°; 0.280000 km; 1,729.112754 m; −89.764966192°, 203.495200000°E. 90° → −0.903974°; 0.120000 km; 1,732.975155 m; −89.774165325°, 204.499259434°E. 180° → +0.417500°; 0.120000 km; 1,735.745777 m; −89.778157346°, 203.495200000°E. 270° → −0.759560°; 35.697040 km; 1,628.251709 m; −88.801808975°, 124.232393059°E.
- **Common sense and coverage:** Connecting Ridge's height matches the expected ~1,950 m; 923/1,440 bins (64.10%) are at or below horizontal, with elevated terrain in some directions, including local rises 80 m north/east. Shackleton rim has 1,187/1,440 bins (82.43%) at or below horizontal. Both are consistent with high sites. The wide map was not prepared at benchmark time: far terrain beyond the core map's edge is not yet included, even though missing-sample counts are zero within the sampled core terrain.
- **Spec questions / choices:** Use each sample's map coverage, not the site's tier, for method selection: rays to pixel size / tan(bin width), then every pixel to 300 km (18.334533 km for 80 m; 55.003599 km for 240 m). Wide terrain between those switches remains on 120 m ray steps, even after the ray leaves the core; core rays use 40 m steps. Both start at 40 m, include the exact switch endpoint, and mask wide terrain wherever the core covers it; no unsound wide-pixel binning or skipped distance interval. R5 adjusts switch with bin width and accepts `step_scale=.5`. Bins use nearest centre (half-open edges); ties keep the first encountered point, with near winning exact near/far ties. Missing site ground raises ValueError; missing core terrain is never filled with wide terrain. Missing samples count failed covered ray samples and eligible missing far pixels; uncovered ray positions count once on the last available map's lattice; nonexistent far pixels cannot be counted. Metadata max range is the configured 300 km limit, not a complete-coverage claim. Bins with no terrain use the §4 two-metre flat horizon and NaN blockers; available terrain is never clamped to that fallback. Arrays retain float64 for computation and follow SkylineLayout order; no writer added because `derived_io.py` is absent from main.

#### 2026-11-13 · S2 part 2 · Synthetic fixtures and scoring cases
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — built fixture pipeline and tests — automated checks run; human review pending
- **State:** built, not verified

- **State:** verified (the orchestrator, Claude Fable 5.2, rebuilt the fixtures and confirmed they equal the committed files, recomputed clearance from elevation and skyline, swept every site with the scoring reference and sent the first version back for lack of variety; Antigravity, gemini-4-hydrogen checked every file against its contract, recomputed all scoring cases and found a weights case that proved nothing, fixed by the agent; 5 sites, 58 scoring cases, 5.9 MB)
- **Changed:** Science fixture encoding, binary I/O, pipeline, tests, `data/fixtures/`, shared scoring cases and data-contract notes.
- **Notes:** G9 sampled maximum errors 0.004999907384558355° and 0.00004999858055221296. Fixtures total 5,873,738 bytes; 58 scoring cases total 683,740 bytes. Daily IM-2 windows: ridge 1,732 GO / 450 NO-GO; crater 103 GO / 18 CAUTION / 2,061 NO-GO; wide 504 CAUTION / 1,678 NO-GO; edge 2,182 NO-GO; sphere 365 GO / 11 CAUTION / 1,806 NO-GO. Values are synthetic, not validation measurements.

#### 2026-11-13 · S4 · Global ephemeris: G1 passes; G2 measured on the full grid
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — wrote `horizons.py`, `ephemeris.py`, the `fetch-ephemeris`
  step and their tests, and ran the comparison with JPL Horizons — the orchestrator (Claude
  Fable 5.2) reran the full comparison offline from the saved responses and checked the
  result against known facts; Cursor, grok-4.7 recomputed it with its own vector code and
  checked the conventions against the Horizons headers and manual
- **State:** verified (gates G1 and G2; the team lead decided on 2026-11-13 that G2
  compares directions on the sky, see `docs/decisions/0011`)
- **Changed:** `science/src/truesouth/horizons.py`, `ephemeris.py`,
  `commands/fetch_ephemeris.py`, `science/tests/`, `data/derived/system.bin`,
  `docs/science.md` section 3
- **Notes:**
  - 20 catalog sites × 2 bodies × 52,584 hours = 2,103,360 comparisons, with no correction
    or fitted offset. Largest direction difference on the sky: 0.0060° (Earth at
    Apollo 11, 2027-01-07T22:00Z). Sun: at most 0.0002°. Limit: 0.02°.
  - Raw compass azimuth is above 0.02° at 28 hours, all the Sun at Apollo 11 within 0.52°
    of straight overhead or underfoot; the largest is 0.082° at elevation −89.88°
    (2031-10-14T01:00Z), where the direction on the sky differs by 0.00017°. Everywhere
    else raw azimuth differs by at most 0.0093°. So G2 is met as a direction on the sky
    and not met, at those 28 hours, as raw compass azimuth. docs/science.md section 3.3
    states both.
  - Horizons headers: longitudes east-positive; `MOON_ME` for the global table and
    `MEAN_ME (high precision)` at the sites, the DE421 mean-Earth frame. No sign change or
    frame rotation was needed.
  - Both sides use ground height 0 plus the 2 m observer. A 5 km height error moves Earth's
    direction by at most 0.0008° and the Sun's by 0.000002°.
  - `system.bin` is 1,262,016 bytes and rebuilds byte for byte from the saved response.
    The full comparison takes 27 s offline; 306 s with 38 fresh requests.

#### 2026-11-13 · S5 · Prepared terrain maps and downloads
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote terrain preparation, sampling, downloads and synthetic tests — agent ran pytest; orchestrator review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, ran the tests and then the real 80 m map: 7,600 by 7,600 pixels, no missing data, heights from -7,296 m to 7,026 m, Shackleton's floor at -2,788 m with its rim near +1,200 m ten kilometres out in all four directions, Connecting Ridge at 1,950 m, one million samples in 0.44 s; Cursor, grok-4.7 reviewed the geometry with its own synthetic rasters and found a download path that could save a corrupt file, fixed by the orchestrator)
- **Changed:** `science/src/truesouth/dem.py`, `science/src/truesouth/commands/`, `science/tests/`, this entry
- **Notes:** All 28 raw URLs passed size checks. NASA product 90 confirms the 240 m filename. Both terrain maps total 408,119,431 bytes; measured download speed about 154,000 B/s, exceeding the 40-minute budget. The 80 m partial reached 20,971,520 bytes; resume with `uv run truesouth fetch-raw --group terrain` after setting `TRUESOUTH_DATA_ROOT`. Its TIFF header reports 7,600 × 7,600, 80 m pixels, lunar south polar stereographic (radius 1,737,400 m, central meridian 0°, true scale at the pole), NaN nodata, scale 1 and offset 0. Full-map statistics and sampling timings await completion.

#### 2026-11-13 · S2 part 1 · Python scoring reference
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote the reference and hand-worked tests — automated tests run; human review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, read the module against docs/science.md sections 9 to 11 and ran the tests; Cursor, grok-4.7 reviewed it with hand cases and found the window-length rounding would differ between Python and JavaScript; the orchestrator decided the rounding rule and the countdown definition, the agent applied them to the doc and the code)
- **Changed:** `science/src/truesouth/scoring.py`, `science/tests/test_scoring.py`
- **Notes:** Spec interpretation questions are recorded in the pull request; G10 awaits the shared fixtures and TypeScript port.
- **Review changes:** Specified half-up windows, flag-based countdowns, veto and slope rules, and added boundary tests.

#### 2026-11-13 · S1 · Catalog inputs and validated loaders
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — built catalog inputs, contracts, loaders and document comparison tests — automated checks run; human review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, counted the sourced and assumed values against the presets table and ran the tests; Antigravity, gemini-4-hydrogen compared every value, link, quotation and coordinate with the two documents and tried to break the tests; its findings, one wrong reason and three weak tests, were fixed by the orchestrator; 20 sites, 5 presets, 15 features, 9 regions; 14 values sourced, 46 assumed)
- **Changed:** data/catalog, science catalog and tests, contracts, schema, data-contract documentation
- **Notes:** 20 sites, 5 presets, 15 named features and 9 Artemis regions; 14 sourced and 46 assumed profile values. Region centres and sizes are null where unpublished; representative DEM points are sites.

#### 2026-11-13 · S3 · Site-centred frames and polar projection
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote geometry tests and `frames.py` — agent ran pytest; the orchestrator has not checked it yet
- **State:** verified (the orchestrator, Claude Fable 5.2, compared each function with docs/science.md section 2 and ran the tests; Cursor, grok-4.7 reviewed the math with hand cases near the south pole, checked the pyproj setup, compared results with web/src/lib/geo, and approved; gate G3 measured 3.1e-9 m against a 0.01 m limit)
- **Changed:** `science/src/truesouth/frames.py`, `science/tests/test_frames.py`, this entry
- **Notes:** G3 largest error: 3.0886440072208643e-9 m (inverse); forward: 1.1524528889697587e-9 m.

#### 2026-11-13 · S0 · Python workspace and contracts
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — implemented workspace, contracts and CLI — automated checks run; human review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, ran uv sync, the tests, the CLI and the schema export, and confirmed by running the models that each of the review's five must-fix gaps is closed; Cursor, grok-4.7 reviewed the pull request field by field against the docs; 30 tests, 49 models)
- **Changed:** Python workspace, science, api, schema and data contract documentation
- **Notes:** Review fixes: closed provenance and layouts, flat worked examples, validations, descriptions, feature IDs, documentation and expanded tests.


## Mission Control

#### 2026-11-13 · MC shell feedback · No view sentence; the landing date joins the timeline; "Next GO"
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (a rearrangement
  of the approved C2 shell, no redesign) — removed the view's sentence plate (its text now in
  an "About" button inside the current tab and in the tab's accessible description), wrote
  `LandingDateControl` and moved the landing date from the app bar to the head of the
  bottom strip, wrote `nextGoDay` and the "Next GO" button with its states, Undo and polite
  status line, updated the specs and DESIGN.md, and wrote 34 vitest tests (fixture tests of
  `nextGoDay`, the button's states, the control's reads and writes, and a render-count test
  that a scrub does not re-render the control, on a small fake DOM) — checked by the agent
  with typecheck, the vitest suite, the build, `uv run pytest`, impeccable's detector (no
  findings), and by eye on the real data at 1440 × 900, 1024 × 768 and 390 × 844 in the four
  camera views and with Compare open, folded, by keyboard and in an accessibility snapshot;
  a human has not reviewed it yet
- **State:** built, not verified (1,725 web tests, 322 Python tests, typecheck and build pass
  on the merge with main; the team lead has not judged the layout)
- **Changed:** `web/src/app/mission/` (new `landing-date-control.tsx`, `next-go-button.tsx`,
  `landing-control.ts`, `fake-dom.ts` and their tests; `view-bar.tsx`, `top-bar.tsx`,
  `free-space.ts`, `timeline/timeline.tsx`, `timeline/axis.ts`, `timeline/timeline.css`),
  `web/src/app/mission-screen.tsx` (three small lines), `web/src/app/shell.css`,
  `web/src/lib/scoring/next-go.ts` (new), `docs/features/` (mission-control, site-detail,
  local-terrain, polar-map, panorama, slip-planner), `DESIGN.md`,
  `docs/design/c2/built-shell-feedback-*.png`
- **Notes:**
  - The free space now starts 8 px under the view bar: at 1440 × 900 it is 59 px taller,
    and the camera's centre rises by half that.
  - Changing the landing date keeps the current time's offset from the landing, clamped to
    the timeline (window ± 3 days), as `moveLandingKeepingOffset` did before; each change
    pushes one history entry, so Back undoes it.
  - "Next GO" searches from the day after the landing date's day, over the sweep's 00:00 UTC
    landings, and lands at 00:00 UTC. With Chandrayaan-3 and Malapert Massif from 2029-01-10
    it says "No GO date before 2032".
  - The Slip Planner can mount `LandingDateControl` in its panel's header as it is; it
    reads and writes only the scenario store.
  - Not done: a draggable start of the window on the timeline (the timeline's range follows
    the landing, so a handle would drag its own axis), and a "Previous GO" twin.

#### 2026-11-13 · MC6 · Lander's eye: the horizon chart
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (building the
  approved C2 chart, no redesign) — wrote `LandersEye` (the hand-built SVG chart with
  `d3-scale` and `d3-shape`, its control row, legend, states, hover readout, marker, drag,
  scroll zoom and keyboard use), its mount under the horizon in Mission Control, the lit
  line's share in the shared "Why is it dark?" card, and 54 vitest tests; then fixed the
  review of PR #78 (Gemini): the antenna mask on the chart's seam, true-size discs, the
  legend and contrast, the lit line, label placement and the shell's measuring — checked by
  the agent with typecheck, the vitest suite, the build and `uv run pytest`, impeccable's
  detector (no findings) and an inline audit pass, and by eye in a browser on the real data
  with the 3D scene behind the panel at 1440 × 900, 1024 × 768 and 390 × 844 and in a 360 px
  lesson box (a local route, never committed); a human has not reviewed it yet
- **State:** verified (322 Python tests, 1,691 web tests, typecheck and build pass on the merge with main, which has the 3D scene; reviewed by Gemini (no frontend science, geometry spot-checked, three mutations caught; six findings, all fixed with tests); the chart and the scene's labels agree at every hour of three fixture windows; not yet seen by the team lead)
- **Changed:** `web/src/features/panorama/` (new: `chart.tsx`, `geometry.ts`,
  `readings.ts`, `panorama.css`, four tests; `index.tsx`), `web/src/app/mission-screen.tsx`
  (the foot stack mounts the chart in Lander's eye, the free space ends above it, the
  shell reads only its own plate and remeasures on a camera change), `web/src/app/shell.css`
  (one phone rule), `web/src/app/mission/timeline/why-dark.ts` and `why-dark-card.tsx`
  (the lit line's share), `docs/features/panorama.md`, `docs/features/site-detail.md`,
  `docs/design/c2/built-landers-eye*.png`, this entry
- **Notes:**
  - Every value drawn or read out comes from `skyline.bin`, the series and the site meta as
    stored. The state words are the 3D scene's (in view, partly in view, behind the ridge,
    below the horizon), from the series' disc fraction and clearance; a test checks the two
    agree at every hour of three fixture windows.
  - Discs are drawn at their true angular size. On Connecting Ridge the share drawn above
    the skyline is within 0.019 of the series' disc fraction. The fixtures store a linear
    ramp, not the §6 circle, so there the gap reaches 0.058, which is the ramp's own error.
  - The skyline, paths and axes are one memoised layer: render-count tests (on the chart
    and on the whole view with its data hooks) show no rebuild while the hour changes.
  - On a dark or blackout hour the panel shows the one-line "why" with its "Why?" button.
  - The marker is not shared with Local terrain yet: a later package wires `marker` and
    `onMarkerChange` through the shell.

#### 2026-11-13 · MC4c · The space-first shell
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (question
  round skipped, as briefed) — wrote the floating layout, the scene slot and its contract
  (`SceneProps`), the free-space calculation and hook, the view bar and view sentence, the
  floating-window frame with its focus and Escape rules, folding with announcements, the
  phone layout (sites sheet, focused-site sheet, compact timeline with a 44 px scrubber),
  and vitest tests for the views, the free space, the window focus rules, the still
  picture, the link round trip of every view and the contrast of panels and plates —
  checked by the agent with typecheck, the vitest suite and the build, impeccable's
  detector (no findings), and by eye in a browser on the real data and the fixtures at
  1440 × 900, 1024 × 768 and 390 × 844; a human has not reviewed it yet
- **State:** verified (1,577 web tests, 308 Python tests, typecheck and build pass on the merge with main; reviewed (11 findings, all fixed); opened by the orchestrator at 1440, 1024 and 390 px on real data: no console errors, no sideways scroll, dark-hour plate and Why? popover, Slip Planner window opens and Escape returns focus)
- **Changed:** `web/src/app/mission-screen.tsx`, `web/src/app/shell.css`,
  `web/src/app/scene.ts` (new), `web/src/app/mission/` (new: `free-space.ts`,
  `shell-hooks.ts`, `view-bar.tsx`, `floating-window.tsx`, `window-focus.ts`,
  `scene-slot.tsx`, `scene-status.ts`, and their tests; changed: `views.ts`,
  `shell-layout.ts`, `focused-site-panel.tsx`, `top-bar.tsx`, `timeline/timeline.tsx`,
  `timeline/timeline.css`, `timeline/why-dark-card.tsx`), `web/src/app/theme.css` (tokens
  `--space`, `--float-gap`, `--plate`), `web/src/components/` (`Panel.tsx` comment, the
  3D badge's CSS removed), `web/src/state/scenario.ts` (the first-visit view is now the
  System view), `DESIGN.md`, `docs/design/c2/built-space-shell*.png`, this entry
- **Notes:**
  - The scene is a placeholder: a near-black background and one line in the free space. T1
    plugs in by passing its component to `<SceneSlot Scene={…}>` in `mission-screen.tsx`;
    the props are `SceneProps` in `web/src/app/scene.ts`. The scene is never unmounted for a
    slow or missing WebGL: it is told `mode: "flat"`.
  - The link keeps one `view`: a camera view, or the open window (`slip`, `compare`). A
    window in a link or on reload opens over the System view; the camera view under a
    window opened in the page is kept in the page only.
  - The free space is the measured gap cell of the layout grid, less an open window or phone
    sheet (the largest uncovered strip). It can be empty while a window is open; the spec
    keeps the camera still then.
  - Dev only: `sessionStorage["truesouth.scene.status"] = "slow"` (or `"no-webgl"`) makes
    the placeholder report that status, to see the still picture and "Try 3D anyway".
  - The "why is it dark" card floats at the foot of the free space only on a dark or
    blackout hour, with "See it from Lander's eye"; it is hidden while a window is open and
    on the phone.
  - Review fixes were made (still built, not verified): "UTC" once on the phone strip; every
    provenance tag a 44 px target on the phone; "Try 3D anyway" announced in the status
    region with focus on the current view, and the still note names the current view;
    `[` and `]` do nothing inside a window, popover, menu or listbox; `SceneProps` gained
    `onAddSite`, `mode` ("3d" or "flat") and an optional `SceneReport` on `onStatus`, so the
    scene stays mounted when WebGL is slow or missing (additive only); the "why" card is one
    plate with "Why?" opening the full card above it (free space on a dark hour: 792 × 392 px
    at 1440 × 900, 376 × 249 px at 1024 × 768, up from 376 × 83 px); windows sit between the
    open side panels when there are 720 px or more; the view bar no longer re-renders on a
    scrub (render-count test); `freeSpaceInput` turns the shell's layout state into the
    free space and is tested (a mutation that ignores the left fold fails it); the unused
    `--shell-top` and `--shell-foot` tokens are gone; the folded sites rail has a 44 px
    "Add site".

#### 2026-11-13 · specs · Mission Control specs rewritten for the space-first layout
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — rewrote the Mission Control, System view, Polar map, Local terrain, Lander's eye, Slip Planner, Compare and site-detail specs, `DESIGN.md`, the build plan and two track guides, and wrote decision 0013, from the team lead's decision and the designer's notes and prototype — read back against the prototype's code and notes; the "Proposed:" items are listed in the pull request for the team lead to accept or change; no human has reviewed it yet
- **State:** built, not verified
- **Changed:** `docs/decisions/0013-space-first-mission-control.md`, `docs/features/` (mission-control, system-view, polar-map, local-terrain, panorama, slip-planner, compare, site-detail), `DESIGN.md`, `docs/build-plan.md`, `docs/tracks/mission-control.md`, `docs/tracks/3d-and-map.md`, `docs/data-contracts.md` (a "Proposed: scene image files" section), `CONTEXT.md` (new terms), this entry
- **Notes:** Documents only. New work packages: MC4c (the floating shell) and S16 (the scene's image files; its contract is not written yet). T8, the custom-site job queue in S10, S11 and A6 are marked out of scope for the deadline. No code, no `contracts.py`, no prototype changes.

#### 2026-11-13 · MC5 · Timeline, scrubber, countdowns and the "why is it dark" card
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (question
  round skipped, as briefed) — wrote the timeline with its scrubber, play and clearance
  chart, the Sun and Earth countdown cards, the "why is it dark" card, the timeline fold,
  the history throttle and the store change that keeps `t` on a slip, with vitest tests —
  checked by the agent with typecheck, 1,277 vitest tests and the build, impeccable's
  detector (no findings), and by eye in a browser on the fixtures and the real Connecting
  Ridge data at 1440 × 900, 1024 × 768 and 390 × 844; a human has not reviewed it yet
- **State:** verified (orchestrator ran typecheck, 1,449 tests and build on the merge with main and looked at the screens on real sites; Antigravity, gemini-4-hydrogen checked every drawn value against the raw files, used it in a browser at three sizes and ran eight mutations; its six must-fix findings were fixed)
- **Changed:** `web/src/app/mission/timeline/` (new), `web/src/app/mission/throttled-history.ts`,
  `web/src/app/mission/shell-layout.ts`, `web/src/app/mission/scenario-context.tsx`,
  `web/src/app/mission-screen.tsx`, `web/src/app/shell.css`, `web/src/components/BodyIcon.tsx`,
  `web/src/state/scenario.ts` (slip and landing keep `t`), `web/src/lib/explain.ts`
  (`blocker_height`), `docs/design/c2/built-timeline*.png`, this entry
- **Notes:**
  - The timeline draws in SVG: the bands are built once per site, profile, landing and width,
    and only the scrubber line and pill move (CSS transforms), so a drag re-renders no band.
    Measured in Chromium: a 120-step drag ran at a median frame of 4.2 ms, p95 16.6 ms.
  - A drag, a held arrow key and play each add one history entry and replace it after. The
    address bar is written at most four times a second (`throttled-history.ts`), because
    browsers ignore more than about 200 history updates in 10 seconds.
  - The "why is it dark" card reads the skyline height at the body's azimuth as elevation
    minus clearance from the series, and the blocker from the nearest skyline bin. A named
    feature is given only when the blocker lies within 0.6 × the feature's diameter of its
    centre (the smallest such feature wins). Checked by hand on Connecting Ridge at
    2028-03-07 06:00 UTC against the raw files: Sun azimuth 184.74°, elevation −1.64°,
    skyline −0.67° (bin 739), blocker 0.560 km away, 1,945.8 m high, bearing 184.75°; no
    named feature.
  - Where the spec and the prototype differ, the spec won: the stretch labels sit under the
    bands with their tags, and with a relay there is no Earth countdown.
  - The spec names `web/src/features/mission-control/site-detail/` as the folder; the brief
    kept this work in `web/src/app/`, so that folder's placeholder is no longer used by the
    shell. Clicking the card to open the Lander's eye waits for MC6.
  - Review fixes were made: a waiting address-bar write only lands on the page and history
    entry it was made on (a click flushes it first; Back, Forward and other pages drop it);
    countdowns never round up, and the amber flag uses the same whole minutes as the text;
    one drag adds exactly one history entry, none if the hour never changes; what the
    timeline draws is in `draw.ts`, tested against `hourFlags` and `evaluate` (two
    mutations confirmed caught); the phone stacks the countdown cards; the docked
    "why" card shows the Sun's and Earth's reasons with a switch when they do not fit side
    by side, and the view keeps at least 120 px; play defaults to 6 h per second and stops
    on a new focused site; the clearance chart has a text summary; the main view no longer
    re-renders its tabs on a scrub. Checked on the real data for Connecting Ridge,
    Shackleton rim, IM-2 Athena and Apollo 11.

#### 2026-11-13 · MC7a · Slip sweep in a Web Worker
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the sweep worker, the message handler, the client and `useSweeps`, with vitest tests — agent ran `pnpm --dir web typecheck`, `pnpm --dir web test` and `pnpm --dir web build`; a human has not reviewed it yet
- **State:** verified (orchestrator ran typecheck, 1,230 tests and build on the merge with main; Codex, gpt-6.1-terra compared the worker with slipSweep on fixtures and the real site, simulated a detaching worker and ran seven mutations; its findings were fixed)
- **Changed:** `web/src/lib/scoring/` (worker, protocol, client, hooks and cache; `scoring.ts` unchanged), `web/vite.config.ts`, `web/src/state/scenario.test.ts` (the local-time Date scan now includes the worker files), this entry
- **Notes:** Review fixes were made. The worker keeps each site's three sweep columns after the first request, at most twelve series, least recently used, and the client sends the columns again when the worker has dropped a token. A sweep is cached and deduped by the time grid's start, step and count, so a different manifest cannot reuse one. The client copies those columns and transfers the copies, so the data store's buffers stay usable. Later profile edits send no series. One worker: a profile edit is compute once the series is resident, and a pool would keep another copy per worker. A landing date does not change the sweep, so a newer request for the same site drops the previous reply. Where `Worker` is missing, `useSweep` still computes on the main thread. Measured on this machine: one site through the handler, 52,584 hours, 100-day window, 3.8 ms (after one warmup); structured clone of 8 columns × 52,584 float64, 4.4 ms; copying those columns 1.0 ms and transferring them 0.1 ms. The production build emits `sweep.worker-BMR0j0qN.js`, 4.17 kB (1.72 kB gzip). The shell does not import the sweep yet, so `vite.config.ts` lists the worker as a build input; remove that input once a screen imports `useSweep`, or the build will emit the worker twice.

#### 2026-11-13 · MC4b · Mission Control panels on the scenario store and real data
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill — wrote the
  scenario provider and URL binding for the screen, the top bar (profile picker, profile
  editor, landing-date picker, slip, share), the sites rail on real evaluations (add,
  remove, reorder by keyboard and pointer), the focused-site panel, the notice strip, a
  shared `Popover` component, and vitest tests for the new display logic — checked by the
  agent with typecheck, 1,116 vitest tests and the build, impeccable's detector (no
  findings), and by eye in a browser on the fixtures at 1440 × 900, 1024 × 768 and
  390 × 844; a human has not reviewed it yet
- **State:** verified (orchestrator ran typecheck, 1,206 tests and build on the merge with main and opened the screen on the real Connecting Ridge data (no errors; a slip changes the link and the status); Codex, gpt-6.1-terra reviewed the logic and ran six mutations; its four must-fix findings were fixed)
- **Changed:** `web/src/app/mission-screen.tsx`, `web/src/app/mission/`, `web/src/app/shell.css`,
  `web/src/components/Popover.tsx`, `web/src/components/components.css`,
  `docs/design/c2/built-mission-*.png`, this entry
- **Notes:**
  - `sample.ts` and the TEMP placeholder profile are deleted. The timeline placeholder did
    not need sample values, so there is no `timeline-placeholder.ts`.
  - The store clamps every landing date so the mission window fits the grid, so the "no
    result: the mission window runs past 2031" state can only come from a custom site or a
    shorter series; it is drawn but cannot be reached through the date picker on fixtures.
  - The store refuses invalid profile edits silently, except "power and comms both zero",
    which adds a notice. The editor detects a refusal and says what range is accepted.
  - The shell now stacks on a phone (under 760 px) instead of scrolling sideways.
  - Review fixes were made: each weight is a number from 0 to 1,000 (store, link reader,
    editor, `docs/mission-profiles.md`); a value and its limit never round to the same
    text when a rule compares them strictly, and the score is rounded down; the mission
    duration carries its tag; a row fed by several profile settings is sourced only if
    every one is; units and labels of every row are pinned by a test; the worst broken
    rule uses the true share of a limit above 0; `ground_height` added to `explain.ts`;
    the stale chip lines removed from `DESIGN.md`. On the real data, Connecting Ridge
    loads with no errors: NO-GO for IM-2 Athena landing 2028-03-01 00:00 UTC, score 0.

#### 2026-11-13 · MC3 · Scenario store, shareable link and evaluation hooks
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the scenario store, the share-link reader and writer, the scoring cache and the evaluation hooks, with vitest tests — agent ran `pnpm --dir web typecheck`, `pnpm --dir web test` and `pnpm --dir web build`; a human has not reviewed it yet
- **State:** verified (orchestrator ran typecheck, 1,089 tests and build on the merge with main; Codex review, seven fixes confirmed)
- **Changed:** `web/src/state/scenario.ts`, `web/src/lib/scoring/` (cache, hooks and exports only), `docs/data-contracts.md` (shareable link), this entry
- **Notes:** The link carries `focus` only when the focused site is not the first selected site; otherwise opening one focuses the first selected site. A dragged landing date or current time replaces the history entry; other changes push. Custom fields are `custom:<preset>;field=value`, and a changed field is assumed with reason "Changed by you." The slip sweep hook still runs on the main thread and returns a `SlipSweep` a worker can fill later (MC7 moves it to a Web Worker). Default sites are Connecting Ridge, Malapert Massif, Mons Mouton and de Gerlache Rim 2, or the first four ids in `sites.json` when none of those are listed. Review fixes were made.

#### 2026-11-13 · MC1 · Loaders, decoders and the data hooks
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the decoders, loaders, data store, hooks, time helpers and tests — agent ran typecheck, vitest and the production build, and opened DataCheck on the fixture server; the orchestrator has not checked it yet
- **State:** built, not verified
- **Changed:** `web/src/data/`, `web/src/state/data.ts`, `web/src/lib/time/`, this entry
- **Notes:** Decoded series are Float64Array so they match Python's float64 decode. A missing terrain.bin, closeup.bin or validation.json is ready with null data. Custom site ids load from `/api/custom/<id>/`.

#### 2026-11-13 · MC2 · Browser port of the mission scoring reference
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — ported `scoring.py` into `web/src/lib/scoring/` and wrote the gate G10 test plus hand-worked unit tests — agent ran `pnpm --dir web typecheck`, `pnpm --dir web test` and `pnpm --dir web build`; a human has not reviewed it yet
- **State:** verified (the orchestrator, Claude Fable 5.2, ran gate G10 on the final 58 shared cases, largest difference 0 against a limit of 1e-9, and the sweep timing, 56 ms for 8 sites over the full grid; Codex, gpt-6.1-terra compared it line by line with scoring.py, ran 350 random series and profiles through both with no mismatch, and broke it eight ways to see which G10 catches)
- **Changed:** `web/src/lib/scoring/`, this entry
- **Notes:** 58 regenerated cases, largest absolute difference from the reference 0 (limit 1e-9). Slip sweep, 8 sites, 52,584 hours, 100-day window: 56.4 ms. The sweep stores typed arrays; one landing is rebuilt on read. Evaluation hooks are a follow-up. No disagreement with `docs/science.md` §9–11.

#### 2026-11-13 · MC1 · Loaders, decoders and the data hooks
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the decoders, loaders, data store, hooks, time helpers and tests — agent ran typecheck, vitest and the production build, and opened DataCheck on the fixture server; the orchestrator has not checked it yet
- **State:** verified (orchestrator ran typecheck, 1,058 tests and build on the merge with main; Codex review, six fixes confirmed)
- **Changed:** `web/src/data/`, `web/src/state/data.ts`, `web/src/lib/time/`, `docs/tracks/README.md`, this entry
- **Notes:** Decoded series are Float64Array so they match Python's float64 decode. A missing terrain.bin, closeup.bin or validation.json is ready with null data. Custom site ids load from `/api/custom/<id>/`.
  Review fixes were made: series scale and offset are checked against the contract, a mounted hook reloads after dropSite, mesh tests pin cell order, an absent mesh is not fetched, and profiles must include every required field.

#### 2026-11-13 · MC4a · C2 theme, shared components, start screen and Mission Control shell
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (4.9.0) —
  wrote the C2 theme tokens, the shared components, the start screen, the shell with
  collapsible side panels, the collapse-state logic and its vitest tests, and the
  DESIGN.md update — checked by the agent with typecheck, tests and build, impeccable's
  detector (source and live routes), and by eye in a browser at 1440 × 900, 1280 × 800 and
  1920 × 1080 with every combination of collapsed panels, and the start screen at 390 px.
  **AI-generated images:** the two start-screen porthole drawings (inline SVG in
  `web/src/app/start/portholes.tsx`), ported by Claude Code, claude-opus-5-5 from the C2
  prototype; the skyline in them is a made-up curve, not data.
- **State:** verified (the orchestrator, Claude Fable 5.2, ran typecheck, the tests and the build, and looked at the running app at 1440 and 1280 pixels wide with the panels open and collapsed, at the start screen at phone width, and at an explanation opened by a click; Antigravity, gemini-3.8-flash reviewed the code and found explanations could not be opened by touch, fixed by the orchestrator)
- **Changed:** `web/src/app/`, `web/src/components/` (not `luna/`), `web/package.json`,
  `web/pnpm-lock.yaml`, `DESIGN.md`, this entry
- **Notes:**
  - New dependency `@fontsource-variable/jost`: Jost self-hosted, so the app works offline.
  - The rail and the focused-site panel show sample data from one file,
    `web/src/app/mission/sample.ts`, marked on screen. MC1–MC3 replace it.
  - The collapsed state is view state in local storage (`truesouth.shell.v1`), not in the
    scenario. Keys `[` and `]` fold the panels.
  - Tailwind's default colour palette is switched off; only the project's tokens exist as
    colour utilities. New tokens for Luna and celebrations are defined but not used yet.
  - Measured: contrast of the faintest text (`--ink-3` on `--hover`) is 4.69:1; 935 vitest
    tests pass; production bundle 499 kB (162 kB gzipped) plus 54 kB of Jost woff2.

#### 2026-11-13 · MC0 · Web scaffold with panel placeholders
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the Vite app, router, theme tokens, data middleware,
  panel placeholders and tests — the orchestrator (Claude Fable 5.2) read the diff, ran the
  tests, typecheck and build, and probed every route and the `/data` middleware on a
  running dev server; Antigravity, gemini-3.8-flash reviewed the pull request
- **State:** verified
- **Changed:** `web/`, this entry
- **Notes:**
  - Every screen is a plain placeholder until the design choice at checkpoint C1.
  - S0 had not merged, so `panel.ts` has a temporary `MissionProfile` and `generated.ts`
    does not exist yet. Both are replaced when S0 lands.
  - The sample scenario on `/mission` is hard-coded: profile `{ id: "im2_athena" }`,
    landing date and current time `2028-03-01T00:00:00Z`, no sites. MC3 replaces it.
  - Review fixes: the pnpm release-age exception for `motion` 14.13.0 was removed and the
    lockfile resolves 14.12.0; `/data` responses send a content type; the dev-server path
    helper moved from `web/src/app/` to `web/dev/`.
  - Measured: 4 vitest tests pass; production bundle 259 kB (82 kB gzipped).

## 3D and Map

#### 2026-11-13 · T1, T2 · The 3D scene behind Mission Control
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (question
  round skipped, as briefed) — wrote the scene in `web/src/features/three/scene/` (the
  Moon, polar cap, Earth and Sun shaders adapted from the approved prototype; the camera
  rig, flights and controls; the ground built from the patch and apron; the pins, plates
  and controls; the Pip lander built in code), the placement helpers in
  `web/src/lib/geo/placement.ts`, vitest tests for both, and the still picture (a render of
  the scene's own NASA textures; no AI-generated imagery) — checked by the agent with
  typecheck, the vitest suite, the build, impeccable's detector (no findings) and by eye
  and by the numbers in a browser with WebGL (NVIDIA RTX 2060, ANGLE D3D11) on the real
  data and the fixtures at 1440 × 900, 1024 × 768 and 390 × 844; a human has not reviewed
  it yet
- **State:** verified (322 Python tests, 1,637 web tests, typecheck and build pass on the merge with main; reviewed by Gemini (geometry and the data rule confirmed, three mutations caught; six findings, all fixed with tests); seen by the builder on hardware WebGL; a weak laptop and a hidden tab are not measured)
- **Changed:** `web/src/features/three/scene/` (new), `web/src/lib/geo/placement.ts` and
  its test (new), `web/src/lib/geo/index.ts`, `web/src/app/scene.ts` (adds
  `SceneArrival`, the optional `onArrive` and `STILL_PICTURE_URL`), one line in
  `web/src/app/mission-screen.tsx`, the still picture in `web/src/app/mission/scene-slot.tsx`
  and its label in `web/src/app/mission/scene-status.ts`,
  `web/public/still/system-view.webp` (new), `docs/design/c2/built-scene-*.png`, this entry
- **Notes:**
  - By the numbers at Connecting Ridge (hours 18,960, 18,997 and 19,091): the Sun's
    elevation from the scene's sub-solar direction agrees with the series' `sun_el` within
    0.005°. The Earth sight-line and the Earth drawn in Lander's eye use the series'
    `earth_az` and `earth_el`, so they agree exactly. The System view's Earth sits along the
    sub-Earth point as science.md §14 says; seen from the site it differs from `earth_el`
    by 0.25° to 0.27°, which is Earth's parallax between the Moon's centre and its surface.
  - Shackleton's 20.9 km rim drawn at its IAU position sits on the crater in the cap image;
    the Connecting Ridge pin lands on the ridge toward de Gerlache.
  - Frame time at 1440 × 900, pixel ratio 1, RTX 2060: 4.2 ms median and 4.3 ms 95th
    percentile both orbiting and during a flight (capped by the 240 Hz display). A still
    scene draws 0 frames in 2 s. A weak laptop is still not measured.
  - Bundles: the first page's `index` chunk is 704.3 kB (224.7 kB gzipped) with no three.js
    in it; the lazy `scene-root` chunk is 973.2 kB (261.7 kB gzipped).
  - Pip is drawn 300 times larger than life in Local terrain, with a "Lander not to scale"
    plate. As the camera drops to Lander's eye it shrinks away and is hidden, so it never
    blocks the horizon.
  - The still picture: `sessionStorage["truesouth.scene.capture"] = "1"` in the dev
    server, open `/mission?...&land=2028-03-01T00%3A00Z&t=0&view=system` at 1440 × 900, wait
    for `window.__truesouthStill` (a WebP data URL), decode it into
    `web/public/still/system-view.webp`. It is 27 kB, over the spec's 0.01 MB guess.
  - Dev only: `window.__truesouthScene` exposes the world, rig, camera and renderer for
    checks like the ones above.
  - Flat mode (the shell's `mode: "flat"`): the scene draws nothing, unmounts its Canvas and
    reports `flatViews: []`, so the shell's still picture stands for every view.
  - Review fixes (Gemini review of #75): the System view can pitch away from the pole (a step
    toward it stops at the limit and never flips); a flight that changes the camera view is
    locked against drags, scrolls and keys, another pick re-targets it, and the Polar map's
    lighting blend lives in the rig and ends at 0 or 1; failed loads say so on a plate and
    never draw a made-up Sun, Earth or distance (`plates.ts`); the apron is lowered only
    under the patch; Lander's eye labels read "Sun, 1.1° below level · in view" from the
    series' disc fraction and clearance; replaced Moon textures are released; the 8K seam
    no longer wraps at 180°; pins are named with their status. Checked with rig, plate,
    ground and label tests, and in the browser with hardware WebGL (the failure states were
    forced through the app's own data store).
  - three.js r187 prints a `THREE.Clock` deprecation warning from inside React Three Fiber.

#### 2026-11-13 · T0 · Coordinate helpers and a shared Canvas mount
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote `web/src/lib/geo/` (tests first), the `SceneCanvas` wrapper and this entry — not checked by a human; the orchestrator marks this verified after `pnpm --dir web test`, typecheck and build
- **State:** verified (the orchestrator, Claude Fable 5.2, compared every helper with docs/science.md and ran the tests, typecheck and build; Antigravity, gemini-4-hydrogen reviewed the math and found an angle-wrap bug, a hard-coded bin count and three test blind spots, all fixed by the orchestrator; 64 tests pass)
- **Changed:** `web/src/lib/geo/`, `web/src/features/three/scene-canvas.tsx`, this entry
- **Notes:**
  - The two view placeholders are unchanged. `SceneCanvas` is not mounted yet, so the production bundle stays 259 kB.
  - Angles in and out of the helpers are degrees. Local terrain is kilometres in the scene; the System view uses Moon radius 1.
  - A map pixel is the centre of that pixel. The south pole is the centre pixel of an odd-sized image. The 7,600 px map is even, so the pole sits on the shared corner of the four central pixels.
  - `|latitude| > 89.999°` throws for the local frame and for walking. The sphere point and the Sun-elevation formula still accept the poles.

## Academy

#### 2026-11-13 · A5b · Lessons 1 to 4 reworded to the real numbers
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — rewrote the text of lessons 1 to 4 in
  `lessons.md` and in `l1.ts`–`l4.ts` against `worked_examples.json`, and read the
  existing tests that tie the code strings to the document — checked by the agent with
  pytest, vitest and typecheck. A human has not read or played the lessons.
- **State:** verified (322 Python tests and 1,581 web tests and the typecheck pass on the merge with main; the orchestrator read every changed line against the built numbers and changed lesson 4's slider goal to any margin at or above the first under 15%; not yet played in a browser)
- **Changed:** `docs/academy/lessons.md` (lessons 1 to 4, the intro note, and the
  "Lesson text that must change to match" list marked done), `web/src/features/academy/lessons/l1.ts`–`l4.ts`
  (string literals only)
- **Notes:**
  - Every value that has a worked-example key is now a `{{key}}` placeholder. Lesson 1
    says the 2.08° tilt figure is the best-season maximum and this month only reaches the
    real value. Lesson 2 names `{{l2.site_name}}` and says why Pip moved. Lesson 3 uses the
    real drops and a Sun that is never above the lesson 1 maximum. Lesson 4 uses 60%, a
    goal of `{{l4.mask_for_15pct_deg}}` and the 5° rule that can never be met.
  - Options changed: lesson 1 step 1 "Under 2°" is now "Under 3°"; lesson 3 step 5's right
    answer no longer says "1–2° up"; lesson 4 step 3 "About two-thirds" is now "Almost
    never". Lesson 3 step 4's line 4 says the Sun is 0.5° up (was 0.8°, above the month's
    highest).
  - Left alone because it needs more than wording: lesson 4 step 4's goal tolerance
    (±1°) also accepts 5.5° and 6° (21% and 16% link time, not under 15%);
    `lessons/COVERAGE.md` still lists the old settings and design values;
    `docs/science.md` section 4 and `docs/academy/luna.md` still say "1–2°" and "2°" for
    the polar Sun.

#### 2026-11-13 · A5a · Lesson types for lessons 1 to 8, skeletons for 1 to 4
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — widened the lesson types, the runner and the evaluator,
  wrote the coverage table, the lessons 1 to 4 skeletons and the vitest checks — checked
  by the agent with typecheck, tests and build. A human has not played a lesson.
- **State:** verified (orchestrator ran typecheck, 1,350 tests and build on the merge with main and played the sample lesson through all eight steps in a browser; Codex, gpt-6.1-terra reviewed the types and skeletons against the lesson document and ran nine mutations; its findings were fixed and the ambiguous settings decided and written into lessons.md)
- **Changed:** `web/src/features/academy/` (`types.ts`, `runner.ts`, `evaluator.ts`,
  `step-view.ts`, `skyline-score.ts`, `store.ts`, `lessons/l1.ts`–`l4.ts`, `lessons/story.ts`,
  `lessons/COVERAGE.md`, and the smallest screen edits the new types needed),
  `docs/academy/overview.md` (the star rule and the type sketch)
- **Notes:**
  - A reveal can be text, an illustration, or a panel at an hour, a month, a UTC range or
    a timeline band. A scene names a flat, smooth or terrain skyline and a drag window.
    A slider is either numbers or UTC dates, and may carry a readout, a scene and which
    of Pip's meters follows it.
  - A lesson with no scored step earns 1 star and no patch. `starsFor(0, 0)` had been 3.
    A negative or non-finite skyline gap is 2 XP and not right first time.
  - Progress is still saved only when the lesson is complete. That decision now lives in
    `commitLessonProgress`, which the lesson screen calls, and a test fails if it writes
    part-way.
  - Lessons 1 to 4 are exported and tested. They are not in the catalog. `TODO(words)`
    counts: l1_sun 9, l2_skyline 10, l3_horizon 10, l4_link 10.
  - Review fixes were made: the skyline window, the lesson 2 drag, the two sliders, both
    lesson 4 panels, provisional story dates, and UTC hours checked on the time grid.
    37 of 40 steps are expressible. Lesson 8 steps 3 to 5 are not.

#### 2026-11-13 · A4 · Under the hood card renderer with KaTeX and Fill chips
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the card type, the renderer, the lazy
  KaTeX loader, the card-text tokenizer, the one rounding rule, the sample card and 32
  vitest tests — checked by the agent with typecheck, tests and build, the impeccable
  detector (0 findings), and by eye in a browser at 1440 × 900 and 390 × 844 with reduce
  motion on and off, including KaTeX held back (loading) and blocked (failed). A human has
  not read the card yet.
- **State:** verified (orchestrator ran typecheck, 1,310 tests and build on the merge with main and looked at the card at both sizes; Codex, gpt-6.1-terra compared the quoted formulas with science.md section 4, probed the renderer for unsafe output and ran seven mutations; its findings were fixed and the trust mutation now fails nine tests)
- **Changed:** `web/src/features/academy/` (`card/`, `types.ts`, `format-example.ts`,
  `placeholders.ts`, `ui/filled.tsx`, `lessons/sample.ts`, `academy.css`, and the
  `pending` prop through `index.tsx`, `lesson-screen.tsx`, `lesson/conversation.tsx`),
  `web/package.json` (`katex` pinned to 0.19.1), `docs/academy/overview.md`, screenshots
  `docs/design/c2/built-academy-card*.png`
- **Notes:**
  - Cards are typed data (`UnderTheHoodCard` in `types.ts`), not Markdown files: the
    overview said `cards/<id>.md` while the same doc and the A2 code made lessons and
    cards typed. The overview now says `cards/<id>.ts`. A5 creates that folder.
  - KaTeX is in its own chunk, loaded when the "Under the hood" tab first opens:
    `katex-render` JS 259.45 kB (77.88 kB gzip), CSS 29.78 kB (7.98 kB gzip), 19 woff2
    fonts 256 kB (only the ones a formula uses are fetched). First-page JS went from
    545.69 kB to 572.54 kB (175.70 to 184.63 kB gzip): the renderer and the sample card,
    no KaTeX. `card/bundle.test.ts` walks the static import graph to keep it that way.
  - Numbers are rounded by key suffix in `format-example.ts` (degrees 2 decimals, km 1,
    m 0, h 1, pct 0), trailing zeros dropped. Lesson text uses the same rule now.
  - The sample route now merges the real `worked_examples.json` under the sample's toy
    values, so the sample card shows lesson 3's fixture numbers.
  - Review fixes made (same PR):
    - An unusable value (null, NaN, Infinity, an object, empty text) shows "value not
      built yet" and never throws.
    - Angles keep at least one decimal, and `_pct` is matched as a segment.
    - A test walks every worked-example key; unitless keys are listed in
      `format-example.ts`.
    - Compared sets gain decimals until their values print differently, and comparison
      words come from the data (`compare.ts`).
    - KaTeX's trust, `maxSize` (20 em) and `maxExpand` (1000) are tested.
    - The boxed-number note says "sample values for testing, not real" on fixtures.
    - Malformed `{{example.…}}` keys show as missing, and the worked example's title is
      drawn as card text.
  - The real `data/derived/` has no `academy/worked_examples.json` yet. On real data the
    card shows every number as "value not built yet", and the browser logs that file's 404.

#### 2026-11-13 · A2 · Academy screens in the picked form and the five step kinds
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the path (variant b), the lesson
  screen (variant b, split stage), lesson complete (variant a), the five step kinds
  (`choice`, `predict`, `fill-formula`, `spot-bug`, `tune-slider`), the widened lesson
  types, the draw-skyline closeness rule, the Academy tokens and their vitest tests —
  checked by the agent with the tests, typecheck and build, the impeccable detector
  (0 findings), and by eye in a browser at 1440 × 900 and 390 × 844 with reduce motion
  on and off. A human has not played it yet.
- **State:** verified (orchestrator ran typecheck, 1,145 tests and build on the merge with main and looked at the screens; Antigravity, gemini-4-hydrogen reviewed the rules, ran eight mutations and measured the screens in a browser; its three must-fix findings were fixed by the orchestrator)
- **Changed:** `web/src/features/academy/`, `web/src/components/luna/` (no-bounce mood
  change; proud, cheering and worried extras recoloured to the C2 rules),
  `docs/academy/overview.md`, the Academy block in `web/src/app/theme.css`, `DESIGN.md`,
  screenshots `docs/design/c2/built-academy-*.png`
- **Notes:**
  - New rules in `docs/academy/overview.md`: predict gets one guess (10 or 2 XP);
    draw-skyline XP by closeness, `round(10 − 8 × clamp((gap − 0.25) / 1.75, 0, 1))`;
    leaving part-way drops the lesson's progress; the ninth patch is "True South".
  - The Academy's motion curve is `--ease-ac`, not `--ease-out`, because `--ease-out`
    already exists for Mission Control.
  - The three panel step kinds (A3) show a placeholder that says the step is coming,
    and offer "Skip this step" (no XP, left out of the stars). A3 removes the skip.
  - Panels at the end of a lesson and in a predict reveal are grey boxes until Mission
    Control's panels have a `"lesson"` mode.
  - `UnderTheHoodCard` in `card/index.tsx` renders plain text; A4 replaces its inside.
  - The sound toggle is not shown: there are no sounds yet, so a toggle would do nothing.

#### 2026-11-13 · A7 · `explain.ts`: a plain-language entry for every term a user meets
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — wrote the 113 entries in
  `web/src/lib/explain.ts` and the vitest checks in `explain.test.ts` — checked by the
  agent with the tests, typecheck and build, and by two read-throughs of every entry: once
  as a reader with no background, once against `docs/science.md`. A human has not read
  the text yet.
- **State:** verified (the orchestrator, Claude Fable 5.2, ran the tests, typecheck and build and applied the review's corrections; Antigravity, gemini-4-hydrogen checked every entry against CONTEXT.md and docs/science.md and asked for seven wording fixes and five lesson-link fixes, all made)
- **Changed:** `web/src/lib/explain.ts`, `web/src/lib/explain.test.ts`, this entry
- **Notes:**
  - Every glossary term in CONTEXT.md (except the developer-only ones), every profile
    field, and every metric, veto, utility and status has an entry. Each entry can link
    to the lesson that teaches it (`lesson`).
  - Callers can now type a term with `ExplainTerm`; `explanations` is still a plain
    record, so `Explain.tsx` needs no change.
  - The test reads `CONTEXT.md` and `docs/mission-profiles.md`, so a new glossary term
    or profile field fails the tests until it is explained.
  - Vetoes and utilities are keyed `veto_slope`, `utility_slope` and so on, because
    `blackout` is already a glossary term. First draft; a polish pass is due.

#### 2026-11-13 · A0 · Lesson types, step runner, feedback flow, academy store, path map
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the lesson types, pure step runner, placeholder
  substitution, `academy` store, sample lesson and plain placeholder screens — the agent
  ran `pnpm --dir web test`, `typecheck` and `build`; the orchestrator has not verified
  this yet
- **State:** verified (the orchestrator, Claude Fable 5.2, read the runner against the spec's game rules and ran the tests, typecheck and build; Antigravity, gemini-3.8-flash reviewed the pull request and approved)
- **Changed:** `web/src/features/academy/`, this entry
- **Notes:**
  - Screens are plain placeholders until the design choice. The sample lesson id is
    `sample`, at `/academy/sample`. A5 replaces it. It is not one of the eight lessons.
  - Goal checks go through an injected evaluator. `stub-evaluator.ts` returns a fixed
    boolean until MC2. The sample passes every goal.
  - Progress is stored at `truesouth.academy.v1`. The store takes a storage object, so
    the tests do not need a DOM. Best stars and best XP are kept. The ninth mission
    patch is `all-eight`, after the eight catalog lessons.
  - Spec questions are in the pull request.

#### 2026-11-13 · A1 · Luna and LunaSays with placeholder art in eight moods; celebrations
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote `Luna`, `LunaSays`, `LunaCelebration`,
  `LunaGallery`, the motion logic and its vitest tests — checked by the agent with the
  tests, typecheck and build, and by eye in a browser at 160 px, 48 px, 390 px wide and
  with reduced motion. **AI-generated images:** the eight placeholder Luna mood drawings
  (inline SVG in `web/src/components/luna/art/`), made by Claude Code, claude-opus-5-5.
- **State:** verified (the orchestrator, Claude Fable 5.2, read the diff, ran the tests, typecheck and build, and looked at all eight moods at 160 px and 48 px on a running page; Cursor, grok-4.6 reviewed the pull request and approved)
- **Changed:** `web/src/components/luna/`
- **Notes:** Luna's look lives only in `art/`; the seam is documented at the top of
  `art/index.ts`. To look at it, mount `LunaGallery` (exported from
  `components/luna`) on a temporary route. Reduced motion follows the system setting
  live, or a `reduceMotion` prop.

## Planning

#### 2026-11-13 · MC7 (spec) · The Slip Planner spec rewritten as a view on the Moon
- **Who:** team lead
- **AI use:** Claude Code (Sonnet 5.5) — rewrote `docs/features/slip-planner.md` and the
  places that called the Slip Planner a window, from `design/variants/c2-slip-on-moon.md` and
  the team lead's picks — not yet read by the team lead; links checked by script
- **State:** verified (308 Python tests and 1,578 web tests pass on the merge with main; read by the orchestrator against the design note and the prototype's code)
- **Changed:** `docs/features/slip-planner.md`, `CONTEXT.md`, `DESIGN.md`,
  `docs/decisions/0013-space-first-mission-control.md`, `docs/build-plan.md`,
  `docs/challenge.md`, and the Slip Planner wording in `docs/features/` and `docs/tracks/`
- **Notes:** Variant a (lamp and ring) is picked; variant b and the window of squares are
  rejected. The orchestrator closed the open points: the shading is on when the view opens;
  strips are landings at 00:00 UTC and a landing at another hour gets a note; picking a
  camera view closes Compare. Spot and Landing-date panel are in the glossary test as layout
  words, and the `slip_planner` explanation in `web/src/lib/explain.ts` now describes the
  view. The shell still shows a Slip Planner window button until MC7 is built.

#### 2026-11-13 · planning · One orchestrator runs all four tracks
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/orchestration/` — team lead set the rules it
  encodes
- **State:** verified (documents only)
- **Changed:** `docs/orchestration/`, `docs/tracks/README.md`, `docs/build-plan.md`,
  `docs/academy/luna.md`
- **Notes:** A Claude Fable 5.2 session hands work packages to agents on Claude Code,
  Codex, Cursor (Grok models only) and Antigravity (Google models only). All UI work goes
  to Claude Opus 5.5. It stops at six checkpoints for review and shows design variants
  before any final UI. Luna stays a placeholder until the last milestone.

#### 2026-11-13 · planning · Work split into four tracks with a guide each
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/tracks/` and moved the polar map and custom sites
  from Mission Control to the 3D and Map track — team lead reviewed the split
- **State:** verified (documents only)
- **Changed:** `docs/tracks/`, `docs/build-plan.md`, `AGENTS.md`, `README.md`, this file

#### 2026-11-13 · planning · Plan rewritten as an implementation-ready doc set
- **Who:** team lead
- **AI use:** Claude Code — reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the documents
  in `docs/` — team lead answered every design question and approved the result
- **State:** verified (documents only; no application code exists)
- **Changed:** replaced the three `lunar_navigator_*.md` files with `README.md`,
  `AGENTS.md`, `CONTEXT.md`, `DEVLOG.md` and `docs/`.
- **Notes:**
  - Main changes: two modes (Mission Control and Academy); mission profiles named after
    real missions; Slip Planner; Lander's eye view; System view; a site-centred local
    frame; one global ephemeris; Sun and Earth as discs.
  - A real Horizons run for Connecting Ridge (December 2026) showed the earlier fixed
    limits would have made every polar site NO-GO. See
    [`docs/decisions/0007-mission-profiles.md`](docs/decisions/0007-mission-profiles.md).
  - Open items are listed in [`docs/build-plan.md`](docs/build-plan.md).

#### 2026-11-13 · planning · First planning notes committed
- **Who:** team
- **AI use:** not recorded
- **State:** superseded
- **Changed:** `lunar_navigator_tech_decisions.md`,
  `lunar_navigator_team_implementation_plan.md`, `lunar_navigator_development_log.md`
  (commit `76bb523`; still in git history).

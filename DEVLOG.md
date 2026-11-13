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
| M1 Thin slice | in progress: S3 to S6, MC4a and A7 verified; S7 and MC3 in review; A2 and S9 being built |
| M2 Mission Control complete on catalog data | not started |
| M3 Everything | not started |
| M4 Tuned and submitted | not started |

## Science

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
- **State:** built, not verified
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

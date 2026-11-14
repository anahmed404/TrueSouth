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
| M1 Thin slice | complete: the panels and the timeline run on real data for all 20 catalog sites and the 5 best-lit variants (S3 to S9, MC3 to MC5 verified); validation against NASA is published (S12) |
| M2 Mission Control complete on catalog data | complete, 2026-11-14: the space-first shell, the 3D scene, the Polar map, Local terrain, Lander's eye, the Slip Planner and Compare are verified and merged |
| M3 Everything | done within the deadline's scope, 2026-11-14: custom coordinates (S10, S10b, S10c), Docker (S13) and the deploy files (S13b, not yet run on a server), the validation page (A8), the math review (A9), Academy lessons 1 to 4 (A5, A3). Out of scope: the sensitivity grid (S11), "compute for my dates" (T8), lessons 5 to 8 (A6) |
| M4 Tuned and submitted | in progress, 2026-11-14: the submission texts are current (A11b); fixes from the team lead's testing continue; the deploy, the public repository or zip, and the video are open. The live record is [`docs/orchestration/status.md`](docs/orchestration/status.md) |

## Science

#### 2026-11-14 · S8b · Close-up ground from NASA's 5 m site maps
- **Who:** Codex implementation sub-agent
- **AI use:** Codex implemented bounded NASA window ingestion, atomic close-up refresh,
  synthetic geometry/regression tests and documentation; automated checks below,
  human review pending.
- **State:** verified (reviewed by Cursor (grok-4.7): approve; as-is orientation wins at all 16 sites against every flip and rotation, zero shift against the 80 m patch, every existing derived blob byte-identical, certificate checks intact; on the tree merged with main 59556f5: 471 Python tests (1 skipped), 2,649 web tests, typecheck and build all exit 0. Follow-up: pin a mesh vertex at more than one longitude in the tests)
- **Changed:** `science/`, close-up drawing artifacts and availability metadata,
  architecture, data-contract explanations and science conventions. No contract change.
- **Result:** 16 accepted meshes, 1,056,784 bytes each, **16,908,544 bytes** added.
  All 27 surface maps on [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78)
  inspected from their own GeoTIFF metadata, including Site20v2, Site42, DM1/DM2,
  SL2/SL3, NPA–NPD and LM1–LM8. All nine uncovered points are outside every
  surface map's extent; no candidate failed its complete finite-data check.
  Site20v2 is preferred to the older Site20 where maps overlap. Best-lit variants
  are assessed at their own coordinates. NASA source credit: Barker et al. (2021),
  [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119).
- **Grid and registration:** 257 × 257 over 2 km, 7.8125 m spacing, bilinear
  interpolation of native 5 m pixel centres. No invented features or nearest-pixel
  decimation. Each GeoTIFF's scale, offset, NaN/nodata mask and pixel transform are
  read. All projections numerically match the existing polar projection and
  1,737,400 m radius; the README specifies MOON_ME/DE421, matching the polar data.
  Legacy GMT CRS names differ but no frame, radius or projection conversion is
  needed. Raw agreement below precedes the constant drawing-height correction
  described in [science.md §13](docs/science.md#13-local-terrain-coordinates).
  Ground, site slope, skyline and series still use the polar maps.
- **Nothing else changes:** compared every one of the 142 pre-existing tracked
  `data/derived/` files against base `b6d4a5b`. Only the 16 `meta.closeup` values
  and 16 `has_closeup` flags in `sites.json` changed (17 metadata files).
  Every other existing byte is unchanged, including the manifest timestamp
  `2026-11-13T00:00:00Z`. The fixture regression also checks this property and
  repeatability through the shared atomic builder. No schema or generated types changed.

All heights below are metres. Mean/RMS compare the uncorrected 5 m raster,
area-averaged onto actual 80 m cells in the local 2 km window, to that map.
Every accepted site's correlation peak is X/Y = 0/0 m on the 10 m search grid
over ±160 m; this does not resolve offsets smaller than that step. Comparisons
use 624–630 80 m cells per site. No horizontal shift is applied.

| Site id | NASA file | 5 m height / unchanged ground (m) | Centre difference (m) | Mean / RMS (m) |
| :--- | :--- | ---: | ---: | ---: |
| `apollo11` | none: centre outside all 27 extents | — | — | — |
| `apollo17` | none: centre outside all 27 extents | — | — | — |
| `artemis_de_gerlache_rim_2` | `SL2_final_adj_5mpp_surf.tif` | -88.215 / -88.834 | +0.619 | -0.128 / 0.202 |
| `artemis_haworth` | `Haworth_final_adj_5mpp_surf.tif` | 1628.547 / 1628.032 | +0.516 | +0.085 / 0.126 |
| `artemis_malapert` | `Site23_final_adj_5mpp_surf.tif` | 4783.796 / 4784.771 | -0.974 | -0.065 / 0.131 |
| `artemis_mouton` | `Site20v2_final_adj_5mpp_surf.tif` | 6398.630 / 6398.160 | +0.470 | -0.039 / 0.153 |
| `artemis_nobile_rim_1` | `Site20v2_final_adj_5mpp_surf.tif` | 5946.836 / 5945.618 | +1.219 | +0.012 / 0.210 |
| `artemis_nobile_rim_2` | `DM2_final_adj_5mpp_surf.tif` | 1009.681 / 1009.324 | +0.356 | +0.042 / 0.362 |
| `blue_ghost1` | none: centre outside all 27 extents | — | — | — |
| `chandrayaan3` | none: centre outside all 27 extents | — | — | — |
| `change4` | none: centre outside all 27 extents | — | — | — |
| `change6` | none: centre outside all 27 extents | — | — | — |
| `connecting_ridge` | `Site01_final_adj_5mpp_surf.tif` | 1949.608 / 1950.256 | -0.648 | -0.098 / 0.317 |
| `connecting_ridge_best_lit` | `Site01_final_adj_5mpp_surf.tif` | 1957.415 / 1956.826 | +0.590 | -0.129 / 0.335 |
| `de_gerlache_rim` | `Site11_final_adj_5mpp_surf.tif` | 1779.031 / 1779.196 | -0.164 | +0.153 / 0.313 |
| `de_gerlache_rim_best_lit` | `Site11_final_adj_5mpp_surf.tif` | 1780.867 / 1780.174 | +0.693 | +0.178 / 0.328 |
| `im1_odysseus` | none: centre outside all 27 extents | — | — | — |
| `im2_athena` | none: centre outside all 27 extents | — | — | — |
| `luna25_target` | none: centre outside all 27 extents | — | — | — |
| `malapert_peak` | `Site23_final_adj_5mpp_surf.tif` | 4970.059 / 4969.078 | +0.981 | -0.088 / 0.185 |
| `malapert_peak_best_lit` | `Site23_final_adj_5mpp_surf.tif` | 4972.750 / 4972.435 | +0.315 | -0.094 / 0.189 |
| `peak_near_shackleton` | `Site07_final_adj_5mpp_surf.tif` | 1454.611 / 1454.988 | -0.377 | -0.299 / 0.365 |
| `peak_near_shackleton_best_lit` | `Site07_final_adj_5mpp_surf.tif` | 1455.477 / 1455.077 | +0.399 | -0.308 / 0.374 |
| `shackleton_rim` | `Site04_final_adj_5mpp_surf.tif` | 1735.218 / 1732.866 | +2.352 | -0.138 / 0.394 |
| `shackleton_rim_best_lit` | `Site04_final_adj_5mpp_surf.tif` | 1735.449 / 1735.207 | +0.242 | -0.138 / 0.397 |

**Network and retained disk.** No full NASA surface or slope TIFF was downloaded.
The 11 candidate source files total 717,884,323 bytes by HEAD, below 1.2 GB;
the largest is Haworth at 142,123,767 bytes, below 150 MB. All 27 HEAD sizes
total 1,742,398,995 bytes; the other files require only metadata ranges.
Successful checkpoints account for 170,917,888 crop-range bytes plus 1,769,472
metadata bytes. Initial exploratory requests and an interrupted first attempt
add unmetered transfer. Small 64 KiB requests encountered an HTTP 403; coalesced
1 MiB requests worked, with one later disconnect resumed from the checkpoint.
The final repeated fetch exited 0 and issued HEADs only, with no new crop transfer.
The current implementation also reuses nearby variants' prepared windows and
skips opening overlapping maps when all their candidate points are already covered.

| Source file | HEAD bytes | Successful crop-range bytes |
| :--- | ---: | ---: |
| `Site20v2_final_adj_5mpp_surf.tif` | 108192905 | 40894464 |
| `DM2_final_adj_5mpp_surf.tif` | 64025607 | 15728640 |
| `Haworth_final_adj_5mpp_surf.tif` | 142123767 | 22020096 |
| `SL2_final_adj_5mpp_surf.tif` | 64025605 | 15728640 |
| `Site01_final_adj_5mpp_surf.tif` | 40980810 | 12582912 |
| `Site04_final_adj_5mpp_surf.tif` | 40980806 | 14680064 |
| `Site06_final_adj_5mpp_surf.tif` | 64025603 | 1048576 |
| `Site07_final_adj_5mpp_surf.tif` | 40980808 | 13631488 |
| `Site11_final_adj_5mpp_surf.tif` | 40980806 | 13631488 |
| `Site20_final_adj_5mpp_surf.tif` | 40980802 | 1048576 |
| `Site23_final_adj_5mpp_surf.tif` | 70586804 | 19922944 |

Site06 and Site20 only incurred extra reads while skipping already covered
points in the initial implementation; no crop uses them. The other nine files
provide the accepted meshes. Shared `C:/Users/abdal/TrueSouth/data/prepared/closeups/`
contains 16 native crops (41,163,896 bytes total), their sidecars, `index.json` and
`agreement.json` (41,220,103 bytes total at measurement). The new `raw/closeups/`
folder is empty. Existing polar prepared maps and downloads were reused and left
alone. No raw or prepared data is staged.

Rebuild in PowerShell, using the existing prepared polar maps and committed ephemeris:

```powershell
$env:TRUESOUTH_DATA_ROOT='C:/Users/abdal/TrueSouth/data'
uv run truesouth fetch-raw --group closeup
uv run truesouth prepare-dem --group closeup
uv run truesouth build-sites --closeups-only --only artemis_de_gerlache_rim_2 artemis_haworth artemis_malapert artemis_mouton artemis_nobile_rim_1 artemis_nobile_rim_2 connecting_ridge de_gerlache_rim malapert_peak peak_near_shackleton shackleton_rim --generated-utc 2026-11-13T00:00:00Z
```

Normal `build-sites --only <ids>` also builds accepted close-ups; custom callers
of the shared builder do not receive one. `--closeups-only` keeps the existing
manifest rather than regenerating it. Prepare, refresh and idempotent fetch
checks all exited 0. The five requested final checks ran once each, sequentially,
with numerical threads and Vitest workers limited to one:

| Command | Result | Exit code |
| :--- | :--- | ---: |
| `uv run pytest -q` | 471 passed, 1 skipped; 226.36 s | 0 |
| `pnpm --dir web install --frozen-lockfile` | installed with the frozen lockfile | 0 |
| `pnpm --dir web test` | 117 files, 2,589 tests passed; 84.58 s | 0 |
| `pnpm --dir web typecheck` | passed | 0 |
| `pnpm --dir web build` | passed; existing large-chunk warning | 0 |

Synthetic tests cover known plane and bump georeferencing (including
PixelIsPoint), bilinear resampling, nodata/NaN, full-window coverage with a hole
between vertices, a recovered known 40 m horizontal shift, fetch idempotence and
missing-crop resume, deletion before the next fallback download, size limits,
atomic failure recovery and unchanged fixture science on both normal and
close-up-only builds. No network or real maps are needed by these tests.

**Not verified:** visual integration belongs to the scene agent; sub-10 m
horizontal offsets and independent absolute vertical accuracy were not measured.
The existing real-map custom-site byte-identity pytest was skipped because the
suite ran without the shared-data environment override; the separate catalog
audit above did use the real prepared maps and checked every existing artifact.
NASA's slope files were deliberately not downloaded, so the independent close-up
slope comparison R4 remains deferred. NASA reports about 90% interpolated 5 m
pixels and 0.30–0.50 m median RMS height uncertainty in its regions of interest;
the close-up is drawing data, not a footpad-safety assessment. Human review pending.

#### 2026-11-14 · S13b · production deploy files
- **Who:** Codex implementation agent
- **AI use:** Codex built the deployment files, trusted-proxy handling, tests and runbook; automated checks run locally, human review pending.
- **State:** verified (reviewed by Cursor (grok-4.7): request changes, eight findings, all fixed by the author with evidence and read by the orchestrator; on the tree merged with main 69bb26e: 458 Python tests (1 skipped), 2,465 web tests, typecheck and build all exit 0. Not yet run on a real server: certificate issue and renewal, the visitor address on Ubuntu, and a terrain job's memory are unverified)
- **Changed:** production Compose, deploy scripts and nginx configuration, API and tests, architecture, deployment runbook and decision 0017.
- **Notes:** Merged main and addressed PR review: strict trusted-proxy CIDRs, mapped addresses and client logging; host refusal, nginx health, fixed app address and proxy-verified updates; JavaScript gzip and runbook fixes. Ran Compose config, isolated bootstrap/TLS, host, health, container recreation, gzip/weak ETag and failure-path checks, `sh -n`, ShellCheck, pytest (458 passed, one skipped), frozen pnpm install, web tests (2465 passed), typecheck and build. Docker Desktop logged the bridge gateway; real Ubuntu visitor addressing and peak terrain-job memory remain unverified. No real certificate or deployment was attempted. Local `system.bin` was 1,262,016 bytes; gzip was 1,030,332 bytes.

#### 2026-11-14 · S10c review · Consistent queue positions
- **Who:** Codex implementation agent
- **AI use:** Codex fixed the POST response contract, added test-client coverage and updated the contract documentation; human review pending.
- **State:** verified (438 Python tests (1 skipped), 2,344 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; reviewed by Cursor (every error path has its code; validation.json differs from main only by the new object, with no existing value changed; the new numbers equal the gate's prose and come from the same computation); one finding fixed: the queue position is a number only while a job is queued, on both answers)
- **Changed:** POST and GET now return a positive queue position only while queued, and null otherwise.

#### 2026-11-14 · S12c · G2 diagnostics
- **Who:** Codex implementation agent
- **AI use:** Codex added structured G2 evidence and ran the real-data validation; human review pending.
- **State:** verified (438 Python tests (1 skipped), 2,344 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; reviewed by Cursor (every error path has its code; validation.json differs from main only by the new object, with no existing value changed; the new numbers equal the gate's prose and come from the same computation); one finding fixed: the queue position is a number only while a job is queued, on both answers)
- **Measured:** Raw azimuth maximum 0.08235604530386809? at apollo11/sun 2031-10-14T01:00:00Z; 28 site/body hours exceed 0.02?. Full sky maximum 0.006029212608512336? and elevation maximum 0.006006374416962501?. Removing the new diagnostics object leaves the real report structurally identical to origin/main.

#### 2026-11-14 · S10c · Custom-site status and errors
- **Who:** Codex implementation agent
- **AI use:** Codex implemented queue positions, error codes, contracts, documentation and regression tests; human review pending.
- **State:** verified (438 Python tests (1 skipped), 2,344 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; reviewed by Cursor (every error path has its code; validation.json differs from main only by the new object, with no existing value changed; the new numbers equal the gate's prose and come from the same computation); one finding fixed: the queue position is a number only while a job is queued, on both answers)
- **Changed:** Status returns the current FIFO position; custom-site errors include stable codes while retaining their messages.

#### 2026-11-14 · S2b · Stable score boundaries and exact window means
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — documented the arithmetic first, implemented
  matching Python and TypeScript scoring, added seeded translation and boundary
  tests, regenerated G10, and ran sequential catalog audits and checks.
- **State:** verified (432 Python tests, 2,344 web tests and the typecheck pass on the merge with main; reviewed by Gemini (approve): 2,240 random and boundary cases gave identical results in Python and TypeScript, down to the bits; 50 offsets of the same window agree; a 5-site audit found no status change; the orchestrator's audit of the whole catalog by landing hour found no status change and 4,598 displayed whole scores corrected upward by one)
- **Changed:** scoring functions and their tests, the fixture generator and shared
  cases, a scoring-only fixture series, `docs/science.md` sections 9–11, decision
  0015 and `docs/reviews/s2b-score-boundary.md`. No screens or contracts changed.
- **Notes:**
  - Exact integer prefix counts replace floating prefix subtraction; a stated
    12-decimal rule handles comparisons and the returned score in both copies.
  - Audited 25 sites × 5 presets × 2,191 days, once before and once after, each
    single-process. Zero status changes and zero score changes above 1e-9 for
    every preset. The largest score difference is 1.1802114841e-11 points.
  - Worked examples regenerate byte-identically. No derived file changed. The
    complete per-profile counts and regression evidence are in the report.
  - Checks: pytest 432 passed, 1 skipped; web 1,926 passed; frozen install,
    typecheck and build passed, each exit 0. Fixed a new fixture-label collision
    found by the first Python run, then reran Python and the affected G10 test.
    Checks ran sequentially, with numerical threads and Vitest workers limited.
- **Seen at merge (orchestrator):** the fix does change what a user sees in a few places, and for the better. Scores are shown rounded down, and the old sums left some exact whole scores one float step short (99.99999999999999 shown as 99). Over the real catalog (25 sites, 5 presets, every landing hour: 6,486,425 results) 4,598 displayed whole scores go up by one (IM-2 Athena 2,092; Artemis crewed 1,699; Blue Ghost 1 807; none for VIPER or Chandrayaan-3); no status changes. A Slip Planner test that named three such days was updated to expect the exact values.

#### 2026-11-14 · S10b integration · Merge main's placement builder
- **Who:** Codex implementation agent
- **AI use:** Codex resolved build-sites and DEVLOG conflicts, preserved main's placement flow, adapted the custom-site wrapper to main's helpers, and added integration tests; human and orchestrator review pending.
- **State:** verified (425 Python tests (1 skipped: the real-map test, run separately by the author and passed), 1,900 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; no derived data changed; reviewed by Gemini (pipeline reuse and byte-identity at Connecting Ridge confirmed; eleven findings on failure handling, all fixed with tests); the catalog build and the API share one site builder on top of the variants work; a full catalog rebuild under the new source fingerprint is still to be run)
- **Changed:** build_site now composes _derive, _record and _stage_site; catalog callers reuse prederived parts and placement metadata, variants still reuse the winning skyline/series. Custom publication retains cancellation, storage hook and internal site.json without touching the index or candidate cache. Placement imports are local to the catalog command. API storage prunes the reserved placement directory before traversal so catalog candidates do not consume the custom quota. Every DEVLOG line from both merge parents was retained.
- **Checks:** Full Python run 424 passed, 1 real-map skip, exit 0. After the placement-quota interaction fix, affected API/integration checks 106 passed, 1 skipped, exit 0. Explicit real-map test: 1 passed, exit 0, Connecting Ridge custom series.bin/skyline.bin/terrain.bin byte-identical to catalog in 36.617 s (37.90 s test); meta differs only site_id. Catalog verification ran --only chandrayaan3 apollo11 --force in a staging copy and rebuilt Connecting Ridge's listed point with the shared builder, retaining its published nearby range. All 25 staged folders and sites.json match origin/main Git blob hashes; tracked derived files also match before and after. Full 25-site recomputation was not run: placement key 0826b46027c9dc5fdfbb91366e2b4a200804f04c6669ce577f9463b7f19b0254 has no shared cache; --only on a peak would also trigger the cold candidate evaluation. API import 1.110 s with no numpy/scipy/pyproj/rasterio/placement_cache modules loaded. Frozen pnpm install, 1,849 web tests (one worker) and typecheck exit 0. Docker skipped as requested; mandatory API dependency closure excludes rasterio.
- **Notes:** Site fields and custom contracts are unchanged by the merge; main's validation exclusions for variants remain intact. Dockerfile and dependencies are unchanged, so the requested Docker rebuild exception does not apply.


#### 2026-11-14 · Science clarifications · A9 findings and implementation limits
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — clarified the science document against the
  reviewed code, checked current stored-file counts without rebuilding data,
  and recorded each A9 finding's status. Both Academy teaching formulas are
  unchanged. No code, contract, screen or data changed.
- **State:** verified (432 Python tests and 2,344 web tests pass on the merge with main, including the Academy's card-formula tests; reviewed by Gemini, which checked each passage against the code and recounted the data (58 stored 360-degree azimuths; sub-solar latitude within 1.59 degrees; no empty skyline bins at the 20 terrain sites); one error found and corrected by the orchestrator: the highest stored Sun at Connecting Ridge is 2.10 degrees (2.13 had been computed at longitude 0))
- **Changed:** `docs/science.md`, the Status table and later-state notes in
  `docs/reviews/a9-math-review.md`, and the dated outcome in decision 0004.
- **Notes:**
  - B1 is fixed by #77; the near-pole part of B8 is fixed by #80. Profile
    file-contract validators remain future work. A1 and C4 are handled in #93;
    this branch leaves sections 9–11 unchanged to avoid overlapping those edits.
  - Documented bin and blocker ties, disc quadrature and singular cases, empty
    skyline assumptions, missing slope, quantisation, approximation domains,
    missed sub-hour intervals and the specified-but-unbuilt paths.
  - Current stored files contain 58 azimuths at 360 degrees: the original
    40 plus 18 variant samples. All 20 terrain-tier catalog files have blockers
    in every bin and report zero missing samples. Only Connecting Ridge was
    independently rebuilt in A9; the other sites were read, not recomputed.
  - Checks, all sequential: pytest 425 passed, 1 skipped; web 2,017 passed;
    frozen install, typecheck and build passed. Each direct exit code was 0.
    Both section 3.4 formula blocks and all of sections 9–11 are unchanged;
    the Academy card tests pass without editing web code.

#### 2026-11-14 · S10b review fixes · Public-endpoint failure handling
- **Who:** Codex implementation agent
- **AI use:** Codex reproduced the review findings with HTTP/worker regression tests, implemented the fixes and ran targeted checks; human and orchestrator review pending.
- **State:** verified (425 Python tests (1 skipped: the real-map test, run separately by the author and passed), 1,900 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; no derived data changed; reviewed by Gemini (pipeline reuse and byte-identity at Connecting Ridge confirmed; eleven findings on failure handling, all fixed with tests); the catalog build and the API share one site builder on top of the variants work; a full catalog rebuild under the new source fingerprint is still to be run)
- **Changed:** Strict finite JSON numbers; safe 422 fields without input echoes; 4 KiB streamed body cap; initialization-only compute locking; surviving/restarting workers; bounded recent states and expiring client histories; 2 GiB configured cache budget and health accounting; canonical ASCII ids and printable names; shared science latitude limit with up-front rejection; catalog latitude tiers including raster corners; ephemeris readiness; cancellable atomic publication, 90 s shutdown grace and proxy headers disabled.
- **Tests:** Each numbered finding reproduced before its fix and pushed separately (small items 9-11 together). Final suite: 409 passed, 1 optional real-map skip, exit 0; explicit real-map test: 1 passed, exit 0 (51.904 s computation, 52.97 s test). All three Connecting Ridge binaries byte-identical; meta only differs in site_id. Frozen pnpm install and typecheck exit 0; all 1,744 web tests pass with maxWorkers=2, unchanged timeouts. Schema export and type generation exit 0. Added 70 review regression cases including invalid UTF-8 and staging rename races. Initial full check found missing contract descriptions; fixed. Under heavy contention the timing check and one default-worker web test timed out; final runs pass without increasing limits. Docker rebuilt and served port 18081: same byte-identical files in 51.141 s, concurrent sphere 0.109 s, corner sphere, safe non-finite 422 and spoofed-proxy 429 checks pass; image 425,121,437 bytes, rasterio absent. Review containers, volume, network and image removed; S13 untouched.
- **Notes:** Merged origin/main and retained all DEVLOG entries. During the disk-full incident, all changed files were rechecked as nonempty, Python parsed, JSON decoded; no truncated source found. Full suites and Docker paused until the orchestrator confirmed restored space. Tier selection now follows site_tier (core80 <= -80; wide240 to -60; sphere north of -60), superseding the first S10b coverage labels. Error bodies and statuses are documented precisely for the form agent; success/status contracts remain unchanged.

#### 2026-11-13 · S10b · Custom sites in the API
- **Who:** Codex implementation agent
- **AI use:** Codex wrote the shared builder extraction, queue, routes, Docker changes and tests; checked with pytest, vitest, typecheck, real terrain byte comparison and HTTP measurement; human review pending.
- **State:** verified (425 Python tests (1 skipped: the real-map test, run separately by the author and passed), 1,900 web tests and the typecheck pass on the merge with main; regenerating the schema and types leaves no diff; no derived data changed; reviewed by Gemini (pipeline reuse and byte-identity at Connecting Ridge confirmed; eleven findings on failure handling, all fixed with tests); the catalog build and the API share one site builder on top of the variants work; a full catalog rebuild under the new source fingerprint is still to be run)
- **Changed:** science shared site builder and request contracts; API jobs, routes, settings and health; generated schema/types; Docker and Compose; architecture and API message docs; decision 0013.
- **Checks:** Final Python suite 339 passed, 1 real-map test skipped by default (exit 0); API suite 31 passed, 1 skipped. Real-map test explicitly run with TRUESOUTH_DATA_ROOT: 1 passed, exit 0. Web 1,581 tests passed, typecheck and frozen install exit 0. Docker image built and ran; Connecting Ridge ready with identical binaries in 43.805 s, cached POST ready after restart in 0.078 s. Image 198,930,368 bytes before (catalog), 423,959,216 bytes after. Rasterio absent; prepared mount read-only; no-maps catalog/503/sphere checks pass. S10b containers, volume, network and image removed. Host 8080 was occupied by S13, so smoke test used temporary host 18080, container 8080; S13 untouched. A temporary host-network build override worked around stalled wheel downloads.
- **Measured:** Connecting Ridge custom series.bin, skyline.bin and terrain.bin byte-identical to catalog; meta differs only site_id. Real comparison 48.987 s; separate HTTP submission through all four downloads 43.445 s, peak process working set 647.801 MiB (Windows GetProcessMemoryInfo, including mapped pages). API import 1.597 s, no numpy/scipy/rasterio/terrain imports.
- **Limits:** Existing science rejects within 0.001 degrees of a pole. Custom entries have outcome, variant_of, offset_m and nearby_sun null; sphere also elevation/slope null. source_url is empty (user coordinates), group contrast. Close-up and apron files are not built; loaders skip them from null metadata/missing scene entries. Map coverage selects core80 then wide240 then sphere; nominal polar sites require installed maps when coverage cannot be inspected. Rasterio is a prepare extra, absent from runtime.
#### 2026-11-13 · S15b · Nearby range and best-lit variants in build-sites
- **Who:** implementation sub-agent
- **AI use:** Cursor, grok-4.7 — wired placement into `build-sites`, added the candidate cache, wrote the synthetic tests, built the five variants and their aprons, and reran validation — exit codes below were read from the logs; human review pending.
- **State:** verified (333 Python tests, 1,756 web tests and the typecheck pass on the merge with main; reviewed by Codex (the five variants match decision 0012; a real-data recomputation of one winning pixel matched; three mutations caught); review fixes: the cache key covers every science module, comparison R5 keeps its catalog sites, two build-level tests, a byte-identical rebuild recorded; only the five new site folders differ from main)
- **Changed:** `commands/build_sites.py`, `placement_cache.py`, `commands/validate.py` (G2 skips a variant), build-sites and G2 tests, `data/derived/sites.json`, five new `sites/*_best_lit/` folders, five new aprons, `scene/meta.json`, `validation.json`, the generated-variants section of `docs/site-catalog.md`, this entry.
- **Checks:** `uv run pytest`: 300 passed in 168.67 s, exit 0, before the merge. `uv run truesouth export-schema` exit 0, then `pnpm --dir web gen:types` exit 0, and `git status --short` showed no contract or generated-type change. `pnpm --dir web typecheck` exit 0. `pnpm --dir web test`: 1,504 passed, exit 0. `pnpm --dir web build` exit 0. Real `build-sites`: first run 2370.6 s, exit 0; up-to-date rerun 1.8 s, exit 0; `--force` rerun 181.2 s (parents recomputed, candidates from cache), exit 0. `build-scene-assets` 31.6 s, exit 0. `validate` 228.9 s, exit 0. All new and edited source files are UTF-8 without a BOM and use LF. NASA data was read only.
- **After merging origin/main:** `uv run pytest -q`: 328 passed in 210.32 s, exit 0. `pnpm --dir web install --frozen-lockfile` exit 0. `pnpm --dir web test`: 1,581 passed, exit 0. `pnpm --dir web typecheck` exit 0. `pnpm --dir web build` exit 0. Schema export and `gen:types` again left no diff. `data/derived/academy/worked_examples.json` matches `origin/main`. Nothing in `web/src` assumes 20 sites, so no web file was changed.
- **Notes:** Decision 0012's table agrees to three decimals. Listed mean `sun_frac`, the range within 160 m, the best-lit mean, the offset rounded to the nearest metre, and the variant latitude and east longitude:

| Site | Listed mean | Range within 160 m | Best-lit mean | Offset (m) | Variant latitude, east longitude |
| :--- | ---: | :--- | ---: | ---: | :--- |
| `connecting_ridge` | 0.599 | 0.397 to 0.870 | 0.870 | 149 | −89.45116, 222.85728 |
| `shackleton_rim` | 0.747 | 0.429 to 0.810 | 0.810 | 94 | −89.77725, 203.37680 |
| `de_gerlache_rim` | 0.607 | 0.276 to 0.696 | 0.696 | 144 | −88.69910, 291.59644 |
| `peak_near_shackleton` | 0.602 | 0.498 to 0.638 | 0.638 | 71 | −88.73810, 124.43758 |
| `malapert_peak` | 0.728 | 0.377 to 0.767 | 0.767 | 72 | −85.97437, 357.91641 |

Each variant, from its own published record and series. Ground height is metres. Slope is degrees. "Any Sun" is the share of hours with `sun_frac` above zero. "Earth ≥ 1°" is the share of hours with Earth clearance at or above 1°.

| Variant | Ground height | Slope | Any Sun | Earth ≥ 1° |
| :--- | ---: | ---: | ---: | ---: |
| `connecting_ridge_best_lit` | 1956.826 | 0.582 | 0.915 | 0.488 |
| `shackleton_rim_best_lit` | 1735.207 | 5.800 | 0.866 | 0.458 |
| `de_gerlache_rim_best_lit` | 1780.174 | 2.694 | 0.745 | 0.515 |
| `peak_near_shackleton_best_lit` | 1455.077 | 2.666 | 0.653 | 0.343 |
| `malapert_peak_best_lit` | 4972.435 | 2.449 | 0.809 | 0.653 |

New R1 rows (mean Sun disc fraction). Difference is ours minus NASA. Existing R1, R2 and R3 rows are unchanged.

| Site | Ours | NASA | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `connecting_ridge_best_lit` | 0.869614909 | 0.864200000 | +0.005414909 | no |
| `de_gerlache_rim_best_lit` | 0.695897674 | 0.464160000 | +0.231737674 | yes |
| `malapert_peak_best_lit` | 0.767453454 | 0.507600000 | +0.259853454 | yes |
| `peak_near_shackleton_best_lit` | 0.637824196 | 0.585400000 | +0.052424196 | no |
| `shackleton_rim_best_lit` | 0.810021349 | 0.728480000 | +0.081541349 | no |

`de_gerlache_rim_best_lit`: NASA's 60 m pixel is 0.464. Neighbours run from 0.056 to 0.669. NASA's 120 m map is 0.529. Ours is 0.696. NASA models an observer on the surface, 18.6 years and its own terrain grid; ours uses an observer 2 m above the ground, six years and the 80 m map. `malapert_peak_best_lit`: NASA's 60 m pixel is 0.508. Neighbours run from 0.487 to 0.748. NASA's 120 m map is 0.665. Ours is 0.767. Same method sentence. The three inside-mark rows quote the NASA pixel, scale, offset and no-data value.

New R2 rows (share of hours with any Earth). `de_gerlache_rim_best_lit` is outside the mark: NASA's 60 m pixel is 0.500, neighbours 0.112 to 0.610, the 120 m map is 0.530, ours is 0.610, and the same method sentence. The other four are inside.

| Site | Ours | NASA | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `connecting_ridge_best_lit` | 0.581888027 | 0.579400000 | +0.002488027 | no |
| `de_gerlache_rim_best_lit` | 0.610223642 | 0.500440000 | +0.109783642 | yes |
| `malapert_peak_best_lit` | 0.771356306 | 0.678480000 | +0.092876306 | no |
| `peak_near_shackleton_best_lit` | 0.442929408 | 0.434640000 | +0.008289408 | no |
| `shackleton_rim_best_lit` | 0.551251331 | 0.478640000 | +0.072611331 | no |

New R3 rows (slope, degrees). All five are inside the 2° mark. Explanations are the in-mark slope provenance: the unit tag is absent, NASA product 90 says degrees, and the file does not give the baseline, so it is not assumed equal to our 160 m central difference.

| Site | Ours | NASA | Difference | Outside mark |
| :--- | ---: | ---: | ---: | :--- |
| `connecting_ridge_best_lit` | 0.581659092 | 0.525682867 | +0.055976225 | no |
| `de_gerlache_rim_best_lit` | 2.693887354 | 1.791804075 | +0.902083278 | no |
| `malapert_peak_best_lit` | 2.448834609 | 2.670941591 | −0.222106983 | no |
| `peak_near_shackleton_best_lit` | 2.666082544 | 2.723110676 | −0.057028132 | no |
| `shackleton_rim_best_lit` | 5.799812470 | 5.988375187 | −0.188562717 | no |

R5 selects the first three catalog `sunlit_peak` ids, sorted by id, and never a variant. The rows are back to `connecting_ridge` (outside, 0.120816809), `de_gerlache_rim` (inside, 0.014725153) and `malapert_peak` (inside, 0.038990643). `connecting_ridge_best_lit` is not in R5. Against `origin/main`, every comparison that already existed is unchanged, including those three R5 rows, and `generated_utc` stays `2026-11-13T00:00:00Z`. The only added rows are R1, R2 and R3 for the five variants. G2 skips variants because they have no saved Horizons response; its measured value and sample count (2,103,360) are unchanged, and G1–G9 passed.

The candidate cache now hashes every `truesouth` module, the contract version and the rule parameters, plus the maps, the ephemeris, the site coordinates and the pixel. `git diff --stat 4608cac HEAD -- science/src/truesouth` is not empty (`contracts.py` and the worked-example modules arrived from main), so the published sites were recomputed under the new key with zero cache hits: 2469 s, exit 0. `git status` afterwards showed no change to the site files, so the new calculation reproduced the same bytes. Each of the five variants was then published twice from that cache (0 candidates computed). The five `*_best_lit` folders and `sites.json` hashed identical between the two runs, 21 files. A second attempt that recomputed the parent skylines ran out of memory and was not used.

The 20 existing sites' `series.bin`, `skyline.bin` and `terrain.bin` are byte-identical to the commit this branch started from. `sites.json` differs only by `variant_of`, `offset_m` and `nearby_sun` (null except on the five peaks and their variants) and the five new records. Scene files other than `meta.json` are byte-identical; five aprons were added. `data/derived/` was 62,193,036 bytes before and 72,108,557 bytes after.

IM-2 Athena, landing at 00:00 UTC, from `scoring.py`. Both points are GO on 2028-01-01 (score 100, fully lit). On 2028-03-01 both are NO-GO (score 40, darkness and blackout); the listed point has mean Sun 0.417 and a 130 h dark stretch, the variant 0.551 and 78 h, and both land in light. On 2028-03-08 both are NO-GO (score 40, darkness, blackout and a dark landing hour). The listed point is dark for the whole window (240 h). The variant still has mean Sun 0.714 and a longest dark stretch of 26 h, but the landing hour itself is dark.

`--only connecting_ridge` builds the listed site and `connecting_ridge_best_lit`. `--only connecting_ridge_best_lit` does the same, by selecting the catalog parent. `--only apollo11_best_lit` raises before any write, because Apollo 11 is not a core80 sunlit peak. The site picker lists each variant as an ordinary site in Sunlit peaks. The default selection for a new visitor is still Connecting Ridge plus three Artemis sites, and does not include a variant. Showing the nearby range and a variant label in the panels is another package.

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

#### 2026-11-14 · MC9c · Compare two sites at two landing dates
- **Who:** Claude Code agent, for the orchestrator, from a tester's request
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (a second mode
  in the approved C2 Compare window, no new colours) — wrote the spec section, the "Sites and
  dates" mode (`dates.ts`, `dates-view.tsx`, `mode-switch.tsx`, `picks-store.ts`,
  `probe.tsx`), the dates CSV and JSON exports, the `cmp` share parameter, the shared
  `LandingDateFields` and `clampLanding`, and 41 vitest tests (32 rule tests; 7 mounted on
  the shared fixture, comparing each column with the scoring engine and the Slip Planner's
  sweep for every preset) — checked by the agent with the vitest suite, typecheck and the
  build, and by eye at 1440 × 900, 1024 × 768 and 390 × 844 (default picks, one site at two
  dates, the pickers open, "Use this date", a copied link reopened in a fresh browser); a
  human has not reviewed it yet
- **State:** verified (reviewed by Cursor (grok-4.7): approve with fixes; 60 cases on fixture and real data matched the scoring engine, the Sites mode and Python; its must-fix (the summary said all four are NO-GO when a column had no result) and one can-follow (picked dates clamped again when the mission changes) fixed by the orchestrator; on the tree merged with main ccb1389: 471 Python tests (1 skipped), 2,834 web tests with 3 expected to fail on the fixture, typecheck and build all exit 0. Not yet tried by the team)
- **Changed:** `web/src/features/mission-control/compare/` (the new mode, its tests; the
  table takes an optional head, last row and best column; columns have a key and a date),
  `web/src/features/mission-control/share/share-link.ts` (adds `cmp` while the mode shows),
  `web/src/app/mission/landing-date-control.tsx` (the form's date and hour fields are now
  `LandingDateFields`, used by the strip's form unchanged and by Compare's pickers),
  `web/src/app/mission/landing-control.ts` (`clampLanding`), `docs/features/compare.md`,
  `docs/features/mission-control.md`, `docs/design/c2/built-compare-dates-*.png`, this entry
- **Notes:**
  - Labels: "Sites" (unchanged, the default) and "Sites and dates".
  - The best column: GO beats CAUTION beats NO-GO, then the higher printed score; ties all
    marked; none when every column is NO-GO, all four tie, or one is loading.
  - The share link carries the picks only through the Share button: the address bar is the
    scenario's, and the scenario store was left as it is. `docs/data-contracts.md`, which
    lists the link's parameters, does not list `cmp` yet (not this track's file).
#### 2026-11-14 · MC rail overlays · Popovers and hover cards leave the rail (the black box)
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — portalled `Popover` and `Tip` to the page's
  body with Tab bridged across (`overlay-host.ts`), kept a popover inside the window
  (`placePanel`), added `contain: paint` to the rail and the focused panel, built the
  `?diag=1` capture (`app/diag.ts`, F9) and four WebGL switches (`gl-switches.ts`), then
  reproduced the black box in installed Chrome under software compositing and fixed it
  with one CSS line (`.popover` background at 99 %), and wrote 25 vitest tests (Tab
  bridge, host, focus return, shell rules, portal mount, placement at 100/125/150 %
  zoom, the switches, and a CSS test that fails without the fix) — checked by the agent
  with typecheck, the vitest suite, the build and `uv run pytest`, and by window captures
  of its own test Chrome window (PrintWindow) before and after the fix; a human has not
  reviewed it yet
- **State:** verified (reviewed by Cursor (grok-4.7): approve; the box reproduced on main under software compositing (15,394 page-colour pixels), 0 on the branch, and back when only the opaque background was restored; on the tree merged with main 08d19ea: 458 Python tests (1 skipped), 2,490 web tests, typecheck and build all exit 0. Not yet confirmed on the team lead's machine, where the box also grows on hover)
  (1 skipped), typecheck, build; the box is gone here, only the team lead's laptop can
  confirm it is the same fault)
- **Changed:** `web/src/components/Popover.tsx`, `Tip.tsx`, `components.css`, new
  `overlay-host.ts` and its test, `web/src/app/shell.css`, new `web/src/app/diag.ts`,
  `web/src/main.tsx`, new `web/src/features/three/scene/gl-switches.ts` and its test,
  `scene-root.tsx`, `docs/decisions/0018-popover-background-not-opaque.md`,
  `docs/design/c2/built-rail-overlays-*.png`
- **Notes:**
  - **Reproduced.** Installed Chrome 157, a throwaway profile, `--force-device-scale-factor=1.25`,
    CSS viewport 1522 × 731, four sites, Slip Planner: fold the rail, press "+", hover rows.
    With `--disable-gpu-compositing` or `--use-angle=d3d9` (both report "Compositing:
    software"), a box of the scene shows `--space` instead of the Moon: CSS x up to 326, y 62
    to 318, growing when a row is hovered; gone when the list closes. Same in the Polar map.
    Not seen with D3D11, OpenGL, `--disable-direct-composition`, `DelegatedCompositing` on
    or off, or video overlays off. Chrome's own screenshot shows it too, so the fault is in
    Chrome's compositor, not the GPU's overlay planes.
  - **Cause and fix.** The popover is a scroller with an opaque background over a 1,570 px
    list; the software compositor treats it as covering what is under it and gets that
    region wrong. One at a time: a 99 % background, `overflow: visible`,
    `scrollbar-gutter: stable` or an inner scroller each remove it; no shadow, no radius,
    `isolation`, `contain: paint`, `translateZ(0)`, `preserveDrawingBuffer` and fresh WebGL
    frames do not. Kept the 99 % background (docs/decisions/0018). Checked after the fix with
    software compositing in Slip Planner and the Polar map, d3d9 and D3D11: no box.
  - The fresh-frames mitigation (4 frames, about 8 ms each on an RTX 2060 at 1902 × 913, per
    popover change) was built, then taken out: an A/B under the reproduction showed no effect.
  - The portal is kept as hardening, not as the fix (the box appeared with and without it).
  - **Diagnostic:** add `diag=1` to the address, make the box appear, press F9: a
    self-contained `.html` downloads (canvas pixels as they are and after a forced frame,
    the paint list, WebGL state, browser and display). Nothing is sent anywhere.
  - **Switches**, read once at load: `gl-preserve=1`, `gl-loop=always`, `gl-aa=0`,
    `gl-power=default`. Without them the scene is as before.
  - To confirm on the laptop: `chrome://gpu` should say "Compositing: Software only".

#### 2026-11-14 · MC testing feedback 3 · A steady bottom strip, the black box, the middle mouse button, "Enter coordinates"
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (keeping the
  approved look) — rebuilt the countdown cards' rows so the strip keeps one height, wrote
  the stretch chip, extended `pointers.ts` to the middle button, made the add-site picker's
  coordinates row a visible control, and wrote 20 vitest tests (a structure test of both
  cards for every hour kind from the fixture, which fails on the old cards, six
  middle-button tests and three for the coordinates row); investigated the black box;
  then fixed the review of PR #97 (Codex: request changes): the notes row could clip, the
  chip said "over" only in a tooltip, `aria-controls` pointed at a closed form, a slow
  validation test — checked by the agent with typecheck, the vitest suite, the build and
  `uv run pytest`, and by eye with
  hardware WebGL (NVIDIA, ANGLE D3D11) at 2000, 1440, 1024, folded and 390 px; a human has
  not reviewed it yet
- **State:** verified (reviewed by Codex (requested changes, all four addressed by the author); on the tree merged with main a35133f: 438 Python tests (1 skipped), 2,465 web tests, typecheck and build all exit 0. The black box is not fixed by this package: not reproduced; a follow-up moves the rail's popovers out of the rail)
  build pass on the merge with main; the team lead has not seen it)
- **Changed:** `web/src/app/mission/timeline/countdowns.tsx` and a new `countdowns.test.ts`,
  `timeline/timeline.css`, `web/src/app/shell.css` (containment on the countdown column),
  `web/src/features/three/scene/pointers.ts` and its test, three props and the spoken hint
  in `scene-root.tsx`, two hints in `web/src/lib/explain.ts`, `custom-site-ui.tsx` (the
  closed row only), `sites.css`, a new `custom-coordinates.test.ts`, two no-ops in
  `fake-dom.ts`, `docs/features/site-detail.md`, `mission-control.md`, `polar-map.md`,
  `docs/challenge.md`, `docs/design/c2/built-feedback3-*.png`
- **Notes:**
  - The strip: each card's rows are now the same at every hour (head, countdown, values, a
    notes row of exactly two lines, filled from the bottom, never clipped). Line one: the
    dark stretch or blackout as a chip that says it in words, "✕ 130 h · over the 6 h limit"
    or "4 h · within the 12 h limit" (and "338 h · within 432 h" when that is too wide), the fullest wording that fits the 158 px card (a
    measured glyph-width budget, tested for every preset and limits up to 100,000 h against
    stretches up to 52,584 h); its full sentence is its screen-reader text. Line two: the
    limit's provenance tag and "Under 6 h" (they coexist at the end of a dark stretch). Measured 196 px at 1440 and 244 px at 1024 at lit, warning, dark
    and blackout hours and while playing across a sunset (was 196 to 237 at 1440); folded
    50 px; phone 180 px. In the Slip Planner the slot holds its landing-date panel: 204 px at
    1440 against the timeline's 196 px, steady when switching views back and forth (sampled
    every 250 ms, no in-between heights).
  - The black box did **not** reproduce here, with the team lead's exact steps (fold the
    sites rail, press its "+", hover a picker row and a rail lamp). Tried: the reported commit
    c5ec7a9 and current main, dev and production builds; 950 to 2560 px wide, 640 to 1300 px
    tall; scaling 1×, 1.1, 1.25 and 1.5; the four camera views and the Polar map; the focused
    panel open and folded; Chrome with SwiftShader and with the GPU off; the CPU throttled 6×
    and 20× so the quality governor steps down; and captures of the real window with
    Windows' PrintWindow (which includes hardware overlay planes that Chrome's screenshots
    miss). Each time: the point under the box is the scene's canvas (or the flat map's), the
    WebGL viewport is the whole canvas, the scissor test is off, the drawing buffer matches the
    canvas, and the free space does not change when a popover or hover card opens (popovers
    and tips are never covers in `readShell`). The box's shape (the bounding box of the open
    popover and hover card) points at the browser's compositor on the team lead's setup. No
    fix was made without a reproduction; the pull request has "How to capture it".
  - "Enter coordinates": an outlined full-width row with a crosshair at the top of the
    add-site picker, closed by default; one click opens the form with focus in the latitude
    field; "Not available on this server" under the label when the server has no custom
    sites. The form and its requests are unchanged.
  - The middle mouse button turns like the left (`MIDDLE_BUTTON_DRAG` in `pointers.ts`
    flips it to slide in one line), in every view including the Slip Planner; a middle click
    does nothing; the browser's own middle click is prevented over the scene.

#### 2026-11-14 · MC9b · Compare: the table gets the space
- **Who:** Claude Code agent, for the orchestrator, from the team lead's feedback
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (a refinement
  of the approved C2 window, no redesign) — removed the window's explanation and summary
  sentence from the screen (both kept as accessible descriptions), put the landing date and
  the exports in a one-row header through a small header slot on `FloatingWindow`, wrote the
  temporary fold of the bottom strip while Compare is open (`windowFoldFor`, `toggleStrip`
  in `shell-layout.ts`), trimmed the table's vertical padding, clamped the best-lit line to
  two lines, replaced the copied site wording with imports from `site-labels.ts`, updated the
  specs, and wrote 10 vitest tests (9 for the fold rule; 1 for the header on the real window) —
  checked by the agent with typecheck, the vitest suite, the build and `uv run pytest`, and
  by eye at 1440 × 900, 1024 × 768 and 390 × 844 with one, four and eight sites, the strip
  open before Compare opened, in a camera view and in the Slip Planner, with the strip
  folded by the user and unfolded by hand; a human has not reviewed it yet
- **State:** verified (reviewed by Antigravity (gemini-4-hydrogen): approve, two mutations killed; on the tree merged with main d9ea075: 438 Python tests (1 skipped), web tests, typecheck and build all exit 0)
- **Changed:** `web/src/features/mission-control/compare/` (header items, hidden summary,
  padding, the shared wording; `site-wording.ts` deleted),
  `web/src/app/mission/floating-window.tsx` (an optional header slot and a hidden
  description), `web/src/app/mission/shell-layout.ts` and `shell-layout.test.ts` (the
  temporary fold), `web/src/app/mission-screen.tsx` (the fold wired in; Compare's
  description hidden), `web/src/app/shell.css` (the header slot), `docs/features/compare.md`,
  `docs/features/mission-control.md`, `docs/design/c2/built-compare-space-*.png`, this entry
- **Notes:**
  - Table rows fully visible with four sites, the strip open before Compare opened:
    1440 × 900 from 2 of 9 to 5 of 9 (the table's height from 343 px to 562 px; it needs
    781 px); 1024 × 768 from 1 of 9 to 4 of 9 (280 px to 438 px). All nine rows at 1440 × 900
    would need about 220 px more: the rest is content (the Broken rule row wraps in 135 px
    columns between the open side panels), not padding.
  - The temporary fold is never saved; closing Compare returns the strip, timeline or Slip
    Planner panel, to the same place, so the camera's free space is unchanged (checked by
    rectangle).
#### 2026-11-13 · MC7 · The Slip Planner, a camera view on the Moon
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (design already
  picked; critique pass run) — moved the Slip Planner from the windows to the camera views;
  wrote its camera pose, orbit and zoom limits and fixed drawing light, the spots with the
  close-sites rules, the off-view notes, the landing-date panel (Canvas strips, "Any site",
  "next GO", slider, keys, hover readouts, zoom, fold), the before-and-after state, the 3D-off
  ground, the average-sunlight shading and vitest tests — checked by the agent with
  typecheck, the vitest suite (including the spot = strip = hover = sites rail agreement test
  on every fixture site), the build, and by eye in headless Chrome on the machine's GPU on
  the real data at 1440 × 900, 1024 × 768 and 390 × 844; a human has not reviewed it yet
- **State:** verified (2,317 web tests, typecheck and build (the sweep worker emitted once) pass on the merge with main (the orchestrator's run), and 425 Python tests on the same tree (the builder's run); reviewed by Cursor, which compared the sweep with the ordinary evaluation for every fixture site, two profiles and more than 60 landing days, and checked dates in two other time zones; seven findings fixed with tests (Any site while sites compute; a landing not at 00:00 UTC; spots equal the sites rail during a profile change; a failed sweep; the shading label); it absorbed the scene polish, the flat Polar map (its 3D-off view now uses the real map) and the ground's look; seen by the builder on hardware WebGL; not yet tried by the team lead)
- **Changed:** `web/src/features/mission-control/slip-planner/` (new), `web/src/lib/scoring/`
  (`slip-days.ts` new; `next-go.ts`, `next-go.test.ts` and `index.ts` byte-for-byte as in
  #83), `web/src/features/three/scene/` (`slip.ts`
  and its test new; small additions to `rig.ts`, `world.ts`, `materials.ts`,
  `scene-root.tsx`), `web/src/app/scene.ts` (optional `onProjector`, `slipShading`),
  `web/src/app/mission/` (`views.ts`, `scene-slot.tsx`, `scene-status.ts`, `view-bar.tsx`
  comment, three tests), `web/src/app/mission-screen.tsx`, `web/src/components/StatusLamp.tsx`
  (exports `GLYPH`), `web/src/app/mission/landing-control.ts` and its two tests (the
  no-GO wording), `web/src/features/three/scene/world.ts` (a comment for the ground look),
  `web/src/app/mission/scene-slot.tsx` and its new test, `web/src/app/scene.ts`
  (`FlatLayerProps`), `web/src/features/polar-map/map.tsx` (the `readouts` prop),
  `web/src/lib/explain.ts` (the Slip Planner's controls hint),
  `web/vite.config.ts` (the worker build input is gone), `docs/features/site-detail.md`,
  `docs/features/slip-planner.md`, `docs/design/c2/built-slip-*.png`, this entry
- **Notes:**
  - Every status, score and veto is the sweep's (`useSweeps`), packed per 00:00 UTC day by
    `lib/scoring/slip-days.ts` from `evaluationAt`. No new scoring code. "next GO" is #83's
    shared `nextGoDay` (`lib/scoring/next-go.ts`, copied unchanged so that merge is a
    no-op), read over the packed day table by `slip-planner/next-go-words.ts`.
  - The landing date is read and written only through the scenario store. The panel header
    has an empty `data-slot="landing-date-control"` for `LandingDateControl`.
  - 3D off: the scene still reports no flat views; the shell's still picture is skipped for
    this view only and the Slip Planner draws a dimmed polar relief under the same spots,
    with the spec's note. T7's flat Polar map should take that place: it needs to accept
    sites to place (or expose the same `SceneProjector` as the 3D scene), hide crater
    names in this view, and draw the average-sunlight layer when asked.
  - A view opened from a link refits when its first (locked) flight lands, since the sites
    and the free space can arrive during it.
  - The build emits the sweep worker once (`dist/assets/sweep.worker-*.js`).
  - Checks on 2026-11-14 after merging `origin/main` (#78, #79, #82): `pnpm --dir web test`
    (1,811 passed), `typecheck`, `build` and `uv run pytest -q` (322 passed), each exit 0.
    Eight sites with VIPER's 100-day profile recompute (sweep and day table, in turn, on
    the full 2,191-day grid) in 113 to 188 ms on a Ryzen 7 3700X. By eye in headless Chrome:
    no site, every date NO-GO, a 06:00 landing (the "00:00 UTC" note), the 1.4 s flight
    (0.12 s with reduced motion, nothing pulsing), every control named, no horizontal scroll,
    and 44 px touch targets on the phone.
  - On the phone the strip rows are 12 px tall: the spec makes the whole strip area one
    touch target, so they leave the tab order and the slider knob is the keyboard path.
  - Review round 1 (Cursor, request changes; 2026-11-14), all fixed on this branch:
    - One source: every status, rule and score a user reads for a site and a landing hour
      comes from the rail's `cachedEvaluation` (`slip-planner/landing-results.ts`). A spot
      therefore equals the rail even while a new profile's sweep runs; the strips never show
      the previous profile's sweep; the packed Float32 score is never shown (IM-2 days where
      it floors one higher: sphere 30, edge 1476, wide 1584; every day of one site tested).
    - "Any site" is GO as soon as a known site is GO; CAUTION, NO-GO and "no GO before…"
      wait for every site; the hover, `aria-valuetext` and "next GO" follow the same rule.
    - A landing not at 00:00 UTC: the header, folded row, slider words and row lamps read
      the real landing; strips, hovers and "next GO" are 00:00 UTC and say so; the note
      shows open (over the row names), folded and on the phone.
    - A failed sweep is its own state, with Retry; "Any site" works from the others.
    - The shading keeps a (short) label when the free space has no room for the controls.
    - `panel-mount.test.ts` mounts the panel and the spots with the real hooks: no new sweep
      and no redraw while the date moves in range; spot = rail before a new sweep answers;
      the 06:00 note in three layouts; a failed sweep and Retry.
  - After #83: the header mounts `LandingDateControl` (the panel's own mission-window line
    is gone). The button's no-GO line now reads "No later GO before 2032"
    (`app/mission/landing-control.ts`, its two tests, `site-detail.md`), so it never
    contradicts "GO on this date" beside it.
  - Checked by eye with the real data in headless Chrome (one browser, closed between runs):
    1440, 1024 with eight sites including two best-lit variants (no label or spot overlap;
    the variants keep their names on hover), the phone and the folded row at 06:00; the
    computing state after a profile change was read from the page (the progress bar,
    "computing…", "Still computing 4 of 4 sites.", spots equal to the rail), not
    photographed: a slowed browser could not take the picture in time.
  - After #88: the Slip Planner is an entry of the rig's per-view table
    (`ORBIT_STYLE.slip = "centre"`): orbit about the sites' centre 28° to 88° up; zoom along
    the line to that centre, 60 to 2,600 km, keeping the aim (not toward the pointer); no
    pan, so the sites never leave the view; a double-click frames them again; its About text
    has its own controls hint. Checked with hardware WebGL (ANGLE, RTX 2060): the flight in
    lands on the fixed light, drag and zoom work, and leaving to each of the four other
    views brings back the real Sun (uSun equals the Sun's direction) and coming back the
    fixed light; the System view still turns freely over the pole; stars stay above the
    limb, dimmed, never over the ground.
  - After #89: one flat-layer mechanism. The Slip Planner is a flat layer of the scene slot
    (`SLIP_PLANNER_LAYER`, beside `POLAR_MAP_LAYER`); the slot takes one layer or a list and
    gives each `canTryAgain` and `onTryAgain` (two additive `FlatLayerProps` fields); the
    slot's render-prop child and the `scene-status.ts` exception are gone. With 3D off the
    view mounts the Polar map's `MapCore` (no pins of its own, no crater names, its
    "sunlight" overlay following the shading switch, its projector placing the spots); the
    dimmed-relief stand-in and `flat.ts` are gone. One additive prop in
    `features/polar-map/map.tsx`: `readouts` (false: no point readout on click or Enter, no
    nudge on N, no hover readout). Our foot plates sit above the map's control plate, whose
    legend carries the "not for your date" label. Variant labels use the map's words
    ("Best-lit map pixel, 149 m from …", from `offset_m`). Checked by eye: `view=map` opens
    the flat map; `view=slip` with 3D off shows the map, the placed spots, the panel and the
    note; Polar map and Slip Planner in both orders, in 3D and with 3D off, leave exactly one
    layer mounted; a click on the map in the Slip Planner opens no readout.
  - After #91 (the ground look): the ground's light (`uLight`) is the Moon's own `uSun`
    uniform, which this view blends to its fixed light, so the site's ground is lit by the
    fixed vector at `slip = 1` and gets the real Sun back with the Moon on leaving (tested on
    the World's uniforms). Its fade is now multiplied by `1 − slip` instead of being cut when
    the view changes, so it fades out as the fixed light blends in and none is drawn at
    `slip = 1` (no drawn shadow there). Checked by eye with hardware WebGL, Local terrain to
    Slip Planner and back. #91's decoration plate shows in Local terrain only, not here.
  - Fixed while checking: the #89 change cleared the foot plates' `top` in 3D, which left the
    shading switch above the window and hid every spot label; a mount test now guards it.

#### 2026-11-14 · MC-sites · Custom coordinates, best-lit variant labels and the nearby range
- **Who:** Claude Code agent (Opus 5.5), for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the custom-site client, job store,
  the coordinates form, the rail's computing rows, the focused-site panel's notes, their
  tests and these doc changes — checked with vitest (client against every documented
  status and error with a mocked `fetch`; store; form; row states; labels with made-up
  and real 25-site data), typecheck, and by eye in the browser at 1440 × 900, 1024 × 768
  and 390 × 844, against the PR #80 server running on the real prepared maps
- **State:** verified (425 Python tests, 2,241 web tests, typecheck and build pass on the merge with main; reviewed by Codex (all five variant labels and ranges match the data; no custom file is requested before a job is ready; three mutations caught); six findings fixed with tests (a compute request is sent only on a button press, with the counts recorded; an answer about another place is refused; ready sites and names are validated; removal frees polling and data; polling backs off and announces once per change; invalid ids in links are dropped); run end to end by the builder against the merged server on the real terrain, including Compute this site on the Polar map; not yet tried by the team lead)
- **Changed:** `web/src/data/custom-sites.ts`, `web/src/state/custom-sites.ts`,
  `web/src/data/hooks.ts` (`useSites` merges ready custom sites; `useCatalogSites`),
  `web/src/state/data.ts` (a custom site's files wait for its job), `web/src/app/mission/`
  (`sites-rail.tsx`, `focused-site-panel.tsx`, `site-status.ts`, new `custom-site-*.ts(x)`,
  `site-labels.ts`, `sites.css`), `web/src/components/Popover.tsx` (`placement="auto"`),
  docs, screenshots `docs/design/c2/built-sites-*.png`
- **Notes:**
  - Real run: −88.5, 45 queued about 25 s while the server loaded its maps, then ran about
    50 s; −87.75, 200.5 took about 40 s; 2.5, 334.75 was a smooth-Moon site in under 5 s.
    Status, timeline, countdowns, the "why is it dark" card, the scene's pin, Local terrain
    (own `terrain.bin`, no apron) and Lander's eye all read them.
  - The Polar map's "Compute this site": the shell passes `useRequestCustomSite()` from
    `custom-site-actions.ts` as `onRequestSite`.
  - Shared wording for Compare: `web/src/app/mission/site-labels.ts` (`CHOSEN_TAG`,
    `variantLine`, `upperReadingLine`, `nearbyRangeText`, `ARTEMIS_NOTE`).
  - Not mine, seen while testing: Local terrain says the apron "could not be loaded" for a
    custom site, which never has one; the timeline shows "Loading the hourly data…" while a
    focused custom site is not computed yet.
  - Review fixes (Codex review of #92): a POST only on a button press (polling, links,
    remounts, focus and reconnecting are GET; counted in tests); answers must name the id
    the server's rules make for the coordinates sent (`web/src/data/custom-site-id.ts`
    ports `site_id` and its Python rounding); ready sites validated field by field; names
    cleaned of control and bidirectional characters, 60 characters, shown isolated;
    remove, failure and Stop waiting release polling, waiters, files and scores; request
    timeouts, back-off, no polling while hidden, `Retry-After` kept to 1 s to 1 h; one
    shared clock and one announcement per change of state; non-canonical ids in links are
    left out with one notice.
  - The Polar map's "Compute this site" is wired (`useRequestCustomSite()` in
    `mission-screen.tsx`); the map gets no callback until `/api/health` says custom sites
    work, checked once when the Polar map view first opens. A ready custom pin carries
    "Your site" (one line in `features/polar-map/draw.ts`).
  - Not doable on the web side without the scene: Local terrain's apron message for a
    custom site (`useApron` has no "none" state the scene reads).

#### 2026-11-14 · MC9 · The Compare window, share, CSV and JSON export, confirmed NASA links
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (building the
  approved C2 window, no redesign) — wrote the Compare model and table, the CSV and scenario
  JSON exports, the Share button with its hand-copy fallback, the NASA link builders, 47
  vitest tests and the spec edits; a background research agent read the QuickMap and Moon
  Trek bundles for their link parameters — checked by the agent with typecheck, the vitest
  suite, the build and `uv run pytest`; by opening both NASA links for Apollo 11 and
  Connecting Ridge and reading each tool's own coordinate readout; and by eye at 1440 × 900,
  1024 × 768 and 390 × 844 with four, eight, one and best-lit sites, keyboard only, real
  downloads read back with Python's csv module, and a copied link opened in a fresh browser
  context. Reviewed by Gemini (request changes, two defects; substance confirmed on real
  data); the agent then fixed all eight review items: the Share fallback moved into the
  shell's popover, CSV formula injection, the variant's "not ranked" sentence, the shared
  site wording and rounding, rendered-panel tests, the summary and Sun-at-landing edges, the
  CSV's precision note, and custom sites. A human has not reviewed it yet
- **State:** verified (2,091 web tests, typecheck and build pass on the merge with main (the orchestrator's run), and 425 Python tests (the builder's run); reviewed by Gemini, which checked every cell against the focused-site panel and a direct evaluation on real data, parsed both exports and checked the NASA links' projection; eight findings fixed with tests (the Share fallback is no longer covered and Escape closes only it; CSV text cells that begin like a formula are neutralised; the best-lit point's missing mark is explained; ranges round outward); not yet tried by the team lead)
- **Changed:** `web/src/features/mission-control/compare/` (model, table, exports, tests),
  `web/src/features/mission-control/share/` (new: Share button, link, NASA links, tests),
  `web/src/lib/export/` (new: CSV writer and reader, with the formula guard),
  `web/src/components/Popover.tsx` (an optional handle to open it from code),
  `web/src/app/mission/top-bar.tsx`
  (Share moved out to its own component; merged with #83, so the app bar holds the brand,
  the mode switch, the profile and Share), `web/src/lib/explain.ts` (Compare's text),
  `docs/features/compare.md`, `docs/features/share-export.md`,
  `docs/features/mission-control.md`, `docs/build-plan.md`,
  `docs/design/c2/built-compare-*.png`, this entry
- **Notes:**
  - Each column is built from the focused-site panel's own functions (`useSiteStatus`,
    `describeEvaluation`, `describeMetrics`, `scoreText`); a test checks every cell
    against the panel for five presets and three dates on the fixture.
  - Spec changes: up to eight sites (the rail's limit), not four; the summary and the
    export buttons sit in the window's body; the Timeline, Skyline and Nearby dates rows
    are deferred. The Timeline CSV, the Slip Planner CSV and the PNG export are not built.
  - Share copies a link built from the store, because the address bar can lag a scrub by
    up to 250 ms.
  - NASA links: QuickMap moved to `quickmap.lroc.im-ldi.com`; both tools open in their
    south-pole projection south of 80° S. The formats are in `share-export.md`. The links
    are in the Compare table only; adding them to the focused-site panel is a follow-up.
  - A scrub does not re-render the table (a render-count test).
  - The variant and nearby-range words are copied into `compare/site-wording.ts` from the
    sites package's `site-labels.ts` (#92); import them from there once #92 is on main.
  - Every CSV string cell that would run as a formula gets a leading `'`; numbers never do.

#### 2026-11-14 · MC shell feedback · No view sentence; the landing date joins the timeline; "Next GO"
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
  then fixed the review of PR #83 (Cursor, approve with fixes): the window's end and the
  duration's tag at every width, the note cleared on a site or profile change, a clamping
  Undo test (fails without the restore), focusable reasons at the ends of the grid, the
  scrubber's pill hiding the day labels under it, and a fake DOM that honours `disabled` —
  checked again by eye at 1440 × 900, 1024 × 768 (open and folded) and 390 × 844, keyboard
  only on the control and the picker sheet; a human has not reviewed it yet
- **State:** verified (333 Python tests, 1,900 web tests, typecheck and build pass on the merge with main; reviewed by Cursor (Next GO equals the ordinary evaluation on three fixture sites and two profiles; time zones; two mutations caught); six findings fixed: the window's end and the duration's tag show at every width, the note clears on a site or profile change, Undo is tested where the time clamps, disabled buttons give a reason, the pill no longer covers day labels; the layout is not yet judged by the team lead)
  build pass on the merge with main; the team lead has not judged the layout)
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
  - The header shows, after the date, "→ 11 Mar · 10 d [sourced]": where the window ends,
    its length and the duration's tag, in the open, folded and phone strips; screen readers
    hear "Mission window ends 11 Mar 2028 00:00 UTC, 10 d after landing." To keep the open
    header at one row at 1440, "Slip +7 d" and "+14 d" live in the date's picker.
  - At the ends of the grid the day and slip buttons stay focusable, do nothing, and give
    the reason with the real dates ("The data starts at 2026-01-01 00:00 UTC …").
  - Not done: a draggable start of the window on the timeline (the timeline's range follows
    the landing, so a handle would drag its own axis), and a "Previous GO" twin.

#### 2026-11-14 · MC6b · Lander's eye: the horizon chart folds away, closed by default
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (keeping the
  approved look) — wrote the fold (one arrow button in the panel's foot row, the session
  memory, the rise), the shell's measurement of the foot stack, and 12 vitest tests — checked
  by the agent with typecheck, the vitest suite, the build and `uv run pytest`, and by eye
  with hardware WebGL at 1440 × 900, 1024 × 768 and 390 × 844, folded and open, lit and dark
  hours, Apollo 11, keyboard only and reduced motion; a human has not reviewed it yet
- **State:** verified (322 Python tests, 1,756 web tests, typecheck and build pass on the merge with main; reviewed by Gemini (approve with fixes; two mutations caught); the orchestrator made the two small fixes: no aria-controls while the chart is unmounted, and the foot stack is left out of the free space while a window is open; asked for by the team lead, not yet seen by them)
- **Changed:** `web/src/features/panorama/` (new `fold.ts`, `fold.test.ts`,
  `collapse.test.ts`; `index.tsx`, `panorama.css`), `web/src/app/mission-screen.tsx` (the
  free space ends at the foot stack's top), `docs/features/panorama.md`,
  `docs/design/c2/built-landers-eye-collapsed-*.png`, this entry
- **Notes:**
  - In Mission Control the chart starts folded: one 46 px row with the arrow ("Horizon
    chart", named "Show the horizon chart") and the panel's one-line answer. In a lesson it
    is always open, with no arrow.
  - The arrow sits at the start of the foot row in both states and does not move (measured
    0 px at 1440 × 900); the chart rises above the row.
  - Kept in sessionStorage (`truesouth.landers-eye-chart.v1`), with the shell's load and save
    pattern. The shell's side panels use localStorage, which would carry the choice into a
    new visit; the brief asked for a fresh visit to start folded.
  - The free space reads the foot stack, which is already where the panel ends up, so the
    camera reframes once with no jump at the end of the rise.

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

#### 2026-11-14 · System view orbits · Faint orbit lines for the Moon and Earth
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote `orbits.ts` (the two circles and the line
  object), a small hook in `world.ts`, the True-scale glide fade (`proportions.ts`,
  `screenDisc`, `discInside`, `discLeaving`), one line in `scene-root.tsx`, the About sentence,
  the spec text and `orbits.test.ts` (run over the real `data/derived/system.bin`) — checked
  by the agent with the vitest suite (a mutation removing the glide fade fails it), typecheck,
  build, and by eye in Chrome with hardware WebGL (RTX 2060) at 1440 × 900 and 1024 × 768
  against `main` (1c3b3b6) run side by side, with the True-scale toggle sampled frame by
  frame; a human has not reviewed it
- **State:** built, not verified
- **Changed:** `web/src/features/three/scene/orbits.ts` and `orbits.test.ts` (new),
  `world.ts` (construct, place and fade the lines; Earth's glide fade), `proportions.ts`
  (screen-disc helpers; a comment on the distance curve's joins), `scene-root.tsx` (one line:
  the free space to the world), `web/src/lib/explain.ts` (`system_view`),
  `docs/features/system-view.md`, `docs/design/c2/built-system-orbits-*.png`, this entry;
  after review, `rig.ts`, `drag-directions.test.ts` and `docs/features/slip-planner.md` (the
  Slip Planner's first drag)
- **Notes:**
  - **The lines:** the Moon's orbit is the circle centred on the drawn Earth through the
    Moon's centre; Earth's orbit is the circle centred on the drawn Sun through Earth's centre.
    Each lies in the plane through its two bodies that is nearest the Moon's equator; Earth
    and the Sun stay within about 7° of that plane, so it is always defined and turns at most
    0.2° from one hour to the next over the whole series (tested). Drawings at the schematic
    distances, not computed orbits; the About text says "Sizes, distances and orbit lines are
    not to scale" (263 characters).
  - **Look:** the Ridge Line grey (`--terrain-rim`) mixed 32 % into Night, opaque one-pixel
    lines drawn first without depth writes, so every body, guide, sight-line and label covers
    them; the parts inside the Moon or Earth are left out, so they stop at the limbs. No
    dashes, labels or controls.
  - **Where:** the System view only; they fade (180 ms) on the flight to any other view and
    with the camera's descent to the ground. At true scale the Moon's orbit stays (a circle of
    221 Moon radii through the Moon about Earth); Earth's orbit is hidden, since the Sun is
    only a direction there.
  - **Cost:** two `LineSegments` of 256 segments (512 vertices each), one fixed buffer each,
    rewritten only when the bodies' drawn places change (the hour, or the True-scale glide);
    at rest nothing is rewritten and no frame is asked for (tested; 0 frames in 1.2 s at rest
    in the browser).
  - **Cursor's note on #111:** during the True-scale glide Earth now fades whenever its disc is
    outside the free space, or would be at its current speed on screen within 360 ms (twice the
    fade, since the flight's ease still accelerates when Earth leaves). Sampled every frame
    both ways at both sizes: Earth outside the free space on 46 to 67 frames per toggle, shown
    on none of them; fully back at the end. The join note needs no change; a comment says so.
  - **Review of #115 (Codex), two geometry fixes:** the limb rule tested each step's two ends
    only, so 366 kept steps of Earth's orbit passed through the Moon over the series (to 0.94
    Moon radii from its centre), and at true scale, where a step is 5.4 Moon radii long, the
    Moon's orbit stopped 4 to 4.7 radii short of the limb. Each step is now cut where it meets
    the Moon's or Earth's sphere (and split if it passes through), so the lines end on the limbs
    whatever the step length. The test now sweeps every hour in both arrangements: no segment
    comes nearer either centre than its radius, each line has exactly two ends on its limb
    (within 1e-9 radii), and the Moon's orbit ends on the limb at the series' extremes. Three
    mutations (keep a chord through a body; drop a crossing step whole; no cut) each fail it.
    In the browser the Moon's orbit ends 0.99999997 Moon radii from the centre (Float32) in
    both arrangements. Even spacing kept: at true scale the circle near the Moon shows no
    facets by eye. `update` now reuses scratch arrays and allocates nothing. Visible change:
    Earth's orbit now meets Earth's disc instead of stopping up to a step short (273 pixels at
    1440 at the opening); the `after-*` captures are retaken, `compare-opening` is the first
    round's.
  - **Slip Planner's first drag (separate commit):** `slipMove` looked straight at the sites'
    centre, but the fit aims 0.2 of the free space above it, so the first drag jumped 83 px at
    1440 × 900. It now keeps the camera's offset from that look. A new test drags (0, 0) and
    small steps right after the pose (the old code fails it at 82.9 px); in the browser the
    centre stays at (684, 444) through a drag of nothing, a 3 px turn and a real 3 px drag.

#### 2026-11-14 · Drag directions · The picture follows the pointer in every view
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — measured every view's drag direction on the real
  rig and in Chrome, fixed the Slip Planner's horizontal turn in `rig.ts`, wrote the
  table-driven `drag-directions.test.ts` and the spec text — checked by the agent with the
  vitest suite (two mutations, the Slip Planner's sign and Lander's eye's vertical sign, each
  fail the table), typecheck, build, and by eye in Chrome (RTX 2060) at 1440 × 900 with real
  mouse drags (left and middle button) and touch emulation; a human has not reviewed it
- **State:** verified (reviewed by Cursor (grok-4.7): directions recomputed per view and input, every caller of Rig.orbit traced, three mutations caught; its one must-fix (an older test still pinning the old Lander's eye vertical) fixed by the orchestrator; on the tree merged with main 1c3b3b6: 471 Python tests (1 skipped), 2,754 web tests, typecheck and build all exit 0. Follow-up: the Slip Planner's first drag snaps about 85 px (slipMove aims at the centre, the pose aims above it))
- **Changed:** `web/src/features/three/scene/rig.ts` (one sign), `drag-directions.test.ts`
  (new), `docs/features/system-view.md` (the contract table), `slip-planner.md`,
  `local-terrain.md`, `panorama.md`, this entry
- **Added by the orchestrator:** the tester reported Lander's eye's vertical drag as
  inverted, and the agent had left it as it was. A vertical drag there now looks the way of
  the drag (drag up, look up); arrow keys are unchanged (`rig.ts`, a `fromKey` argument
  passed from `scene-root.tsx`; the table test states the exception and checks the arrows)
- **Taken back, 2026-11-14:** the team tried that change and asked for it to be reverted.
  Lander's eye follows the pointer on both axes again, as the agent had left it (dragging up
  moves the horizon up); the `fromKey` argument and the test's exception are removed
- **Notes:**
  - **The contract** (from the System view as on `main`): whatever is under the pointer moves
    the way the pointer moves, on both axes; for an orbit, the ground nearest the viewer; for
    Lander's eye, the scene ahead. Middle button = left button; right button, Shift and two
    fingers slide in the System view and turn elsewhere (two fingers do nothing there); the
    wheel zooms; an arrow key moves the camera the arrow's way (the picture the other way).
  - **Measured before the fix** (screen motion of the grabbed point for a 60 px right or 40 px
    down drag, left/middle/touch alike): System view +47 / +28 px; Follow site +56 / +36;
    Slip Planner **−57** / +29 (horizontal reversed); Local terrain +33 / +2; Lander's eye
    +106 / +47; the Polar map's flat map +80 / +50 for an 80 / 50 px drag (d3-zoom). After:
    Slip Planner +57 / +29, the rest unchanged.
  - **The fix:** the Slip Planner turned the camera's azimuth the other way from Local terrain
    (`slip.ts` moves it by −dx); the rig now passes −dx. Speeds, limits and zoom unchanged.
  - **Lander's eye:** already follows the pointer on both axes, by the rig's maths and with
    real mouse and touch drags (dragging up moves the horizon up, so the view looks down; the
    tester called the horizontal, which follows the same rule, good). Left as it is, as
    recommended; if the tester means "drag up to look up", that is the opposite rule on one
    axis only and is a one-sign change in `rig.ts` (the `el` line in the look-around).
  - Seen but not changed (outside this package): the first drag after flying into the Slip
    Planner snaps the camera's aim onto the sites' centre (about 90 px vertical) before it
    turns; it was there before the fix too.

#### 2026-11-14 · System view · Earth a little smaller and farther, so the Moon leads
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — retuned the constants in
  `web/src/features/three/scene/proportions.ts` (Earth's drawn size and its own distance law;
  the Sun's law unchanged) and the opening pose in `camera.ts` (lean), updated their vitest
  tests (run over the real `data/derived/system.bin`) and the spec — checked by the agent with
  the vitest suite, typecheck, build, and by eye in Chrome with hardware WebGL (RTX 2060) at
  1440 × 900 and 1024 × 768 against `main` (bbc6df0) run side by side, with the True-scale
  toggle sampled frame by frame both ways; a human has not reviewed it
- **State:** verified (reviewed by Cursor (grok-4.7): approve with two can-follow notes; the Sun's drawn distance equal to main at all 52,584 hours, Earth 0.77 to 0.82 times the Moon on screen, the opening's guarantees recomputed in four layouts, no drawn body over the Moon at 1,093 sampled cameras; on the tree merged with main 0fe9217: 471 Python tests (1 skipped), 2,651 web tests, typecheck and build all exit 0. Follow-up queued: fade Earth while it is outside the free space during the True-scale flight)
- **Changed:** `web/src/features/three/scene/proportions.ts`, `camera.ts` (the opening's lean
  and fit), `proportions.test.ts`, `scene-logic.test.ts`, `docs/features/system-view.md`,
  `docs/design/c2/built-system-earth-tune-*.png`, this entry; `world.ts` untouched
- **Notes:**
  - **Earth's size:** drawn 0.83 Moon radii (was 1.005), now smaller than the Moon by the
    team's choice; Earth stays smaller than the Sun, and "True scale" is unchanged. In the
    opening it shows 0.80 times the Moon at 1440 × 900 and 0.81 at 1024 × 768.
  - **Earth's distance:** its own law, 0.4125 × (d ÷ Moon radius)^0.385: 3.20 to 3.37 Moon
    radii out (was 2.89 to 3.04). Not 3.5: the Moon's size wins, and at 1024 × 768 the Moon
    would drop below 45 px past about 3.37 at apogee. The lean went from 12° to 15°, so Earth
    sits a little deeper than the Moon; the opening's fit now counts Earth's sideways reach as
    projected under the lean.
  - **The Sun:** exactly as before (0.372 × the same power, radius 3.5; 29.3 to 29.8 Moon
    radii), tested hour by hour. A log-log segment between 1 and 100 million km joins the two
    laws, so a further body is always drawn further. The Sun is 8.7 to 9.3 times Earth's
    distance (never under 8); the orbit margin (the Sun's nearest surface over the diameter
    of the circle the Moon traces around Earth) is at least 3.35.
  - **Opening, measured in the app** (Moon / Earth, landing date, panels open): 1440 × 900
    94.2 / 74.9 px (`main` 95.2 / 92.9); 1024 × 768 44.7 / 36.4 px (`main` 45.1 / 44.8). From
    the test layouts the Moon is 94.4 and 44.7 px.
  - **One claim changed:** a "To Earth" mark from a site far from the line to Earth now passes
    just beside Earth's smaller disc (within one Moon radius of its centre), where before it
    passed through it. The Sun's disc is still hit from every site. In the opening it points
    at Earth on screen.
  - **True-scale toggle, by eye, from the opening at both sizes, both ways:** about 315 frames
    per toggle; Earth glides between 3.34 and 228.7 Moon radii at most 5.7 % of its distance
    per frame, never hidden; the Moon never leaves the frame; the Sun hides only at the end of
    the way in. Mid-flight in, the view turns to true scale's framing and Earth passes below
    the free space for a moment (it shows at the timeline's top edge) before landing in frame.
  - The sampled-camera test of the "not drawn in front of the Moon" rule (4,000 cameras, both
    scale modes) and the "From Earth" / "From the Sun" series test pass with these constants.

#### 2026-11-14 · System view proportions · Earth and the Sun read larger and farther than the Moon
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote `proportions.ts` (drawn sizes and
  distances, the on-screen rule that hides a body between the camera and the Moon, Earth and
  the Sun during the True-scale glide) and its vitest tests against the real
  `data/derived/system.bin`, the opening view in `camera.ts` and its tests over four layouts
  and the series' extremes, the fade in `world.ts`, the rig's glide clock, the overlay's edge
  arrows and small-Moon label placement, the reconciled `lib/geo/placement.ts`, the spec; no
  AI-generated imagery — checked by the agent with the vitest suite, typecheck, build, and by
  eye in Chrome with hardware WebGL (RTX 2060) at 1440 × 900 and 1024 × 768, panels open and
  folded, against `main` run side by side, with the True-scale toggle sampled frame by frame;
  reviewed by Codex (gpt-6.1-terra) and Cursor (grok-4.7), findings addressed below; a human
  has not reviewed it
- **State:** verified (reviewed three times (Codex once, Cursor twice): the opening's guarantees recomputed over all 52,584 hours in four layouts, mutations caught; Cursor's last must-fix (Earth drawn over the Moon when zoomed far out) fixed by the author with an on-screen overlap rule tested over 4,000 sampled cameras, not re-reviewed; sizes and distances chosen with the team lead from captures; on the tree merged with main b6d4a5b: 458 Python tests (1 skipped), 2,627 web tests, typecheck and build all exit 0. The True-scale toggle was not re-checked frame by frame with the final constants)
- **Changed:** `web/src/features/three/scene/` (`proportions.ts` and its test are new;
  `camera.ts` opening view, `rig.ts` zoom-out limit and glide, `world.ts` placement, the
  in-front rule and fade and Earth's light comment, `materials.ts` Earth opacity and Sun fade,
  `overlay.tsx` Earth's edge arrow, small-Moon label placement and the Sun's arrow stepping
  around Earth, one placement line, the imports and two per-frame lines in `scene-root.tsx`,
  tests in `scene-logic.test.ts`, `navigate.test.ts`, `rig.test.ts`), `web/src/lib/geo/`
  (`placement.ts`, its test, `index.ts`), `web/src/lib/explain.ts` (`system_view`),
  `docs/features/system-view.md`, `docs/design/c2/built-system-proportions-*.png`, this entry
- **Notes:**
  - **The opening (the team lead's final balance):** the Moon leads, in the middle of the free
    space where `main` puts it; Earth is whole beside it to the left, about the Moon's size or
    a little smaller; the Sun is far outside with its edge arrow. The camera looks up from
    under the south pole, turned so the Moon's 0° meridian (where Earth always lies, within
    libration) runs along the free space's long side, and leans 12° away from Earth so Earth
    is always a little further than the Moon. It does not depend on the hour. First load and
    returning from another view use it; a "South pole" click (including the one that leaves
    "Follow site") frames the polar cap close in, as the team lead chose.
  - **On-screen radii in the opening, measured in the app** (Moon / Earth, landing date):
    1440 × 900 panels open 95.2 / 92.9 px; folded 101.4 / 98.7; 1024 × 768 open 45.1 / 44.8;
    folded 59.7 / 58.9. From the tests' layout rects the Moon is 95.3, 98.2, 45.1 and 56.4 px
    (the folded rects in the tests are approximations of the app's). `main`'s Moon: 134.1,
    134.3, 63.5, 79.0. Over the series Earth shows 0.95 to 1.0 times the Moon.
  - **Proportions** (`proportions.ts`): drawn radii Moon 1, Earth 1.005, Sun 3.5; drawn
    distance 0.372 × (d ÷ Moon radius)^0.385, so Earth 2.89 to 3.04 Moon radii out (2.5 on
    `main`) and the Sun 29.3 to 29.8, 9.7 to 10.3 times Earth's distance. The circle the Moon
    would trace around the drawn Earth stays far from the Sun: its nearest surface is at least
    3.76 times that circle's diameter from Earth at every hour (tested). Zoom out to 420 Moon
    radii. Earth's drawn radius stays above the Moon's; it shows slightly smaller only because
    it is further from the camera.
  - **At 1024 × 768:** the Moon is 45 px with Earth whole; when the Moon is under 60 px the
    site's name plate starts past its limb and the two mark labels step below its disc (the
    existing settle logic, with the Moon's disc counted as taken).
  - **Review (Cursor, 9384c6b), item 1:** the in-front rule is now judged on screen, at any
    distance and in both scale modes: a body is not drawn when the camera is inside it, or it
    is nearer than the Moon and its disc overlaps the Moon's (with 30 % of the Moon's radius
    to spare), or it is at least 5 % nearer, larger on screen and in view. The 5 % stays only
    on that last clause: without it the Sun, always larger than the Moon, would vanish when
    zoomed out whenever it sits a hair on the camera's side. Tested at the review's distances
    along Earth's line (81 to 421 radii) and over 4,000 sampled cameras across the whole zoom
    range in both scale modes with real hours: no drawn body nearer than the Moon overlaps it.
  - **Item 2:** a short fade (180 ms, at once with reduced motion) with hysteresis; it asks
    for frames only while it runs (tested with a mocked clock). The name and edge arrow show
    while the disc is hidden. Earth's material is transparent again for the fade.
  - **Earlier reviews:** Codex's (rule pinned, real series, degenerate inputs, Earth lit from
    the true Sun direction, one source for the schematic) and Cursor's 06f6798 (in-front rule,
    no slices in the opening, glide clock) stand; the counts in them were for the previous
    constants.
  - **True scale, by eye:** toggled both ways at both sizes from the opening, "From Earth" and
    zoomed out in the previous round with the same mechanism; Earth glides at about 3 % of its
    distance per frame and the Moon never leaves the frame. Not re-sampled frame by frame with
    these constants; the captures show both ends and the middle.
  - **After merging #105:** the globe keeps its finest mesh only while ground is drawn; in the
    System view it is 384 × 192 at rest and 64 while moving zoomed out, as before.
  - Not measured: a weak GPU. Nothing new is loaded; Earth draws in the transparent pass.

#### 2026-11-14 · T3b · A custom site's ground joins the Moon
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — measured the fault, wrote `custom-apron.ts`
  and its tests, the apron state and the plate line in `plates.ts`, the explanation in
  `explain.ts`, the hook in `world.ts` and the spec; captured before and after pictures in
  a headless Chrome with hardware WebGL (RTX 2060) against its own API (port 8123, the main
  checkout's `data/prepared` read-only) and dev server (port 5198); no AI-generated imagery;
  a human has not reviewed it yet
- **State:** verified (reviewed twice by Codex (gpt-6.1-terra): its own rim probe measures 0.5 to 2.6 mm at full detail (13 to 23 m before), no hole or overlap at the corners, catalog heights identical to main away from the rim; the two moving-state findings of the re-check were then fixed by the author with tests at every detail level and every globe mesh, not re-reviewed; on the tree merged with main 36010d2: 458 Python tests (1 skipped), 2,589 web tests, typecheck and build all exit 0. Not yet tried by the team lead)
- **Changed:** `web/src/features/three/scene/custom-apron.ts` and its test (new);
  `world.ts` (`setGround` builds the apron for a custom site; the height map is read once);
  `plates.ts` and its test (`apronLoadState`, the "surroundings" plate); `scene-root.tsx`
  (one line: the apron state comes from `apronLoadState`); `web/src/lib/explain.ts`
  (`custom_site_surroundings`, outside this track's folders: the text the plate shows);
  `docs/features/local-terrain.md` ("States"); `docs/design/c2/built-custom-site-ground-*.png`;
  this entry
- **Notes:**
  - The cause, measured: a custom site's patch is placed at the site's true ground height
    (`elevation_m`; the 11 cached custom sites range from −3,188 m to +1,394 m), but the
    globe is a plain sphere at the reference radius. A catalog site's apron eases from the
    true heights down to that sphere and fills the 140 km disc the globe stops drawing
    around the site once the ground is in. A custom site has no apron (the API makes none),
    so its 20 km patch sat alone in that hole, kilometres above or below the globe; zoomed
    out, the hole closes and the globe covers it again.
  - The fix: the browser builds the custom site's apron from the patch's own heights and the
    global height map it already loads for the globe (LOLA, 4 pixels a degree), joined at
    the patch's edge with no step and eased to the reference sphere at its outer edge; one
    quiet plate line says the surroundings are coarse. No terrain is invented, and the
    series still decides lit or dark (decision 0015).
  - Checked: the 80 m tier at −2,603 m and +261 m, the 240 m tier (72° S 10° E) and the
    smooth tier (20° N 30° E), in Local terrain close and zoomed out and in Lander's eye, at
    1440 × 900 and 1024 × 768; Connecting Ridge takes the unchanged path; the quality
    governor's stages coarsen the new apron while moving and restore it at rest.
  - Seen, not changed: in Lander's eye at a smooth-tier site (also the catalog's Apollo 11)
    the camera looks toward Earth or the Sun, tens of degrees up, so the picture shows sky
    only; that is the camera's framing (`rig.ts`), not the ground.
  - Review fixes (Codex review of #105), 2026-11-14:
    - The drawn mesh separated at the patch's edge (the apron's cells crossed the rim with
      the points under the patch lowered 30 m): measured on the drawn triangles about
      25.5 m below the patch at every height and tier. Now the apron's full-detail cells stop
      at its first ring beyond the patch and a strip joins that ring to the patch's own rim
      points (with the patch's normals): 0.0015 m (`ground-join.test.ts`, tolerance 0.25 m).
      Same code path for catalog aprons (a flat test apron: 77 m before, 0.006 m after);
      Connecting Ridge's pictures are unchanged at this scale.
    - Found while retaking the pictures: `readGlobalHeights` read the image's size after
      closing the ImageBitmap, which then reports 0 × 0, so every far height was NaN and
      the apron fell to the site's own height, a cliff of up to 2.4 km at the rim (the
      first round's pictures were taken with the earlier loader and were right). Fixed and
      tested with a bitmap that zeroes its size on close.
    - The global height map has an explicit state (idle, loading, ready, failed); a failure
      is shown in plain words, not cached, and retried on the next visit to the view.
    - The outer edge: no fight was seen in a nudge test at grazing views (the pixels that
      flip under a 0.17 m camera nudge stay the same with the globe hidden), but by the
      numbers one could happen near the globe's own vertices (0.25 m apart against a depth
      step of about 1 m); the apron's and smooth ground's edge now ends 150 m below the
      sphere, pinned by a test.
    - The ground's key is checked before the apron is built.
    - Seen, not changed: at grazing angles a thin broken line of drawn shadow can follow a
      crest-like rim; it is decoration (gone with shadows off), not a gap.
  - Re-check fixes (Codex re-check of #105), 2026-11-14:
    - The join at every level: while moving, the patch and the apron share one step (2 or
      4), and each level now has its own strip to the patch's edge as that level draws it.
      Tested at every level on a ridge and a flat patch at −2,600, 0 and +1,400 m on both
      tiers (0.25 m); removing the coarse strips fails 25 of 46 cases.
    - The globe keeps its finest mesh while ground is drawn (`globeSegments` in
      `World.setMoonSegments`): the coarser meshes the governor picks while moving lie 262 m
      to 4.2 km inside the sphere, deeper than the ground's edge. Tested for every selectable
      count, on the finest mesh's own triangles and through `World`; checked by eye at the
      90 km zoom limit and in Lander's eye, at rest and with moving simulated (globe asked for
      64 segments, ground at stage 3), for Connecting Ridge and a custom site: no slit or step.
    - Reading the global height map fails after 20 s if it never settles (then retried on
      the next visit); a late answer is ignored. Tested.
    - Connecting Ridge before and after, close and at the zoom limit: identical by eye; 0.05 %
      and 0.01 % of pixels differ by more than 24 grey levels.
  - For the API later, so a custom site looks like a catalog site: the same apron the
    catalog has, made by the same step (`build-scene-assets`): `aprons/<site_id>.bin`,
    161 × 161 heights over 300 km at the 80 m or 240 m map's resolution where it covers
    (uint16, (h + 12,000) × 2, 51.8 kB), listed in a custom site's metadata (for example
    `apron: { file, rows, columns, window_m }` in its `meta.json`, or served at
    `/api/custom/{id}/apron.bin`), so the browser stops using the coarse global map.

#### 2026-11-14 · T7b · The Moon around the Polar map's detailed square
- **Who:** implementation agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — built the context reprojection, border,
  outside-map readouts, tests and the first visual pass with the impeccable skill;
  Codex, gpt-6.1-sol — resumed the interrupted work, finished label placement and readout
  wrapping, added free-space label tests, ran the checks, updated the spec and captured the
  final opening views and flat Slip Planner. No AI-generated imagery; human review pending.
- **State:** verified (reviewed by Cursor (grok-4.7): approve with two fixes, both made by the orchestrator (a 240 m point inside the square is no longer called outside the detailed map; the zoom floor in the doc is 40 %); on the tree merged with main 8176241: 438 Python tests (1 skipped), 2,431 web tests, typecheck and build all exit 0)
- **Changed:** `web/src/features/polar-map/`; `docs/features/polar-map.md`; eight
  `docs/design/c2/built-polar-map-context-*.png` screenshots; this entry.
- **Notes:**
  - Uses the scene's existing NASA `scene/moon_4k.webp`, redrawn in the browser with the
    shared projection helpers. A 1,024 px outer canvas reaches the equator; a 2,048 px inner
    canvas reaches 960 km from the pole (about 59°S along its sides). The quieter grey
    context is a picture, never a terrain or visibility result. No pipeline, contract,
    scene, Mission Control or dependency changes.
  - The earlier timing probe measured about 1.5 s to build on this machine, with completion
    competing with the flight under load. Work yields between roughly 8 ms slices and
    starts when the view is picked. The two RGBA canvases total 20 MiB (calculated, not a
    measured heap peak); the decoded source and temporary pixel arrays cost more during
    construction. Context, 8K relief and overlays release their cache references on leaving.
  - The border follows the image and lookup grids' square, not the 80°S circle. Its label
    stays inside the free space, above an edge when possible and inside otherwise. Grid
    labels give way to it; pin and feature labels avoid it. The border stays when the label
    is hidden. `readouts={false}` hides the label by default for the Slip Planner;
    `detailLabel` overrides only that label. Other prop meanings are unchanged.
  - Catalog and ready custom pins in the southern hemisphere can sit on the context,
    outside the border, labelled "Outside the detailed map" (custom pins retain "Your
    site"). Northern sites remain in the off-map list. NASA's hover, point and nudge values
    outside the square say "outside the detailed map". Compute remains available when a
    callback is supplied and names the 80 m, 240 m or smooth-Moon tier from the shared
    `tierHint`, using the server's latitude bounds. The pan clamp still keeps the detailed
    square reachable. The takeover fit reserves the scene's 60 px controls strip.
  - **Checks:** each full command ran once, sequentially, with its exit code read directly:
    web test exit 0 (2,342 tests, 103 files); typecheck exit 0; build exit 0; pytest exit 0
    (425 passed, 1 skipped, 3 existing dependency/fixture warnings, 260.67 s). No timed-out
    test needed a rerun. Before these, the three map files passed 67 focused tests, including
    projection, outside-map readouts, tier boundaries, label placement and the takeover's
    under-1% pin displacement. The Impeccable detector returned no findings.
  - **By eye:** real-data opening views at 1440 × 900 and 390 × 844 show the whole square
    with the Moon around it and the label clear of the view bar; left pans show the context
    following the map. The Slip Planner with forced no-WebGL was captured at both sizes:
    its spots follow the map and the square's label is hidden. On the phone its existing
    map controls cover much of the small map; their behavior was left unchanged.
    Earlier captures show the takeover and minimum zoom. The preview's snapshot and
    recording host repeatedly timed out or disconnected, so the remaining right/up/down
    pan checks could not be completed by eye. Some final PNGs are frames from the session
    browser's recording because its snapshot endpoint failed. No browser test suite added.
  - `origin/main` was merged at `2dc14c6`, retaining both sides' entries; the final fetch
    still found main at `5a5fd84`. Own preview tabs were closed and port 5199 stopped;
    ports 5173, 8000 and 8080 were not touched. Team-lead review remains outstanding.

#### 2026-11-14 · T3 · The ground's look in Local terrain and Lander's eye
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (question
  round skipped, as briefed) — wrote the ground's material (`ground-material.ts`), its pure
  parts and quality levels (`ground-relief.ts`, `ground-quality.ts`) with vitest tests, the
  height grids and the local-position attribute in `ground.ts`, the decoration plate, and
  the docs; captured the before and after screenshots and the frame-time measurements in a
  headless Chrome with hardware WebGL (RTX 2060, ANGLE D3D11) and with SwiftShader; no
  AI-generated imagery; a human has not reviewed it yet
- **State:** verified (2,142 web tests, 425 Python tests, typecheck and build pass on the merge with main; reviewed by Codex (every shader result ends in pixels, with no path to a label or a decision; the fragment-to-map projection matched at three points; two mutations caught); findings fixed: the decoration plate can no longer vanish while the drawing stays (the ground falls back to plain when the plate cannot fit), the plate's link to the series is tested, the near-ground craters follow a realistic size mix, the ground follows the scene's quality stages; seen by the builder on hardware WebGL; not yet seen by the team lead)
  is not measured, and orbiting by hand was not possible in the headless browser: the views
  were checked at the camera's arrival poses and while stepping the timeline hour by hour)
- **Changed:** `web/src/features/three/scene/ground-material.ts`, `ground-relief.ts`,
  `ground-quality.ts` and their tests (new); `ground.ts` (an `aL` attribute, `patchUpGrid`,
  `apronUpGrid`) and its test; `world.ts` (the ground uses `GroundLook`: the constructor,
  `setGround`, `clearGround`, `setInputs` and one line in `layout`; `world.groundLook` is
  public for the quality stages); `plates.ts` and its test (the decoration plate);
  `overlay.tsx` (plates may sit at the foot); `scene.css` (the two-line plate, and stacked
  plates centred once); `scene-root.tsx` (passes the series' Sun answer to the plates: one
  line and a dependency); `docs/features/local-terrain.md` ("What is drawn", the plate,
  Performance); `docs/features/panorama.md` (one sentence);
  `docs/decisions/0015-drawn-ground-shadows.md`; `docs/design/c2/built-ground-*.png`; this
  entry. `materials.ts` is untouched: its old `groundMaterial` is no longer used and can be
  deleted by whoever merges second.
- **Notes:**
  - Why it looked low quality (before shots): the ground was lit per vertex normal, so the
    300 km terrain had one light value every 1.9 km and the patch every 78 m, with no cast
    shadows at all; a milky fill (`alb * 0.19`) and the soft roll-off washed out contrast;
    the near ground at 2 m was the smooth 80 m ramp; the albedo was the Moon's 4K colour map,
    about 2.7 km a pixel.
  - Now: relief at 160 m (core) or 320 m (cap) in every pixel out to the horizon, cast
    shadows with a Sun-disc edge, illustrative regolith close up, lunar photometry. Each
    effect is full, reduced or off; costs are in local-terrain.md, "Performance" (all full
    about 1.8 ms a frame on the RTX 2060 at 1440 × 900; zero frames at rest).
  - Drawn shadows can differ from the series at the lander (Connecting Ridge, 2028-03-06
    18:00 UTC: series dark, drawing shows a sunlit patch beside Pip). The plate gives the
    series' answer and says the series is right. The browser never judges the drawing.
  - First build hung Chrome for minutes: ANGLE's D3D compiler unrolled the 64-step march and
    the crater loops. The loop counts are uniforms now; compiling takes well under a second.
  - Found and fixed: `shell.css` makes every `.scene-plate` absolute with
    `translateX(-50%)`, so plates in the top stack were centred twice (shifted left by half
    their width) and stacked plates would overlap.
  - Seen, not changed: at a sphere-tier site (Apollo 11) Lander's eye looks up at Earth or
    the Sun, which are 20° to 60° up there, so almost no ground is in view; the frame was
    nearly black in the headless browser.
  - What a later pipeline package should ship so the drawing can match the series more
    often and show more relief: (1) a wider, finer apron, 1,201 × 1,201 points over 300 km
    (250 m), 2.9 MB as uint16, or 601 × 601 (500 m), 0.7 MB; (2) a 60 km mid patch at 80 m,
    751 × 751, 1.1 MB as uint16 heights, between the patch and the apron; (3) slope maps at the map's own 80 m
    for the ±76 km core, 1,900 × 1,900 lossless WebP, a few MB; (4) close-up DEMs (5 m,
    2 km) for the Lander's eye near ground, already in the contracts as `closeup.bin`; (5) an
    albedo map of the cap in the same projection (the LROC colour map is 2.7 km a pixel at
    the pole).
  - Review fixes (Codex review of #91), 2026-11-14:
    - The disclosure is on screen wherever the drawing is: the decoration plate is exempt
      from the overlay's hiding, shortens to "Shadows and ground texture are illustrative."
      in a tight space or beside an open window, and where not even that fits the ground is
      drawn without shadows and texture (`decorationDisclosure`, `visiblePlates`,
      `GroundLook.setDisclosed`). Checked by eye: Compare open (no room: plain ground, no
      plate; closed again: full), 1024 × 640, a 390 × 844 phone, Lander's eye with the chart
      folded and open (the plate sits above the view's controls, clear of the chart's row).
    - The plate's series answer is `seriesSunAnswer`, tested on fixture_ridge at a lit, a
      dark and a partly hidden hour; a constant "lit" fails two tests, and a test pins the
      one line in `scene-root.tsx` that passes it.
    - Texture: craters like real small lunar ones (mostly old and shallow, a few fresh),
      clustered with no grid, rim shadows at half strength, fewer rocks.
    - Weak GPU: the ground follows #88's quality governor (`setMotion(moving, stage)`), with
      coarser meshes by draw range; `prepareGround` uploads the ground before the first
      flight. Numbers in local-terrain.md, "Performance".
    - Custom sites (no apron listed) draw the patch alone with no error plate.
    - One shared draw hook (no per-draw allocation); the loop bounds' comment says why they
      are uniforms. A WebGL 1-only browser: the scene's own probe (`scene-root.tsx`,
      `probeWebgl`) asks for WebGL 2 and reports "no-webgl"; the shell's probe
      (`app/mission/scene-slot.tsx`) accepts WebGL 1 and would mount the scene, which then
      reports "no-webgl" itself. Not changed here.
    - Decision renamed 0015 (#88 added 0014).

#### 2026-11-14 · T7 · The flat Polar map
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill (no question
  round: a briefed sub-agent) — wrote the flat map in `web/src/features/polar-map/` (canvas
  drawing, pins, readouts, the takeover, the nudge), its vitest tests, the seam change in
  `web/src/app/scene.ts` and `scene-slot.tsx`, the `polar_map` sentence and the spec edits
  — checked by the agent with the vitest suite, typecheck, the build, impeccable's detector
  (no findings) and by eye in a browser on the real data at 1440 × 900, 1024 × 768,
  390 × 844, forced "no WebGL", reduced motion and a 360 px lesson box; a human has not
  reviewed it yet
- **State:** verified (2,017 web tests, typecheck and build pass on the merge with main (the orchestrator's run), and 425 Python tests on the same tree (the builder's run); reviewed by Cursor, which re-derived the projection independently and matched it at the pole, the four 80°S axes and five sites, confirmed the image is not mirrored and the lookup cells are right; one must-fix (the NASA caveat now stays up while a pin is dragged) and five smaller fixes made; not yet tried by the team lead)
- **Changed:** `web/src/features/polar-map/` (new files; `index.tsx` keeps `PolarMap` as the
  default export), `web/src/app/scene.ts` (adds `FlatLayer` and `FlatLayerProps`),
  `web/src/app/mission/scene-slot.tsx` (optional `flat` prop), two lines in
  `web/src/app/mission-screen.tsx`, the `polar_map` text in `web/src/lib/explain.ts`,
  `web/package.json` and `web/pnpm-lock.yaml` (`d3-selection` and its types declared; both
  were already in the lockfile under `d3-zoom`), `docs/features/polar-map.md`,
  `docs/design/c2/built-polar-map-*.png`, this entry
- **Notes:**
  - The swap from globe to map: the scene's arrival gives the pole and the scale; the map
    takes the scale halfway between the pole's and 80°S's, so no pin from the pole to 80°S
    moves by more than about 0.6 % of the map's width at 80°S (a pinhole projection of the
    cap, tested against `polarPose` and `polarScale`). Matching the pole exactly left pins
    near 80°S up to 1.1 % off.
  - Best-lit variants (#77, merged in): tested against the five real ones. A variant whose
    parent is drawn stands in a callout beside it; one whose parent is folded into another
    pin folds with it. Seen at Connecting Ridge and Shackleton rim at 40 m a pixel. The
    nudge readout there reads "Average sunlight 54 % → 43 %, lower" 300 m from Connecting
    Ridge, with its 40 to 87 % nearby range and the best-lit point 150 m away.
  - Review of #89 (Cursor): the coordinate work checked out independently. Fixed: the "not
    for your dates" caveat stays on screen while a pin is dragged; every NASA average is
    labelled as NASA's; nearby ranges round outward in PR #92's wording ("Within 160 m: 39 %
    to 87 %"), and byte 254 reads "over 99 %"; pan stops with a third of the map in the free
    space; the 8K relief is let go after 20 s zoomed out and with the overlays on leaving.
    New rendered tests (`readout-card.test.ts`) cover the caveat mid-drag, the start value
    at the listed point, the request button and the longitude passed to `onRequestSite`.
    Checked by eye once on the merged shell (#83): the map centres in the taller free space
    and its controls sit above the timeline.
  - For the Slip Planner (#87) and the Academy, `PolarMap` takes `sites`,
    `showFeatureNames`, `overlay`, `overlayOpacity` and `onProjector` (the same shape as
    `SceneProjector`). Nothing is built for the Slip Planner here.
  - `artemis_regions.json` has no centres or sizes, so no outlines are drawn.
  - Catalog sites that are not selected are grey dots without a status: a status needs the
    site's 0.8 MB series, which loads when the site is added.
  - On a page load straight into `view=map`, the scene's first flight waits for data; after
    2.4 s without an arrival the map opens at its own fit (the same fit as the camera's).
  - `polar-map.css` is not in a cascade layer: it loads before `theme.css`, and a
    `@layer components` there reordered Tailwind's layers and reset every component's
    padding (seen and fixed in the browser).

#### 2026-11-14 · Scene polish · Controls, real stars, and speed on weak machines
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5, with the impeccable design skill — wrote the
  System view's pivot, pan, zoom to the pointer and double-click (`navigate.ts`), the drag
  fixes in `rig.ts`, the star renderer (`stars.ts`) and the script that makes
  `web/public/stars.bin` (`web/dev/build-stars.mjs`), the quality stages and the Moon's
  level of detail (`perf.ts`), vitest tests for all of them, and the doc changes; no
  AI-generated imagery (the stars are a NASA/ADC catalogue) — checked by the agent with the
  vitest suite, typecheck, build, pytest, pixel diffs of before and after screenshots, and
  by eye and by the numbers in Chrome with hardware WebGL (RTX 2060), SwiftShader with 1×,
  4× and 6× CPU throttling, and real touch events at 390 × 844; a human has not reviewed it
- **State:** verified (425 Python tests, 1,975 web tests, typecheck and build pass on the merge with main; reviewed by Gemini (the star file checked against five published positions and not mirrored; level-of-detail disposal; zoom to the pointer; two mutations caught); seven findings fixed with tests (a stuck drag, the drag direction in every orientation, pivot continuity, frame timing that ignores a hidden tab and recovers); the team lead's later requests are in: the System view turns freely over both poles, and the distances plate is removed; a real laptop with built-in graphics is still not measured; not yet tried by the team lead)
- **Changed:** `web/src/features/three/scene/` (`navigate.ts`, `stars.ts`, `perf.ts` and
  their tests are new; `rig.ts`, `scene-root.tsx`, `overlay.tsx`, and one additive method in
  `world.ts`, `setMoonSegments`), `web/public/stars.bin` and `web/dev/build-stars.mjs` (new),
  `web/src/lib/explain.ts` (an optional `controls` line for the System view and Local
  terrain) and `web/src/components/Explain.tsx` (shows it), `web/src/app/scene.ts` (the
  `"slow"` comment), `pointers.ts` and its test (new), `docs/features/system-view.md`,
  `DESIGN.md` (stars), `docs/decisions/0014-the-scene-steps-quality-down.md`,
  `docs/design/c2/built-scene-polish-*.png`, this entry
- **Notes:**
  - **Controls.** Every drag follows "grab the globe": the surface under the pointer moves
    with it. The sideways drag was inverted in Local terrain, and in the System view
    whenever the south was at the top of the screen. The System view's drag is a free
    trackball (team lead, 2026-11-14): a horizontal drag turns the camera about its own up
    axis, a vertical drag about its own right axis, through the pivot, with no pole limit,
    over either pole and all the way round. Far out the pivot is the Moon's centre; close in
    the point of interest (the pole, the followed site, a double-clicked spot, or the centre
    of the view), sliding between 0.5 and 2 Moon radii; a preset's point fades as it leaves
    the centre or nears its horizon. A turn never goes below 60 km: it slides along it. Each
    view's drag is a per-view setting (`ORBIT_STYLE` in `rig.ts`): Local terrain and Lander's
    eye keep their limits, the Polar map stays north-up. Pan: right-drag, Shift-drag, two
    fingers. Wheel and pinch zoom toward the pointer. "South pole" frames the whole cap
    poleward of about 80°S, level; a double-click on empty space flies back to the preset's
    level framing. Keys: arrows move the camera (the picture moves the other way), Shift and
    an arrow pans, plus and minus zoom. The first load still lands on home.
  - **The "Distances not to scale" plate is gone** (team lead). The About text still says
    distances are squeezed and every direction is true; the "True scale" button's description
    says what it switches.
  - **Stars.** The Yale Bright Star Catalogue, 5th revised edition (Hoffleit and Warren
    1991, CDS V/50), from HEASARC's public `bsc5p` table, reduced to 8,404 stars to
    magnitude 6.5 in 67 kB. Placed by one fixed rotation: the Moon's pole points where the
    IAU model says, turned about it as on 2000-01-01, not for the scrubber's time (that
    would be ephemeris work in the frontend). Nothing on screen claims otherwise.
  - **Speed.** Before and after, median ms between drawn frames, 1440 × 900:
    RTX 2060 4.2 → 4.2 (all scenarios, display-capped); SwiftShader orbit 196 → 33, flight
    to the Polar map 229 → 37; SwiftShader with 6× CPU orbit 213 → 36, flight 225 → 41.
    The cost was the Moon's 147,000 triangles, not pixels or the main thread (2.5 ms). On a
    fast machine the still picture is pixel-identical to before in the Moon. Not measured: a
    real laptop's built-in graphics. Still slow on SwiftShader: Local terrain (about 240 ms
    a frame at 6× CPU) because of the ground's mesh, left for the ground package; and the
    first flight into Local terrain has a one-off upload stall (about 375 ms).
  - **Quality stages** are decided by `QualityGovernor` (`perf.ts`, tested): only visible
    flight frames count; stalls (over a second, or over four times the last window's median)
    are dropped; three fast windows step back up; a stage that fails right after recovering
    is not re-entered. The intro has no separate measurement any more.
  - **The WebGL context** asks for the fast GPU: `powerPreference: "high-performance"` was
    already set when the scene was made (#75), and the live context reports it on the RTX
    2060; no other attribute fights it (`antialias` on, `preserveDrawingBuffer` off but in
    the dev still capture, `failIfMajorPerformanceCaveat` off). Its cost: on a laptop with
    two graphics chips it wakes the discrete one, so it uses more battery.
  - **For the ground package (Local terrain on a weak GPU):** on SwiftShader with 6× CPU,
    Local terrain draws at about 240 ms a frame (765 ms at a 4K-sized window, DPR 2), against
    36 ms for the System view after the Moon's level of detail. Main-thread work there is
    small (render submit 4 to 13 ms, overlay 4 to 8 ms), so the cost is the GPU drawing the
    apron and patch meshes plus the globe at its full 384-segment mesh. What would fix it,
    as was done for the Moon: draw fewer apron and patch triangles while the camera moves
    (a coarser index buffer over the same vertices, swapped in while `inMotion`, full mesh
    for the rest frame), and skip the globe's hidden pixels under the apron earlier. The
    first flight into Local terrain also stalls about 375 ms while those meshes upload;
    uploading them while the camera rests in another view would hide that.
  - **Review fixes (Gemini review of #88):** a drag can no longer get stuck (pointer
    bookkeeping in `pointers.ts`: up, cancel, lost capture, window blur, hidden tab, and a
    mouse moving with no button all end it; tested in every order); after a pan, a sideways
    drag moves the surface sideways (the trackball; a property test over orientations with
    the pole up, down, sideways and in the middle); the pivot is continuous (sweeps through
    the blend zone, across the equator, past a followed site's horizon and off the limb);
    frame timing ignores hidden tabs and stalls and recovers (governor tests); the rest frame
    waits 300 ms, longer than the 250 ms motion cutoff; `user-select: none` on the scene.
    Checked in Chrome on the RTX 2060: an upward drag goes over the pole and round; after
    panning the pole to each side all four drag directions move the centre point the drag's
    way; a blur mid-drag leaves nothing turning; zooming out with the minus key from a
    followed site and dragging moves smoothly; "South pole" levels the view.
  - The timeline's play button advances one hour per drawn frame at 6 h a second, so its
    frame gap (about 167 ms) is the play rate, not a cost.
  - **Dev only:** `?perf` shows frame times over the scene; `window.__truesouthPerf` reads
    them; `window.__truesouthScene` now also exposes `invalidate`.
  - During this work the machine's disk filled up twice and the dev server crashed once;
    every commit was re-checked afterwards.

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

#### 2026-11-14 · A4b · The lessons' panels show the real thing
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — audited lessons 1 to 4 for stand-ins and
  missing values, wrote the lesson panels (`lesson/panels/`), their data module and tests,
  the wiring into the predict reveal and the lesson-complete screen, and the doc changes.
  Checked by the agent with the tests (on the real derived files and the fixture), the
  typecheck and the build, and in a browser at 1440 × 900 and 390 × 844, keyboard only,
  with reduced motion, and with `VITE_DATA=fixtures`. No AI-generated images. A human has
  not played it.
- **State:** verified (reviewed by Codex (gpt-6.1-terra): every panel number recomputed from the stored data and equal to the lessons after display rounding; five findings, all fixed by the author (a read-only horizon chart, the month validated, a whole-dataset lesson check, wider no-stand-in coverage); on the tree merged with main 23d3a1b: 471 Python tests (1 skipped), 2,792 web tests with 3 expected to fail on the fixture until S2c lands, typecheck and build all exit 0. Not yet played by a person)
- **Changed:** `web/src/features/academy/` (`lesson/panels/`, `lesson/stage.tsx`,
  `complete-screen.tsx`, `drag-body.ts`, `lessons/story.ts`, `lessons/l4.ts`, `academy.css`,
  tests), `docs/academy/lessons.md`, `docs/academy/overview.md`,
  `docs/design/c2/built-academy-panels-*.png`. One additive change outside the Academy
  (review fix): `web/src/features/panorama/chart.tsx` takes an optional
  `interactive?: boolean` on `HorizonChart` (default true, Mission Control unchanged); with
  false the chart is a picture (`role="img"`, its label the text alternative; no tab stop,
  cursor, readout, marking, wheel or key handling, no instructions or live region), and
  `panorama.css` gives `.pano-chart[data-static]` a default cursor. Otherwise the panels
  import `HorizonChart` and its geometry, `bandSegments` and `Countdowns` (timeline, lazy),
  `hourFlags` and `useHourFlags` (scoring) and `drawnDistance` and `DRAWN_EARTH_RADIUS`
  (`three/scene/proportions.ts`, a pure module) as they are.
- **Notes:**
  - Seven stand-ins removed: three prediction reveals (lesson 1 step 3 System view, lesson 2
    step 1 Lander's eye, lesson 4 step 3 timeline) and four lesson-complete screens ("The …
    panel appears here once Mission Control builds it"). Each now draws the lesson's stored
    data at its site and moment; `panel-data.test.ts` checks the numbers against the worked
    examples, `no-stand-ins.test.ts` renders every step and complete screen.
  - Lesson 4 step 3's caption called its band "the timeline's Earth band", but that band
    is link hours (51.5% of the story month at the 1° mask) while the caption quotes
    `l4.earth_up_pct` (59.7%, any of Earth's disc showing). The reveal draws the latter
    and the caption now says so (lessons.md first).
  - The story site is now `story.site_id` (it was hard-coded to `connecting_ridge`, absent
    from the fixtures). The story month is `story.landing_utc` to `story.month_end_utc`
    only when they are exactly 720 hours apart and inside the time grid; otherwise the
    lesson shows "This lesson's numbers do not match the lesson" and nothing is drawn or
    shortened (review fix; the earlier fixture workaround is gone).
  - Review fixes (Codex, PR #113): the reveal's horizon chart is read-only (above); the
    System view names the missing data when `system.bin` fails; `lesson-data.test.ts` runs
    every lesson's checks on a whole dataset (goals reachable, correct answers true of the
    drawn data). It passes on the real data and is marked expected-to-fail on the fixture,
    whose made-up worked examples contradict its own series (lesson 1's highest Sun 4.4°
    against 2.14° stored, Earth visible all month against "about 60%", the month end equal
    to the landing): the Science follow-up is making them computed, and the marker comes off
    when it lands. `no-stand-ins.test.ts` now also covers prompts, conversation lines,
    cards, live stages and the bare readout key `l4.link_pct_by_mask`.
  - Cost: about +13 kB JavaScript and +13 kB CSS in all (10 kB of it the timeline's CSS,
    loaded only with the countdowns on lesson 4's complete screen). No 3D code is loaded;
    `system.bin` (1.26 MB) is fetched only by lesson 1's reveal and complete screen.

#### 2026-11-14 · A12 · The team proposal
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — wrote `docs/submission/proposal.md`, the team's
  proposal in the organisers' template, from the repository's own submission files, specs and
  validation data; checked each reference by fetching its DOI record (Crossref) or the
  publisher's or NASA's page, and counted the words of each section by script. No browser was
  opened and no test suite was run. The team gave the team name, the four members' names and
  their responsibilities; nothing else about a person was written. A human has not read it.
- **State:** verified (fact-checked by Cursor (grok-4.7): headline numbers recomputed, both quotations word for word, nine references confirmed; two wrong statements and five loose ones corrected by the orchestrator; roles set by the team; on the tree merged with main bbc6df0: 458 Python tests (1 skipped), 2,649 web tests, typecheck and build all exit 0)
- **Changed:** `docs/submission/proposal.md`; stale statements in `project-description.md`, `links-checklist.md` and `ai-use.md` (the deploy files pull request #101 is merged; the test count now cites `status.md` as of 2026-11-14); this entry
- **Notes:** The four optional slots for a line on each member's background are kept only in a comment at the top of the proposal. The two Horizons
  references that could not be checked (Giorgini et al. 1996; the DE421 report) were left out.

#### 2026-11-14 · A3b · Revisit answered steps; questions get their context
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the review of finished steps
  (`review.ts`, the runner's per-step `history`, the progress marks in `lesson/top-bar.tsx`,
  the read-only view in `lesson-screen.tsx`), the context audit of lessons 1 to 4 and the
  new wording (in `docs/academy/lessons.md` first, then the lesson files), and the vitest
  tests. Checked by the agent with the tests and typecheck, and in a browser at
  1440 × 900 and 390 × 844 (touch emulation, and keyboard only): each lesson's progress row
  at the start, mid-lesson and at the end, reviewing a choice, a drag and the sketch, and
  returning. Every simplified sentence was checked against `docs/science.md` §3.4 and the
  CONTEXT.md and `explain.ts` terms. No AI-generated images. A human has not played it.
- **State:** verified (reviewed by Codex (gpt-6.1-terra): request changes, six items, all fixed by the author (the read-only rule is now tested through the real lesson screen and the injected-XP mutation fails; two prompts reworded); on the tree merged with main f0081ad: 458 Python tests (1 skipped), 2,649 web tests, typecheck and build all exit 0. Not yet played by a person)
- **Changed:** `web/src/features/academy/` (`review.ts`, `runner.ts`, `step-view.ts`,
  `lesson-screen.tsx`, `lesson/top-bar.tsx`, `lesson/conversation.tsx`,
  `lesson/skyline-stage.tsx`, `lesson/scenes.tsx`, `sketch.ts`, `academy.css`,
  `lessons/l1.ts`–`l4.ts`, tests), `docs/academy/lessons.md`,
  `docs/design/c2/built-academy-revisit-*.png`, `built-academy-context-*.png`.
  `explain.ts` unchanged: its texts for the terms used were right.
- **Notes:**
  - A finished step's progress mark is a button ("Step 2 of 5, completed. Review"). The
    step opens read-only: answers, hint, feedback, result and XP, the drag's checked hour,
    the sketch under the real skyline, and the lesson's card under "Under the hood". One
    way back: "Back to step N", Esc, Enter, or the current step's mark. Steps not yet
    reached are never controls; `reviewTarget` ignores any request for them. Nothing is
    rescored. The current step's unsaved answer (a picked option, the dragged hour, a
    sketch) waits on return.
  - Kept for the session in the runner's state: `history`, one record per finished step
    (attempts, ending, XP, feedback). The lesson screen keeps each finished step's last
    draft. No new persistence: mid-lesson progress was in memory and a reload restarts the
    lesson, as before; the lesson's position is not in the URL.
  - Context: twelve questions now set up their terms first (month and midday, Luna and
    Pip, elevation, Connecting Ridge, compass directions, how far south, the move to the
    lesson 2 site, atan, skyline, disc fraction, R, talking to Earth, antenna mask and link
    time, NO-GO). No number, answer or formula changed. Lesson 1 step 1's stage is now
    Pip under the sky ruler, so "how high" is an angle before it is asked.
  - Review fixes (Codex, PR #108): review mode is now tested through the real lesson
    screen (`review-screen.test.ts`, on a fake DOM that dispatches events): option buttons,
    number keys, Space, Backspace, the primary button, Enter, Esc, the marks, the drag's
    keys, body and time bar; XP (from the leave dialog) and saved progress unchanged, and
    the finished lesson saves exactly 50 XP and 3 stars. An XP award injected into the
    review button's handler fails it. The sketch's handlers in review are tested too
    (`skyline-review.test.ts`). Lesson 2 step 2 no longer names atan's numerator; lesson 4
    step 5 gives NO-GO to a landing, not a site; Esc leaves review from either tab; a
    one-point sketch survives a review; the step-1 review captures were retaken after the
    caption and ruler-label fixes (every step type checked in review at 1440 × 900 and
    390 × 844: no label in the ground or outside the stage, no clipped caption).

#### 2026-11-14 · A11b · Submission materials brought up to date
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — rewrote the six files in `docs/submission/`
  against `origin/main` at 69bb26e: read the code, the specs, `DEVLOG.md`, `docs/validation.md`
  and `data/derived/validation.json`; ran the Python scoring reference (`truesouth.scoring`)
  on the stored series from a throwaway script outside the repository to compute every date
  and status the demo script quotes; recounted the AI-use lines. No browser was opened and
  no test suite was run. A human has not read it.
- **State:** verified (reviewed by Codex (gpt-6.1-terra): the demo was performed on the running build and its numbers recomputed (all agree); five wording errors fixed by the orchestrator; on the tree merged with main 9f12ff4: 458 Python tests (1 skipped), 2,465 web tests, typecheck and build all exit 0. Not rehearsed against a clock; not every sentence of the other five files was independently confirmed)
  numbers in it were computed, not seen on screen)
- **Changed:** `docs/submission/` (all six files), this entry
- **Notes:**
  - Removed or corrected: custom sites in a catalog-only build answer 503 (and the form says
    "Not available on this server"), not 501; Apollo 11 on 2028-01-03 has the Sun 4.6° up, not
    high (the demo now looks five days later); Local terrain's lander is larger than life, not
    "scaled"; Compare's summary sentence is no longer drawn; the Sun reaches 2.10° at
    Connecting Ridge, so the texts say "about two degrees"; the shared fixture for G10 now has
    76 cases, not 58; #93 to #96 are merged, not in review.
  - Open items for the team lead are listed in `docs/submission/links-checklist.md`: the
    repository (private, no licence), the live link (#101 not merged), the backup video,
    whether to apply `README-proposed.md`, and why the data covers six years.
  - Found outside this package and not changed: `docs/challenge.md` still marks Compare, the
    Slip Planner and the Lander's eye "not built"; `docs/challenge.md` and `docs/validation.md`
    give the largest Sun and Earth difference as 0.0060° where the validation page rounds up
    to 0.0061°; `docs/orchestration/status.md` still names Docker project `truesouth-s13`
    and `docs/architecture.md` names `truesouth-s10b`, while `compose.yaml` sets `name:
    truesouth`.

#### 2026-11-14 · A3 · drag-body and draw-skyline steps: lessons 1, 2 and 4 complete
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the two step kinds (`drag-body.ts`,
  `sketch.ts`, `lesson/drag-body-stage.tsx`, `lesson/skyline-stage.tsx`,
  `lesson/scene-data.ts`), their wiring into the lesson screen, the CSS, the vitest tests
  and the doc changes. Checked by the agent with the tests (against the real
  `data/derived/` series, skyline and worked examples, and the fixture), the typecheck,
  the build and pytest, the Impeccable detector (no findings), and by playing the four
  steps in a browser at 1440 × 900 by mouse and by keyboard only, and at 390 × 844 with
  touch emulation, the failed-load fallback (series blocked) and reduced motion. No
  console errors. A human has not played them. No AI-generated images.
- **State:** verified (438 Python tests, 2,395 web tests, typecheck and build pass on the merge with main; reviewed by Codex, which decoded the stored series itself and confirmed which hours each drag step accepts; findings fixed with tests: a level-ground chart shows no terrain-based reading, a cancelled drag checks the hour on screen, lesson 2 step 4 needs the Sun above level (20 of 49 hours pass), the power meter follows the drag; played by the builder by mouse, keyboard and touch emulation; not yet played by the team lead)
  tests, typecheck and build pass; 425 Python tests pass, 1 skipped; reviewed by Codex
  with changes requested, fixed below; not yet played by the team lead)
- **Changed:** `web/src/features/academy/` (plus `docs/academy/lessons.md`,
  `docs/academy/overview.md`, `docs/design/c2/built-lesson-steps-*.png`) and one additive
  change in `web/src/features/panorama/chart.tsx`: an optional `ground: "skyline" | "level"`
  prop on `HorizonChart` (default `"skyline"`, Mission Control unchanged), with `Readout`
  and `LEVEL_NAME` exported for tests. The step composes the chart's own `HorizonChart`, so
  `LandersEye` is untouched.
- **Review fixes (Codex, PR #95):**
  1. Level ground shows nothing that depends on terrain: with `ground="level"` a day dot
     reads the hour, azimuth and elevation (no disc fraction), the line is "Level ground,
     0°", and the keyboard hint and announcement say so. `level-ground.test.ts` renders the
     readout and both lessons' steps at 2028-01-18 00:00 UTC and three other hours.
  2. The hour on screen is the hour Check judges: the body and the time bar share one drag
     session (`drag-session.ts`), and any end of a drag (up, cancel, lost capture, window
     blur, hidden tab) commits the hour on screen.
  3. Lesson 2 step 4 needs a risen Sun: a value goal may carry an optional second
     condition, `also` (drag-body only, checked by `validateLesson`). The goal is now
     `sun_el_deg > 0` and `sun_frac < 0.5`: 20 of the 49 hours pass, 2028-01-04T02:00:00Z to
     21:00:00Z, the example hour among them; the 9 plain-night hours before are misses
     whose hint says the Sun must be above level. Luna's line, hint and explanation changed.
  4. Pip's power meter follows the hour on screen live during a drag, through a small live
     value read by the meter alone; the static-layer render test still passes.
  5. The sketch's stroke keeps its line in a ref updated on each move and ends the same way
     on up, cancel and lost capture; a test checks stroke, up, then Done.
  6. "Start again" goes once the sketch is revealed, as intended: a sketch step is one
     attempt (`overview.md`, "Game rules"), and the lesson's words promise no redraw.
- **Notes:**
  - The real data agrees with the keys: over the story month the stored maximum Sun
    elevation reads 0.63° (`l1.sun_el_max_deg`) and Earth's 6.22° (`l4.earth_el_max_deg`),
    minima −0.25° and −7.53°; lesson 2's 48 hours hold 20 hours with the Sun up and a disc
    fraction under 0.5, the example hour's 0. `drag-body.test.ts` checks all of this.
  - The series stores elevations in steps of 0.01°, so an exact `==` goal could never
    match a decoded float. Lessons 1 and 4 now carry `tolerance: 0.005` (half a step):
    exactly the hours that read as the month's highest count (test checks every hour).
  - A `flat` or `smooth` scene draws a level skyline at 0° (a drawing with no blockers;
    values still come from the series). Only the dragged body is drawn, and it sets the
    vertical range. `smooth` is drawn level too: the stored smooth-Moon skyline exists only
    for sphere-tier sites.
  - The `preview` lines of these steps are now the failed-load fallback (and lesson 2
    step 3's reveal caption); their "Soon you'll…" lines are gone. `drop-pin` keeps its
    holding form (`PENDING_STEP_KINDS`).
  - Lesson 2's scene now looks at `l2.example_utc`, so the sketch draws the Sun there; its
    unused `readout` (the site name) was removed.
  - The new render-count test found that the chart's static layer redrew on every hour
    when the lesson's examples object was handed over again; fixed by keying the chart
    window on its two hours.
  - In lesson 2 step 4 the Sun's 48-hour path is short on the 360° strip; the time bar
    under the chart is the easier way to sweep it.

#### 2026-11-13 · A5 · Lessons 1 to 4 playable, with their cards
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the final hints, explanations, reveals
  and panel-step previews of lessons 1 to 4 (and the matching "Words" lists in
  `lessons.md`), the four Under-the-hood cards, the routing, path and completion changes,
  the slider readout, the "not ready" form of panel steps and their vitest tests; checked
  each multiple-choice answer against `worked_examples.json` and the story month's
  series. **AI-generated images:** the side view of the curved Moon for lesson 3's reveal
  (inline SVG in `lesson/scenes.tsx`, a labelled schematic, not to scale). Checked by the
  agent with the tests, typecheck, build and pytest, by playing lessons 1 to 4 in a
  browser at 1440 × 900 and 390 × 844 (and once with `VITE_DATA=fixtures`, and once by
  keyboard only), and with the Impeccable detector. A human has not played the lessons.
- **State:** verified (333 Python tests, 1,849 web tests and the typecheck pass on the merge with main; reviewed by Codex, which recomputed every answer of lessons 1 to 4 from the real data; five findings fixed (the highest-Sun formula uses the distance from the pole and is called an estimate; the ridge is said to be toward the Sun; the 20 km slider goal is exact; story-month numbers say this month; the wording test covers every visible string); played by the builder by keyboard at two sizes; not yet played by the team lead)
- **Changed:** `web/src/features/academy/` (`lessons/l1.ts`–`l4.ts`, `lessons/index.ts`,
  `lessons/story.ts`, `lessons/COVERAGE.md`, `cards/`, `index.tsx`, `path-map.tsx`,
  `complete-screen.tsx`, `lesson-screen.tsx`, `lesson/stage.tsx`, `lesson/scenes.tsx`,
  `lesson/conversation.tsx`, `step-view.ts`, `types.ts`, `academy.css`, tests),
  `docs/academy/lessons.md` (a "Words" list per lesson and two card notes),
  `docs/design/c2/built-lessons-*.png`
- **Notes:**
  - `/academy/l1_sun` to `/academy/l4_link` open with the real worked examples, with plain
    loading and failed-to-load pages. Every lesson is open from the start, as
    `overview.md` says; lessons 5 to 8 show "Not written yet" on the path. The sample is
    no longer linked from the path; it still opens at `/academy/sample`.
  - Panel steps (`drag-body`, `draw-skyline`, `drop-pin`) wait for A3. Until then each
    shows a `preview` (a new optional field): Luna says what the learner will do there,
    the stage shows the real answer, and "Continue" moves on for no XP. A skipped step
    is not counted for the stars; `starsFor(0, 0)` already gave 1 star and no patch.
  - Number sliders now show their readout (the s²/2R drop in lesson 3, the link time
    from `l4.link_pct_by_mask` in lesson 4). Lesson 3's illustration reveal is now drawn.
  - `docs/science.md` has no 1.54° tilt (lesson 1's card) and no 0.26° off-centre shift
    (lesson 4's card); the cards describe both in words. §9 names
    `web/src/lib/scoring/metrics.ts`, which does not exist; the code is `scoring.ts`.
  - On the fixture the lessons validate and play, but its synthetic numbers do not fit
    the story (lesson 2's Sun is above the ridge; lesson 1's maximum is 4.4°).
  - Review fixes (Codex review of PR #81), each its own commit:
    1. Lesson 1 step 4 asks "Highest Sun ≈ (90° − how far south you are) + ( ? )". After a
       math review, the rule is worded as an estimate, not a limit (the stored six years
       reach a little higher than its 2.08°): Luna says "about 2° at Pip's latitude in the
       best season ... one is an estimate for the best season, the other is this month",
       no 2.08 is typed, and a test fails if any lesson or card source words it as a limit.
       A test checks that 90 − |`l1.site_lat_deg`| + 1.54 rounds to 2. The miss explanation says what 23.4° and 5.1° really are. The
       lesson 1 card quotes `docs/science.md` §3.4's highest-Sun rule with |φ|, the lesson 4
       card its 0.26° off-centre shift.
    2. Lesson 2 step 1 says the ridge lies in the Sun's direction; step 3 sketches the
       skyline towards the Sun; step 5 compares two features in the same direction.
    3. Lesson 3's slider goal is exactly 20 km (19 and 21 km read 104 and 127 m and are
       misses). A test tries every position of both sliders: an answer is accepted exactly
       when its own readout answers the question. Lesson 4's "6.5° or more" passes it.
    4. Story-month numbers say "this month". Lesson 4 step 5 asks "Which rule made them all
       fail?" and says only that a 5° margin gives `l4.link_pct_mask5`% this month. Lesson 1
       step 3 says the Sun's direction circles and for part of the month it is just below
       level; the 511 hours and twelve 30° sectors are not typed.
    5. The drift test covers every learner-visible string, every option in order, no
       duplicate options and every marked answer in range. Card text is pinned by a
       snapshot.
    6. Played by keyboard only at 1440 × 900 and 390 × 844, all four lessons end to end:
       focus visible on every control, no control under 44 px, no sideways scroll, no
       console errors. Fixed: the result and a right option said "Correct" twice to a screen
       reader; a degree slider read "6.5 °" (now "6.5°"). Progress: tests on lesson 1 played
       wrong then right, quit halfway, replayed better and worse, and reloaded (XP is
       best-of, never added twice, quitting saves nothing); in the browser a replay of
       lesson 4 earned 35 XP and the total stayed 160. A missing, null, NaN or empty
       worked-example key: the lesson does not open and says some of its numbers are not
       built yet.
    7. The Lander's eye chart is not wired into the panel steps (A3).
  - Worked-example keys worth adding later: the hours the Sun is above level in the story
    month (511 of 720), the number of 30° compass sectors the Sun visits (12), and the
    5° link time for other 30-day windows (about 32.6% from February and 32.9% from
    October 2028), so lesson 4 could show the month-to-month spread.

#### 2026-11-13 · A9 · Math review of all fifteen science sections
- **Who:** Codex review agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-sol — read the science document against Python and
  TypeScript, wrote independent numerical probes, checked saved Horizons responses
  and read-only prepared terrain, and wrote the review report. No human or owning
  track has checked the report yet.
- **State:** built, not verified
- **Changed:** `docs/reviews/a9-math-review.md`, the short reproducer in
  `docs/reviews/a9-scripts/boundaries.py`, and two wrong TypeScript file paths in
  `docs/science.md`. No formulas, code or derived data changed.
- **Notes:**
  - Reviewed all 15 numbered sections and inventoried 40 formula groups. Recorded
    128 case-level numerical checks, including 36 additional Python/TypeScript
    scoring scenarios. Found 1 A, 11 B and 5 C findings. The A finding is a shared
    prefix-sum rounding error that can turn an exact score of 70 into CAUTION.
  - Full saved-response G2 passes at all 20 sites over 52,584 hours. Rebuilt one
    real skyline and checked four bins independently. The report states the
    unimplemented paths and every material verification limit.
  - Required checks pass: pytest 322 tests (exit 0), frozen-lockfile install
    (exit 0), and, after bringing in A8 from main, web 1,744 tests and typecheck
    (both exit 0). The report and retained script were rechecked after the disk-full
    interval; a PowerShell text-encoding issue was repaired. State remains built,
    not verified pending independent review.

#### 2026-11-13 · A8 · Validation page, "How we know it's right"
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote the page at `/validation`, its model,
  number formatting, the two hand-built SVG charts and the vitest tests — checked by the
  agent with tests, typecheck and build, the impeccable detector (0 findings), and by eye
  at 1440 × 900, 1024 × 768 and 390 × 844 on the real data and on `VITE_DATA=fixtures`
  (no console errors, no sideways page scroll, every control at least 44 px, keyboard
  focus visible). A human has not read the page yet.
- **State:** verified (322 Python tests, 1,744 web tests, typecheck and build pass on the merge with main; reviewed by Codex (every recorded miss shown, counts match both data files, three mutations caught; six findings, all fixed with tests: largest differences round up, a damaged file never prints NaN, the compass-bearing note is in the open); not yet read by the team lead)
- **Changed:** `web/src/features/validation/` (all new except `index.tsx`), screenshots
  `docs/design/c2/built-validation*.png`
- **Notes:**
  - Every number on the page comes from `validation.json`. Derived display values (a
    difference of the file's two numbers, row counts, the largest daily value) are marked
    in code comments. A gate with `passed: null` reads "Checked in the web tests". A
    failed gate is a NO-GO cross with "Failed"; a comparison outside its mark is a CAUTION
    "!" with "Outside the mark", its explanation in a card above its table.
  - Missing or unreadable file: "Validation has not been run on this build", no numbers.
  - Sections 3 and 5 also show every gate and comparison the brief did not place: G1, G3,
    G9, G10 and G11 under "Other checks"; R5 (and R6 on the fixture) under Slope.
  - Gaps in the real file: no R4 (the page says so), the raw compass-azimuth difference
    of decision 0011 exists only inside G2's `detail` text, and in-mark R1 to R3
    `explanation` fields hold pixel notes, not explanations (shown behind "Notes from the
    pipeline").
  - The fixture already has a failing comparison (R1) and a failing gate (G6). The test
    for an outside self-comparison is built from the fixture's R5 row.
  - Review fixes (Codex review of PR #79), each its own commit:
    1. A largest difference, an upper bound or a "within X" is rounded up, a lower bound
       down, a reading to nearest (`format.ts`), and a shown value keeps its side of its
       limit or mark. The real headline now reads "within 0.0061°", not "0.006°". A test
       checks every gate and comparison in both data files against its printed result.
    2. `check.ts` checks every field the page reads. An incomplete gate or row reads
       "This check's record is incomplete in this build" in its place and is never
       counted as passed; no NaN, undefined, null or Infinity in any tested case.
       `parseValidation` in `web/src/data/` still rejects a whole file whose gate has a
       result but no measurement, so that case reads "not run" in the app.
    3. G2's raw-bearing sentences are quoted from `detail` in the open under the headline.
       The pipeline could supply them as fields: `raw_azimuth_max_deg`,
       `raw_azimuth_max_at` (site, body, UTC), `raw_azimuth_hours_over_limit`,
       `sky_max_deg` and `elevation_max_deg`.
    4. Method boxes link to lessons 1 to 4 by catalog title; lessons 5 to 8 get no link.
       The feature imports only `academy/catalog.ts`. No link points into the private repo.
    5. Every data table has a caption; every header cell a scope.
    6. Contrast: CAUTION amber text 8.83:1 on the card, 8.25:1 on the highlighted row;
       the diagonal 5.78:1 on the plot. The mark's shaded band was 1.12:1, so its edges
       are now dashed Ink 3 lines (5.78:1 on the plot, 5.15:1 over the band).

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

#### 2026-11-13 · A11 · Submission materials (drafts)
- **Who:** team lead
- **AI use:** Claude Code, claude-sonnet-5-5 — wrote the project description (three
  lengths), the objective-to-feature map, the three-minute demo script with its
  one-minute version and judge questions, the AI-use disclosure, the links checklist and a
  proposed README, from the repository's own documents and `data/derived/validation.json`;
  ran the Python scoring reference on the stored series to check the demo's dates — not yet
  read by the team lead; every number is footnoted to a file and every unsure point is
  marked "CHECK:"
- **State:** built, not verified
- **Changed:** `docs/submission/` (new), this entry
- **Notes:**
  - States in the objective map were checked against `origin/main` and the open pull
    requests, and must be checked again on the day (the validation page, #79, had merged): #81 (Academy lessons 1 to 4), #83 (landing date in the timeline and "Next GO"),
    #77 (sunlit-peak variants) and #80 (custom-site server) were open. The Slip Planner, the
    Compare window, the flat Polar map and the custom-coordinates form are not built and
    have no pull request, so the demo script reaches the slip story with the landing-date
    buttons instead.
  - Two gaps are written down plainly: sunlight at Connecting Ridge is well below the
    published 92.27% (different point spans; not closed), and `docs/orchestration/status.md`
    totals do not match its own ledger table.
  - The README is not changed. A proposed version is `docs/submission/README-proposed.md`.

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

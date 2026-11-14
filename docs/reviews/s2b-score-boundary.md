# S2b score-boundary verification

## Scheme

The rules live in [`science.md`](../science.md), sections 9 to 11. Scoring
recovers the stored Sun-fraction integer counts and subtracts integer prefix
sums before dividing once. Lit/link counts and run lengths are integers too.
The same window therefore has identical metrics, utilities, score and status
at every offset. Both languages use the same 12-decimal comparison rule,
utility endpoint handling, weighted operation order and returned-score rounding.
There is no screen or contract change. The trade-off is recorded in
[decision 0015](../decisions/0015-exact-count-scoring.md).

## Catalog audit

The baseline is main `4f7a3a7faae323a1b8049d34ae5c206a4d5ce5a6`, including the
five best-lit variants from PR #77. Each pass was one Python process with
numerical-library threads limited to one. One pass ran before implementation
and saved every score, status and veto bitset; one ran after implementation.
No terrain, map, scene or placement build was run.

Both passes read every site's stored Int16 series and every unchanged preset.
For each profile they used the actual scoring functions for flags, prefix
means, longest runs and evaluation, at indices 0, 24, 48 and so on. The longest
run function was applied to each selected day's window, rather than computing
the unused intervening landing hours. This changes no metric and avoids an
unnecessary all-hours sweep. The windows that run beyond the time grid remain
unavailable in both passes.

There are 25 sites, five profiles and 2,191 landing days: **273,875** results,
including **270,375** fitting windows and **3,500** unavailable windows.

| Profile | Fitting windows | Unavailable | Status changes | Score changes above 1e-9 | Largest absolute score difference |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `viper` | 52,300 | 2,475 | 0 | 0 | 7.673861546209082e-13 |
| `im2_athena` | 54,550 | 225 | 0 | 0 | 2.7995383788947947e-12 |
| `chandrayaan3` | 54,450 | 325 | 0 | 0 | 4.760636329592671e-13 |
| `artemis_crewed` | 54,625 | 150 | 0 | 0 | 1.1802114840975264e-11 |
| `blue_ghost1` | 54,450 | 325 | 0 | 0 | 1.7905676941154525e-12 |

**Complete list of status changes: none.** Consequently neither the daily
Slip Planner status nor Next GO changes for any catalog preset.

The before and after status counts are identical:

| Profile | GO | CAUTION | NO-GO |
| :--- | ---: | ---: | ---: |
| `viper` | 1,516 | 1,954 | 48,830 |
| `im2_athena` | 3,088 | 68 | 51,394 |
| `chandrayaan3` | 0 | 13 | 54,437 |
| `artemis_crewed` | 5,644 | 0 | 48,981 |
| `blue_ghost1` | 474 | 43 | 53,933 |

These comparisons establish the result for these stored files and five
presets. They do not assert that an arbitrary custom profile cannot sit on an
affected exact boundary. That is the regression fixed here.

## Worked examples and derived data

`uv run truesouth build-worked-examples` returned exit 0. Its output is
**byte-identical** to the saved original: zero value changes. The story stays
2028-01-01T00:00:00Z GO at score 100, 2028-01-22T00:00:00Z NO-GO, and next GO
2028-01-27T00:00:00Z. SHA-256 checks of every derived file found no changes.
No derived file is part of this PR.

## Regression evidence

- The original A1 case failed before the change. All 16 one-hour landing
  indices now return exactly 70 and GO, for both literal and decoded 0.7.
- Seeded property tests translate contract-grid windows to offsets 0, 1, 15,
  1,024 and 50,000, after long full-Sun prefixes. They require identical full
  evaluations, check floating bits explicitly, and compare sweeps with single
  windows in both languages.
- Boundary tests cover inclusive flags and veto equality, slope ideal and
  maximum, zero run/zero limit utility branches, operational elevation,
  landing bounds, clearance and countdown consistency. A real excess beyond
  the declared comparison precision still triggers its veto.
- `uv run truesouth build-fixtures` generated 76 shared cases, up from 58:
  16 translated A1 cases, an exact veto boundary and a score of exactly 70
  through all three weights. The generator and both test suites assert the
  independent expected boundary results, rather than merely comparing copies.
- The new scoring-only series uses the existing binary format and sits under
  `data/fixtures/scoring/boundary/`. It is not an added catalog site. All other
  fixture binary files are unchanged.

## Checks

All commands ran sequentially. Each native exit code was captured immediately
after its redirected command. Python used `OPENBLAS_NUM_THREADS=1` and
`OMP_NUM_THREADS=1`; Vitest used one worker.

| Command | Result | Exit code |
| :--- | :--- | ---: |
| `uv run pytest -q` | 432 passed, 1 skipped, 3 warnings | 0 |
| `pnpm --dir web install --frozen-lockfile` | Frozen lockfile installed | 0 |
| `pnpm --dir web test --maxWorkers=1` | 1,926 passed in 79 files | 0 |
| `pnpm --dir web typecheck` | Passed | 0 |
| `pnpm --dir web build` | Passed; existing large-chunk advisory | 0 |
| G10 after the fixture-label correction | 78 passed, including all 76 cases | 0 |

The first Python full run found one label collision: its existing `veto_...`
coverage check interpreted the equality case as a veto that must trigger.
Renaming that new label to `exact_veto_limit` fixed the fixture test without
changing an input or result. Python was rerun to a clean full-suite exit;
the affected G10 test was then rerun. The passing full web, typecheck and build
runs were not repeated. No schema or contract changed, so export-schema and
gen:types are unnecessary.

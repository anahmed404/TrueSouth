# Validation

How we know TrueSouth's results are right, and how we show it.

There are two kinds of check. **Hard gates** must pass or the test run fails. **Reported
comparisons** are measured, published on the in-app validation page, and investigated when
they look wrong.

## Hard gates

Run with `uv run pytest` and `pnpm --dir web test`.

| # | Check | Pass mark | Section of [`science.md`](science.md) |
| :--- | :--- | :--- | :--- |
| G1 | Horizons parser reads a saved response and returns its exact values. Longitudes are confirmed east-positive from the header. | exact | §3.1 |
| G2 | Our Sun and Earth azimuth and elevation match Horizons' own site table at every catalog site and every hour of the time grid. | max difference ≤ 0.02° | §3.2–3.3 |
| G3 | `pyproj` and the closed-form projection agree, forward and inverse. | ≤ 0.01 m | §2.3 |
| G4 | Flat terrain at height 0 gives a skyline of $-\arccos(R/(R+h))$ in every bin. | ≤ 0.001° | §4–5 |
| G5 | A synthetic wall of height $H$ at distance $D$ gives the exact elevation angle, in the near field and in the far field. | ≤ 0.001° | §4–5 |
| G6 | Near-field and far-field methods agree where they meet. | ≤ 0.02° | §5 |
| G7 | Disc fraction matches the exact formula for flat skylines at several heights. | ≤ 0.005 | §6 |
| G8 | A synthetic plane tilted 10° gives a slope of 10° by both slope methods. | ≤ 0.001° | §8 |
| G9 | Series encode and decode without losing more than the stated precision. | ≤ 0.005° and ≤ 0.00005 | [`data-contracts.md`](data-contracts.md) |
| G10 | TypeScript metrics, vetoes, scores and statuses match the Python reference on the shared fixture. | ≤ 1e-9 | §9–10 |
| G11 | Generated TypeScript types are up to date with `contracts.py`. | no diff | |

G2 is the strongest evidence in the project: about two million comparisons against NASA's
own ephemeris service. If it cannot be met, follow the fallback in
[`decisions/0004-one-global-ephemeris.md`](decisions/0004-one-global-ephemeris.md).

The shared fixture for G10 is `web/src/lib/scoring/__fixtures__/scoring_cases.json`,
written by `uv run truesouth build-fixtures`. It holds at least 40 cases, covering every
veto, each preset, a relay case, a slope-not-assessed case and windows at both ends of the
time grid.

## Reported comparisons

Run with `uv run truesouth validate`. Results go to `data/derived/validation.json`.

| # | Comparison | Against | Investigate when |
| :--- | :--- | :--- | :--- |
| R1 | Mean `sun_frac` over the time grid, per polar catalog site | NASA's average sunlight map at the site's pixel (PGDA product 69) | differs by more than 10 percentage points |
| R2 | Share of hours with `earth_frac > 0`, per polar catalog site | NASA's average Earth-visibility map | differs by more than 10 percentage points |
| R3 | Our slope from the 80 m map | NASA's 80 m slope map (PGDA product 90) | differs by more than 2° |
| R4 | Our 100 m-baseline slope from a close-up DEM | NASA's close-up slope map (PGDA product 78) | differs by more than 2° |
| R5 | Skyline convergence: 1,440 bins against 2,880 bins with half the step, at three sites | ourselves | RMS above 0.05° |
| R6 | Sensitivity grid's fast skyline against the full method, at three sites | ourselves | mean `sun_frac` differs by more than 5 points |

Why R1 and R2 are not hard gates: NASA's maps average 18.6 years and ours average 6. A
small gap is expected. NASA's Earth map counts Earth as visible when any part of its disc
shows, which is why R2 uses `earth_frac > 0`.

## `validation.json`

```json
{
  "generated_utc": "…",
  "gates": [ { "id": "G2", "name": "…", "passed": true, "measured": 0.011, "limit": 0.02, "unit": "deg", "samples": 2103360 } ],
  "comparisons": [
    { "id": "R1", "site_id": "connecting_ridge", "ours": 0.83, "reference": 0.86, "unit": "fraction",
      "reference_source": "https://pgda.gsfc.nasa.gov/products/69" }
  ]
}
```

Numbers above are placeholders showing the shape.

## The validation page

`/validation` in the app. Spec: [`features/validation-page.md`](features/validation-page.md).

## Honesty rules

- Publish every comparison, including the ones that look bad.
- When a result is outside its "investigate" mark at demo time, the page says so and gives
  our best explanation.
- Never tune a mission profile to make a validation number look better. Validation tests
  the series; profiles are applied after.

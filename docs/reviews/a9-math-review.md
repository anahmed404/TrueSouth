# A9 math review

## Summary

Reviewed `2f258dd` on 2026-11-13 UTC. All 15 numbered sections of
`docs/science.md` were read, including sections 2.4, 3.4 and 7.1. Section 15
was revisited after the numerical work. This is a review, not a science change.

The inventory below contains **40 formula groups**, including related vector
components and discrete decision rules. All five constants in section 1 were
checked. A group is not a count of LaTeX displays. Section 12 has no executable
implementation to compare with its formulas.

There are **1 severity-A finding, 11 severity-B findings and 5 severity-C
findings**. A changes an available result. B is a real ambiguity or difference
that does not change an available result today but could. C is wording or a
stale reference. Missing future features are B, not evidence that today's
listed-point results are wrong.

The numerical ledger records 74 independent Python checks, 14 independent
browser geometry checks, four independently calculated real skyline bins and
36 additional scoring scenarios: **128 case-level checks**. The 36 scenarios
also compare Python and TypeScript through 11,764 recursive value comparisons;
the largest difference is zero. Additional targeted probes are recorded under
the findings. They are not added to the 128 count.

I also read all 20 real series, covering 52,584 hours each, and rebuilt their
eight columns from the stored skylines and ephemeris. That is 8,413,440 column
values, not that many independent formula tests. I reran G1 and the complete
G2 from saved raw responses, without network calls or writes to those data.
G1's difference was zero. G2 covered 2,103,360 site/body hours. Its largest
gated component was 0.00600724942124 degrees, below 0.02 degrees. Full sky
separation reached 0.00602921260851 degrees. The raw azimuth reached
0.0823560453039 degrees at Apollo 11, 2031-10-14T01:00:00Z, with 28 exceptions
to 0.02 degrees, as already disclosed in section 3.3 and decision 0011.

## Findings

### A1. Prefix-sum rounding can turn an exact GO into CAUTION

**Section and sentence:** section 10, lines 492–493, “GO if no veto triggers
and score ≥ 70.” Section 9 defines the mean over the mission window, not an
approximation with a different status at an exact threshold.

**Code:** `science/src/truesouth/scoring.py:100` (`_means`) and `:132`
(`_evaluation`); `web/src/lib/scoring/scoring.ts:172` (`prefixMeans`), `:184`
(`windowMean`) and `:381` (`evaluationFromMetrics`). Both implementations
subtract accumulated sums, then compare the unrounded score with 70.

**Evidence:** use 16 hours with `sun_frac = 7000 × 0.0001`, the actual decoded
representation of 0.7. Set `sun_el = 1`, `earth_clear = 1`, duration to one
hour, minimum Sun fraction to 0.5, antenna mask to 1 degree, no operational
elevation or landing-angle limits, dark and blackout limits to zero, and
weights to slope 0, power 1, comms 0. Slope is not assessed. There are no
vetoes. The independent one-hour mean gives a score of 70, hence GO. At
landing index 15, both languages give **69.99999999999993, CAUTION**. At
index 0, both give 70, GO. The score error is about −7.1e-14 points. The
visible effect is a whole status category. The existing G10 fixture proves
agreement between implementations, so it cannot catch this shared defect.

**Smallest fix:** decide and state the numerical boundary policy in
`science.md` first. Then apply it in both status implementations and add this
case to the shared fixture. A carefully bounded comparison policy can keep
prefix sums; rounding every displayed score and using that for status would
also change near-threshold behavior and needs an explicit decision. Update any
Academy card that quotes the boundary if its meaning changes. Section 15 does
not disclose this limit. The short retained script reproduces both languages.

### B1. Section 7.1 is implemented as helpers but not published by the pipeline

**Section and sentence:** section 7.1, lines 365–385, promises a nearby range
and a best-lit variant for every `sunlit_peak` catalog site.

**Code:** `science/src/truesouth/placement.py:90` (`evaluate_placement`) and
`:138` (`build_variant`) implement the calculation. However,
`science/src/truesouth/commands/build_sites.py:141`, `:172` and `:193` publish
only the original catalog sites and never call either helper.

**Evidence:** five input sites are `sunlit_peak`. The committed derived
catalog has 20 sites, **zero** `variant_of` values and **zero** `nearby_sun`
values. The stated result would add five variants and five nearby ranges.
On two synthetic 80 m grids, a point at a pixel centre correctly produces 13
candidates. Equal means choose the nearest candidate. Separate exact-distance
ties choose row 3 before row 5 and column 3 before column 5. Those helpers
agree with the document; their production integration is missing.

**Effect and fix:** no present listed-point number is wrong for this reason.
The missing range can matter by tens of percentage points; decision 0012
reports 59.9% at Connecting Ridge's listed point and 87.0% at its best-lit
pixel, a 27.1-point difference. I did not independently rebuild that winning
pixel. Keep section 7.1's math and integrate the helpers, files and consumers,
or mark the section as planned until that is done. Section 15 does not disclose
the incomplete integration.

### B2. Section 12 has no sensitivity-grid implementation

**Section and sentence:** section 12, lines 511–527, says “Compute for my
dates” evaluates 81 points, with a 720-bin, 150 km fast skyline and a centre
comparison.

**Code:** no `science/src/truesouth/sensitivity.py` exists. The API has no
sensitivity route. `science/src/truesouth/commands/validate.py:339` explicitly
omits R6 because the sensitivity grid is not built.

**Evidence:** the document requires 9 × 9 = **81** results; executable
implementations found: **0**. At 250 m spacing, the axis offsets are −1,000
to +1,000 m, and the corner is 1,414.213562 m from the pin. These two geometry
inputs have no repository sensitivity function to run. `compute_skyline` with
720 bins is not a substitute: it still uses far-field pixels and a 300 km
limit, rather than the described fast method.

**Effect and fix:** no current sensitivity number is available to be wrong.
Mark this section as planned, then implement its stated method and R6. Define
the initial far-field step and which switch the 1% growth follows before
implementation; the text currently does not settle these. This is not a
wrong-path edit because there is no replacement file. Section 15 does not
disclose the missing calculation.

### B3. Skyline bin edges and equal-blocker ties are not specified

**Section and sentence:** section 5, line 307, “Put the elevation in the
pixel's bin and keep the maximum.” The data-contract text gives centres but
does not give edge ownership or ties.

**Code:** `science/src/truesouth/skyline.py:195` rounds to the nearest centre,
with exact half-bin ties toward the increasing azimuth, wrapping to zero.
`_keep` at `:72` retains the first equal maximum, and `:85` does not replace a
previous winner on equality. `web/src/lib/geo/mesh.ts:48` and
`science/src/truesouth/worked_examples.py:165` use the same nearest-bin rule.

**Evidence:** 0.125 degrees selects bin **1**, not 0. At 359.875 degrees it
selects bin **0**, not 1439. Bins therefore own their lower edge and exclude
their upper edge, modulo 360 degrees. At two equal elevations of 1 degree,
processed in order at 1 km and 2 km, the first blocker remains at 1 km; reverse
the input order and the reported blocker is 2 km. The skyline height is 1
degree in either case. The nearest-bin outputs were run in both languages.

**Effect and fix:** existing code is consistent. A different reader could
build a shifted skyline or choose different blocker metadata and Academy
examples. State bin ownership, the nearest-bin tie and first-winner tie in
section 5. State the traversal order if blocker identity must be reproducible
independently of chunking. No code change is needed. This convention is absent
from section 15.

### B4. The disc formula does not specify its quadrature points or singular case

**Section and sentence:** section 6, lines 328–330, gives 33 offsets inside
the disc but does not say where they are. Its azimuth expression divides by
the cosine of centre elevation, which vanishes at the zenith and nadir.

**Code:** `science/src/truesouth/discs.py:33` first handles wholly clear or
hidden discs. Line 37 uses equal-width **midpoints**. Line 40 floors the cosine
at machine epsilon for remaining partial discs.

**Evidence:** at a flat zero-degree skyline with radius 0.27 degrees and
centre elevation −0.135 degrees, the code gives **0.195269727159**. A second
plausible choice of 33 equally spaced interior offsets gives
**0.196606020735**, a difference of 0.001336293576, or 0.133629 percentage
points. At −0.2565 degrees the answers are 0.006635955502 and 0.006713677072,
a difference of 0.000077721570. Exact endpoint checks return 0 and 1. A flat
zero skyline gives 1 at the zenith and 0 at the nadir, whereas direct use of
the written azimuth expression is undefined there.

**Effect and fix:** current catalog fractions are reproducible only after
reading the code. Different strip choices can move a threshold comparison.
Add the midpoint convention and the clear/hidden singularity handling to
section 6. Disclose that the remaining tangent-plane approximation is not
meaningful for an artificial skyline touching the zenith. Keep the current
code unless the science policy changes. Section 15 does not mention either
quadrature error or this singularity.

### B5. Missing terrain can silently become a clear sphere skyline

**Section and sentence:** section 5, lines 313–319, says missing pixels are
skipped and counted, and gives the flat horizon specifically for a sphere-tier
site. It does not define an empty bin at a terrain-covered site. Section 8
only explicitly identifies sphere-tier slope as not assessed.

**Code:** `science/src/truesouth/skyline.py:198` replaces every empty bin by
the sphere dip, even for a covered site. `science/src/truesouth/slope.py:68`
and `:113` return no slope for missing samples or an underdetermined plane.

**Evidence:** a 3 × 3 80 m map with a finite central site pixel and all eight
neighbors missing has no valid blocker in any of the 1,440 bins. Independent
terrain visibility is **unknown**. The code instead returns
**−0.086936571934 degrees** in every bin. At Sun elevation 0 and radius 0.27
degrees it then gives a finite fraction of **0.701657964397**, despite no
usable surrounding terrain. A normal finite flat map gives the same dip for
a legitimate geometric reason. For slope, a complete plane gives the expected
angle; a collinear close-up sample set gives no slope, not a zero-degree slope.

**Effect and fix:** Connecting Ridge's real skyline had zero missing samples,
so this probe does not establish a present catalog error. A future custom site
or damaged map could acquire a confident sunlight value from missing terrain.
Define the missing-bin and missing-slope policy in `science.md` first. Prefer
an explicit unavailable result or a clearly tagged sphere assumption over
silent substitution, then change the code and contracts as needed. Section 15
discloses finite map resolution, not this missing-data behavior.

### B6. The highest-Sun teaching rule needs a latitude domain

**Section and sentence:** section 3.4, lines 247–256, gives a best-season
maximum for “latitude Ï†” without restricting latitude.

**Code:** `science/src/truesouth/ephemeris.py:23` computes the direction
without this approximation; `web/src/lib/geo/system.ts:44` gives the
corresponding infinite-distance elevation.

**Evidence:** at Connecting Ridge's −89.4555 degrees the teaching rule gives
**2.0845 degrees**; the six-year zero-ground-height topocentric maximum is
**2.131334005655 degrees**, a difference of +0.046834005655 degrees. This is
reasonable for a rule explicitly described as approximate. At latitude 0,
the same rule gives **91.54 degrees**. An elevation cannot exceed 90 degrees.
The best-season idealized equatorial maximum is 90 degrees; a fixed-longitude
hourly sample over the stored six years reaches 89.847733254679 degrees.
That last number is a sampled check, not a new equatorial maximum formula.

**Effect and fix:** the shipped polar teaching example is valid. Extending it
to equatorial catalog sites could teach an impossible angle. State the polar
domain, outside the sub-solar latitude band, and say “estimate,” not a strict
upper bound. If generalizing it, correct `science.md` before adding a new
formula to code or Academy cards. Section 15 does not disclose this domain.
The two 1.54/1.59 statements themselves are both defensible; see the source
check below.

### B7. Section 14's Sun elevation is an infinite-distance drawing approximation

**Section and sentence:** section 14, line 567, “A site's Sun elevation
follows from the sub-solar point alone.” This reuses the elevation symbol from
the topocentric calculation without stating a different approximation.

**Code:** `web/src/lib/geo/system.ts:44` implements the written dot product.
`science/src/truesouth/ephemeris.py:23` subtracts the observer position as
section 3.2 requires. They are different elevations.

**Evidence:** take a zero-height site at (0, 0) degrees, a Sun sub-point at
(0, 90) degrees and distance 149,600,000 km. The section 14 formula gives
**0 degrees**; section 3.2 gives **−0.000665413114 degrees**. A second site
at (−85, 0) degrees with the same Sun also gives 0 versus
−0.000665413114 degrees. A finite observer is below the centre-based
terminator. Terrain skyline and the finite Sun disc create further
differences between a drawn day/night line and visibility.

**Effect and fix:** this helper currently has only test consumers, and the
scene's lighting is decoration. No mission metric was found to use it. Name
the approximation and distinguish its centre-based terminator from the
section 3.2 elevation in section 14. Keep the drawing code. Section 15 does
not disclose this approximation.

### B8. Contracts accept profiles and sites forbidden by the science conventions

**Section and sentence:** section 2.1 rejects sites beyond 89.999 degrees in
absolute latitude. Section 10 requires power and comms weights not both zero,
and an ideal slope below the maximum slope.

**Code:** `science/src/truesouth/contracts.py:281` (`Weights`) and `:289`
(`MissionProfile`) do not enforce the two cross-field requirements.
`CustomSiteRequest` uses the inclusive ±90-degree `Latitude` type.
`science/src/truesouth/frames.py:14` rejects those near-pole sites, and
`scoring.py:74` and `:129` fail later. The web scenario validation at
`web/src/state/scenario.ts:813` already protects profile edits.

**Evidence:** weights (slope 1, power 0, comms 0) pass `MissionProfile`
validation. With no assessed slope, both scoring copies throw “score is
undefined when assessed weights sum to zero”; with an assessed slope they can
produce a score, even though the profile is still forbidden by section 10.
Both-zero power and comms are blocked by the scenario editor. Separately,
latitudes −89.99901 and −90 degrees pass `CustomSiteRequest` but are rejected
by `local_basis`; −89.999 degrees passes both. These are boundary-validation
gaps, not a disagreement in a valid score formula.

**Effect and fix:** no preset or current editor path was found to bypass its
guard. A direct contract consumer or future API route could accept an input
that fails during calculation. Keep the science rules and add validators at
the appropriate contract boundary. Regenerate TypeScript types if the
contract changes. Section 15 does not disclose inconsistent accepted domains.

### B9. Hourly flags can miss an entire short lit interval

**Section and sentence:** section 15, lines 586–587, says “A transition is
good to a few minutes.” Section 9 explicitly considers only neighboring
hourly samples whose combined flags differ.

**Code:** `science/src/truesouth/scoring.py:205` (`countdowns`) and
`web/src/lib/scoring/scoring.ts:568` (`crossing`) skip intervals with equal
endpoint flags, exactly as section 9 specifies.

**Evidence:** let Sun fraction go linearly from 0.4 to 0.6, with threshold
0.5. Let Sun elevation go from 2 to 1 degree, with operational minimum 1.25
degrees. The independent fraction crossing is 0.5 hours; the elevation
crossing is 0.75 hours. All conditions pass for **15 minutes**, from 0.5 to
0.75 hours. Both endpoint flags are false. The Python function returns no
sunrise and no sunset; TypeScript uses the same predicate. A single-condition
changing-endpoint case does interpolate correctly. Faster terrain crossings
can also occur between hourly ephemeris samples; I did not bound their error.

**Effect and fix:** no real missed event was established. The limitation is
stronger than “a few minutes”: an event can be absent. Keep section 9's
specified hourly algorithm unless the team chooses to change it. Amend section
15 to disclose missed sub-hour intervals and remove an unsupported universal
timing-accuracy implication. Quantifying a minutes-level accuracy claim needs
a finer-time independent comparison.

### B10. Quantisation can store a 360-degree azimuth

**Section and sentence:** section 2.1 defines azimuth modulo 360 degrees.
Section 7 calls the stored columns the centre's local azimuth. The data
contract gives the 0.01-degree step but does not state a wrap after rounding.

**Code:** `science/src/truesouth/series.py:73` (`encode_series`) rounds with
`np.rint`; `:100` (`decode_series`) applies scale and offset without wrapping.

**Evidence:** a physical azimuth of 359.999920911472 degrees at
`artemis_de_gerlache_rim_2`, 2030-07-20T16:00:00Z, is stored as **360 degrees**.
This is an error of +0.000079088528 degrees as a linear value and no change
of physical direction after wrapping. A synthetic 359.999 degrees likewise
rounds to 360, whereas 0 degrees stays zero. The real-data scan found the
instances counted in the quantisation notes below.

**Effect and fix:** the current geometry helpers wrap bearings. I found no
misclassified mission hour caused by 360 degrees. A consumer expecting the
half-open domain could fail. Decide whether the stored domain allows the
rounded endpoint or must wrap it, state that in the science and contract
documentation, then change code only if the policy requires it. Also state
the encoder's half-to-even rule; it differs from the nearest-bin half-up rule.
Section 15 does not discuss quantisation at domain edges.

### B11. Close-up and skyline-wall formulas are ahead of the production outputs

**Section and sentence:** sections 8 and 13 describe a 5 m close-up plane
fit, close-up mesh and a skyline wall drawn only when its blocker is farther
than 10 km.

**Code:** `science/src/truesouth/slope.py:85` and
`terrain_mesh.py:108` provide the close-up helpers. However,
`commands/build_sites.py:139` always publishes `has_closeup=false` and no
close-up mesh. `web/src/lib/geo/scene.ts:81` provides the wall-height helper;
no production call draws that ring or applies the blocker-distance gate.
The old Local terrain panel is a placeholder, and the newer shared scene
does not call this wall helper either.

**Evidence:** 20 real catalog sites have **zero** close-up meshes. Synthetic
plane fits with gradients (0.12, −0.08) and (0, 0) give the independent
8.206727074-degree and 0-degree answers to floating-point precision. The
wall helper gives 0 km for a zero-degree skyline and 0.874886635259 km for
5 degrees. The required draw decision is false at exactly 10 km and true
beyond 10 km; there is no production implementation to run at either input.

**Effect and fix:** no current close-up slope or wall-height number is shown
by these missing paths. Mark their implementation state in the document or
finish the callers later. Do not substitute the 160 m polar slope for the
100 m close-up slope. Keep the formulas; no math fix is indicated. Section 15
explains why close-up DEMs do not feed skylines but does not disclose that the
close-up production path and wall are absent.

### C1. Two TypeScript file references were stale and are fixed in this PR

Section 9, line 456, named `web/src/lib/scoring/metrics.ts`. Section 10, line
498, named `web/src/lib/scoring/score.ts`. Neither exists. Both functions live
in `web/src/lib/scoring/scoring.ts`. These are the only changes to
`docs/science.md`. Numeric effect: zero. Section 12's missing file is B2 and
was not replaced by an unrelated path.

### C2. The frame uncertainty and the old unproven status are stale

Section 15, lines 580–582, says Horizons' frame is still unconfirmed. Section
3.1, lines 135–143, confirms mean-Earth DE421 and the parser checks the header
at `horizons.py:137`. G1 found `MOON_ME` and east-positive definitions with
zero difference. Decision 0004's “Not yet proven” paragraph also predates the
completed full G2 run. Numeric effect: zero. Update the current known-limit
wording and add a dated outcome to the decision; retain its historical
decision and fallback. Do not invent a frame rotation.

### C3. The Python/browser dividing sentence contradicts the sections after it

Section 7, lines 354–355, says everything below it is computed in the browser.
Sections 7.1, 8, 12 and 13 contain Python computations; section 7.1 even says
so explicitly. `placement.py`, `slope.py` and `terrain_mesh.py` are examples.
Numeric effect: zero. Limit the dividing sentence to mission metrics and
scores in sections 9–11, as decision 0002 does.

### C4. The slip-sweep scan description is no longer literal

Section 11, line 503, says longest runs are scanned directly. Python's
`scoring.py:86` uses windowed operations. TypeScript's
`scoring.ts:221` (`longestRuns`) uses break positions, prefix and suffix runs,
and range maxima. The 36 added scenarios compare every landing hour in both
sweeps with zero difference. This changes computational method, not the
definition or a visible number. Describe the result as the longest unbroken
run, with the implementation free to use this equivalent optimized method.

### C5. The “polar Sun is only 1–2 degrees high” sentence is too broad

Section 4, line 282, uses “polar” where it means very close to the pole. At
Connecting Ridge the stated teaching estimate is already 2.0845 degrees; the
stored six-year direction reaches 2.131334 degrees. At 80 degrees south,
section 3.4's same approximate rule gives 11.54 degrees. The text does not
drive any result, so the numeric effect is zero. Say the Sun stays low near
the pole and link to section 3.4 rather than giving a universal 1–2-degree
range.

## Section-by-section inventory

Every symbol uses the meaning in the corresponding science section. Angles
at function boundaries were checked in degrees. Trigonometric calculations
use radians internally. Distances were checked against the suffix convention;
topocentric body ranges and body radii are in kilometres, terrain in metres.

| Section | Formula groups, constants, thresholds and assumptions | Implementation | Checked how | Result |
| :--- | :--- | :--- | :--- | :--- |
| 1 | R=1,737,400 m; Sun radius 695,700 km; Earth radius 6,378.137 km; observer 2 m; 1,440 bins. UTC, degrees at boundaries, east-positive longitude and clockwise-from-north azimuth. Spherical terrain reference. | `constants.py`; `contracts.py`; geo constants | Read every literal, both encodings and units. Time grid starts 2026-01-01T00:00:00Z and ends inclusively at 2031-12-31T23:00:00Z. | Match; B10 is the rounded azimuth endpoint. |
| 2 | F01 unit vector; F02 east/north/up basis; F03 elevation and azimuth; F04 great-circle destination; F05 stereographic forward; F06 inverse; F07 map scale; F08 shade normal and fixed light; F09 clamped dot-product shade. Reject sites beyond 89.999 degrees. Projection central meridian 0, true scale at −90; map rows toward −y. | `frames.py:22`, `:28`, `:37`, `:52`, `:65`, `:72`, `:81`; `dem.py:27`, `:89`; `maps.py:6`; browser `geo/frames.ts`, `projection.ts` | Ordinary and near-pole inputs; 360 wrap; bilinear centres and fractional cells; independent planar shading; pyproj in G3; metadata rejection tests. | Formulas match. B8: contracts accept more than calculation allows. Zenith azimuth is deliberately 0 when horizontal magnitude is at most 1e-12; not explicitly stated in the doc. |
| 3 | F10 observer position with ground plus 2 m; F11 body position with D converted consistently; F12 normalized difference; F13 angular radius; F14 G2 azimuth sky angle and elevation difference; F15 RMS and full separation; F16 highest-Sun teaching estimate; F17 maximum Earth parallax. Apparent global sub-points, not simultaneous geometric positions. | `horizons.py`; `ephemeris.py:23`, `:58`, `:70`; browser `geo/system.ts` only for drawing | Independent vector calculations for Earth and Sun; G1 and full G2 from stored Float32 data; two G2 wrap/pole-like cases; extrema of all 52,584 ephemeris rows; published NASA obliquity. | G1/G2 pass. B6 identifies the teaching domain. Section 3.3 already discloses the apparent-convention residual and raw compass error. |
| 4 | F18 exact spherical terrain elevation; F19 short-distance approximation; F20 curvature drop; F21 exact horizon dip and small-height approximation. Observer radius includes ground plus 2 m. | `skyline.py:24`; `worked_examples.py:268`, `:274`; sphere branch in `compute_skyline` | Direct scalar geometry at 40 m and 20 km; horizon at 2 m and 100 m; independent real skyline angles. | Match to arithmetic precision. Approximation errors are recorded below; C5 concerns the prose. |
| 5 | F22 pixel/tangent switch; F23 max skyline, nearest bin and periodic linear interpolation. Near: 40 m inclusive to each map's switch inclusive, half-pixel steps. Far: strictly beyond switch to 300 km inclusive. Core coverage takes precedence over wide coverage. | `skyline.py:39`, `:72`, `:110`; `dem.py:135`; `worked_examples.py:165`; browser `geo/mesh.ts:48` | Read each inequality and ray lattice, G4–G6 tests; four independent bins at real Connecting Ridge; wrap/interpolation and half-bin probes. Pixel/tangent switches: about 18.334533 km and 55.003599 km. | B3/B5. Independent real bins agree within 0.000012944 degrees. No observed catalog missing-data error at the rebuilt site. |
| 6 | F24 strip half-height and azimuth offset; F25 normalized exposed-chord sum; F26 exact flat-skyline segment area. 33 strips, fraction 0–1, constant apparent local radius during each disc evaluation. | `discs.py:9`; `skyline.py:39` | Independent strip sums on flat and nonflat skylines, near-zero wrap, fully hidden/clear boundaries; G7 flat exact benchmarks. | B4. Existing quadrature is within G7's 0.005 tolerance. The flat formula is a benchmark, not the routine's exact output at every height. |
| 7 | F27 clearance as centre elevation minus interpolated skyline; F28 nearby mean, map-distance disk and deterministic best-lit choice. Eight columns and independent Int16 rounding. Radius 160 m, boundary included with a 1e-6 m numeric allowance. | `series.py:27`, `:73`, `:100`; `placement.py:45`, `:90`, `:138` | Independent clearance for two sites and two hours; all 20 stored series; one full-precision terrain rebuild; two candidate grids and separate row/column tie probes. | Existing series agree within storage error. B1/B10 and C3. Nearest-point tie handling agrees with text. |
| 8 | F29 least-squares plane slope within 50 m inclusive; F30 central-difference polar slope with k at site latitude. Nearest row/column, half-to-even; 100 m, 160 m or 480 m baseline. | `slope.py:37`, `:85` | Two plane gradients, two polar latitudes, G8 and nearest-pixel tests; missing/collinear checks. | Match. B5/B11 describe unavailable data and production gaps. The polar baseline is 2p in map metres; its ground length is smaller by k. |
| 9 | F31 window size floor(24d+0.5), N≥1 and half-open sample slice; F32 inclusive lit/link predicates, means and longest runs; F33 interpolated crossings, earliest sunset and latest sunrise. No result beyond grid end; exact last-fitting window exists. | `scoring.py:60`, `:79`, `:158`, `:185`; browser `scoring.ts:121`, `:148`, `:412`, `:545` | 36 independent scoring cases and every sweep landing in both languages; half-hour ties, last fitting and one-too-late, relay crossing, exact/adjacent thresholds, changing conditions. | Valid-input rules agree exactly. B9 describes missed short intervals. C1 fixes path. |
| 10 | F34 six veto predicates: strict excess, strict lower/upper landing bounds, landing-dark always; F35 g including zero limits and three clamped utilities; F36 weighted score, omitted unknown slope and 70-point status. Power/comms cannot both have zero weight. | `scoring.py:107`; browser `scoring.ts:286`, `:305`; UI `state/scenario.ts:813` | Each threshold below/equal/above where applicable; zero limits; relay; missing slope; individual zero weights; exact 70; all 36 added cases and shared G10. | A1, B8. No Python/TypeScript mismatch on the valid cases. C1 fixes path. |
| 11 | F37 prefix-sum means, clipped runs and UTC-midnight selection. Full reference has hourly landings; UI reads indices 0,24,48,…; no result for overrun. | Python `slip_sweep`; browser `slipSweep`, `evaluationAt`, `utcMidnightHours`; `sweep.worker.ts` and protocol | Every landing in each added case; read worker and daily index code; existing worker/protocol tests and G10. | Mathematically equivalent; A1 and C4. No separate science in worker. |
| 12 | F38 9 × 9 geometry, 250 m spacing, local-frame rotation, ray-only 720-bin fast skyline, 150 km radius and 1% growing step, centre comparison. | No sensitivity implementation | Independent centre/corner geometry only; searched Python/API files and read R6 omission. | B2; no numeric method comparison possible. |
| 13 | F39 offset distance/bearing, true curved local position, mesh gradient/baseline, ENU/scene axis map, direction map and wall height. Grid 257 × 257 over 20 km; close-up helper over 2 km. Central derivatives inside and one-sided at rim; no projection k; NaN propagation. Wall blocker must be strictly beyond 10 km. | `terrain_mesh.py:92`, `:116`, `:163`, `:179`; browser `geo/scene.ts`, `geo/placement.ts`; `scene_assets.py` uses same walk for apron | Ordinary and zero-distance vertex; planar overlay centre/rim; independent scene direction and wall values; mesh/scene tests; apron quantisation ordinary and tie. | Implemented formulas match. B11 concerns absent callers. 156.25 m interior/78.125 m rim baseline; close-up interior 15.625 m and rim 7.8125 m. |
| 14 | F40 Moon-fixed axes to scene, body directions and dot-product Sun elevation/terminator. | browser `geo/system.ts`, `geo/placement.ts`; scene positions use those directions | Two independent unit-vector/axis/projection cases and two elevation cases, plus finite-distance horizon counterexamples. | Code matches the written drawing formula; B7 distinguishes it from section 3.2. |
| 15 | No new formula. Pixel resolution, frame uncertainty, separate DEM roles, visibility versus radio budget, hourly time step and assumed limits. | Documentation; pipeline and scoring checks above | Read last against findings and validation thresholds. | C2 is stale. Undisclosed limits are listed below. |

## The two teaching rules against sources and stored data

NASA's [Human Landing System Lunar Thermal Analysis Guidebook, table 3.2-1](https://ntrs.nasa.gov/api/citations/20210010030/downloads/HLS-UG-001%20Lunar%20Thermal%20Analysis%20Guidebook%20Baseline_STI.pdf)
lists a lunar obliquity to the ecliptic of **1.542 degrees**. This supports
“about 1.54 degrees.” It is distinct from the **6.68-degree** obliquity to
the Moon's orbit around Earth. Confusing these would be a large error; the
document does not confuse them.

The stored `system.bin`, read as Float32, has sub-solar latitude:

| Extremum | Value in degrees | UTC |
| :--- | ---: | :--- |
| Minimum | −1.5880320072174072 | 2029-09-23T14:00:00Z |
| Maximum | 1.586387038230896 | 2026-05-30T18:00:00Z |

Thus “within ±1.59 degrees” is also right for this stored interval. The
nominal tilt to the ecliptic is not an exact cap on an apparent sub-solar
latitude in a body-fixed mean-Earth frame. The Sun direction and lunar pole
vary in the full ephemeris. The Moon's orbit around Earth also puts the Moon
off the ecliptic, so its Sun direction need not lie in that plane. Mean-Earth
and principal-axis definitions are distinct. JPL describes the
[mean-Earth frame and apparent sub-points](https://ssd.jpl.nasa.gov/horizons/manual.html#lunar-mean-earth-frame-of-de421);
NASA/JPL's [Lunar Constants and Models, physical librations](https://planetarydata.jpl.nasa.gov/img/data/m3/CH1M3_0002/EXTRAS/LunConstantsModels_2005_jpl_d32296.pdf)
discusses small time-dependent orientation changes, up to about 0.035 degrees
in that description. Together these explain why a mean-angle teaching
constant is not a strict bound on this apparent-coordinate series. This is a
physical interpretation of the sources, not a measured decomposition of the
0.048032-degree excess. I did not solve separately for each contribution.

Earth's stored range is **356,647.90625 km** at
2026-12-24T09:00:00Z to **406,663.625 km** at
2029-04-12T23:00:00Z. Applying section 3.4's bound independently gives about
**0.279115843 degrees** and **0.244787053 degrees**, respectively. The numerical
ledger gives the full evaluated values. The typical 384,400 km distance gives
about **0.258964688 degrees**, so 0.26 degrees and the rounded 0.24–0.28-degree
range are justified. I also constructed two tangent observers and compared
their direction shifts with `topocentric`, using ground height −2 m only to
cancel its fixed 2 m observer height and test exactly the reference radius.
Those checks agree to roughly 1e-12 degrees.

The exact bound uses the actual observer radius, including terrain and
height; section 3.4 deliberately uses R as a teaching approximation. At the
real Connecting Ridge ground height of 1,950.256444 m the added radius is
about 0.1124%, too small to alter the teaching rule's two-decimal range.

## Quantisation and real data

I rebuilt Connecting Ridge once with the two read-only prepared maps under
`C:/Users/abdal/TrueSouth/data/prepared`. The normal chunk size hit the
machine's memory limit. `chunk_size=8192` completed in about 30 seconds and
does not change the sampling rules. No raw or prepared file was copied or
modified. Independent selected-bin calculations scanned both maps' pixel
centres and computed the near rays from the written destination and elevation
relations. Their largest difference from the routine was 0.000012944 degrees,
well below the synthetic 0.001-degree wall tolerance. This establishes four
bins, not an independent proof of all 1,440 bins.

The rebuilt full skyline differs from its stored Float32 elevation by at
most **1.1801394173e-7 degrees**. Using that unrounded rebuilt skyline and the
stored Float32 global ephemeris, its rebuilt series has these maximum errors
against committed decoded Int16 data:

| Column | Maximum absolute difference | Allowed half-step |
| :--- | ---: | ---: |
| `sun_az` | 0.004999908115 degrees | 0.005 degrees |
| `sun_el` | 0.004999973514 degrees | 0.005 degrees |
| `sun_frac` | 0.000049998632 | 0.00005 |
| `sun_clear` | 0.004999940931 degrees | 0.005 degrees |
| `earth_az` | 0.004999955761 degrees | 0.005 degrees |
| `earth_el` | 0.004999983450 degrees | 0.005 degrees |
| `earth_frac` | 0.000049992627 | 0.00005 |
| `earth_clear` | 0.004999997341 degrees | 0.005 degrees |

The stated storage precision survives this real rebuild. Across all 20 sites,
recomputing from the already-rounded skyline is a slightly different
calculation from recomputing from the original skyline: it can exceed the
Int16 half-step by a tiny Float32 skyline error. For example, the largest
Sun-fraction discrepancy in that audit was 0.000050162581. This is not evidence
that the encoder alone violates its rounding precision. G9 checks the
encoder/decoder directly, not that second-stage reconstruction.

There are 40 stored azimuth samples at 360 degrees across the real
catalog: 9 Sun samples and 31 Earth samples. The largest difference in six-year mean
Sun fraction between the stored-skyline reconstruction and decoded data was
6.4804719813e-8 fraction. The largest difference in any-Earth share was
0.000399361022 fraction, about 0.039936 percentage points. The latter is a
threshold effect, not a large fraction-encoding error.

The stored elevation, azimuth and clearance are rounded separately. Therefore
decoded clearance need not equal decoded elevation minus the skyline at
decoded azimuth exactly. An inclusive threshold applied to the decoded series
can differ from one applied to the unrounded series within half a storage
step. R2 also counts any positive stored Earth fraction; a tiny physical
fraction below half a fraction step can round to zero. These are limits of
the specified storage scheme, not Python/TypeScript parity failures.

## Validation and browser parity

I checked every numerical gate limit in `docs/validation.md` against the gate
builders in `validation.py` and `commands/validate.py`. G1 is exact; G2 is
0.02 degrees per gated sky-angle component; G3 is 0.01 m; G4/G5 are 0.001
degrees; G6 is 0.02 degrees; G7 is 0.005 fraction; G8 is 0.001 degrees; G9 is
0.005 degrees and 0.00005 fraction. They match. G10 is 1e-9 and G11 requires
fresh generated types. R1/R2 are 0.1 fraction, R3 is 2 degrees, and R5 is
0.05 degrees RMS. These match too. R4/R6 are not implemented measurements;
no competing implemented limit was found.

R1/R2 comparisons use a strictly greater difference for the investigate
mark. The Decimal comparison in `validation.py:30` deliberately avoids a
binary 0.8−0.7 falsely exceeding 0.1. Hard gates use less than or equal to
their limit. Section 10 vetoes use strict excess; equality is allowed. Lit
and link flags use greater than or equal. Missing optional landing-angle
limits disable those vetoes. The nonoptional dark, blackout and slope limits
are required profile fields, so “if the profile sets its limit” is not a
separate nullable branch for those fields.

The shared G10 file has 58 cases. It already contains half-hour rounding, zero individual
weights, relay, every veto, missing slope and end-of-grid labels. I did not
claim these categories were absent. The additional 36 scenarios combine
those boundaries and compare every landing in each small sweep. They include
1.5-hour and 2.5-hour rounding ties; exact and adjacent Sun, mask and landing
angle thresholds; dark/blackout limits 0, 1 and 2; exact/adjacent slope limit;
relay clearance crossing the mask; last-fitting and one-hour-too-late windows;
zero slope, power or comms weights; and the exact-70 cancellation case absent
from the shared fixture. Python and TypeScript agree on every field. That
agreement does not validate their shared status error, A1.

The browser geometry checks run the actual TypeScript modules with only types
stripped by Node, using independent calculations in the runner. They do not
reimplement the functions and compare two copies of the same new code.
The retained small script reproduces the status boundary with the actual
browser scoring module:

```text
uv run python docs/reviews/a9-scripts/boundaries.py
```

## Limits already disclosed and limits still missing

Section 15 already discloses finite terrain resolution, regional rather than
footpad slope, using close-up DEMs separately from skylines, visibility rather
than a radio link budget, hourly sampling and assumed mission limits. Section
3.2 separately discloses apparent-position conventions; section 3.3 discloses
the raw-azimuth exception; section 7.1 discloses position sensitivity and
best-lit selection bias. Those are not new hidden errors.

Real limits absent from section 15 are the exact-threshold floating-point
status problem; missing-bin sphere substitution; missing slope/plane
rank behavior; disc quadrature and the near-zenith tangent-plane singularity;
the polar domain and non-bound nature of the teaching maximum; finite-distance
versus centre-based drawing directions; missed sub-hour events; quantisation
effects at thresholds and angle wrap; and the not-yet-published placement,
sensitivity, close-up and skyline-wall paths. The bin/tie conventions belong
in their methods, not necessarily in a list of physical limits.

## What was not checked

- I did not change math or production code, rebuild fixtures, regenerate
  contracts, render a UI, run Docker, or merge anything.
- I did not rerun all 20 full terrain skylines, all 1,440 bins independently,
  all sunlit-peak neighborhood skylines, or a full six-year finer-time
  ephemeris. I rebuilt one real skyline and checked four bins independently.
- I did not independently reproduce the five nearby ranges or the particular
  NASA-map numbers in decision 0012. Its “pixels less than 160 m apart” prose
  is not proved by a 160 m search radius, which allows pairs up to 320 m apart.
  The precise pairwise claim remains unverified.
- The full G2 rerun uses the repository parser and comparison routine on raw
  saved responses. Independent formula checks cover representative ordinary
  and edge inputs; they are not a second independent ephemeris system. I did
  not fetch new Horizons responses or independently integrate lunar motion.
- I did not separate the exact physical contributions to the difference
  between nominal obliquity and the stored apparent sub-solar extrema.
- I did not validate real 5 m close-up products or R4, or run sensitivity/R6;
  their production paths are absent. I did not rerun the complete NASA map
  R1–R5 command, which writes the derived validation report.
- The image encoders, map lookup scaling, apron encoding and scene asset
  normals were read with their contract definitions. Representative apron
  quantisation was calculated independently. I did not independently re-create
  every image, shader, resampling operation or every worked-example selection.
- The 40 groups are fully inventoried, but an unimplemented group cannot have
  two successful repository-function comparisons. Section 12 and the missing
  close-up/wall production callers are explicit exceptions. Numerical probes
  of their available helpers do not verify those absent end-to-end paths.

## Reference-only edits

`docs/science.md` section 9: `web/src/lib/scoring/metrics.ts` →
`web/src/lib/scoring/scoring.ts`.

`docs/science.md` section 10: `web/src/lib/scoring/score.ts` →
`web/src/lib/scoring/scoring.ts`.

No other path was replaced. No formula, threshold, production code or derived
data was edited.

## Repository checks

At the reviewed `2f258dd` base, `uv run pytest -q` passed **322 tests** with
three warnings; its directly captured exit code was **0**. It ran with
`OPENBLAS_NUM_THREADS=1` to limit numerical-library thread allocation.
`pnpm --dir web install --frozen-lockfile` returned **0**, followed by
`pnpm --dir web test`: **1,691 tests in 67 files passed**, exit **0**.
Both suites were redirected to logs and their process exit codes were read
immediately in PowerShell, rather than inferred from a wrapper's exit code.

The report, retained script, science path edits and DEVLOG entry were checked
for complete text after the reported disk-full interval. The review's JSON
evidence files also parse. An encoding issue from a PowerShell text rewrite
was repaired; no truncated write was found in these artifacts. The DEVLOG
state remains “built, not verified,” as requested; this report has not received
the owning tracks' independent review.

Main advanced to `63d518a` with the A8 validation page while the review ran.
That integration and the post-integration web check are recorded below once
complete; the math review's immutable source remains `2f258dd`.

## Numerical ledger

Each line below records inputs, an independently calculated result, the actual
repository result and maximum absolute difference. Units follow its section:
angles in degrees, local geometry in metres unless explicitly kilometres,
fractions and scores dimensionless. Arrays report the largest component error.

### Independent Python calculations

| # | Section and calculation | Inputs | Independent result | Code result | Absolute difference |
| ---: | :--- | :--- | :--- | :--- | ---: |
| 1 | 2.1: unit vector | `[-85, 222.6]` | `[-0.0641550883623, -0.0589936278857, -0.996194698092]` | `[-0.0641550883623, -0.0589936278857, -0.996194698092]` | 0 |
| 2 | 2.1: local basis | `[-85, 222.6]` | `[[0.676875969683, -0.73609708712, 0], [-0.733296015469, -0.674300252264, 0.0871557427477], [-0.0641550883623, -0.0589936278857, -0.996194698092]]` | `[[0.676875969683, -0.73609708712, 0], [-0.733296015469, -0.674300252264, 0.0871557427477], [-0.0641550883623, -0.0589936278857, -0.996194698092]]` | 0 |
| 3 | 2.1: azimuth/elevation | `[-85, 222.6, -12, 80]` | `[216.867089164, 8.01288182863]` | `[216.867089164, 8.01288182863]` | 1.7763568394e-15 |
| 4 | 2.1: unit vector | `[-89.999, 359.999]` | `[1.74532925164e-05, -3.04617419756e-10, -0.999999999848]` | `[1.74532925164e-05, -3.04617419756e-10, -0.999999999848]` | 0 |
| 5 | 2.1: local basis | `[-89.999, 359.999]` | `[[1.7453292519e-05, 0.999999999848, 0], [0.999999999695, -1.74532925164e-05, 1.74532925191e-05], [1.74532925164e-05, -3.04617419756e-10, -0.999999999848]]` | `[[1.7453292519e-05, 0.999999999848, 0], [0.999999999695, -1.74532925164e-05, 1.74532925191e-05], [1.74532925164e-05, -3.04617419756e-10, -0.999999999848]]` | 0 |
| 6 | 2.1: azimuth/elevation | `[-89.999, 359.999, -12, 80]` | `[80.0012093296, 12.0001736292]` | `[80.0012093296, 12.0001736292]` | 1.7763568394e-15 |
| 7 | 2.2: destination | `[-85, 359.99, 90, 10000]` | `[-84.9891639533, 3.76834340217]` | `[-84.9891639533, 3.76834340217]` | 0 |
| 8 | 2.2: destination | `[-89.999, 120, 180, 10]` | `[-89.999329779, 120]` | `[-89.999329779, 120]` | 0 |
| 9 | 2.3: projection | `[-80, 90]` | `[304005.60802, 1.86149747392e-11]` | `[304005.60802, 1.86149747392e-11]` | 5.82076609135e-11 |
| 10 | 2.3: inverse | `[304005.60802, 1.86149747392e-11]` | `[-80, 90]` | `[-80, 90]` | 0 |
| 11 | 2.3: map scale | `-80` | `1.00765426625` | `1.00765426625` | 0 |
| 12 | 2.3: projection | `[-90, 0]` | `[0, 0]` | `[0, 0]` | 0 |
| 13 | 2.3: inverse | `[0, 0]` | `[-90, 0]` | `[-90, 0]` | 0 |
| 14 | 2.3: map scale | `-90` | `1` | `1` | 0 |
| 15 | 2.4: hillshade | `[0, 0]` | `0.707106781187` | `0.707106781187` | 0 |
| 16 | 2.4: hillshade | `[0.3, -0.4]` | `0.945505048884` | `0.945505056326` | 7.44270600705e-09 |
| 17 | 3.1: time count | `52584` | `52584` | `52584` | 0 |
| 18 | 3.1: last time offset hours | `2031-12-31T23:00:00Z` | `52583` | `52583` | 0 |
| 19 | 3.2: topocentric | `[-89.4555, 222.6192, -2, 0, 384400, 6378.137, 1000]` | `[137.392383148, 1.34023685878, 0.950831170541, 384355.411073]` | `[137.392383148, 1.34023685878, 0.950831170541, 384355.411073]` | 0 |
| 20 | 3.2: topocentric | `[0, 0, 0, 0, 149600000, 695700, 0]` | `[0, 90, 0.266452409222, 149598262.598]` | `[0, 90, 0.266452409222, 149598262.598]` | 0 |
| 21 | 3.3: G2 components and separation | `[359.99, 2, 0.01, 2.01]` | `[0.0199876944136, 0.01, 0.0223497286568]` | `[0.0199876944136, 0.01, 0.0223497286568]` | 0 |
| 22 | 3.3: G2 components and separation | `[180, 89.99, 0, 90]` | `[7.01670929853e-15, 0.01, 0.01]` | `[7.01670929853e-15, 0.01, 0.01]` | 0 |
| 23 | 4: terrain elevation | `[20000, 1000, 200]` | `1.95429625932` | `1.95429625932` | 1.83186799063e-13 |
| 24 | 4: small-distance approximation | `[20000, 1000, 200]` | `1.95556302427` | `1.95429625932` | 0.00126676494866 |
| 25 | 4: terrain elevation | `[40, 0, 0]` | `-2.86306313869` | `-2.86306313893` | 2.3970070373e-10 |
| 26 | 4: small-distance approximation | `[40, 0, 0]` | `-2.86306313868` | `-2.86306313893` | 2.52479370744e-10 |
| 27 | 4: curvature drop | `20000` | `115.114538966` | `115.114538966` | 0 |
| 28 | 4: curvature drop | `40` | `0.000460458155865` | `0.000460458155865` | 0 |
| 29 | 4: horizon dip exact and approximation | `2` | `-0.0869365719337` | `-0.086936571936` | 2.29007091068e-12 |
| 30 | 4: horizon dip approximation | `2` | `-0.0869366136328` | `-0.0869365719337` | 4.16990934005e-08 |
| 31 | 4: horizon dip exact and approximation | `100` | `-0.614719948191` | `-0.614719948191` | 7.81597009336e-14 |
| 32 | 4: horizon dip approximation | `100` | `-0.614734690332` | `-0.614719948191` | 1.47421405402e-05 |
| 33 | 5: skyline interpolation | `13.125` | `52.5` | `52.5` | 0 |
| 34 | 5: nearest bin half up | `13.125` | `53` | `53` | 0 |
| 35 | 5: skyline interpolation | `359.875` | `719.5` | `719.5` | 0 |
| 36 | 5: nearest bin half up | `359.875` | `0` | `0` | 0 |
| 37 | 5: skyline interpolation | `0.125` | `0.5` | `0.5` | 0 |
| 38 | 5: nearest bin half up | `0.125` | `1` | `1` | 0 |
| 39 | 6: strip fraction | `[0, 0, 0.27]` | `0.5` | `0.5` | 0 |
| 40 | 6: flat exact disc benchmark | `[0, 0, 0.27]` | `0.5` | `0.5` | 0 |
| 41 | 6: strip fraction | `[-0.135, 0, 0.27]` | `0.195269727159` | `0.195269727159` | 2.77555756156e-17 |
| 42 | 6: flat exact disc benchmark | `[-0.135, 0, 0.27]` | `0.195501109478` | `0.195269727159` | 0.00023138231895 |
| 43 | 6: strip fraction | `[-0.27, 0, 0.27]` | `0` | `0` | 0 |
| 44 | 6: flat exact disc benchmark | `[-0.27, 0, 0.27]` | `0` | `0` | 0 |
| 45 | 6: strip fraction | `[0.27, 0, 0.27]` | `1` | `1` | 0 |
| 46 | 6: flat exact disc benchmark | `[0.27, 0, 0.27]` | `1` | `1` | 0 |
| 47 | 3.4: maximum Earth parallax bound | `356647.90625` | `0.279115843131` | `0.279115843131` | 8.80406858528e-14 |
| 48 | 3.4: maximum Earth parallax bound | `406663.625` | `0.24478705259` | `0.24478705259` | 1.02695629778e-14 |
| 49 | 8: polar slope | `[-89, 0.12, -0.08]` | `8.20734356928` | `8.2073438291` | 2.5982453522e-07 |
| 50 | 8: polar slope | `[-80, 0.12, -0.08]` | `8.26867821429` | `8.26867847601` | 2.61712225225e-07 |
| 51 | 8: close-up plane fit | `[0.12, -0.08]` | `8.206727074` | `8.206727074` | 7.9936057773e-14 |
| 52 | 8: close-up plane fit | `[0, 0]` | `0` | `2.63688957661e-13` | 2.63688957661e-13 |
| 53 | 13: true local position | `[10000, 2000, 500, 100]` | `[10.0028204245, 2.0005640849, 0.370061692443]` | `[10.0028204245, 2.0005640849, 0.370061692443]` | 4.4408920985e-16 |
| 54 | 13: true local position | `[0, 0, 100, 100]` | `[0, 0, 0]` | `[0, 0, 0]` | 0 |
| 55 | 13: overlay slope centre and rim | `[0.12, -0.08]` | `[[8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074]]` | `[[8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074], [8.206727074, 8.206727074, 8.206727074, 8.206727074, 8.206727074]]` | 0 |
| 56 | 13: overlay slope centre and rim | `[0, 0]` | `[[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]` | `[[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]` | 0 |
| 57 | validation: R1 mean | `[0.5, 0.9]` | `0.7` | `0.7` | 0 |
| 58 | validation: R2 any Earth | `[0.5, 0.9]` | `1` | `1` | 0 |
| 59 | validation: R1 mean | `[0.6, 0.8]` | `0.7` | `0.7` | 0 |
| 60 | validation: R2 any Earth | `[0.6, 0.8]` | `1` | `1` | 0 |
| 61 | scene: apron quantisation | `[0, 1.24]` | `[0, 1]` | `[0, 1]` | 0 |
| 62 | scene: apron quantisation | `[0, 1.25]` | `[0, 1]` | `[0, 1]` | 0 |
| 63 | 7.1: candidate count at pixel centre | `[-89, 0]` | `13` | `13` | 0 |
| 64 | 7.1: placement equal-mean nearest tie | `[-89, 0]` | `0` | `0` | 0 |
| 65 | 7.1: candidate count at pixel centre | `[-80, 45]` | `13` | `13` | 0 |
| 66 | 7.1: placement equal-mean nearest tie | `[-80, 45]` | `0` | `0` | 0 |
| 67 | 6: nonflat strips including azimuth wrap | `[12, 0.2, 0.27]` | `0.850958882084` | `0.850958882084` | 2.22044604925e-16 |
| 68 | 6: nonflat strips including azimuth wrap | `[359.99, -0.1, 0.27]` | `0.269531435566` | `0.269531435566` | 0 |
| 69 | 7: series clearance | `[-85, 0]` | `[4.99933711831, 3.95927240355]` | `[4.99933711831, 3.95927240355]` | 0 |
| 70 | 7: series clearance | `[-89.99, 359.99]` | `[0.00930680896389, -0.990665313652]` | `[0.00930680896389, -0.990665313652]` | 0 |
| 71 | 2.3: bilinear DEM height | `[4.25, 4.5]` | `6.4` | `6.40000015496` | 1.54961906418e-07 |
| 72 | 2.3: bilinear DEM height | `[4, 4]` | `0` | `0` | 0 |
| 73 | 7.1: row/column placement tie | `[[3, 4], [5, 4]]` | `[3, 4]` | `[3, 4]` | 0 |
| 74 | 7.1: row/column placement tie | `[[4, 3], [4, 5]]` | `[4, 3]` | `[4, 3]` | 0 |

The small-distance and small-height approximation rows deliberately compare
an approximation with the exact routine. Their nonzero differences are not
implementation defects. The synthetic polar-map heights were stored as Float32;
their sub-microdegree plane error is a storage effect.

### Independent browser geometry calculations

| # | Calculation | Inputs | Independent result | Code result | Absolute difference |
| ---: | :--- | :--- | :--- | :--- | ---: |
| 1 | system elevation | `[-85, 222.6, 1, 32]` | `[-5.91433536119]` | `[-5.91433536119]` | 0 |
| 2 | system elevation | `[0, 90, 0, 0]` | `[3.50835464927e-15]` | `[3.50835464927e-15]` | 3.94430452611e-31 |
| 3 | unit vector | `[-85, 222.6]` | `[-0.0641550883623, -0.0589936278857, -0.996194698092]` | `[-0.0641550883623, -0.0589936278857, -0.996194698092]` | 2.77555756156e-17 |
| 4 | system axis map | `[-0.0641550883623, -0.0589936278857, -0.996194698092]` | `[-0.0641550883623, -0.996194698092, 0.0589936278857]` | `[-0.0641550883623, -0.996194698092, 0.0589936278857]` | 0 |
| 5 | projection | `[-85, 222.6]` | `[-102690.914054, -111675.530075]` | `[-102690.914054, -111675.530075]` | 1.7462298274e-10 |
| 6 | unit vector | `[-89.999, 359.999]` | `[1.74532925164e-05, -3.04617419756e-10, -0.999999999848]` | `[1.74532925164e-05, -3.04617419756e-10, -0.999999999848]` | 0 |
| 7 | system axis map | `[1.74532925164e-05, -3.04617419756e-10, -0.999999999848]` | `[1.74532925164e-05, -0.999999999848, 3.04617419756e-10]` | `[1.74532925164e-05, -0.999999999848, 3.04617419756e-10]` | 0 |
| 8 | projection | `[-89.999, 359.999]` | `[-0.000529242305126, 30.3233504204]` | `[-0.000529242305122, 30.3233504202]` | 2.23828067192e-10 |
| 9 | scene direction | `[90, 0]` | `[1, 0, -6.12323399574e-17]` | `[1, 0, -6.12323399574e-17]` | 0 |
| 10 | skyline wall height | `[0]` | `[0]` | `[0]` | 0 |
| 11 | scene direction | `[359.9, 89.9]` | `[-3.04617110481e-06, 0.999998476913, -0.00174532570761]` | `[-3.04617110481e-06, 0.999998476913, -0.00174532570761]` | 0 |
| 12 | skyline wall height | `[89.9]` | `[5729.57213354]` | `[5729.57213354]` | 0 |
| 13 | bin tie | `[0.125]` | `[1]` | `[1]` | 0 |
| 14 | bin tie | `[359.875]` | `[0]` | `[0]` | 0 |

### Independent real skyline bins

Connecting Ridge: latitude −89.4555 degrees, east longitude 222.6192 degrees,
ground 1,950.2564442439525 m, observer 2 m above it. The independent calculation
uses each map’s half-pixel ray spacing and far-field pixel centres.

| Bin and azimuth | Independent elevation, degrees | Code elevation, degrees | Signed code minus independent, degrees |
| :--- | ---: | ---: | ---: |
| 0, 0 degrees | 0.954604849195 | 0.954604849271 | 7.66753327497e-11 |
| 360, 90 degrees | 0.740406500107 | 0.74040650006 | -4.71953587322e-11 |
| 720, 180 degrees | -0.604279540626 | -0.604279540635 | -9.51860812393e-12 |
| 1080, 270 degrees | -1.96844157207 | -1.96845451596 | -1.29438929384e-05 |

### Independent scoring calculations and both implementations

Defaults for the first 32 rows: duration 4/24 days; minimum Sun fraction 0.5;
operational minimum elevation 0 degrees; maximum dark and blackout 2 hours;
no relay; antenna mask 1 degree; maximum/ideal slope 10/2 degrees; landing
elevation bounds 0 to 3 degrees inclusive; weights (slope, power, comms)=(1,1,1).
Landing index is 0 and slope is 5 degrees unless shown. The eight-hour series is:

```text
sun_frac   = [0.8, 0.5, 0.49, 1, 0.6, 0.7, 0.8, 0.9]
sun_el     = [1,   0,   2,    3, 2,   1,   1,   1] degrees
earth_clear= [1,   0.99,1,    2, 1,   0,   1,   2] degrees
```

Rows 30–32 have no assessed slope. The four final rows instead use 16 hours at Sun fraction 0.7, Sun elevation
1 degree and Earth clearance 1 degree; duration 1/24 days; zero dark and
blackout limits; and weights (0,1,0). All other fields retain the defaults.
The retained script also repeats this with the exact decoded 7000-count
representation, which produces the same CAUTION defect at index 15.

| # | Changed input | Independent score/status | Python score/status | TypeScript score/status | Score difference |
| ---: | :--- | :--- | :--- | :--- | ---: |
| 1 | `ordinary` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 2 | `max_dark_h=0` | 56.583333333333336 / NO-GO | 56.583333333333336 / NO-GO | 56.583333333333336 / NO-GO | 0 |
| 3 | `max_dark_h=1` | 33.333333333333336 / CAUTION | 33.333333333333336 / CAUTION | 33.333333333333336 / CAUTION | 0 |
| 4 | `max_dark_h=2` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 5 | `max_blackout_h=0` | 57.458333333333336 / NO-GO | 57.458333333333336 / NO-GO | 57.458333333333336 / NO-GO | 0 |
| 6 | `max_blackout_h=1` | 32.458333333333336 / CAUTION | 32.458333333333336 / CAUTION | 32.458333333333336 / CAUTION | 0 |
| 7 | `max_blackout_h=2` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 8 | `min_sun_fraction=0.49` | 56.583333333333336 / CAUTION | 56.583333333333336 / CAUTION | 56.583333333333336 / CAUTION | 0 |
| 9 | `min_sun_fraction=0.5` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 10 | `min_sun_fraction=0.50000001` | 33.333333333333336 / CAUTION | 33.333333333333336 / CAUTION | 33.333333333333336 / CAUTION | 0 |
| 11 | `antenna_mask_deg=0.99` | 65.791666666666671 / CAUTION | 65.791666666666671 / CAUTION | 65.791666666666671 / CAUTION | 0 |
| 12 | `antenna_mask_deg=1` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 13 | `antenna_mask_deg=1.00000001` | 32.458333333333336 / NO-GO | 32.458333333333336 / NO-GO | 32.458333333333336 / NO-GO | 0 |
| 14 | `landing_sun_el_min_deg=0.99999999` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 15 | `landing_sun_el_min_deg=1` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 16 | `landing_sun_el_min_deg=1.00000001` | 44.958333333333336 / NO-GO | 44.958333333333336 / NO-GO | 44.958333333333336 / NO-GO | 0 |
| 17 | `landing_sun_el_max_deg=0.99999999` | 44.958333333333336 / NO-GO | 44.958333333333336 / NO-GO | 44.958333333333336 / NO-GO | 0 |
| 18 | `landing_sun_el_max_deg=1` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 19 | `landing_sun_el_max_deg=1.00000001` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 20 | `slope=9.99999999` | 24.12500004166667 / CAUTION | 24.12500004166667 / CAUTION | 24.12500004166667 / CAUTION | 0 |
| 21 | `slope=10` | 24.125 / CAUTION | 24.125 / CAUTION | 24.125 / CAUTION | 0 |
| 22 | `slope=10.00000001` | 24.125 / NO-GO | 24.125 / NO-GO | 24.125 / NO-GO | 0 |
| 23 | `slope=None` | 36.1875 / CAUTION | 36.1875 / CAUTION | 36.1875 / CAUTION | 0 |
| 24 | `round=0.0625` | 50.833333333333336 / CAUTION | 50.833333333333336 / CAUTION | 50.833333333333336 / CAUTION | 0 |
| 25 | `round=0.10416666666666667` | 41.888888888888886 / CAUTION | 41.888888888888886 / CAUTION | 41.888888888888886 / CAUTION | 0 |
| 26 | `round=0.16666666666666666` | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 44.958333333333336 / CAUTION | 0 |
| 27 | `window_end=4` | 58.333333333333336 / CAUTION | 58.333333333333336 / CAUTION | 58.333333333333336 / CAUTION | 0 |
| 28 | `window_end=5` | no result | no result | no result | 0 |
| 29 | `relay clearance crossing` | 65.791666666666671 / CAUTION | 65.791666666666671 / CAUTION | 65.791666666666671 / CAUTION | 0 |
| 30 | `weights={'slope': 0, 'power': 0, 'comms': 1}` | 37.5 / CAUTION | 37.5 / CAUTION | 37.5 / CAUTION | 0 |
| 31 | `weights={'slope': 0, 'power': 1, 'comms': 0}` | 34.875 / CAUTION | 34.875 / CAUTION | 34.875 / CAUTION | 0 |
| 32 | `weights={'slope': 3, 'power': 0, 'comms': 2}` | 37.5 / CAUTION | 37.5 / CAUTION | 37.5 / CAUTION | 0 |
| 33 | `GO70 prefix i=0` | 70 / GO | 70 / GO | 70 / GO | 0 |
| 34 | `GO70 prefix i=3` | 70 / GO | 70.000000000000014 / GO | 70.000000000000014 / GO | 1.42108547152e-14 |
| 35 | `GO70 prefix i=10` | 70 / GO | 70.000000000000014 / GO | 70.000000000000014 / GO | 1.42108547152e-14 |
| 36 | `GO70 prefix i=15` | 70 / GO | 69.999999999999929 / CAUTION | 69.999999999999929 / CAUTION | -7.1054273576e-14 |

The score table is a compact view of the comparisons. Each scenario also
compared all seven metrics, all six veto records, all utilities, slope
assessment, full lit/link arrays, four countdowns, and every landing in its
hourly slip sweep. All Python/TypeScript values matched exactly.


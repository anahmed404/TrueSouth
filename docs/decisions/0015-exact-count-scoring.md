# 0015. Scoring accumulates exact stored counts

**Decision.** Window means and numerical boundaries follow
[`science.md`](../science.md), sections 9 to 11. Recover stored Sun-fraction
counts, accumulate integers, and divide once for each mean. Use the same
comparison precision and operation order in Python and TypeScript.

**Why.** Floating prefix subtraction made an identical one-hour window score
70 at one landing index and just below 70 at another. That changed GO to
CAUTION. Integer prefix sums retain fast sweeps and make a window independent
of the values before it. The stored fractions already have a fixed step.

**Boundary policy.** The comparison precision in the science document is much
finer than stored or displayed values. It handles arithmetic equality; it is
not a physical uncertainty allowance. Utilities snap to their defined endpoint
values at a breakpoint. Intermediate utilities otherwise keep binary64
precision. The returned score has the stated comparison precision.

**Considered.** Compensated floating prefix sums reduce cancellation but do not
give the same simple guarantee of exact accumulation for this quantised input.
Scanning each window would lose the sweep's performance. Relative epsilon
comparisons can make equality depend on scale and obscure which side of a
limit a value owns. A stated decimal comparison rule is deterministic.

**Scope.** No terrain, ephemeris, profile contract, screen or derived-data
format changes. Scoring-only synthetic fraction means use the same input step
as stored series. The complete catalog audit and independent boundary oracles
are recorded in [`the S2b report`](../reviews/s2b-score-boundary.md).

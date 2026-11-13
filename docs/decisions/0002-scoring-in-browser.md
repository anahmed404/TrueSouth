# 0002. Metrics and scores are computed in the browser

**Decision.** Python produces each site's per-hour series. The browser turns a series and
a mission profile into metrics, vetoes, a score and a status.

**Why.** Profiles change constantly as a planner drags sliders. Scoring is cheap
arithmetic on data the browser already holds, so results update with no request. The Slip
Planner needs thousands of evaluations per change.

**How it stays correct.** `science/src/truesouth/scoring.py` is a reference copy. It
writes a fixture of cases, and a vitest test requires the TypeScript to match it exactly
(gate G10 in [`../validation.md`](../validation.md)).

**The line.** Anything that needs terrain or ephemeris stays in Python. Anything that
depends on the mission profile runs in the browser.

# 0007. Mission profiles replace one fixed set of limits

**Decision.** Limits live in a mission profile. Presets are named after real missions.
Every value is tagged sourced or assumed. Comms rules are judged over the mission's own
window.

**Why.** The first plan had one set of limits: Earth at least 5° up, visible at least 50%
of the time, no blackout over 12 hours. Real Horizons data for Connecting Ridge in
December 2026 showed Earth above 5° only 14% of the time and above 0° only 38%. Every
polar site would have been NO-GO, including the places NASA plans to land.

No single set of limits fits both a 100-day rover and a 6.5-day crewed visit. Judging a
10-day mission by a month-long average also hides the real answer, which is to land when
Earth is up.

**Status rule.** Vetoes decide whether a mission can work. The score only ranks missions
that can. A window with no veto is GO or CAUTION, never NO-GO.

**Observer height** is not in the profile. It is fixed at 2 m because it changes the
skyline, which is precomputed.

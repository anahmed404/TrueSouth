# 0011. Gate G2 compares directions on the sky

**Decision.** Gate G2 checks our Sun and Earth directions against JPL Horizons' own site
tables in two ways, each within 0.02°: the azimuth difference measured as an angle on the
sky, and the elevation difference ([`../science.md`](../science.md) §3.3). It does not
gate the raw difference between two compass bearings. That number is still measured and
shown beside the gate on the validation page.

The team lead decided this on 2026-11-13, on the orchestrator's recommendation.

**Why.** A compass bearing stops meaning anything when a body is almost straight overhead
or underfoot: a tiny change in direction swings the bearing by many degrees. The first
full run showed exactly that.

| Measure, over 20 sites, 2 bodies and 52,584 hours | Largest difference |
| :--- | :--- |
| Direction on the sky | 0.0060° |
| Elevation | 0.0060° |
| Raw compass azimuth, everywhere except the case below | 0.0093° |
| Raw compass azimuth, the Sun at Apollo 11 within 0.52° of the zenith or nadir | 0.082°, at 28 hours |

At the worst of those 28 hours the two directions differ by 0.00017° on the sky.

**What it does not change.** No formula, no data and no result. The product uses a body's
direction to look up the skyline beneath it; a body at the zenith is nowhere near a
skyline. At the polar sites, where the Sun stays within about 2° of the horizon, the raw
compass azimuth never differs by more than 0.0060°.

**Considered.** Keeping the original wording and recording the 28 hours as a known
exception. That would report the gate as failed for a reason that says nothing about
whether our directions are right.

**The original wording,** for the record: "Our Sun and Earth azimuth and elevation match
Horizons' own site table at every catalog site and every hour of the time grid. Max
difference ≤ 0.02°."

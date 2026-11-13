# 0015. The browser draws ground shadows, and never reads them

**Decision.** In Local terrain and Lander's eye the ground is drawn with cast shadows, relief
from the polar cap's slope maps, and an illustrative regolith texture close up
([`../features/local-terrain.md`](../features/local-terrain.md), "What is drawn"). The
shadows come from a march toward the light, run per pixel in the ground's shader over the
heights the browser already holds for drawing (the 20 km patch and the 300 km terrain
around it).

This is the one place where the browser follows a ray over terrain. It is allowed because
it is drawing only, like the polar map's hillshade: its result is a pixel's brightness and
goes nowhere else. No label, state, plate, score or number reads it. Lit or dark, link or no
link, and every countdown still come from the series computed in Python
([`0002-scoring-in-browser.md`](0002-scoring-in-browser.md)).

**Why.** The team lead found the ground flat and untextured ("like a PS1 game"). At the
pole the Sun is one or two degrees up, so relief is read almost only through shadows; a
ground without them looks smooth and wrong. The alternatives were worse:

- A shadow map from the Sun. At a 1° Sun it needs a map tens of times longer than wide and
  still speckles; it also costs a second render of the ground on every change.
- Shadows from the pipeline (a per-hour shadow image). It would be exact, but it is a new
  pipeline product per site and hour, and none exists before the deadline.

**Trade-off.** The drawn terrain is coarser (1.9 km beyond the patch) and nearer (150 km)
than the 300 km skyline the series used, so the drawn shadow at the lander can differ from
the series. The plate in both views gives the series' answer and says, every time, that the
series is right where the drawing differs. The browser does not compare the two: deciding
when they disagree would itself be a horizon search for a result.

**What would remove the trade-off.** Wider and finer heights from the pipeline (listed in
the 3D and Map entry of [`../../DEVLOG.md`](../../DEVLOG.md), 2026-11-14), after which the
drawing and the series would rarely differ.

Recorded 2026-11-14 by the agent building the ground look.

# 0012. Sunlit peaks keep their listed point, and show how much position matters

**Decision.** Every catalog site is evaluated at its listed coordinates. For the five
sites in the group `sunlit_peak` the pipeline also computes two things
([`../science.md`](../science.md) §7.1):

1. **A nearby range:** the lowest and highest mean sunlight among the 80 m map pixels
   within 160 m of the listed point. The app shows it beside the site's own number.
2. **A best-lit variant:** a second site at the best-lit of those pixels, labelled as
   chosen by TrueSouth, with its distance from the listed point.

The team lead decided this on 2026-11-13, on the orchestrator's recommendation.

**Why.** On a sharp ridge the result depends on which side of the crest the point falls,
and the observer stands only 2 m above the ground. Measured on NASA's 80 m terrain map
over the six-year time grid, as mean `sun_frac`:

| Site | Listed point | Range within 160 m | Highest ground within 160 m | Best-lit pixel (distance) | NASA's average-sunlight map at that pixel |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `connecting_ridge` | 59.9% | 39.7% to 87.0% | 87.0% | 87.0% (149 m) | 86.4% |
| `shackleton_rim` | 74.7% | 42.9% to 81.0% | 81.0% | 81.0% (94 m) | 72.8% |
| `de_gerlache_rim` | 60.7% | 27.6% to 69.6% | 55.3% | 69.6% (144 m) | 46.4% |
| `peak_near_shackleton` | 60.2% | 49.8% to 63.8% | 60.2% | 63.8% (71 m) | 58.5% |
| `malapert_peak` | 72.8% | 37.7% to 76.7% | 72.4% | 76.7% (72 m) | 50.8% |

So a published "sunlit peak" and the same coordinates on our map can be two different
places as far as the Sun is concerned. A planner needs to see that, not have it hidden.

**What our method agrees with.** At Connecting Ridge's listed point we read 59.9% and
NASA's map reads 66.1%; at its best-lit pixel we read 87.0% and NASA's map 86.4%. Our hours
with any Sun there are 91.5%; the source for this site (Gläser et al. 2014) reports
sunlight 92.27% of the time at 2 m. Mazarico et al. 2011 give 89.0% average sunlight at a
nearby point (−89.45, 222.69, stated to two decimals).

**Considered and rejected.**

- *Move each site to the highest ground within 160 m.* The orchestrator recommended this
  first, from Connecting Ridge alone. At all five sites it helps two, changes nothing at
  two and makes `de_gerlache_rim` worse. The highest ground is not always the best lit.
- *Move each site to its best-lit pixel.* It would flatter our results. At all five sites
  NASA's map reads lower at the pixel we would choose: by under one point at
  `connecting_ridge`, and by 23 and 26 points at `de_gerlache_rim` and `malapert_peak`.
  Choosing the highest of an imperfect estimate
  picks the places where it errs high. As a labelled variant beside the listed point this
  is honest; as a silent replacement it is not.
- *Ignore terrain closer than two pixels.* It would also ignore real slopes beside a
  lander, and reached only 78 to 83% at Connecting Ridge.

**Rules that follow.**

- The choice of a best-lit pixel uses only our own series, never NASA's average-sunlight
  map. That map is what we validate against.
- A best-lit variant is tagged as chosen by TrueSouth, never as sourced, and the app says
  its sunlight is an upper reading.
- The comparison with NASA's map (validation R1) is published for the listed point and
  for the variant, including where they differ by more than the "investigate" mark. NASA's
  map is for an observer on the surface over 18.6 years; ours is 2 m up over six years, on
  a different map grid.

**Not verified.** A reviewer reported that Connecting Ridge's listed coordinates are the
centre of the source paper's study area and that its best spot lies about 480 m away. The
paper could not be read, so this is not used anywhere.

# Demo script: three minutes

For the presenter. Read the **Say** lines aloud. They use no lunar jargon. The story is the
one in the Academy: Pip is a small solar lander headed for the Moon's south pole, and its
launch slips by three weeks.

State checked against `origin/main` at 2026-11-13 22:14 UTC (`origin/main` at 63d518a). This script uses only what is merged,
with two exceptions marked **[PR]**. The Slip Planner is **not built** (its window is a
placeholder), so steps 2 to 4 use the landing-date buttons. If the Slip Planner merges
first, see "If the Slip Planner is merged" at the end.

## Before the demo

1. Open every link below in a private window on the machine you will present from. Each
   one must show the right date in the top bar. **Try them before the demo.**
2. Use a browser with a graphics card. Without WebGL the scene shows a still picture
   instead of the 3D Moon (see "If something fails").
3. Have the recorded backup video ready in another tab.
4. Window about 1440 × 900. Mission Control is built for a wide screen.

Replace `<live>` with the live origin (CHECK: the live link is not known yet). The link
format is in [`../data-contracts.md`](../data-contracts.md), "Shareable scenario link".
Every link uses the IM-2 Athena profile, which is Pip's profile. A date is written
`2028-01-22T00%3A00Z` in a link.

| Name | Link |
| :--- | :--- |
| **A, the start** | `<live>/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-01-01T00%3A00Z&t=0&view=system` |
| **B, three weeks later** | the same, with `land=2028-01-22T00%3A00Z` |
| **C, the next GO date** | the same, with `land=2028-01-27T00%3A00Z` |
| **D, Lander's eye on the GO date** | link C with `view=panorama` |
| **E, the dark hour, Lander's eye** | link B with `view=panorama` |
| **F, the dark hour, Local terrain** | link B with `view=terrain` |
| **G, Apollo 11** | `<live>/mission?profile=im2_athena&sites=apollo11,connecting_ridge&land=2028-01-03T00%3A00Z&t=0&view=system` |

A working example from the repository, using 2028-03-01: `/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-03-01T00%3A00Z&t=0&view=system`.

## The facts the story rests on

These are in `data/derived/academy/worked_examples.json` (keys `story.*` and `l7.*`).

| Fact | Value | Key |
| :--- | :--- | :--- |
| Story site and profile | `connecting_ridge`, `im2_athena` | `story.site_id`, `story.profile_id` |
| GO landing | 2028-01-01T00:00:00Z | `l7.go_date` |
| Mission window ends | 2028-01-11T00:00:00Z | `story.window_end_utc` |
| Three weeks later | 2028-01-22T00:00:00Z | `l7.slip_date` |
| Broken rules on that date | `darkness`, `blackout`, `landing_dark` | `l7.slip_vetoes` |
| Longest blackout then | 119 hours | `l7.slip_blackout_h` |
| Next GO date | 2028-01-27T00:00:00Z | `l7.next_go_date` |

The writer also ran the Python scoring reference (`science/src/truesouth/scoring.py`) on
the stored series for these dates. Check each against the screen before the demo:

| Date | Verdict and score | Other readings |
| :--- | :--- | :--- |
| 2028-01-01 | GO, 100 | Sun's highest point in the 10-day window: 0.63° |
| 2028-01-22 | NO-GO, 40 | Sun at landing 0.52° above level but hidden: clearance −1.01° |
| 2028-01-27 | GO, 99.9 | Sunset in about 242.7 h (10 d 2 h 41 m); Earthset in about 308.6 h (12 d 20 h 34 m) |
| Apollo 11, 2028-01-03 | GO, 100 | Sun reaches 88.91°; Earth about 62° up at landing; slope not assessed (no terrain model) |

The limits behind GO and NO-GO for IM-2 Athena are mostly **assumed**. Only the 10-day
mission length is sourced ([`../mission-profiles.md`](../mission-profiles.md)). Say so if
asked (see the questions below).

## The three-minute script

Timings add up to 3:00.

### 1. The Moon and the sites (0:00 to 0:15)

- **Open:** link A. The System view fills the window.
- **You see:** the Moon, Earth and Sun, a marker for Connecting Ridge near the south pole,
  four sites in the left rail.
- **Say:** "This is the Moon's south pole, where the Sun never climbs. It skims the horizon
  below two degrees. Our lander Pip can only land where the Sun and Earth are both up for
  its ten-day stay. Every picture here is built from NASA's real terrain and positions."
- **If something fails:** the still picture appears instead of the 3D Moon. Keep going; the
  rail, the verdict and the timeline are the same. Say "this is our fallback picture of the
  same scene".

### 2. The launch slips (0:15 to 0:30)

- **Click:** the "Slip +7 d" button in the top bar three times. The landing date reads
  2028-01-22 00:00 UTC. (Or open link B.) If #83 has merged, the date controls are in the
  header of the bottom timeline, not the top bar; the buttons are the same.
- **You see:** the verdicts in the left rail change.
- **Say:** "Pip's launch just slipped three weeks. It was fine on 1 January. Same site, same
  mission, 22 January."
- **If something fails:** open link B in the same tab.

### 3. It turns NO-GO, and why (0:30 to 0:55)

- **Click:** Connecting Ridge in the left rail if it is not already focused. Read the card
  at the right.
- **You see:** NO-GO, and the broken rules named: "Longest dark stretch", "Longest
  blackout" and "Dark at landing". The blackout reads 119 h against Pip's 12 h limit,
  tagged **assumed**.
- **Say:** "The site turns NO-GO. Three rules break. For 119 hours in a row, Earth is out of
  sight, so Pip cannot call home. The limit shown there, twelve hours, is our estimate. We
  tag every estimate, and we never present one as published."
- **If something fails:** read the same three rules from the rail, which shows the worst
  one under each site's name.

### 4. The next good date (0:55 to 1:10)

- **Click:** "One day later" five times, or open link C. The date reads 2028-01-27. If #83
  has merged, click "Next GO" once instead: it should jump to 2028-01-27 for Connecting
  Ridge (CHECK: it searches from the day after the landing date; confirm the date it lands on).
- **You see:** GO, score 99.9. The timeline shows no dark stretch and no blackout.
- **Say:** "Five days later it works again. A slip of three weeks is NO-GO. A slip of
  twenty-six days is GO. That is the whole point: small date changes decide the mission."
- **If something fails:** open link C.

### 5. The view from Pip (1:10 to 1:30)

- **Click:** "Lander's eye" in the view bar, or open link D.
- **You see:** a flat strip of the whole horizon with the terrain's outline, the Sun and
  Earth on it, and below, the two countdown cards.
- **Say:** "This is what Pip would see turning in a full circle. The Sun is only a
  quarter of a degree up. The cards count down: sunset is more than ten days away, Earthset
  nearly thirteen. Both are longer than Pip's ten-day mission."
- **If something fails:** the cards and the timeline do not need 3D. Stay on the strip.

### 6. A dark hour, and what blocks it (1:30 to 1:55)

- **Open:** link E (22 January, hour zero). Click the "Why?" button beside the one-line
  reason under the horizon chart.
- **You see:** the Sun 0.52° above level, yet marked dark, and the card naming the terrain
  that hides it and how far away it is.
- **Click:** "Local terrain" in the view bar, or open link F. The camera drops to the
  ground around the site, and a small lander, drawn larger than life and labelled so, stands
  on it.
- **Say:** "The Sun is above level, and still Pip is in the dark. A ridge stands in the way.
  The tool names it and shows where it is. The 3D picture is only a picture; the result
  comes from the real terrain numbers."
- **If something fails:** stay on the card; it is plain text.

### 7. Back to space (1:55 to 2:00)

- **Click:** "System view".
- **Say:** "Pulling back out."

### 8. Apollo 11, for contrast (2:00 to 2:15)

- **Open:** link G. Click Apollo 11 in the rail, then "Lander's eye".
- **You see:** a high Sun, Earth high in the sky, GO on 3 January, "Terrain not modelled".
- **Say:** "Apollo 11 landed near the equator. There the Sun climbs almost overhead, up to
  nearly 89 degrees in this window, and Earth sits high above the horizon. At the pole the
  Sun climbs to a fraction of a degree. That is why this place is hard. We do not model
  terrain away from the poles, and the screen says so."
- **If something fails:** use the System view picture and say the same words.

### 9. The Academy (2:15 to 2:45)

- **Click:** "Academy" in the top bar. Open lesson 1. **[PR-81]**
- **You see:** Luna, the moon mascot, asking: "At my equator the midday Sun is almost
  overhead. How high does it get at my south pole?" Three answers. Pick "Under 3°".
- **Say:** "The same logic, as a short game for students and the public. Luna guides you
  through it. At the end of each lesson you open the real Mission Control panel you just
  learned. The story is made up, but every number in it is real."
- **If #81 is not merged:** show the lesson path map instead (the picture
  `docs/design/c2/built-academy-path.png`) and say "the first four lessons are being
  finished". Do not click into a lesson.

### 10. How we know it is right (2:45 to 3:00)

- **Open:** `<live>/validation` (merged in #79).
- **You see:** the headline comparison against NASA's Horizons.
- **Say:** "We checked our Sun and Earth directions against NASA's own ephemeris service
  at every site and every hour: over two million comparisons. The largest difference is
  0.0061 degrees. We publish the two results that miss our marks, too."
- **If the page is slow or fails:** say the same words from the headline card below.
  CHECK: open `/validation` on the live site, and read its headline against the card.

## The one-minute version

Use link A, then:

| Time | Do | Say |
| :--- | :--- | :--- |
| 0:00 to 0:10 | Link A | "Landing at the Moon's south pole is hard: the Sun skims the horizon. TrueSouth tells a planner whether a landing date works." |
| 0:10 to 0:25 | "Slip +7 d" three times; read the NO-GO card | "Pip's launch slips three weeks. The site turns NO-GO: Earth is out of sight for 119 hours." |
| 0:25 to 0:35 | "One day later" five times | "Five days on, it is GO again." |
| 0:35 to 0:45 | "Lander's eye" | "This is Pip's horizon: the Sun, Earth and the terrain that blocks them, with countdowns." |
| 0:45 to 0:55 | Validation card | "Our Sun and Earth directions match NASA's Horizons within 0.0061 degrees, over two million checks." |
| 0:55 to 1:00 | none | "A planning aid, not flight certification. TrueSouth." |

## The headline card

Hold this on a phone or a slide for step 10 if the page is not live.

> **Sun and Earth directions against NASA's JPL Horizons:** 2,103,360 comparisons (20 sites,
> 2 bodies, 52,584 hours). Largest difference **0.0061°**. Pass mark 0.02°.
> Source: `data/derived/validation.json`, gate G2.

## Likely questions

**How accurate is it?** Our Sun and Earth directions match NASA's Horizons within 0.0061°
(pass mark 0.02°) at all 20 sites, every hour for six years. Our terrain geometry passes nine
automated gates (G1 to G9). Against NASA's own sunlight map, 13 of 14 polar sites are within 6.3
percentage points. One is not, and one skyline check is not (next answer). The terrain map
cannot see boulders or small craters.

**Why does your sunlight differ from NASA's map at one site?** At Peak near Shackleton we
read 60.2% and NASA's 60 m map reads 36.1%, a gap of 24.1 points, far outside our 10-point
mark. On a narrow ridge the value depends on exactly which pixel you read: NASA's
neighbouring pixels range from 44.7% to 58.0%, and NASA's 120 m map gives 60.1%, close to
ours. NASA also models an observer on the ground over 18.6 years; we model 2 m up over six
years. There is a second gap we have not closed.
At Connecting Ridge the published figure (Gläser et al. 2014: 92.27% of time with any Sun,
2 m above ground, over 19 years) is well above ours: 65.7% of hours with any Sun over six
years, and 59.9% mean sunlight. NASA's own 60 m map gives 66.1% at that pixel, close to ours.
The averaging spans and maps differ, and we have not shown which causes the gap. We do not
claim they agree (`DEVLOG.md`, S7 entry; `docs/site-catalog.md`).

**What is assumed?** Most mission limits are not published, so they are tagged **assumed**
on screen. For IM-2 Athena, only the 10-day length is sourced. The longest dark stretch it
survives (6 h), the longest blackout (12 h), the slope limit (10°) and no relay are
assumed. For all profiles, the antenna mask (1°), the share of the Sun that counts as lit
(0.5) and the weights are ours (`docs/mission-profiles.md`).

**Does it work for any coordinates?** Not yet. It has 20 catalog sites: Artemis candidate
regions, published sunlit points, recent landers and Apollo and Chang'e contrast sites.
Away from the poles it uses a smooth Moon and says "Terrain not modelled". A server that
computes a custom point is in review (#80); the entry form in the app is not written.

**Why six years?** CHECK: the repository does not record the reason. It is the span we
computed, 2026-01-01 to 2031-12-31 (52,584 hours), and it keeps the shipped data to about 60 MB
(`docs/orchestration/status.md`). Confirm the answer with the team lead before the demo.

**What would you do next?** Build the Slip Planner (every landing date for every site in
one view), the Compare window, the flat Polar map with pins, a form for custom coordinates
with dates, a sensitivity grid, Academy lessons 5 to 8 and Luna's final art. These are the
items in `docs/build-plan.md` marked out of scope for the deadline or not yet built.

**Is it flight certification?** No. It is a planning aid. The footer says so on every
screen.

**Did AI write it?** AI tools wrote most of the code and drafts, under a human team lead
who set the direction and picked every design. The full disclosure is in
[`ai-use.md`](ai-use.md).

## If the Slip Planner is merged

Only after you have opened it and seen it work. Replace steps 2 to 4 (0:15 to 1:10) with:

2. Click "Slip Planner" in the view bar. The camera flies to the pole and each site becomes
   a spot. Say: "Pip's launch just slipped three weeks. Each site is a spot; the strips below
   show every landing date for six years."
3. Drag the landing-date slider to 2028-01-22. Connecting Ridge's spot turns NO-GO. Hover
   to see why. Say as in step 3.
4. Drag to 2028-01-27, or click the next GO date on the strip. Say as in step 4.

Keep the same timings.

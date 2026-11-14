# Demo script: three minutes

For the presenter. Read the **Say** lines aloud. They use no lunar jargon. The story is the
one in the Academy: Pip is a small solar lander headed for the Moon's south pole, and its
launch slips by three weeks.

State checked against `origin/main` at **2026-11-14 (`origin/main` at `5a5fd84`)**. Every
view in this script—System view, Polar map, Slip Planner, Local terrain, Lander's eye,
Compare, Academy lessons 1–4, and Validation—is merged on `origin/main`.

## Before the demo

1. Open every link below in a private window on the machine you will present from. Each
   one must show the right landing date and view. **Try them before the demo.**
2. Use a browser with a graphics card. Without WebGL the System view shows a still picture
   and the Slip Planner falls back to the 2D Polar map (see "If something fails").
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
| **G, Apollo 11** | `<live>/mission?profile=im2_athena&sites=apollo11,connecting_ridge&land=2028-01-03T00%3A00Z&t=0&view=system` (`CHECK: try on screen`) |

## The facts the story rests on

Quoted directly from `data/derived/academy/worked_examples.json` (keys `story.*`, `l1.*`, `l6.*`, `l7.*`):

| Fact | Value | Key |
| :--- | :--- | :--- |
| Story site and profile | `connecting_ridge`, `im2_athena` | `story.site_id`, `story.profile_id` |
| GO landing | `2028-01-01T00:00:00Z` (GO, score `100`, 0 h dark, 0 h blackout, Sun `0.63°` at landing) | `l7.go_date`, `l6.a_score`, `l6.example_metrics.*` |
| Mission window ends | `2028-01-11T00:00:00Z` | `story.window_end_utc` |
| Three weeks later | `2028-01-22T00:00:00Z` (NO-GO) | `l7.slip_date` |
| Broken rules on that date | `darkness`, `blackout`, `landing_dark` | `l7.slip_vetoes` |
| Longest blackout then | `119` hours | `l7.slip_blackout_h` |
| Next GO date | `2028-01-27T00:00:00Z` | `l7.next_go_date` |

Other dates and on-screen readings used below are not stored in `worked_examples.json`; verify them on the live screen before presenting:

- `2028-01-22` hour 0 solar elevation/clearance and exact score (`CHECK: try on screen`).
- `2028-01-27` exact score and Sun/Earth countdown durations (`CHECK: try on screen`).
- Whether any other site in the 4-site set is GO on `2028-01-22` (`CHECK: try on screen`).
- Apollo 11 on `2028-01-03` (`CHECK: try on screen`).

The limits behind GO and NO-GO for IM-2 Athena are mostly **assumed**. Only the 10-day
mission length is sourced ([`../mission-profiles.md`](../mission-profiles.md)). Say so if
asked (see the questions below).

## The three-minute script

Timings add up to 3:00.

### 1. The Moon and the sites (0:00 to 0:15)

- **Open:** link A (`2028-01-01T00:00Z`). The **System view** fills the window.
- **You see:** the Moon, Earth, Sun, and Yale starfield; a green GO marker for Connecting Ridge near the south pole; four sites in the "Selected sites" rail (Connecting Ridge is GO, score 100).
- **Say:** "This is the Moon's south pole, where the Sun never climbs. It skims the horizon
  below two degrees. Our lander Pip can only land where the Sun and Earth are both up for
  its ten-day stay. Every picture here is built from NASA's real terrain and positions."
- **If something fails:** the still picture appears instead of the 3D Moon. Keep going; the
  rail, the verdict and the timeline are the same. Say "this is our fallback picture of the
  same scene".

### 2. The launch slips in the Slip Planner (0:15 to 0:30)

- **Click:** **Slip Planner** in the view bar. The camera flies to the south pole and each site becomes a **spot** (status lamp inside a score ring) on the Moon, with the **Landing dates** panel below ("Any site" + one 6-year strip per site).
- **Do:** drag the landing-date slider to `2028-01-22` (or open the Landing date picker in the panel header and click `+14 d` then `+7 d`, or open link B with `view=slip`).
- **You see:** the spots and strips update live, and a before-and-after summary plate appears (`Slipped +21 d…`).
- **Say:** "Pip's launch just slipped three weeks. Each spot is a site on the Moon; the strips below show every landing date for six years. It was GO with score 100 on 1 January. Same site, same mission, 22 January."
- **If 3D is off:** the Slip Planner automatically shows the flat Polar map under the same spots and strips.

### 3. It turns NO-GO, and why (0:30 to 0:55)

- **Do:** hover Connecting Ridge's spot or strip (or read the focused-site panel at the right).
- **You see:** **NO-GO**, with the three broken rules: "Longest dark stretch", "Longest blackout" (**119 h** against Pip's 12 h limit, tagged **assumed**), and "Dark at landing".
- **Say:** "The site turns NO-GO. Three rules break. For 119 hours in a row, Earth is out of
  sight, so Pip cannot call home. The limit shown there, twelve hours, is our estimate. We
  tag every estimate, and we never present one as published."
- **Optional quick peek (if ahead on time):** click **Compare** on the view bar to show the four sites side by side with the deciding row highlighted and `Export CSV` / `Export JSON`, then press Escape to close it.

### 4. The next good date (0:55 to 1:10)

- **Click:** **Next GO** in the Landing-date panel header (or drag the slider to `2028-01-27`, or open link C).
- **You see:** Connecting Ridge jumps to **`2028-01-27`** and turns **GO** (`CHECK: try on screen` for the exact score).
- **Say:** "Five days later it works again. A slip of three weeks is NO-GO. A slip of
  twenty-six days is GO. That is the whole point: small date changes decide the mission."

### 5. The view from Pip (1:10 to 1:30)

- **Click:** **Lander's eye** in the view bar (or open link D). Click **Horizon chart** at the bottom-left of the panel to expand the 360-degree chart (it starts folded by default so the 3D horizon has the room).
- **You see:** the 3D horizon at 2 m above Connecting Ridge, the Sun and Earth tracks on the skyline chart, and the Sun and Earth countdown cards in the Timeline below (`CHECK: try on screen` for the exact countdown numbers on `2028-01-27`).
- **Say:** "This is what Pip would see at two metres above the ground, turning in a full circle. The horizon chart plots NASA's skyline and the Sun and Earth tracks, and the cards count down to the next sunset and Earthset."
- **If something fails:** the cards, timeline, and SVG horizon chart do not need WebGL.

### 6. A dark hour, and what blocks it (1:30 to 1:55)

- **Open:** link E (`2028-01-22`, hour zero—a dark hour at landing). Expand **Horizon chart** if folded, and click **Why?** beside the one-line darkness summary (`CHECK: try on screen` for the exact elevation/clearance and blocker distance shown).
- **Click:** **Local terrain** in the view bar (or open link F). The camera rises to show the 20 km terrain patch inside the 300 km surrounding terrain out to a curved horizon, with the scaled lander Pip (`Lander not to scale`) and the disclosure plate saying shadows are for understanding only.
- **Say:** "At landing on 22 January, Pip is in the dark—terrain stands in the way, and the tool measures the exact blocker distance and height. The 3D picture lets you see the ridges around the site; the go or no-go result always comes from the precomputed science data, and the screen says so."

### 7. Back to space (1:55 to 2:00)

- **Click:** **System view** in the view bar.
- **Say:** "Pulling back out."

### 8. Apollo 11, for contrast (2:00 to 2:15)

- **Open:** link G (`2028-01-03`, `CHECK: try on screen`). Click Apollo 11 in the left rail, then **Lander's eye** (or stay in System view).
- **You see:** a high Sun, Earth high above the horizon, and "No terrain data for Apollo 11. This is the smooth Moon."
- **Say:** "Apollo 11 landed near the equator, where the Sun and Earth climb high in the sky. At the south pole both hug the horizon. Away from the poles we treat the Moon as a smooth sphere, and the screen tells you."

### 9. The Academy (2:15 to 2:45)

- **Click:** **Academy** in the top bar. Open **Lesson 1 ("Where's the Sun?")** (`/academy/l1_sun`).
- **You see:** Luna, the moon mascot, asking step 1: "At my equator the midday Sun is almost overhead. How high does it get at my south pole?" Pick **Under 3°**. (Note for presenter: lessons 1–4 are playable; 4 draggable-panel steps show a preview + real answer until PR `#95` merges, so step 1 of Lesson 1 or Lesson 3's curvature slider works best live.)
- **Say:** "The same physics, as a short guided story for students and the public. Luna walks you through four lessons to land Pip. Every number in the story is computed from the real pipeline, and each lesson opens an Under-the-hood formula card."

### 10. How we know it is right (2:45 to 3:00)

- **Open:** `<live>/validation`.
- **You see:** the headline comparison against NASA's JPL Horizons, the 9 measured pipeline gates (plus G10 and G11 checked in web tests), and the 59 comparisons against NASA's maps.
- **Say:** "We checked our Sun and Earth directions against NASA's own ephemeris service across more than two million site-hour pairs: the largest difference is within 0.0061 degrees. And where our numbers differ from NASA's long-term maps, we publish those rows and explain why."
- **If the page fails:** hold up the headline card below. CHECK: open `/validation` on the live site before presenting and confirm the headline matches.

## The one-minute version

Use link A, then:

| Time | Do | Say |
| :--- | :--- | :--- |
| 0:00 to 0:10 | Link A (`2028-01-01`) | "Landing at the Moon's south pole is hard: the Sun skims the horizon. TrueSouth tells a planner whether a landing date works." |
| 0:10 to 0:25 | Click **Slip Planner**, drag to `2028-01-22` | "Pip's launch slips three weeks. Each site is a spot on the Moon; Connecting Ridge turns NO-GO with a 119-hour Earth blackout." |
| 0:25 to 0:35 | Click **Next GO** (`2028-01-27`) | "Five days later, it is GO again." |
| 0:35 to 0:45 | Click **Lander's eye** | "This is Pip's horizon at two metres up: the skyline, the Sun and Earth, and live countdowns." |
| 0:45 to 0:55 | Open `/validation` | "Our Sun and Earth directions match NASA's Horizons within 0.0061 degrees across over two million checks." |
| 0:55 to 1:00 | none | "A planning aid, not flight certification. TrueSouth." |

## The headline card

Hold this on a phone or a slide for step 10 if the page is not live.

> **Sun and Earth directions against NASA's JPL Horizons:** 2,103,360 comparisons (20 sites,
> 2 bodies, 52,584 hours). Largest difference **0.0061°**. Pass mark 0.02°.
> Source: `data/derived/validation.json`, gate G2.

## Likely questions

**How accurate is it?** Our Sun and Earth directions match NASA's Horizons within 0.0061°
(pass mark 0.02°) at all 20 catalog sites, every hour for six years. Nine automated pipeline
gates (G1 to G9) pass, and TypeScript/Python scoring parity (G10) and type parity (G11) pass
in the web tests. Against NASA's 60 m average-sunlight map, 16 of 19 polar entries are within
8.2 percentage points, 18 of 19 Earth-visibility entries are within 9.3 points, and all 18
`core80` slopes are within 1.3 degrees. The 80 m map cannot see boulders or small craters.

**Why does your sunlight differ from NASA's map at a few sites?** Three polar entries exceed
our 10-point sunlight mark (`peak_near_shackleton` +24.0 points, `de_gerlache_rim_best_lit`
+23.2 points, `malapert_peak_best_lit` +26.0 points) and one best-lit variant exceeds our
Earth-visibility mark (`de_gerlache_rim_best_lit` +11.0 points). On steep ridges a single 60 m
pixel varies widely (NASA's neighbours around Peak near Shackleton run from 44.7% to 58.0%,
and NASA's 120 m map reads 60.1%, matching our 60.2%). NASA also averages 18.6 years at 0 m
ground height against our 6 years at 2 m. At Connecting Ridge, Gläser et al. (2014) report
92.27% any-Sun over 19 years at CR1, whereas our 6-year 80 m run gives 65.7% any-Sun (59.9%
mean) at CR1 and 91.5% any-Sun (87.0% mean) at our `connecting_ridge_best_lit` pixel 149 m
away; we publish all of these differences openly (`DEVLOG.md`, `docs/site-catalog.md`,
`/validation`).

**What is assumed?** Most mission limits are not published, so they are tagged **assumed**
on screen. For IM-2 Athena, only the 10-day length is sourced. The longest dark stretch it
survives (6 h), the longest blackout (12 h), the slope limit (10°) and no relay are
assumed. For all profiles, the antenna mask (1°), the share of the Sun that counts as lit
(0.5) and the weights are ours (`docs/mission-profiles.md`).

**Does it work for any coordinates?** Yes, when running against the API with prepared NASA
terrain maps mounted (`POST /api/sites/custom`): users can type any latitude and longitude in
"+ Add site" → "Your own coordinates" or click empty ground in **Polar map** → "Compute this
site". Polar sites compute from real 80 m/240 m terrain in under a minute; sites north of
60°S run on the smooth Moon in seconds. (In the catalog-only Docker build without mounted
maps, the UI displays that custom sites are not available on that server.)

**Why six years?** CHECK: the repository does not record the reason. It is the span we
computed, 2026-01-01 to 2031-12-31 (52,584 hours), keeping the shipped derived dataset
manageable (~60 MB in repo). Confirm the answer with the team lead before the demo.

**What would you do next?** Local terrain slope/height overlays and 5 m close-up meshes (`T4`,
`T5`), the 9×9 "compute for my dates" sensitivity grid (`S11`/`T8`), Academy lessons 5 to 8
(`A6`), Luna's final hand-drawn art (`A10`), and official USGS Artemis region outlines (which
require a ScienceBase login).

**Is it flight certification?** No. It is a planning aid. The footer says so on every
screen.

**Did AI write it?** AI tools wrote most of the code and drafts, under a human team lead
who set the direction and picked every design. The full disclosure is in
[`ai-use.md`](ai-use.md).

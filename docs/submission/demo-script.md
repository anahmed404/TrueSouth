# Demo script: three minutes

For the presenter. Read the **Say** lines aloud. They use no lunar jargon. The story is the
Academy's: Pip is a small solar lander headed for the Moon's south pole, and its launch
slips by three weeks.

State checked against `origin/main` at **69bb26e, 2026-11-14**. Every control named below
is the label on screen in that build. Nobody has yet run this script start to finish in the
browser; the first rehearsal is the check. Rehearse it once and fix any label that moved.

## Before the demo

1. Open every link below in a private window on the machine you will present from.
   **Try them before the demo.**
2. Use a browser with a graphics card. Without WebGL the System view shows a still picture
   and the Slip Planner shows the flat Polar map under the same spots (see "If something
   fails").
3. Have the recorded backup video ready in another tab. (Open item in
   [`links-checklist.md`](links-checklist.md): the video is not recorded yet.)
4. Window about 1440 × 900. Mission Control is built for a wide screen.

Replace `<live>` with the address of the demo server. CHECK (team lead): there is no live
address yet; see [`links-checklist.md`](links-checklist.md). The link format is in
[`../data-contracts.md`](../data-contracts.md), "Shareable scenario link". Every link uses
the IM-2 Athena profile, which is Pip's profile. A date is written `2028-01-22T00%3A00Z` in
a link. `t` is the current time in hours after the landing date.

| Name | Link |
| :--- | :--- |
| **A, the start** | `<live>/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-01-01T00%3A00Z&t=0&view=system` |
| **B, three weeks later** | link A with `land=2028-01-22T00%3A00Z` and `view=slip` (a shortcut for step 2) |
| **C, the next GO date** | link A with `land=2028-01-27T00%3A00Z` |
| **E, the dark hour from Pip's eye** | link A with `land=2028-01-22T00%3A00Z` and `view=panorama` |
| **G, Apollo 11 (optional)** | `<live>/mission?profile=im2_athena&sites=apollo11,connecting_ridge&land=2028-01-03T00%3A00Z&t=120&view=panorama` |

## The facts the story rests on

Computed for this file with the Python scoring reference (`truesouth.scoring`) on the
stored series (`data/derived/sites/<id>/series.bin`), the IM-2 Athena profile from
`data/derived/profiles.json`, and each site's stored slope. Each landing is at 00:00 UTC.
Scores print rounded down, as the app does. The Academy's `data/derived/academy/worked_examples.json`
gives the same Connecting Ridge numbers for 2028-01-01 and 2028-01-22.

| Landing (UTC) | Connecting Ridge | The other three sites |
| :--- | :--- | :--- |
| 2028-01-01 | **GO**, score 100. 0 h dark, 0 h blackout. Sun 0.63° up at landing | Malapert Massif NO-GO (dark stretch 202 h). Mons Mouton NO-GO (dark 240 h, blackout 18 h). de Gerlache Rim 2 NO-GO (slope 10.8° against the 10° limit, and dark) |
| 2028-01-22 | **NO-GO**. Broken: longest dark stretch (61 h against 6 h), longest blackout (**119 h** against 12 h), dark at landing. The Sun is 0.52° up but 1.01° below the skyline; Earth is 6.11° below the horizon | All three NO-GO |
| 2028-01-27 | **GO**, score 99 (99.89 rounded down). 0 h dark, 0 h blackout. This is the first GO day after 22 January (23 to 26 January are all NO-GO) | All three NO-GO |

So on 1 January, Connecting Ridge is the only GO of the four, and nothing else becomes GO
on 22 or 27 January. The slip is 21 days; the next GO is 5 days after that.

The limits behind GO and NO-GO for IM-2 Athena are mostly **assumed**. Only the 10-day
mission length is sourced ([`../mission-profiles.md`](../mission-profiles.md)). Say so if
asked.

## The three-minute script

Timings add up to 3:00. About 400 spoken words.

### 1. The Moon and the sites (0:00 to 0:20)

- **Open:** link A. The **System view** fills the window.
- **You see:** the Moon, Earth, the Sun and the stars. The "Selected sites" rail on the left
  lists four sites; Connecting Ridge is GO and the other three are NO-GO.
- **Say:** "This is the Moon's south pole. The Sun never climbs more than about two degrees
  there. It skims the horizon. Pip, our lander, can only land where the Sun and Earth are
  both in view for its ten-day stay. Everything here is built from NASA's real terrain and
  positions."
- **Do:** drag the Moon over a pole to show it turns freely.
- **If something fails:** a still picture appears in place of the 3D Moon. Keep going; the
  rail, the verdicts and the timeline are the same.

### 2. The launch slips (0:20 to 0:50)

- **Click:** **Slip Planner** in the view bar. The camera flies to the pole. Each site becomes
  a spot (a status lamp inside a ring that fills to its score), with a strip per site in
  the bottom panel and an "Any site" strip above them.
- **Click:** the landing date at the left of the bottom panel (it reads `2028-01-01 00:00
  UTC`). In the box that opens, press **+14 d**, then **Slip +7 d**. Press Escape.
- **You see:** the spots and strips update at once. A plate says "Slipped +21 d, 01 Jan →
  22 Jan 2028. 1 of 4 sites changed. No site is GO or CAUTION on this date." Connecting
  Ridge's spot shows "was GO".
- **Say:** "Pip's launch just slipped three weeks. Each spot is a site on the Moon. The
  strips show every landing date for six years. It was GO on 1 January. Same site, same
  mission, 22 January: no site works."
- **If you want to skip the clicks:** open link B.
- **If 3D is off:** the Slip Planner shows the flat Polar map under the same spots.

### 3. Why it fails (0:50 to 1:15)

- **Look at:** the "Focused site" panel on the right (Connecting Ridge).
- **You see:** NO-GO, and three broken rules: "Longest dark stretch", "Longest blackout"
  (**119 h** against a 12 h limit, tagged **assumed**) and "Dark at landing".
- **Click:** **Lander's eye** in the view bar. The foot row under the 3D horizon gives a
  one-line reason for the Sun and for Earth, with a **Why?** button. Press it: the box that
  opens ("Why is it dark?", and "Why is there no link?" for Earth) names the terrain that
  hides the Sun and gives its bearing, distance and height.
- **Say:** "Three rules break. For 119 hours in a row Earth is below the horizon, so Pip
  cannot call home. The twelve-hour limit is our estimate, and the screen says so. We tag
  every estimate, and we never show one as published. And the Sun is up by half a degree,
  but a ridge hides it."

### 4. The next good date (1:15 to 1:30)

- **Click:** **Next GO** in the landing date row (bottom strip). The landing date jumps to
  `2028-01-27` and a note says "Landing moved to 27 Jan 2028, the next GO date for
  Connecting Ridge." The verdict turns GO, score 99.
- **Say:** "Five days later it works again. Three weeks late is NO-GO. Twenty-six days late
  is GO. Small date changes decide the mission."

### 5. Compare (1:30 to 1:50)

- **Click:** **Compare** in the view bar. The bottom strip folds to one row.
- **You see:** one table, four columns. Connecting Ridge is GO; the other three are NO-GO.
  One row is marked "Decides between them". The header has the landing date, "Export CSV"
  and "Export JSON". "Open in NASA’s maps" links each site to QuickMap and Moon Trek.
- **Say:** "Compare puts the sites side by side for one date. The row that decides between
  them is marked. Planners can export the table or open any site in NASA's own maps."
- **Press** Escape to close it.

### 6. The ground (1:50 to 2:10)

- **Click:** **Local terrain** in the view bar. The camera drops to the ground at
  Connecting Ridge: 20 km of terrain around the site and more beyond it to the horizon,
  with Pip standing at the site ("Lander not to scale").
- **You see:** relief, drawn shadows and a ground texture, and a plate: "The series says:
  lit. 100 % of the Sun's disc is above the skyline." with the note that shading and
  shadows are for understanding only.
- **Say:** "This is the ground Pip lands on. The shadows are only a drawing. Whether it is
  light or dark always comes from the computed record, and the screen says so."
- **If WebGL is off:** skip this step and go on.

### 7. The Academy (2:10 to 2:40)

- **Click:** **Academy** in the top bar, then lesson 1, **Start lesson 1**
  ("Where's the Sun?"). Or open `<live>/academy/l1_sun`.
- **Do:** Luna asks how high the Sun gets at the south pole. Pick **Under 3°** and press
  **Check**. On the next step, drag the Sun through the month to its highest point and
  press **Check**.
- **Say:** "The same physics, as a short guided story for students and the public. Luna
  walks you through four lessons to land Pip: dragging the Sun, sketching a skyline,
  finding a bug in a calculation. Every number comes from the same pipeline, and each
  lesson has an Under-the-hood formula card."

### 8. How we know it is right (2:40 to 3:00)

- **Open:** `<live>/validation` ("How we know it's right"; also a link on the start screen).
- **You see:** under "Sun and Earth positions": "Our Sun and Earth positions agree with
  NASA's to within 0.0061°." Below it are the terrain checks and "Against NASA's maps",
  including the rows that are outside our marks.
- **Say:** "We checked our Sun and Earth directions against NASA's ephemeris service in more
  than two million comparisons. The largest difference is 0.0061 degrees. Where
  our numbers differ from NASA's long-term maps, we publish those rows and explain why.
  TrueSouth is a planning aid, not flight certification."
- **If the page fails:** hold up the headline card below.

## If there is time

- **Apollo 11** (link G): Lander's eye at Apollo 11 on 2028-01-06, five days after the
  landing date. The Sun is 65° up and Earth 59°. A plate says "No terrain data for Apollo
  11. This is the smooth Moon." Say: "Near the equator both are high. At the pole both hug
  the horizon. Away from the poles we treat the Moon as a smooth ball, and the screen says
  so."
- **Your own coordinates:** in the "Selected sites" rail press **Add site**, then **Enter
  coordinates**, type a latitude and an east longitude, and compute. The rail shows the
  queue position. A south-pole site took 44 to 49 seconds on our development machine. If the
  server has no prepared NASA maps, the row says "Not available on this server"; skip it.

## The one-minute version

Use link A, then:

| Time | Do | Say |
| :--- | :--- | :--- |
| 0:00 to 0:10 | Link A | "Landing at the Moon's south pole is hard: the Sun skims the horizon. TrueSouth tells a planner whether a landing date works." |
| 0:10 to 0:30 | Click **Slip Planner**, press the landing date, **+14 d**, **Slip +7 d** | "Pip's launch slips three weeks. Connecting Ridge turns NO-GO: Earth is out of sight for 119 hours." |
| 0:30 to 0:40 | Press **Next GO** | "Five days later, it is GO again." |
| 0:40 to 0:50 | Click **Lander's eye** | "This is Pip's horizon at two metres up, with live countdowns." |
| 0:50 to 1:00 | Open `/validation` | "Our Sun and Earth directions match NASA's Horizons within 0.0061 degrees. A planning aid, not flight certification." |

## The headline card

Hold this on a phone or a slide for step 8 if the page is not live.

> **Sun and Earth directions against NASA's JPL Horizons:** 2,103,360 comparisons (20 sites,
> 2 bodies, 52,584 hours). Largest difference **0.0061°**. Pass mark 0.02°.
> Source: `data/derived/validation.json`, gate G2.

## Likely questions

**How accurate is it?** Our Sun and Earth directions match NASA's Horizons within 0.0061°
(pass mark 0.02°) at all 20 catalog sites, every hour for six years. Nine pipeline gates
(G1 to G9) pass, and the web tests check TypeScript scoring against the Python reference
(G10) and the generated types (G11). Against NASA's 60 m average-sunlight map, 16 of 19
polar entries are within 8.2 percentage points, 18 of 19 Earth-visibility entries are
within 9.3 points, and all 18 slopes are within 1.3 degrees. The 80 m map cannot see
boulders or small craters. Nothing here is flight certification.

**Why does your sunlight differ from NASA's map at a few sites?** Three polar entries are
outside our 10-point mark: Peak near Shackleton (+24.0 points), and the best-lit variants at
de Gerlache rim (+23.2) and Malapert Massif peak (+26.0). One variant is outside the
Earth-visibility mark (de Gerlache rim, +11.0). On steep ridges a single 60 m pixel varies
widely: NASA's neighbours around Peak near Shackleton run from 44.7% to 58.0%, and NASA's
120 m map reads 60.1%, matching our 60.2%. NASA also averages 18.6 years at ground level,
against our six years at 2 m. We publish all of these rows on the validation page.

**What is assumed?** Most mission limits are not published, so they are tagged **assumed**
on screen. For IM-2 Athena only the 10-day length is sourced. The longest dark stretch it
survives (6 h), the longest blackout (12 h), the slope limit (10°) and no relay are
assumed. For every preset, the antenna mask (1°), the share of the Sun that counts as lit
(0.5) and the weights are ours ([`../mission-profiles.md`](../mission-profiles.md)).

**Does it work for any coordinates?** Yes, on a server with NASA's prepared terrain maps.
Type a latitude and east longitude under "Enter coordinates" in "Add site", or click the
Polar map and press "Compute this site". South of 80°S it uses 80 m terrain, from 80°S to
60°S 240 m terrain, and north of 60°S a smooth Moon. A server without the maps says custom
sites are not available.

**Why six years?** Not recorded in the repository. The data runs from 2026-01-01 to
2031-12-31 (52,584 hours). CHECK (team lead): give the reason before the demo.

**What would you do next?** Colour overlays and close-up 5 m terrain in Local terrain, a
"compute for my dates" grid, Academy lessons 5 to 8, final art for Luna, and official
Artemis region outlines.

**Is it flight certification?** No. It is a planning aid. The footer says so.

**Did AI write it?** AI tools wrote most of the code and drafts, under a human team lead who
set the direction and picked every design. The full disclosure is in
[`ai-use.md`](ai-use.md).

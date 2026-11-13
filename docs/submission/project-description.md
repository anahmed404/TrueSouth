# Project description

Text for the NASA Space Apps 2026 submission form. Three lengths of the same content.
The numbers come from `data/derived/validation.json` (file generated 2026-11-13) and the
files named in the footnotes. Where a sentence depends on work that is still in a pull
request, it is marked **[PR]** and listed under "Before pasting".

## Before pasting

State checked against `origin/main` at @@CHECKED@@. Re-run `git fetch origin` and
`gh pr list --state open`, then read this list again.

| Marked | What it depends on | If it is not merged |
| :--- | :--- | :--- |
| **[PR-81]** | Pull request #81, Academy lessons 1 to 4 playable | Say "the Academy's first four lessons are being finished" or delete the Academy sentences about lessons |
| **[PR-79]** | Pull request #79, the validation page | Delete "and a validation page that shows every comparison" |

Nothing in the three texts depends on the Slip Planner, the Compare window, the flat Polar
map or custom coordinates. None of those is merged. Do not add them. If the Slip Planner
merges before the deadline, add the optional sentence at the end of this file.

CHECK: does the form allow links, line breaks or headings? The full description uses
plain headings; flatten them if the form does not.

---

## One sentence (28 words)

TrueSouth tells mission planners and learners whether a lunar landing date works: it scores sunlight and Earth contact at 20 sites from NASA's LOLA terrain and JPL Horizons.

## Short summary (about 100 words)

Landing near the Moon's south pole depends on narrow windows: the Sun skims the horizon, Earth rises and sets, and mountains block both. When a launch slips, planners must choose again. TrueSouth turns NASA's LOLA terrain and JPL Horizons positions into a skyline and an hourly record of the Sun and Earth for 20 sites over six years. Mission Control scores any landing date against a mission profile in the browser, with every limit tagged sourced or assumed. The Academy teaches the same logic **[PR-81]**. Our Sun and Earth directions match Horizons within 0.0061 degrees. It is a planning aid, not flight certification.

## Full description

### The problem

NASA's challenge says: "Hardware development challenges, launch delays, or other factors
often force mission planners to reconsider their original landing date and location." At the
Moon's south pole that choice is hard. The Sun stays within 1 to 2 degrees of the horizon,
Earth moves above and below it as the Moon wobbles, and mountains block both. A small change
in where or when to land can turn a workable mission into a dead one. NASA's Quickmap,
Moon Trek and JPL Horizons hold the information but "are often difficult for non-specialists
to use effectively for rapid scenario comparison."

### Who it is for

Mission planners who must decide quickly; educators and students; the public.

### What TrueSouth is

TrueSouth answers one question: "Where and when can this mission land?" It has two modes on
the same real data.

**Mission Control** is for planners. The user picks a mission profile (five presets named
after real missions, such as IM-2 Athena and the Artemis crewed landing), up to eight of 20
catalog sites and a landing date. Each site gets a verdict, GO, CAUTION or NO-GO, with a score
and the exact rule that fails. A timeline shows every hour of the mission window, and
countdowns show the time left before sunset and Earthset. A 3D scene of the Sun, Earth and
Moon is the home screen, and the Lander's eye draws the Sun and Earth on the skyline.

**The Academy** is for everyone else. Luna, a moon mascot, guides the learner through short
lessons to land Pip, a fictional lander. The story is invented. The sites, terrain and
positions are real **[PR-81]**.

### How it works

The heavy science runs ahead of time. NASA's LOLA terrain gives each site a skyline out to
300 km: the highest terrain in each of 1,440 compass directions. One pull from JPL Horizons gives the Sun's and Earth's positions for every hour from
2026-01-01 to 2031-12-31. Together they give, for each site and hour, how much of the Sun's and
Earth's disc is above the skyline. The browser then turns that record and a mission profile into
a verdict and re-scores instantly when the date or any limit changes.

### NASA data and tools it uses

- **JPL Horizons System:** Sun and Earth positions.
- **LOLA 80 m and 240 m polar terrain (Planetary Geodesy Data Archive):** skylines, slope, 3D ground.
- **LOLA average sunlight and Earth-visibility maps (60 m, 120 m) and 80 m slope map:** NASA's
  own answers, used only to check ours.
- **NASA SVS 4720 and Blue Marble Next Generation:** Moon and Earth pictures, never retouched.
- **NASA mission documents:** the sourced values in the mission profiles.

### How we know it is right

We check against NASA's own data and publish every result **[PR-79]**.

- **Sun and Earth directions** match JPL Horizons' own site tables at all 20 sites and every
  hour: 2,103,360 comparisons, largest difference 0.0061 degrees, pass mark 0.02. The raw
  compass bearing differs by up to 0.083 degrees in 28 hours, all with the Sun almost
  overhead at Apollo 11. We report it and do not gate it.
- **Terrain geometry:** nine automated gates pass.
- **Sunlight** against NASA's map: 13 of 14 polar sites are within 6.3 percentage points.
  **Outside our mark:** Peak near Shackleton reads 24.1 points higher (60.2% against 36.1%).
  On a sharp ridge the answer depends on the pixel: NASA's neighbours range from 44.7% to 58.0%.
- **Earth visibility** is within 3.6 points and **slope** within 1.3 degrees.
- **Outside our mark:** at Connecting Ridge, 405 of 1,440 skyline directions move by more than
  0.05 degrees when the method's step is halved, by up to 0.36. The cause is terrain within
  0.56 km of the site.

### What it does not do

It models the stay on the surface only: no launch, transit, descent or return. Many mission
limits are not published, so they are our estimates, tagged **assumed** on screen and never
shown as sourced. The 80 m map cannot see boulders, and our averages cover six years, NASA's 18.6. It does not yet compute custom
coordinates. TrueSouth is a planning aid, not flight certification.

---

## Optional sentence if the Slip Planner is merged

"The Slip Planner shows each selected site as a spot on the Moon's south pole and a strip
of GO, CAUTION and NO-GO landing dates across six years, so a slip of weeks shows at a
glance."

Add it to the "What TrueSouth is" paragraph on Mission Control only after you have opened
the merged Slip Planner and seen it do this.

---

## Sources for every number

| Number | File |
| :--- | :--- |
| 20 sites; 52,584 hours; 1,440 bins; 300 km | `docs/site-catalog.md`; `docs/science.md` §1, §3.1, §5 |
| 2,103,360 comparisons; 0.0061 | `data/derived/validation.json`, gate G2 `samples`; G2 `measured` is 0.006007249 deg, and the full-sky maximum in its `detail` is 0.00602921 deg, so both round up to 0.0061 |
| 0.083 and 28 hours | the same `detail`: raw maximum 0.0823560453 deg, 28 site-body hours |
| Nine gates pass | `validation.json`, G1 to G9 `passed: true`; G10 and G11 are `null` ("checked by the web tests") |
| 13 of 14, 6.3 points | R1 rows: the largest of the 13 is Connecting Ridge, 0.5986 against 0.6611, a difference of 0.0625 |
| Peak near Shackleton 24.1 points | R1 row `peak_near_shackleton`: 0.6017 against 0.3613, a difference of 0.2404; the 0.601, 0.447 and 0.580 figures are in that row's `explanation` |
| 3.6 points; 1.3 degrees | R2 largest 0.03555 (`peak_near_shackleton`); R3 largest 1.2331 deg (`shackleton_rim`) |
| 405 of 1,440; 0.36; 0.56 km | R5 row `connecting_ridge`, its `explanation` |
| 18.6 years against six | `docs/validation.md`, "Why R1 and R2 are not hard gates" |
| Five presets | `docs/mission-profiles.md` |

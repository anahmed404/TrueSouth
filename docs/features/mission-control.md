# Mission Control

The planner mode. It answers "where and when can this mission land?" in five steps, and
keeps every view on one clock.

Owner: Mission Control track. Folder: `web/src/features/mission-control/`.

## The workflow

1. **Choose a mission profile.** A real-mission preset, or Custom.
2. **Choose sites.** From the catalog, or by clicking the polar map.
3. **Find dates.** The Slip Planner shows every landing date for every chosen site.
4. **Inspect one site and date.** Four linked views, a timeline and countdowns.
5. **Compare and share.** Up to four sites side by side; copy a link; export.

A new visitor lands on step 3 with a working default: profile `im2_athena`, four polar
sites, landing date 2028-03-01. Nothing is empty on first load.

## Layout

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ TrueSouth   [Mission Control | Academy]     Profile ▾    Landing date ▾   Share │
├───────────────┬───────────────────────────────────────────────┬───────────────┤
│ SITES         │  [Slip] [Map] [System] [Terrain] [Lander's eye] [Compare]      │
│ ● Connecting… │                                               │ FOCUSED SITE  │
│ ● Mons Mouton │                 main view                     │ status        │
│ ● …           │                                               │ vetoes        │
│ + Add site    │                                               │ metrics       │
├───────────────┴───────────────────────────────────────────────┴───────────────┤
│ timeline: lit/dark band, link/blackout band, scrubber     │ countdown cards   │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar.** Mode switch, profile picker, landing-date picker, share menu.
- **Sites rail.** Selected sites, each with a status chip for the current landing date.
  Click to focus. Up to 8 sites.
- **Main view.** One view at a time. A "split" toggle shows two views side by side.
- **Focused-site panel.** Status, vetoes, every metric, slope with its baseline, links out
  to Quickmap and Moon Trek.
- **Bottom strip.** Timeline and countdowns. Spec: [`site-detail.md`](site-detail.md).

## Views

| Tab | Spec |
| :--- | :--- |
| Slip | [`slip-planner.md`](slip-planner.md) |
| Map | [`polar-map.md`](polar-map.md) |
| System | [`system-view.md`](system-view.md) |
| Terrain | [`local-terrain.md`](local-terrain.md) |
| Lander's eye | [`panorama.md`](panorama.md) |
| Compare | [`compare.md`](compare.md) |

## Profile picker

- Lists the presets from `profiles.json`, each with the real mission's name and a
  one-line description.
- "Customise" opens an editor with every field of
  [`../mission-profiles.md`](../mission-profiles.md).
- Each field shows its tag. **Sourced** fields link to the source and show the quote on
  hover. **Assumed** fields show the reason.
- Editing a field switches the profile to Custom and marks that field "changed by you".
- Weights are three sliders. They are normalised automatically; there is no "must sum to
  1" error.
- Every change updates statuses, metrics and the Slip Planner at once.

## Landing-date picker

- A date and hour in UTC, limited to the time grid.
- Arrows step by one day. "Slip" buttons step by 7 and 14 days.
- The latest valid landing date is the end of the time grid minus the mission duration.

## Explain tooltips

Every metric, veto and profile field has an info icon. It shows one or two plain sentences
from `web/src/lib/explain.ts` and, where one exists, a link to the Academy lesson that
teaches it. The same text is used in the Academy.

## Status and vetoes

- Status is always shown as colour plus word: GO, CAUTION, NO-GO.
- Vetoes are listed by name with the measured value and the limit, for example
  "Blackout: 31 h, limit 12 h".
- The score never hides a veto. A NO-GO site shows its vetoes first and its score greyed.
- A sphere-tier site shows "Terrain not modelled" and "Slope not assessed".
- A persistent footer line reads: "Planning aid, not flight certification. Limits marked
  assumed are our estimates."

## States

| State | What the user sees |
| :--- | :--- |
| Loading a site | Skeleton rows; other sites stay usable |
| Custom site computing | "Computing terrain for your site…" with queue position |
| API offline | Custom sites and sensitivity grids disabled, with a one-line reason; all else works |
| No sites selected | A prompt to add one, with the polar map open |

## Done when

- A first-time visitor sees a filled Slip Planner within two seconds on the fixture data.
- Changing any profile field updates every visible status with no network request.
- Focusing a site, changing the date or dragging the scrubber updates all open views
  together.
- Reloading the page restores the same scenario from the URL.
- Every number on screen has units and an explain tooltip.

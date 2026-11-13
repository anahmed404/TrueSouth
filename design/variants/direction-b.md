# Direction B: Lunar atlas

**The idea in one line:** TrueSouth as a finely printed atlas of the south pole that you can
work in. Warm regolith greys, off-white ink, serif headings, map linework, and exact numbers
set like a gazetteer.

Prototypes, all at 1440 × 900 and all on the same mock data (de Gerlache rim, `im2_athena`,
landing date 2028-03-01 00:00 UTC):

| Screen | File |
| :--- | :--- |
| Start screen | [`start/b/index.html`](start/b/index.html) |
| Mission Control shell | [`mission-shell/b/index.html`](mission-shell/b/index.html) |
| Timeline and countdowns, three states | [`timeline-countdowns/b/index.html`](timeline-countdowns/b/index.html) |
| Lander's eye, full size and sphere tier | [`landers-eye/b/index.html`](landers-eye/b/index.html) |

## What makes it B

- **The timeline is the hero.** In Mission Control it is a full-width band right under the
  top bar, with the four countdown cards beside it. The selected sites run beneath it as a
  strip of cards. The main view and the focused-site panel share the rest.
- **Cartographic devices that carry information.** The day axis is a map scale bar
  (alternating day segments). Panels that hold a drawing get a double neatline. The
  Lander's eye has an azimuth graticule with edge ticks and an engraved (hatched) ground.
  Longest stretches are labelled with italic callouts and leader lines, the way an atlas
  names a feature.
- **Status as map-legend symbols.** GO is a filled circle, CAUTION a filled triangle, NO-GO
  a crossed square, always followed by the word. Countdowns under 6 h add a triangle and
  "under 6 h".
- **True-shape insets.** Where the vertical stretch distorts the discs (×10 near the pole),
  a small inset redraws the scene at ×1, so Earth half behind a ridge looks like it.
- **Place names in italic serif.** Sites, craters and features are set the way atlases set
  them. Data is set in a condensed sans with tabular figures.

## Palette

Names follow the token rules in `docs/tracks/README.md` ("Look and words"). The three
status tokens keep their required names.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--paper-0` | `#1a1814` | Page background: warm charcoal |
| `--paper-1` | `#211e1a` | Panels |
| `--paper-2` | `#2a2721` | Raised, focused card, inputs |
| `--paper-3` | `#343028` | Wells, empty bar tracks |
| `--rule` | `#3a352d` | Hairlines, graticule |
| `--rule-2` | `#554e41` | Strong hairlines, frames, neatlines |
| `--ink` | `#ede6d6` | Primary text: off-white ink |
| `--ink-2` | `#bfb5a2` | Secondary text |
| `--ink-3` | `#8f8675` | Labels, axes |
| `--ink-4` | `#665e51` | Disabled, greyed score |
| `--accent` | `#d39ba6` | The one accent, "overprint rose": scrubber, focus, active tab, selection |
| `--accent-ink` | `#2b1b1f` | Text on the accent |
| `--accent-wash` | `rgba(211,155,166,.11)` | Pressed toggle background |
| `--status-go` | `#93c27f` | GO |
| `--status-caution` | `#e6b645` | CAUTION, countdown under 6 h |
| `--status-nogo` | `#e66b53` | NO-GO, a veto that breaks |
| `--sun` | `#efe0b6` | Sun disc, Sun path, lit hours |
| `--earth` | `#94b5c7` | Earth disc, Earth path, link hours, antenna mask |
| `--ground` | `#37322a` | Terrain below the skyline |
| `--sky` | `#1e1c18` | Plot background above the skyline |

Rules of use:

- The accent marks only "where you are": the scrubber, the focused site, the active tab and
  a pressed toggle. It never marks a status.
- Status colours appear only on status, never as decoration.
- Sun and Earth colours are data colours. They are used for those two bodies everywhere,
  including the clearance chart.
- Provenance tags: **sourced** is a solid outline with ↗ and links to the source;
  **assumed** is a dashed outline in italic. They differ in more than colour.

## Type

| Role | Face | Fallback stack |
| :--- | :--- | :--- |
| Display, headings, place names, callouts | Newsreader (400, 500; italic 400, 500), optical sizes 6–72 | "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif |
| Data, labels, controls | IBM Plex Sans Condensed (400, 500, 600) with `font-variant-numeric: tabular-nums lining-nums` | "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif |

Google Fonts URL used by the prototypes:

```text
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap
```

Scale (px):

| Token | Size | Use |
| :--- | :--- | :--- |
| `--t-micro` | 10.5 | Axis labels, tags, sublines |
| `--t-label` | 11.5 | Field labels, chips |
| `--t-data` | 12.5 | Table rows, body of dense panels |
| `--t-body` | 14 | Running text |
| `--t-h3` | 17 | Small headings (serif) |
| `--t-h2` | 22 | Section headings (serif italic) |
| `--t-h1` | 30 | Focused-site name; 27 px in the shell |
| `--t-display` | 68 | Start-screen titles use 50, the wordmark 46 |

- Headings and names are sentence case. No letter-spaced capitals for labels. The only
  capitals are the status words GO, CAUTION, NO-GO, which are glossary terms.
- Big numbers (countdowns, score) use the data face at 20–22 px, weight 500.

## Spacing and shape

- 4 px base: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48.
- Corner radius 2 px (`--radius`) on controls and cards. Plates and panels are square.
- Lines, not shadows. Panels are separated by 1 px rules. A drawing gets a neatline: a 1 px
  `--rule-2` border plus a 1 px `--rule` outline 3–4 px outside it
  (`outline: 1px solid var(--rule); outline-offset: 3px`). The only shadow is under a
  floating hover readout.

## Mission Control shell grid (1440 × 900)

```text
┌ top bar 52 ─────────────────────────────────────────────────────────────────────────┐
├ timeline band 258 ──────────────────────────────────────────────┬ countdowns 352 ───┤
├ selected sites strip 82: [card][card][card][card][card][+ Add site]   5 of 8 sites ─┤
├ view tabs + main view ──────────────────────────────────────────┬ focused site 404 ─┤
├ footer 28: planning-aid line ───────────────────────────────────┴──────────────────┤
```

## Notes for `web/src/app/theme.css`

- Copy the `:root` block from any prototype's `<style>` (it is identical in all four) and
  keep the token names above. `--status-go`, `--status-caution` and `--status-nogo` are the
  names the tracks guide requires.
- Map tokens into Tailwind through `theme.extend.colors` (for example
  `paper: { 0: 'var(--paper-0)', … }`, `ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', … }`)
  so components never type a value.
- SVG drawings use the same tokens through `fill="var(--sun)"` and similar. The hatched
  ground is a 6 × 3 `<pattern>` of one horizontal line at 9–10 % ink opacity.
- The dimmed part of a disc is the full disc at 22 % opacity, with the same disc drawn
  again at full strength inside a clip path of the sky above the skyline.
- Set `font-variant-numeric: tabular-nums lining-nums` on `body`, so columns of numbers
  line up.

## Decisions I was unsure about

- **The accent is rose, not ochre or gold.** A warm gold would sit next to CAUTION amber,
  and terracotta next to NO-GO red. A dusty rose, after the magenta overprint on printed
  charts, is warm and cannot be mistaken for a status.
- **Countdowns as four cards in two rows** (next event, then the one after, for each body).
  The spec says "four cards" but its table lists two kinds per body; I read it as both
  events per body.
- **Utilities shown under the score** in the focused-site panel, with their weights.
  The spec asks for status, vetoes, metrics and slope; utilities fill a gap and explain a
  greyed score. Easy to drop.
- **True-shape insets** are my addition to the Lander's eye. The spec's ellipses stay; the
  inset only adds a second, undistorted look.

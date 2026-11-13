# Direction A · Flight console

**Idea.** An engineering telemetry console: near-black blue-grey, hairline rules, square
corners, monospaced numbers in compact rows, and one cool accent for whatever you can
touch. Dense and calm, like real flight-operations software.

Prototypes (open each at 1440 × 900):

| Screen | File |
| :--- | :--- |
| Start screen | [`start/a/index.html`](start/a/index.html) |
| Mission Control shell | [`mission-shell/a/index.html`](mission-shell/a/index.html) |
| Timeline and countdowns | [`timeline-countdowns/a/index.html`](timeline-countdowns/a/index.html) |
| Lander's eye | [`landers-eye/a/index.html`](landers-eye/a/index.html) |
| UX flow (shared, neutral) | [`../flows/mission-control/index.html`](../flows/mission-control/index.html) |

All four screens use one mock scenario: IM-2 Athena (`im2_athena`), landing date
2028-03-01 00:00 UTC, focused site Connecting Ridge. Its mock numbers agree everywhere:
longest dark stretch 4 h from 2028-03-03 08:00 UTC, longest blackout 31 h from
2028-03-07 12:00 UTC (breaks the 12 h veto, so NO-GO, score 51 greyed). The bands, the
skyline and the countdowns come from one small mock geometry model pasted into each page.
It is mock geometry for design review, not science.

## Palette

Status colours use the three tokens the track guide names. Everything else is new.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--bg-0` | `#0a0e13` | App background, plot backgrounds |
| `--bg-1` | `#0e1319` | Panels, rails, bars |
| `--bg-2` | `#131a22` | Hover row, cards, readout boxes |
| `--bg-3` | `#18212b` | Selected row, active tab, band tracks |
| `--bg-4` | `#1f2934` | Reserved (pressed) |
| `--rule` | `#1c252f` | Hairlines between rows, grid lines |
| `--rule-2` | `#27323d` | Panel borders, control borders |
| `--rule-3` | `#384553` | Emphasised borders, tag borders |
| `--ink-0` | `#e2e8ee` | Primary text and numbers |
| `--ink-1` | `#aab5c0` | Secondary text |
| `--ink-2` | `#77838f` | Labels, captions, units |
| `--ink-3` | `#4f5a66` | Disabled, greyed score, faint context |
| `--accent` | `#5cb8d6` | The one accent: scrubber, active tab, focus, primary button border, hover crosshair |
| `--accent-2` | `#93d4ea` | Accent text on dark (scrubber readout, card headers) |
| `--accent-bg` | `rgba(92,184,214,.12)` | Accent fills |
| `--accent-ink` | `#061218` | Text on a solid accent fill |
| `--status-go` | `#45c07e` | GO (with ✓ in a circle and the word) |
| `--status-caution` | `#e8a73a` | CAUTION (with ! in a triangle and the word); countdown under 6 h |
| `--status-nogo` | `#ef5d55` | NO-GO (with × in an octagon and the word); veto rows and outlines |
| `--status-*-bg` | the same at 10–11 % alpha | Chip and card fills |
| `--sun` | `#ebdfb2` | Sun band, Sun path, Sun disc |
| `--earth` | `#86a9e6` | Earth band, Earth path, Earth disc, antenna mask |
| `--terrain-edge` | `#93a0ad` | Skyline line; terrain fill is a gradient `#1e2833` → `#0f141a` |

Rules of use:

- **Amber means CAUTION only.** Other notices (sphere tier, "terrain not modelled") are
  neutral with a dashed border.
- **The accent is for things you can act on** (scrubber, selected tab, focused row,
  buttons, links). Data never uses it, so the Sun and Earth have their own two colours.
- **Provenance tags** are words in small caps with a border: `SOURCED ↗` solid border,
  `ASSUMED` dashed border, `RULE` dotted border. Never colour alone.
- **Lit and link states** are words with an icon: `LIT` / `DARK`, `LINK` / `BLACKOUT`;
  the off states use a dashed border.

## Fonts

| Role | Family | Fallback |
| :--- | :--- | :--- |
| UI text | IBM Plex Sans 300/400/500/600 | `"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif` |
| Numbers, coordinates, times, tags | IBM Plex Mono 400/500/600 | `ui-monospace, "Cascadia Mono", "SF Mono", Consolas, Menlo, monospace` |

Load both from Google Fonts. Set `font-variant-numeric: tabular-nums` on `body`. Every
number goes in a `.num` span (Plex Mono, letter-spacing −0.01em), so columns line up even
in the sans fallback.

## Type scale

| Token | Size | Use |
| :--- | :--- | :--- |
| `--fs-micro` | 10px | Section labels: uppercase, weight 500–600, letter-spacing 0.10–0.12em, `--ink-2` |
| `--fs-xs` | 11px | Table rows, captions, legends |
| `--fs-s` | 12px | Body default |
| `--fs-m` | 13px | Site names, tab labels, view titles |
| `--fs-l` | 15px | Countdown values (17px for the primary card) |
| `--fs-xl` | 18px | Focused-site name |
| `--fs-2xl` | 24px | Reserved |
| `--fs-3xl` | 44px | Start screen door titles, weight 300 |

SVG labels inside charts are 9–10.5px: Plex Mono for axes and values, Plex Sans 600 with
letter-spacing for band and compass labels.

## Spacing and shape

- **4 px grid.** Tokens `--sp-1`…`--sp-9` = 2, 4, 6, 8, 12, 16, 24, 32, 48 px. Panels pad
  12–14 px horizontally.
- **Row height** `--row-h` 22 px for table rows (21 px in the focused-site panel). Top bar
  `--bar-h` 40 px. Panel headers 32 px. Controls 26 px tall.
- **Square corners everywhere** (`border-radius: 0`). Separation is by 1 px hairlines
  (`--rule`, `--rule-2`), never by shadow, except a single drop shadow under a floating
  card such as "Why is it dark?".
- **Selection** is a 2 px accent bar: left edge for a focused row, top edge for the active
  tab, bottom edge for an active segmented button.

## Layout (Mission Control at 1440 × 900)

Grid `236px | 1fr | 316px` by `40px | 1fr | 200px | 24px`:

- Top bar, full width: brand, mode switch, profile picker, landing-date picker with slip
  buttons, Share. "API online" lives in the footer to keep the top bar on one line.
- Sites rail 236 px, focused-site panel 316 px, main view in between.
- Bottom strip 200 px, full width: timeline on the left, a 424 px column of four countdown
  cards on the right (two per body: next event first). Opening the clearance chart makes
  the strip about 140 px taller, taken from the main view.
- Footer 24 px: the planning-aid line, API status, data sources.

## Drawing conventions

- **Bands:** the Sun bar's height is the disc fraction; dark and blackout hours are the
  empty track (`--bg-3`). Context days are 22 % opacity over a 45° hatch.
- **Longest stretches:** dashed `--ink-1` outline when within the limit; solid
  `--status-nogo` outline with a 7 % red fill and "✕ … VETO" when it breaks one.
- **Lander's eye:** discs are ellipses true in angle, as the spec says. At ×12–×18 the Sun
  is only 2 px wide, so each disc gets corner brackets (an annotation, not data) and a
  label. The full-size view adds a 1:1 inset of Earth at true aspect.
- **Explain tooltips:** in dense tables the term itself has a dotted underline, which saves
  a column of info icons. Elsewhere an (i) icon.

## To rebuild in `web/src/app/theme.css`

1. Copy the `:root` block from the `/*<base>*/` section of any prototype; it is the token
   set above. Rename nothing: `--status-go`, `--status-caution`, `--status-nogo` already
   match the track guide.
2. Add the Google Fonts link for IBM Plex Sans and IBM Plex Mono to `index.html`.
3. Port these classes as shared components: `.st` (status chip), `.prov` (provenance tag),
   `.tier`, `.bstate` (LIT/DARK/LINK/BLACKOUT), `.cd*` (countdown cards), `.why`, `.cap`
   (section label), `.num`.
4. Port the icon `<symbol>` set (`i-go`, `i-caution`, `i-nogo`, `i-sun`, `i-link`, …); the
   status icons are what keeps status readable without colour.
5. Keep `color-scheme: dark` and `border-radius: 0` as global defaults.

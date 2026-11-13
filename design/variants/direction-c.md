# Direction C: Night-sky instrument

**The idea in one line:** TrueSouth is a well-made instrument for watching the sky. The
current view fills the window like a night sky, and the tools float over it as rounded
glass panels. Only real light sources glow.

Prototypes (static, mock data, open directly in a browser at 1440 × 900):

| Screen | File |
| :--- | :--- |
| Start screen | [`start/c/index.html`](start/c/index.html) |
| Mission Control shell | [`mission-shell/c/index.html`](mission-shell/c/index.html) |
| Timeline and countdowns | [`timeline-countdowns/c/index.html`](timeline-countdowns/c/index.html) |
| Lander's eye | [`landers-eye/c/index.html`](landers-eye/c/index.html) |

## What makes it C

- **The main view is full-bleed.** The sites rail, the focused-site panel, the timeline
  and the view tabs float over it as rounded, blurred-glass panels. Nothing frames the view.
- **Light only where there is light.** The Sun, Earth and status lamps may glow. Panels,
  buttons and the scrubber never glow.
- **Status lamps are physical objects.** Each is a round, lit lamp with a glyph cut into
  it (✓ GO, ! CAUTION, ✕ NO-GO), always next to the word. Colour is never the only signal.
- **Numbers are big.** Key values use 19–36 px numerals with smaller units, so a planner
  can read them from across a desk.
- **Portholes connect the two modes.** The start screen's two doors are identical round
  portholes on one shared sky. The Lander's eye reuses the porthole as a "close-up" loupe.
  The Academy can reuse it for lesson scenes.

## Palette

Define these tokens in `web/src/app/theme.css`. Components use the tokens, never raw
values.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--sky-950` | `#03040b` | Page background, deepest sky |
| `--sky-900` | `#070920` | Sky |
| `--sky-800` | `#0d1034` | Sky near the top-centre glow of the page gradient |
| `--sky-700` | `#171c4d` | Raised sky, bezels |
| `--panel-top` / `--panel-bottom` | `rgba(24,28,74,.80)` / `rgba(12,14,42,.86)` | Floating panel gradient |
| `--glass-edge` | `rgba(172,180,255,.16)` | Panel border (1 px) |
| `--well` | `rgba(4,5,18,.55)` | Inset wells: metric tiles, tracks, cards inside panels |
| `--well-edge` | `rgba(172,180,255,.10)` | Well border |
| `--ink` | `#f2f3ff` | Primary text |
| `--ink-dim` | `#b0b5de` | Secondary text |
| `--ink-faint` | `#757dad` | Labels, axes, captions |
| `--ink-ghost` | `#4a5180` | Disabled, greyed score |
| `--accent` | `#a99cff` | Selection, focus, scrubber, active mode. Never a status. |
| `--accent-ink` | `#0b0c24` | Text on accent |
| `--sun` | `#ffe2a0` | Sun band, Sun path, Sun icon |
| `--sun-core` | `#fff8e4` | Sun disc |
| `--earth` | `#6cc4ff` | Earth band, Earth path, antenna mask |
| `--earth-core` | `#8fd3ff` | Earth disc |
| `--status-go` | `#3be3a0` | GO |
| `--status-caution` | `#ff9f2e` | CAUTION, countdown under 6 h |
| `--status-nogo` | `#ff5c72` | NO-GO, veto outlines |
| `--terrain-top` / `--terrain-bottom` | `#1b1f4c` / `#05061a` | Skyline silhouette fill (vertical gradient) |
| `--terrain-rim` | `#d9dbff` | Skyline edge line (1.3–1.4 px, 85–90 % opacity) |

The Sun is a pale cream and CAUTION is a saturated orange, so a Sun band and an amber
countdown never look alike. Earth blue and the lavender accent are kept apart the same way.

## Type

- **Family:** [Jost](https://fonts.google.com/specimen/Jost) (Google Fonts, weights
  400/500/600). Jost is a Futura revival, the face on the Apollo 11 plaque. Fallback stack:
  `"Jost", "Futura", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`.
- No monospace face. Numbers use `font-variant-numeric: tabular-nums`.
- Units follow a number at 0.62 em in `--ink-dim`, for example `31` `h`.
- Eyebrow labels: 10.5 px, uppercase, letter-spacing 0.14 em, `--ink-faint`.

| Token | Size | Use |
| :--- | :--- | :--- |
| `--t-micro` | 10.5 px | Eyebrows, tags, axis ticks |
| `--t-label` | 11.5 px | Captions, secondary rows |
| `--t-body` | 13 px | Mission Control body |
| `--t-lead` | 15 px | Academy body, door descriptions |
| `--t-title` | 20 px | Panel titles, site name |
| `--t-num` | 26 px | Status word, metric values (19–22 px in dense tiles) |
| `--t-hero` | 34–46 px | Countdowns in the close study, start-screen headline |

Weights: 400 body, 500 numbers and names, 600 titles and status words.

## Spacing, radius, depth

- Spacing scale: `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 20, `--s6` 24, `--s8` 32 px.
- Panels float 16 px from the window edge and 12–16 px from each other.
- Radius: `--r-panel` 24 px; `--r-card` 16–18 px for cards inside panels; tiles 12 px;
  chips, buttons and the top bar are fully round (`999px`).
- Panel depth: `backdrop-filter: blur(18px) saturate(1.15)`,
  `box-shadow: 0 18px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)`.
- A text card over the full-bleed view uses `rgba(10,12,36,.9)` or darker. SVG labels over
  the sky get a 4 px halo in the sky colour (`paint-order: stroke`).

## Components a developer needs

- **Lamp** (`.lamp`): a circle at 20–44 px. Radial gradient from a white-tinted highlight at
  36 %/30 % through the status colour to a 42 % darker rim. A 3 px dark ring and a 1 px
  light ring around it, plus a soft glow in the status colour. An SVG glyph sits inside
  at 58 % size, with a 3.2 stroke in `#090a1f`.
- **Provenance tags:** a **sourced** tag has a solid outline and ↗. An **assumed** tag has a
  dashed outline. The tags differ by shape and word, never by colour alone.
- **Countdown card:** a well card. It turns amber (border, wash, number) and shows a
  "! UNDER 6 H" flag when the countdown is under 6 h.
- **Longest stretch outline:** a dashed `--ink` outline when the stretch passes its limit.
  A solid 2 px `--status-nogo` outline plus "✕ … veto" when it breaks one.
- **Scrubber:** a 2 px `--accent` line, a knob, and a pill above it with the mission day
  and UTC time.
- **Lander's eye discs:** a full ellipse at 28 % opacity, then the same ellipse clipped to
  the sky above the skyline at full strength. The glow is clipped the same way, so a Sun
  behind a ridge lights only the sky over it.
- **Loupe** (Lander's eye only): a round 116 px close-up of a disc against the local
  skyline at true shape (no vertical stretch). It uses the porthole ring styling.

## Layout of the Mission Control shell (1440 × 900)

| Element | Position | Size |
| :--- | :--- | :--- |
| Top bar | 16 px inset | 54 px tall, pill-shaped |
| View tabs | centred over the clear area | — |
| View controls | a chip row under the tabs | — |
| Sites rail | left | 256 px wide, height fits its content |
| Focused-site panel | right | 344 px wide, 590 px tall |
| Timeline | bottom, full width | 184 px tall; the two countdown cards sit at its right end |
| Footer line | under the timeline | — |

The Lander's eye is centred on the clear area between the rail and the panel. It is drawn
at 2.8 px per degree of azimuth with vertical ×12. Its ends fade into the background under
the panels.

## Decisions I was unsure of

- The spec draws countdowns and the focused-site panel differently. Here the timeline
  spans the full width, and the focused panel stops above it.
- Spec says "four countdown cards" but its table has two rows. I show two cards (Sun,
  Earth), each with the next event large and the one after it small.
- Utilities appear as one line in the status card, not as gauges, to keep the panel
  within 900 px.
- The loupes are an addition to the Lander's eye spec.

# Product

<!-- impeccable:product-schema 1 -->

<!-- Written from the repository's own docs (README.md, CONTEXT.md, docs/architecture.md,
docs/features/, docs/mission-profiles.md, docs/academy/) during the direction C2 design pass.
No interview was held: the brief said nobody would answer questions, so every fact here is
taken from those docs, not confirmed in conversation. Facts marked "(inferred)" are our
reading of the docs rather than a sentence in them. -->

## Platform

web

## Users

- **Mission planners** use Mission Control. They pick a mission profile and sites, look for
  every landing date that works, and inspect one site and date in detail. They want exact
  numbers, units, and the source of every limit.
- **Students, educators and the public** use the Academy: a 10–15 minute guided story in
  which Luna, a moon mascot, helps them land Pip, a small lander, and rebuild the tool's
  logic step by step.
- **NASA Space Apps 2026 judges** see both modes in a short demo and need to understand
  what each view shows without a walkthrough (inferred from the challenge context).

## Product Purpose

TrueSouth answers one question fast: "Where and when can this mission land?" at the
Moon's south pole, where the Sun skims the horizon at 1–2°, Earth bobs above and below the
horizon each month, and mountains block both. A small change in where or when to land can
turn a workable mission into a dead one. Success is a planner finding every viable landing
date for a set of sites, and a learner understanding why a site is lit or dark.

## Positioning

Both modes run on the same real NASA data: JPL Horizons for Sun and Earth positions and
LOLA laser-altimeter terrain for the skyline. Every mission number is tagged sourced (with
a link) or assumed. The Academy rebuilds the same logic the planner uses, so the two modes
teach and check each other.

## Operating Context

- Mission Control is desktop-first and may ask for a wide screen. The Academy must also
  work on a phone.
- Mission Control is a five-step workflow: choose a mission profile, choose sites, find
  dates in the Slip Planner, inspect one site and date in four linked views with a
  timeline and countdowns, then compare and share.
- Every view shares one clock, the scrubber.
- A new visitor lands on a working default: profile `im2_athena`, four polar sites,
  landing date 2028-03-01.

## Capabilities and Constraints

- Terms come from `CONTEXT.md` and are used exactly in the UI. The six Mission Control
  views are the Slip Planner, Polar map, System view (3D), Local terrain (3D), Lander's
  eye and Compare.
- Status is GO, CAUTION or NO-GO, always shown as colour plus a word or icon.
- Every number has a unit. Angles are degrees with one or two decimals. Times are UTC,
  ISO-8601, and say "UTC" on screen.
- Every mission-profile value shown carries a sourced or assumed tag. An assumed number is
  never presented as sourced.
- The frontend computes only mission metrics and scores. Skylines, Sun and Earth positions
  and disc visibility come from the Python pipeline. WebGL shadows are decoration, never a
  result.
- Plain-language explanations of terms live in `web/src/lib/explain.ts`, shared by both
  modes.
- Theme tokens live in `web/src/app/theme.css`; components never type a colour value.
- English only.
- A persistent footer line reads: "Planning aid, not flight certification. Limits marked
  assumed are our estimates."

## Brand Commitments

- The name TrueSouth, the mascot Luna (art still owed) and the lander Pip.
- One dark theme for both modes.
- Mission Control is dense and calm: small type, tables, exact numbers. The Academy is
  roomy and playful: large rounded cards, big buttons, Luna on screen.
- The team lead's binding direction for the visual system (2026-11, direction C review):
  no purple or "AI" colour, a plain dark mode, less on screen at once, no glow, no
  all-caps letter-spaced titles.

## Evidence on Hand

- Real data sources: JPL Horizons, LOLA via NASA PGDA. A synthetic fixture dataset exists
  for development.
- Five real-mission presets with sourced quotes: VIPER, IM-2 Athena, Chandrayaan-3,
  Artemis crewed landing, Blue Ghost 1 (`docs/mission-profiles.md`).
- A validation page compares results with NASA's published maps.
- There are no user testimonials, usage numbers or partner endorsements; none may be
  invented.

## Product Principles

1. Answer "where and when" first; detail waits until it is asked for.
2. Sourced or assumed, never blurred: honesty about every number outranks polish.
3. One clock: every view shows the same moment.
4. The same words, explanations and colours in both modes.
5. A status is never colour alone.

## Accessibility & Inclusion

- Status always pairs colour with a word or glyph.
- Text meets WCAG AA contrast.
- The Academy works on a phone.

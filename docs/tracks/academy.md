# Academy track guide

You build the guided lessons, Luna, and every plain-language explanation in the product.
You also check the math, build the validation page and prepare the submission.
Read [`README.md`](README.md) in this folder first.

**You are the product's voice and its second pair of eyes.** If you cannot explain a
formula, either the explanation or the formula needs work. Say which.

## You own

`web/src/features/academy/`, `web/src/features/validation/`, `web/src/components/luna/`,
`web/src/lib/explain.ts`, [`../academy/`](../academy/), and
[`../features/validation-page.md`](../features/validation-page.md).

You review every change to [`../science.md`](../science.md).

## Read first, in this order

1. [`../../CONTEXT.md`](../../CONTEXT.md)
2. [`../academy/overview.md`](../academy/overview.md)
3. [`../academy/lessons.md`](../academy/lessons.md)
4. [`../academy/luna.md`](../academy/luna.md)
5. [`../science.md`](../science.md), all of it, slowly. You will explain every section.
6. [`../mission-profiles.md`](../mission-profiles.md)
7. [`../validation.md`](../validation.md) and
   [`../features/validation-page.md`](../features/validation-page.md)
8. Decision [`0010`](../decisions/0010-fictional-story-real-data.md)

## Your order of work

Details and checks for each id are in [`../build-plan.md`](../build-plan.md).

You can start as soon as Mission Control's scaffold (MC0) is on `main`. Until then, draft
lesson text and the `explain.ts` entries on paper.

**M0.**

- [ ] **A0** Lesson types, the step runner, the feedback flow, the `academy` store, the
      path map
- [ ] **A1** `Luna` and `LunaSays` with placeholder art in all eight moods; celebrations

**M1.**

- [ ] **A7** `explain.ts`: every key, with a first-draft sentence. Mission Control's
      tooltips wait on this, so do it early and polish later.
- [ ] **A2** The five step kinds that need no panel: `choice`, `predict`, `fill-formula`,
      `spot-bug`, `tune-slider`
- [ ] **A4** The card renderer, with KaTeX and worked-example placeholders

**M2.**

- [ ] **A3** The three step kinds that embed panels: `drag-body`, `draw-skyline`,
      `drop-pin`
- [ ] **A5** Lessons 1–4 and their cards

**M3.**

- [ ] **A6** Lessons 5–8, their cards and the finale
- [ ] **A8** The validation page
- [ ] **A9** The math review

**M4.**

- [ ] **A10** Luna's final art, once the reference photos arrive
- [ ] **A11** The submission materials

Write lessons in order. Each one teaches the next.

## What others need from you

| What | Who needs it | When |
| :--- | :--- | :--- |
| `Luna` and `LunaSays` | Mission Control (empty and error states) | A1, end of M0 |
| `explain.ts` with every key | Mission Control, 3D and Map (tooltips) | A7, early M1 |
| The final list of worked-example keys | Science (S12) | end of M1 |
| Reviews of changes to `../science.md` | Science | within a few hours |
| Math review findings, one issue per mismatch | Science | A9 |
| The demo script, description and AI-use disclosure | the whole team | A11 |

Tell the team in chat the moment each of these lands on `main`.

## What you need from others

| What | From | Until it arrives |
| :--- | :--- | :--- |
| The scaffold, `PanelProps`, theme tokens | Mission Control (MC0) | Draft text |
| Evaluation hooks, for step goals | Mission Control (MC2) | A stub that returns fixture values |
| `LandersEye`, `Timeline`, `Countdowns` in `"lesson"` mode | Mission Control (MC5, MC6) | A grey box the size of the panel |
| `SlipPlanner` in `"lesson"` mode | Mission Control (MC7) | The same |
| `SystemView`, `LocalTerrain`, `PolarMap` in `"lesson"` mode | 3D and Map (T1, T4, T5, T7) | The same |
| Fixture `worked_examples.json` and `validation.json` | Science (S2) | — |
| The real ones | Science (S12) | Fixtures |
| Luna reference photos | Team lead | Placeholder art |

Lessons 1–4 need the Lander's eye view, the System view and the timeline. Lessons 5–8
need the map, the terrain and the Slip Planner. That is why the lessons come in two
halves.

## Rules for this track

- **No typed numbers in lessons or cards.** Every number about the Moon is a
  `{{example.key}}` placeholder filled from `worked_examples.json`. If you need a new
  number, add its key to [`../academy/lessons.md`](../academy/lessons.md) and ask Science.
- **No new science.** A lesson explains what `../science.md` says. If a lesson needs a
  formula that is not there, the formula goes into `../science.md` first.
- **Cards quote and cite.** A card's formula is copied from `../science.md` and names the
  section.
- **Correct answers come from data.** A step's goal is a typed condition checked by the
  evaluation hooks, not a hard-coded answer.
- **Reuse panels; do not rebuild them.** A lesson shows Mission Control's own panels in
  `"lesson"` mode. If a panel cannot do what a step needs, ask its owner for a prop.
- **A lesson never touches the Mission Control scenario.** It builds its own.
- **Luna's voice.** One idea per bubble, two short sentences at most, warm, never mocking.
  The full guide is in [`../academy/luna.md`](../academy/luna.md).
- **Original art.** Luna and Pip are our own designs. Do not copy another product's mascot
  or a real company's lander.
- **Explain every term once.** `explain.ts` has one or two plain sentences per term, for a
  reader with no background. No formula, no jargon that is not itself explained.
- **Honest endings.** The finale says plainly when the learner's choice does not match
  NASA's regions, and why.
- **Stay in budget.** Eight lessons, about five steps each, 10–15 minutes in all. Time a
  full run with someone new before each checkpoint.

## The math review (A9)

Go through `../science.md` one section at a time, with the Python file it names open
beside it.

For each section:

1. Read the formula and say what each symbol means, in your own words.
2. Find the same formula in the code. Check the signs, the units and the order of
   arguments.
3. Run the worked example for that section by hand or in a notebook. Compare with what
   the app shows.
4. Write the card's "What can go wrong" part from what you just checked.

File one issue for each mismatch. Say which you think is wrong, the doc or the code, and
why. A mismatch you find here is the review doing its job.

## Things that are easy to get wrong

- **Explaining with a formula.** If the plain version needs a formula to make sense, it
  is not plain yet.
- **A lesson that needs a previous lesson's XP.** Every lesson is unlocked. Each must make
  sense on its own.
- **A step with no way to fail gracefully.** After two misses, show the answer and move
  on.
- **Touch targets.** The Academy must work on a phone. Dragging steps need arrow-key and
  tap alternatives.
- **Motion.** Respect "reduce motion". Confetti is optional; the lesson is not.
- **The spot-the-bug steps.** The "bug" must be a mistake someone really makes. Two of
  ours are real: the flat-Moon calculation and the fixed 50% rule.

## Brief for your agent

Paste this at the start of a session, with the work package filled in.

```text
You are working on the Academy track of TrueSouth. Work package: <id and name>.

Read, in this order: CONTEXT.md, docs/tracks/README.md, docs/tracks/academy.md,
docs/academy/overview.md, and the spec named for this work package in docs/build-plan.md.
For lesson content, read docs/academy/lessons.md. For Luna, read docs/academy/luna.md.
For any formula, docs/science.md is the only source.

Before writing code or text, tell me:
1. The "done when" checks for this work package.
2. The files you will create or change. They must all be in the folders this track owns.
3. Which panels, hooks and worked-example keys you will use, and any that do not exist.

Rules: TypeScript strict. Lessons are typed data in lessons/<id>.ts. No numbers about the
Moon typed into lesson or card text; use {{example.key}} placeholders. Step goals are
typed conditions checked by the evaluation hooks. Reuse the existing panels in "lesson"
mode; do not rebuild them. Cards quote formulas from docs/science.md and cite the section.
Luna speaks in one or two short, warm sentences. Use the theme tokens. Do not add a
dependency without telling me first. Do not add Playwright. If the spec is silent or
looks wrong, stop and ask me.

When you finish, run `pnpm --dir web test` and `pnpm --dir web typecheck` and show me the
output. Then tell me exactly how to play through what you built.
```

## Before you open a pull request

- [ ] `pnpm --dir web test` and `pnpm --dir web typecheck` pass.
- [ ] You played every changed lesson start to finish, by mouse and by keyboard.
- [ ] You tried a wrong answer on every step.
- [ ] The lesson works at 390 px wide.
- [ ] No typed numbers about the Moon; every placeholder has a key in the fixture.
- [ ] The diff touches only your folders.

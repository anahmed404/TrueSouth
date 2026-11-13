# Validation page

"How we know it's right." A page that shows the evidence from
[`../validation.md`](../validation.md) to judges, planners and curious learners.

Owner: Academy track. Folder: `web/src/features/validation/`.
Data: `validation.json`.

## Sections

1. **The method in one picture.** A diagram: Horizons and LOLA go in; skyline, series and
   scores come out. Each box links to its Academy lesson.
2. **Sun and Earth positions.** The headline number from gate G2: how many comparisons
   were made against JPL Horizons and the largest difference found. A small chart shows
   the difference over time for one site.
3. **Terrain geometry.** The synthetic tests (flat Moon, wall at a known distance, tilted
   plane), each with its expected and measured value.
4. **Against NASA's maps.** A table and a scatter chart for comparisons R1 and R2: our
   value against NASA's for each polar site. Points on the diagonal agree. Sites outside
   the "investigate" mark are labelled, with our explanation.
5. **Slope.** Comparisons R3 and R4.
6. **What we do not model.** The list from [`../science.md`](../science.md) §15, in plain
   words.
7. **Data sources.** Every NASA product used, with its link.

## Rules

- Every number on the page comes from `validation.json`. Nothing is typed in by hand.
- Failed gates and out-of-range comparisons are shown as clearly as passes.
- The page shows when the validation was last run.
- If `validation.json` is missing, the page says "Validation has not been run on this
  build" and shows no numbers.

## Done when

- The page renders from the fixture `validation.json`, including one deliberately failing
  comparison.
- Every source link opens.
- A reader with no background can tell from section 2 alone that our Sun and Earth
  positions were checked against NASA's.

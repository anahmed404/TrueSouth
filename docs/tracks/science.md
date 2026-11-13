# Science track guide

You turn NASA data into the files the app reads, and you run the API.
Read [`README.md`](README.md) in this folder first.

**Your work is the critical path.** Nothing on screen is real until your pipeline runs,
and three people are waiting on your first two days.

## You own

`science/`, `api/`, `data/`, `pyproject.toml`, `Dockerfile`, `compose.yaml`,
[`../science.md`](../science.md), [`../data-contracts.md`](../data-contracts.md),
[`../validation.md`](../validation.md), [`../site-catalog.md`](../site-catalog.md),
[`../mission-profiles.md`](../mission-profiles.md).

Do not edit anything under `web/` except by pull request to its owner. The one exception
is the generated schema file your `export-schema` command writes.

## Read first, in this order

1. [`../../CONTEXT.md`](../../CONTEXT.md)
2. [`../architecture.md`](../architecture.md), sections "The pipeline" and "The API"
3. [`../science.md`](../science.md), all of it
4. [`../data-contracts.md`](../data-contracts.md)
5. [`../validation.md`](../validation.md)
6. Decisions [`0003`](../decisions/0003-site-centred-local-frame.md),
   [`0004`](../decisions/0004-one-global-ephemeris.md),
   [`0005`](../decisions/0005-skyline-method.md) and
   [`0008`](../decisions/0008-terrain-tiers.md)

## Your order of work

Details and checks for each id are in [`../build-plan.md`](../build-plan.md).

**M0. Unblock everyone.**

- [ ] **S0** Workspace, package, CLI skeleton, `contracts.py`, `export-schema`. Push the
      same day you start.
- [ ] **S1** `data/catalog/` files, copied from the catalog and profile docs.
- [ ] **S2** `scoring.py` reference and `build-fixtures`.

**M1. One real site.**

- [ ] **S3** `frames.py`
- [ ] **S4** Horizons, the global ephemeris, the check against Horizons' site tables
- [ ] **S5** Downloads, prepared maps, sampling
- [ ] **S6** Skyline
- [ ] **S7** Disc fractions, series, `build-sites` for Connecting Ridge

S3 comes first. Then S4 and S5 are independent of each other; run them in parallel if you
can. S6 needs S5. S7 needs S4 and S6.

**M2.** S8 (slope, meshes, all catalog sites), S9 (map images).

**M3.** S10 (API), S11 (sensitivity), S12 (validation and worked examples), S13 (Docker).

**M4.** S14 (tune the presets).

## What others need from you

| What | Who needs it | When |
| :--- | :--- | :--- |
| `contracts.py` and the exported schema | Mission Control, to generate types | S0, day one |
| Fixtures for every derived file, with at least four sites, one of them sphere-tier | everyone | S2, end of M0 |
| The scoring fixture cases | Mission Control (gate G10) | S2 |
| A fixture `worked_examples.json` with every key in [`../academy/lessons.md`](../academy/lessons.md) | Academy | S2 |
| A fixture `validation.json`, including one failing comparison | Academy | S2 |
| Real derived data for Connecting Ridge | everyone, for the M1 checkpoint | S7 |
| All catalog sites and map images | 3D and Map (polar map), Mission Control | S8, S9 |
| The API running locally | 3D and Map (custom sites) | S10, S11 |
| Real `worked_examples.json` and `validation.json` | Academy | S12 |

Tell the team in chat the moment each of these lands on `main`.

## What you need from others

- **Academy:** a review of every change to `../science.md`, and the final list of
  worked-example keys. The list in the lessons doc is the starting point.
- **Team lead:** a download of the Artemis region outlines, which needs a free login. See
  [`../site-catalog.md`](../site-catalog.md).

You are blocked by nobody. If you are waiting, something is wrong; say so.

## Rules for this track

- **Formulas come from `../science.md`.** If you need to change one, change the doc in the
  same pull request, and ask Academy to review.
- **Write the test from known geometry first.** A flat Moon, a wall at a known distance,
  a tilted plane. The gates in [`../validation.md`](../validation.md) are your test list.
- **Never loosen a gate to make it pass.** If a tolerance cannot be met, stop and report
  the measured number. Decision 0004 has a written fallback for gate G2.
- **Vectorise.** No Python loop over pixels, rays or hours. Use `numpy` arrays and work in
  chunks to bound memory.
- **Check the data, do not assume it.** Read each map's projection, pixel size and
  missing-data value from the file. Stop with a clear error if it is not what
  `../science.md` §2.3 expects.
- **Confirm before you download.** `fetch-raw` checks every URL exists and reports its
  size before fetching.
- **Keep TLS checks on.** Use `truststore`. Never pass `verify=False`.
- **Save surprises as fixtures.** When a Horizons response has a format you did not
  expect, save the raw response under `science/tests/data/` and test against it.
- **Make runs repeatable.** Fixtures use a fixed random seed. Every step can be run again
  and skips work already done.
- **Write down what you measure.** The largest difference in gate G2, the time
  `build-sites` takes, the size of `data/derived/`: put them in `DEVLOG.md`.
- **Commit `data/derived/` and `data/fixtures/`.** Never commit `data/raw/`,
  `data/prepared/` or `data/cache/`.

## Things that are easy to get wrong

- **Longitude sign.** Horizons may report sub-point longitudes west-positive. Read the
  response header and test it.
- **Row order.** In a map array, row 0 is the top edge, which is +y.
- **Wrap-around.** Azimuths and longitudes wrap at 360°. Interpolating the skyline between
  bin 1,439 and bin 0 must wrap.
- **The site near a map edge.** IM-1 is 4 km inside the 80 m map. Near-field rays must
  continue on the 240 m map.
- **Missing data.** Skip it and count it. Never treat it as height zero.
- **Units.** Horizons distances come in astronomical units or kilometres depending on the
  quantity. Convert once, at the parser.

## Brief for your agent

Paste this at the start of a session, with the work package filled in.

```text
You are working on the Science track of TrueSouth. Work package: <id and name>.

Read, in this order: CONTEXT.md, docs/tracks/README.md, docs/tracks/science.md, and the
spec named for this work package in docs/build-plan.md. For any formula, docs/science.md
is the only source.

Before writing code, tell me:
1. The "done when" checks and gates for this work package.
2. The files you will create or change. They must all be under science/, api/ or data/.
3. The tests you will write first, and the known geometry each one uses.

Then write the tests, then the code. Use numpy without Python loops over pixels, rays or
hours. Do not change any tolerance in docs/validation.md. Do not disable TLS checks. If
the spec is silent or looks wrong, stop and ask me.

When you finish, run `uv run pytest` and show me the output, and report any number you
measured.
```

## Before you open a pull request

- [ ] `uv run pytest` passes.
- [ ] Any contract change: schema exported, types regenerated, fixtures rebuilt, doc
      updated.
- [ ] Nothing under `data/raw/`, `data/prepared/` or `data/cache/` is staged.
- [ ] The diff touches only your folders.
- [ ] Measured numbers are in your `DEVLOG.md` entry.

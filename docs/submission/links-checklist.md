# Links checklist

Every link the submission will contain, and what must be true before sending it. The last
column is for the team to fill: open each link in a **private (incognito) window, signed
out**, and tick it only if the right page loads.

State checked at **2026-11-14, `origin/main` at 69bb26e**. The production deploy files
(#101) are merged on `main` (9f12ff4), but the deploy has not been run on a server, so there
is no live site yet.

## Open items for the team lead

These need a decision or an action from the team lead. This file does not settle them.

| # | Open item | Why it matters | Status |
| :--- | :--- | :--- | :--- |
| 1 | **Repository access.** The repository is private and has no licence file. Judges need a public link or a zip. Decide which, or both. If it goes public, first look for anything that should not be public (personal details, keys), and choose a licence (for example MIT for the code). NASA's data and images keep their own terms. | A private link will not open for judges. Without a licence, others may not reuse the code. | [ ] Open |
| 2 | **Live demo link.** The production deploy files (nginx reverse proxy, HTTPS; #101) are merged, but the deploy has not been run on a server, so there is no live site. Add the link only once it opens in a private window. Also decide whether that server has NASA's prepared terrain maps (custom coordinates on) or is catalog-only (the "Enter coordinates" form says "Not available on this server"). | The demo script and the submission form both need it. | [ ] Open |
| 3 | **Backup video.** Not recorded. The demo script lists no voice-over or music tool; if the video has an AI voice or music, name the tool in [`ai-use.md`](ai-use.md). | The presenter needs a fallback, and the form may ask for a video link. | [ ] Open |
| 4 | **Apply `README-proposed.md` to the real `README.md`?** The real README still says "No application code exists yet." | Judges read the README first. | [ ] Open |
| 5 | **Why the data covers six years.** The repository does not record the reason. | A judge may ask; the demo script marks it. | [ ] Open |
| 6 | **Links for the five assumed profile values** (IM-2 and Chandrayaan-3 `relay_available`; Chandrayaan-3's three Sun-elevation values), and **Luna's reference photos**, and the **Artemis region outlines** (a ScienceBase login is needed). | Until then the values stay tagged **assumed**, Luna's drawings stay placeholders, and the outlines are not drawn. | [ ] Open |

## Must be true before submitting

- [ ] **The live link opens without logging in**, in a private window, on a different device
  or network from the one that built it. It opens straight to the start screen.
- [ ] **The live link is a build with the 3D scene and all five views.** Open a link with
  `view=system` and check the Moon is drawn, then test "Slip Planner", "Polar map", "Local
  terrain", "Lander's eye" and "Compare".
- [ ] **Every demo link below opens** and shows the right landing date and view.
- [ ] **The repository link works for a judge** (open item 1).
- [ ] **The video link opens without an account** (an unlisted link is fine) and plays to the
  end (open item 3).
- [ ] **No link in the submission text goes to `localhost`**, a pull request, or a page
  behind a login.
- [ ] **Check open pull requests before the final deploy** (`gh pr list --state open`) and
  confirm `docs/submission/` still matches what is live on the day.
- [ ] **Custom-site availability on the live server:** `/api/health` reports
  `custom_sites` as `available` or `not_available`. If custom coordinates are part of the
  demo, confirm that a south-pole site computes (about 44 to 49 seconds on our development
  machine).
- [ ] **The Docker image builds from a clean checkout** (`docker compose up -d --build`, then
  open port 8080 on your own machine), if the repository or zip is what judges will run.
  `docs/orchestration/status.md` says the team lead's local copy of the image is rebuilt
  after each batch of merges; rebuild once more on the final commit.
- [ ] **The footer line is on screen** in Mission Control and on the validation page:
  "Planning aid, not flight certification. Limits marked assumed are our estimates."

## 1. The submission's own links

Fill the middle column. The team lead owns these.

| Link | Address | Opens in a private window |
| :--- | :--- | :--- |
| Live demo | CHECK: open item 2 | [ ] |
| Repository (public link, or "zip attached") | CHECK: open item 1 | [ ] |
| Demo video | CHECK: open item 3 | [ ] |
| Challenge page | <https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/> | [ ] |

## 2. The demo links

Replace `<live>`. Defined in [`demo-script.md`](demo-script.md). Build each from the same
pattern; a date is `2028-01-22T00%3A00Z` in a link. Every one must be tried before the demo.

| Name | Path | Opens in a private window |
| :--- | :--- | :--- |
| A, the start | `/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-01-01T00%3A00Z&t=0&view=system` | [ ] |
| B, three weeks later | link A with `land=2028-01-22T00%3A00Z` and `view=slip` | [ ] |
| C, the next GO date | link A with `land=2028-01-27T00%3A00Z` | [ ] |
| E, the dark hour, Lander's eye | link A with `land=2028-01-22T00%3A00Z` and `view=panorama` | [ ] |
| G, Apollo 11 (optional) | `/mission?profile=im2_athena&sites=apollo11,connecting_ridge&land=2028-01-03T00%3A00Z&t=120&view=panorama` | [ ] |
| Polar map (link A) | link A with `view=map` | [ ] |
| Compare window (link C) | link C with `view=compare` | [ ] |
| Local terrain (link C) | link C with `view=terrain` | [ ] |
| Academy path & Lesson 1 | `/academy` and `/academy/l1_sun` | [ ] |
| Validation page | `/validation` | [ ] |

## 3. NASA data sources used

From `data/derived/validation.json` (`sources`) and the scene/app source files. The product names are NASA's.

| What | Used for | URL | Opens in a private window |
| :--- | :--- | :--- | :--- |
| JPL Horizons System | Sun and Earth positions; checks G1 and G2 | <https://ssd.jpl.nasa.gov/horizons/> | [ ] |
| LOLA 80 m and 240 m polar terrain (PGDA product 90) | Terrain behind every skyline, slope, and 3D ground | <https://pgda.gsfc.nasa.gov/products/90> | [ ] |
| LOLA average sunlight and Earth visibility, 60 m and 120 m (PGDA product 69) | Polar map context overlays; comparisons R1 and R2 | <https://pgda.gsfc.nasa.gov/products/69> | [ ] |
| LOLA 80 m slope map (PGDA product 90) | Comparison R3 | <https://pgda.gsfc.nasa.gov/products/90> | [ ] |
| LOLA 5 m close-up maps (PGDA product 78) | Positions of Artemis candidate sites; slope check | <https://pgda.gsfc.nasa.gov/products/78> | [ ] |
| NASA Scientific Visualization Studio 4720 | The Moon's colour map and height map in the scene | <https://svs.gsfc.nasa.gov/4720> | [ ] |
| Blue Marble Next Generation, NASA Earth Observatory | The Earth picture in the scene | CHECK: no page link in the repository; the file is `world.topo.bathy.200403.3x5400x2700.jpg` from `assets.science.nasa.gov` (`docs/architecture.md`) | [ ] |
| Yale Bright Star Catalogue V/50 (NASA/ADC, via HEASARC `bsc5p`) | The 8,404 stars in the System view background | <https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_bsc5p.tdat.gz> | [ ] |
| NASA Artemis candidate regions | Names of the nine regions | <https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/> | [ ] |
| IAU gazetteer of planetary nomenclature | Crater names for map labels | <https://planetarynames.wr.usgs.gov/> | [ ] |
| LROC Quickmap | Deep-linked from Compare's "Open in NASA's maps" (`nasa-links.ts`) | <https://quickmap.lroc.im-ldi.com/> | [ ] |
| Moon Trek | Deep-linked from Compare's "Open in NASA's maps" (`nasa-links.ts`) | <https://trek.nasa.gov/moon/> | [ ] |

Credit lines, as recorded in `data/derived/scene/meta.json`:

- "NASA Scientific Visualization Studio; LRO LROC and LOLA teams. SVS 4720."
- "NASA Earth Observatory, Reto Stöckli. Blue Marble Next Generation, March 2004."
- "NASA LOLA / PGDA, LDEM_80S_80MPP_ADJ, via the TrueSouth pipeline."

## 4. Site sources

Each catalog site's coordinates come from one of these (`data/derived/sites.json`). The five
`*_best_lit` variants are generated from the `80 m` LOLA map by TrueSouth (`Offset 71–149 m`).

| Sites | URL | Opens in a private window |
| :--- | :--- | :--- |
| Apollo 11 | <https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C> | [ ] |
| Apollo 17 | <https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html> | [ ] |
| Six Artemis candidate regions | <https://pgda.gsfc.nasa.gov/products/78> | [ ] |
| Blue Ghost Mission 1 | <https://www.lroc.asu.edu/images/1407> | [ ] |
| Chandrayaan-3 | <https://www.lroc.asu.edu/images/1314> | [ ] |
| Chang'e 4 | <https://lroc.im-ldi.com/images/1100> | [ ] |
| Chang'e 6 | <https://lroc.im-ldi.com/images/1374> | [ ] |
| IM-1 Odysseus | <https://lroc.im-ldi.com/images/1360> | [ ] |
| IM-2 Athena | <https://www.lroc.asu.edu/images/1401> | [ ] |
| Luna 25 target | <https://lroc.im-ldi.com/images/1311> | [ ] |
| Connecting Ridge; Shackleton rim (Gläser et al. 2014) | <https://www.sciencedirect.com/science/article/abs/pii/S0019103514004278> | [ ] |
| Peak near Shackleton (Bussey et al. 2010) | <https://www.sciencedirect.com/science/article/abs/pii/S0019103510001375> | [ ] |
| de Gerlache rim; Malapert Massif peak (De Rosa et al. 2012) | <https://arxiv.org/abs/1208.5587> | [ ] |

## 5. Mission-profile sources

The sourced values in the five presets (`data/derived/profiles.json`,
[`../mission-profiles.md`](../mission-profiles.md)).

| Used for | URL | Opens in a private window |
| :--- | :--- | :--- |
| VIPER: 100 days, 50 h dark, no relay | <https://science.nasa.gov/mission/viper/lunar-operations/> | [ ] |
| VIPER: 18-day loss of signal | <https://science.nasa.gov/wp-content/uploads/2024/08/viper-pip-final.pdf> | [ ] |
| VIPER: 15° slope | <https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf> | [ ] |
| IM-2 Athena: 10 days | <https://www.nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf> | [ ] |
| Chandrayaan-3: 14 days | <https://www.isro.gov.in/Chandrayaan3_Details.html> | [ ] |
| Chandrayaan-3: 10° slope | <https://www.hou.usra.edu/meetings/lpsc2023/pdf/1037.pdf> | [ ] |
| Artemis: 6.5 days | <https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/> | [ ] |
| Artemis: lit, no relay, 10° slope | <https://ntrs.nasa.gov/api/citations/20240009596/downloads/ArtemisHLSUpdate_2024.pdf> | [ ] |
| Blue Ghost 1: 14 days | <https://www.nasa.gov/wp-content/uploads/2025/01/np-2025-01-001-jsc-clps-firefly-press-kit-screen-508-1-10-25-final.pdf> | [ ] |

Every profile value not listed above is tagged **assumed**, with its reason in
`data/derived/profiles.json`. Five of them are assumed only because no link exists:
the IM-2 and Chandrayaan-3 `relay_available` values and Chandrayaan-3's three Sun-elevation
values. They stay assumed until a link is found (open item 6;
[`../orchestration/status.md`](../orchestration/status.md), "Waiting on the team lead").

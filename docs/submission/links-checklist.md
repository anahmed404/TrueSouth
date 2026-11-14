# Links checklist

Every link the submission will contain, and what must be true before sending it.
The last column is for the team to fill: open each link in a **private (incognito)
window, signed out**, and tick it only if the right page loads.

State checked at **2026-11-14 (`origin/main` at `5a5fd84`)**.

## Must be true before submitting

- [ ] **The live link opens without logging in**, in a private window, on a different
  device or network from the one that built it. It opens straight to the start screen.
- [ ] **The live link is the build that has the 3D scene and all five views.** Open
  `<live>/mission?...&view=system` and check the Moon is drawn, and test `Slip Planner`,
  `Polar map`, `Local terrain`, `Lander's eye`, and `Compare`.
- [ ] **Every demo link below opens** and shows the right landing date and view.
- [ ] **The repository link works for a judge.** The repository is **private today**
  (`gh repo view` reports `PRIVATE`, and there is no licence). A private link will not open
  for judges. Either make the repository public, or attach a zip of it, or both. If it
  goes public, first look for anything that should not be public (personal details,
  keys). CHECK: who decides this, and when.
- [ ] **The video link opens without an account** (an unlisted link is fine) and plays to
  the end. A recorded backup of the demo is also on the presenter's machine.
- [ ] **No link in the submission text goes to `localhost`**, a pull request, or a page
  behind a login.
- [ ] **Check open pull requests before the final deploy:** `#93` (scoring boundary fix),
  `#94` (science docs), `#95` (Academy `A3` interactive panel steps), `#96` (server queue
  position and validation fields). Confirm `docs/submission/` matches whatever is live on the day.
- [ ] **Confirm custom-site availability on the live server:** in the catalog-only Docker
  build without mounted NASA terrain maps, `/api/health` reports custom sites unavailable
  and the UI shows the `501` notice cleanly. If custom coordinates are part of the live
  demo, confirm the prepared terrain maps are mounted and `/api/sites/custom` responds.
- [ ] **The Docker image builds from a clean checkout** (`docker compose -p truesouth-s13 up -d --build`,
  then open <http://localhost:8080>), if the repository or zip is what judges will run.
  CHECK: `status.md` last recorded a full container check at PR #71; rebuild and verify on
  `origin/main` (`5a5fd84`).
- [ ] **The footer line is on screen:** "Planning aid, not flight certification. Limits marked
  assumed are our estimates."

## 1. The submission's own links

Fill the middle column. The team lead owns these.

| Link | URL | Opens in a private window |
| :--- | :--- | :--- |
| Live demo | CHECK: not known yet | [ ] |
| Repository (public link, or "zip attached") | CHECK: not known yet; `https://github.com/anahmed404/TrueSouth` is currently private | [ ] |
| Demo video | CHECK: not recorded yet | [ ] |
| Challenge page | <https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/> | [ ] |

## 2. The demo links

Replace `<live>`. Defined in [`demo-script.md`](demo-script.md). Build each from the same
pattern; a date is `2028-01-22T00%3A00Z` in a link. Every one must be tried before the demo.

| Name | Path | Opens in a private window |
| :--- | :--- | :--- |
| A, the start | `/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-01-01T00%3A00Z&t=0&view=system` | [ ] |
| B, three weeks later | same, `land=2028-01-22T00%3A00Z` | [ ] |
| C, the next GO date | same, `land=2028-01-27T00%3A00Z` | [ ] |
| D, Lander's eye on the GO date | link C with `view=panorama` | [ ] |
| E, the dark hour, Lander's eye | link B with `view=panorama` | [ ] |
| F, the dark hour, Local terrain | link B with `view=terrain` | [ ] |
| G, Apollo 11 | `/mission?profile=im2_athena&sites=apollo11,connecting_ridge&land=2028-01-03T00%3A00Z&t=0&view=system` | [ ] |
| Slip Planner (link A) | link A with `view=slip` | [ ] |
| Polar map (link A) | link A with `view=map` | [ ] |
| Compare window (link B) | link B with `view=compare` | [ ] |
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

Five profile values are tagged **assumed** because no link exists for them: the IM-2 and
Chandrayaan-3 `relay_available` values and Chandrayaan-3's three Sun-elevation values. They
stay assumed until a link is found ([`../orchestration/status.md`](../orchestration/status.md),
"Waiting on the team lead").

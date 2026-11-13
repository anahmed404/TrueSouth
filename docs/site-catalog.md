# Site catalog

The 20 sites TrueSouth ships with. The editable copy is `data/catalog/sites.json`; keep it
and this page in step.

Latitude is negative south. Longitude is east, 0–360.

## Rules

- Every site's coordinates come from a source linked here.
- **Published** means the source states the latitude and longitude.
- **Derived** means we computed them from something the source publishes, and the row
  says how.
- Never guess a coordinate. A place with no usable source is not a site.

## Terrain tier

Set by latitude ([`decisions/0008`](decisions/0008-terrain-tiers.md)):

| Latitude | Tier |
| :--- | :--- |
| 80°S to the pole | `core80` |
| 60°S to 80°S | `wide240` |
| Anywhere else | `sphere` |

## Group A: Artemis candidate regions

NASA's nine candidate regions, announced in October 2024
(<https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/>):
Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile
Rim 1, Nobile Rim 2, de Gerlache Rim 2 and Slater Plain. They were chosen for the original
Artemis III landing plan and now apply to the first crewed landing, Artemis IV.

**NASA has not published a centre coordinate for any region.** Six regions have a NASA 5 m
close-up DEM of the same name. For those six, the site is the centre of that map. This is
a representative point inside the region, not an official centre, and the app says so.

| Id | Name | Lat | East lon | Derived from |
| :--- | :--- | :--- | :--- | :--- |
| `artemis_haworth` | Haworth | −86.7639 | 337.2230 | Centre of close-up DEM "Haworth" |
| `artemis_malapert` | Malapert Massif | −85.9948 | 359.7642 | Centre of close-up DEM "Site23" |
| `artemis_mouton` | Mons Mouton | −85.4266 | 31.7428 | Centre of close-up DEM "Site20v2" |
| `artemis_nobile_rim_1` | Nobile Rim 1 | −85.4381 | 37.3667 | Centre of close-up DEM "Site06" |
| `artemis_nobile_rim_2` | Nobile Rim 2 | −83.9540 | 58.8221 | Centre of close-up DEM "DM2" |
| `artemis_de_gerlache_rim_2` | de Gerlache Rim 2 | −88.2300 | 295.3716 | Centre of close-up DEM "SL2" |

- The match between region names and DEM names is from Table 1 of a 2024 Acta
  Astronautica paper (doi:10.1016/j.actaastro.2024.10.049). The "Mons Mouton" region was
  first called "Leibnitz Beta Plateau".
- That each DEM covers its region is our inference from matching sizes. No source says the
  DEM edges are the official region boundaries.

**Three regions have no site:** Peak near Cabeus B, Mons Mouton Plateau and Slater Plain.
No centre is published and no close-up DEM carries their name.

**Region outlines.** The official outlines of all nine regions are in a USGS data release
(doi:10.5066/P1MEQ6UK, file `A3_9regions-lonlat-simplified.zip`). It needs a free
ScienceBase login, so it has not been downloaded yet. Until it is, the map draws the six
regions above as the footprint of their close-up DEM, labelled "approximate", and omits
the other three.

## Group B: Published high-sunlight points

Points that illumination studies single out for unusually long sunlight. All published.

| Id | Name | Lat | East lon | Source | Sunlight in the source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `connecting_ridge` | Connecting Ridge | −89.4555 | 222.6192 | Gläser et al. 2014, point CR1. <https://www.sciencedirect.com/science/article/abs/pii/S0019103514004278> | 92.27% at 2 m above ground, over 19 years |
| `shackleton_rim` | Shackleton rim | −89.7742 | 203.4952 | Gläser et al. 2014, point SR1 (same paper) | not stated for this point |
| `de_gerlache_rim` | de Gerlache rim | −88.6952 | 291.7154 | De Rosa et al. 2012, region GR1. <https://arxiv.org/abs/1208.5587> | not stated |
| `peak_near_shackleton` | Peak near Shackleton | −88.74 | 124.5 | Bussey et al. 2010. <https://www.sciencedirect.com/science/article/abs/pii/S0019103510001375> | "86% of the year" (2020) |
| `malapert_peak` | Malapert Massif peak | −85.9756 | 357.8876 | De Rosa et al. 2012, region MP1 (same preprint) | not stated |

Notes:

- Connecting Ridge is the Academy's story site. It is 0.54° from the pole.
- The first plan credited the Connecting Ridge point to De Rosa et al. It is from Gläser
  et al. 2014. De Rosa's own CR1 centre is −89.4679, 222.589. Mazarico et al. 2011 give a
  nearby point, −89.45, 222.69, with 89.0% average sunlight.
- The first plan's "site 007" at −88.811, 123.64 has no source and is replaced by Bussey's
  published point.
- The first plan's Malapert point, −85.99, 357.07, has no source and is replaced.
- The De Rosa values are from the arXiv preprint.
- The published sunlight figures are comparison targets for
  [`validation.md`](validation.md), alongside NASA's maps.

## Group C: Recent landers in the south polar region

All published.

| Id | Name | Lat | East lon | Outcome | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `chandrayaan3` | Chandrayaan-3 (Shiv Shakti) | −69.3741 | 32.32 | Landed 23 August 2023 | <https://www.lroc.asu.edu/images/1314> |
| `im1_odysseus` | IM-1 Odysseus | −80.13 | 1.44 | Landed leaning, 22 February 2024, in a worn 1 km crater on a 12° slope | <https://lroc.im-ldi.com/images/1360> |
| `im2_athena` | IM-2 Athena | −84.7906 | 29.1957 | Landed on its side in a 20 m crater, 6 March 2025 | <https://www.lroc.asu.edu/images/1401> |
| `luna25_target` | Luna 25 target | −69.545 | 43.544 | Never reached: the lander crashed about 400 km short on 19 August 2023 | <https://lroc.im-ldi.com/images/1311> |

- IM-2's intended point was −84.78, 29.13. The site is where it came to rest.
- IM-1 is `core80` but only 4 km inside the 80 m map's edge. Its skyline relies on the
  240 m map to the north ([`science.md`](science.md) §5).

## Group D: Contrast sites

Places away from the pole, to show how different the pole is. All `sphere` tier, all
published.

| Id | Name | Lat | East lon | Why it is here | Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `apollo11` | Apollo 11 | 0.67416 | 23.47314 | Near the equator: the Sun climbs high and Earth stays up | <https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C> |
| `apollo17` | Apollo 17 | 20.1911 | 30.7723 | A second Apollo site, further north | <https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html> |
| `blue_ghost1` | Blue Ghost Mission 1 | 18.5623 | 61.8103 | A recent commercial landing | <https://www.lroc.asu.edu/images/1407> |
| `change4` | Chang'e 4 | −45.4561 | 177.5885 | Far side: Earth never rises, so it needed a relay | <https://lroc.im-ldi.com/images/1100> |
| `change6` | Chang'e 6 | −41.6385 | 206.0148 | Far side, southern mid-latitude | <https://lroc.im-ldi.com/images/1374> |

Chang'e 4: a peer-reviewed paper (Liu et al. 2019) gives −45.4446, 177.5991, about 350 m
from the LROC value used here.

### Verified extras, not in the catalog

Ready to add if wanted:

| Name | Lat | East lon | Outcome | Source |
| :--- | :--- | :--- | :--- | :--- |
| Apollo 15 | 26.13239 | 3.63330 | Landed | <https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html> |
| Chang'e 3 | 44.1214 | 340.4884 | Landed | <https://lroc.im-ldi.com/images/637> |
| SLIM | −13.3160 | 25.2510 | Landed 55 m from target, tipped so its solar cells could not generate at first | <https://lroc.im-ldi.com/images/1358> |

## Close-up DEMs

NASA's 5 m maps (PGDA product 78, <https://pgda.gsfc.nasa.gov/products/78>). The page
gives names only. Centres are derived from each file's header.

Ten of them cover a catalog site, and `fetch-raw` downloads those ten:

| Product id | Name on NASA's page | Centre lat | Centre east lon | Width (km) | Catalog site |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Site01 | Connecting ridge | −89.4632 | 222.5104 | 16 | `connecting_ridge` |
| Site04 | Shackleton rim | −89.7668 | 188.1301 | 16 | `shackleton_rim` |
| Site07 | Peak near Shackleton | −88.8110 | 123.6901 | 16 | `peak_near_shackleton` |
| Site11 | de Gerlache rim | −88.6834 | 292.0679 | 16 | `de_gerlache_rim` |
| Site23 | Malapert massif | −85.9948 | 359.7642 | 21 | `artemis_malapert`, `malapert_peak` |
| Site20v2 | Leibnitz beta plateau, extended | −85.4266 | 31.7428 | 26 | `artemis_mouton` |
| Site06 | Nobile rim 1 | −85.4381 | 37.3667 | 20 | `artemis_nobile_rim_1` |
| DM2 | Nobile rim 2 | −83.9540 | 58.8221 | 20 | `artemis_nobile_rim_2` |
| SL2 | de Gerlache rim | −88.2300 | 295.3716 | 20 | `artemis_de_gerlache_rim_2` |
| Haworth | Haworth | −86.7639 | 337.2230 | 29.8 | `artemis_haworth` |

`build-sites` sets `has_closeup` by testing each site against each map's real extent, not
from this table.

Seventeen more close-up DEMs exist and are not used: Site20, Site42, Shoemaker, DM1, SL3,
NPA, NPB, NPC, NPD and LM1 to LM8. A custom site that falls inside a downloaded map uses
it.

## Named features

Label positions for `data/catalog/features.json`, from the IAU gazetteer
(`https://planetarynames.wr.usgs.gov/Feature/<id>`).

| Name | IAU id | Lat | East lon | Diameter (km) |
| :--- | :--- | :--- | :--- | :--- |
| Shackleton | 5450 | −89.67 | 129.78 | 20.92 |
| de Gerlache | 1439 | −88.48 | 271.66 | 32.71 |
| Sverdrup | 5782 | −88.32 | 206.61 | 32.83 |
| Shoemaker | 5494 | −88.14 | 45.91 | 51.82 |
| Slater | 15325 | −88.08 | 111.29 | 25.12 |
| Haworth | 14502 | −87.45 | 354.83 | 51.42 |
| Faustini | 1919 | −87.18 | 84.31 | 42.48 |
| Mons Malapert | 16338 | −85.98 | 358.33 | 67.00 |
| Cabeus | 953 | −85.33 | 317.87 | 100.58 |
| Nobile | 4321 | −85.28 | 53.27 | 79.27 |
| Malapert | 3603 | −85.00 | 11.40 | 72.38 |
| Mons Mouton | 16070 | −84.60 | 31.00 | 130.00 |
| Amundsen | 247 | −84.44 | 83.07 | 103.39 |
| Wiechert | 6541 | −84.03 | 164.70 | 40.82 |
| Scott | 5395 | −82.35 | 48.52 | 107.82 |

Mons Malapert is the IAU's name for Malapert Massif. The gazetteer lists longitudes from
−180 to 180; they are converted here.

## Links out

Each site carries `quickmap_url` and `moontrek_url`. Until the link formats are confirmed
(work package MC9) both point to the tools' home pages:
<https://quickmap.lroc.asu.edu/> and <https://trek.nasa.gov/moon/>.

## Adding a site

1. Find the coordinates in a primary source: an LROC image page, NASA's NSSDCA, the IAU
   gazetteer, or a peer-reviewed paper.
2. Add a row here with the source link.
3. Add the entry to `data/catalog/sites.json`.
4. Run `uv run truesouth build-sites --only <id>`.

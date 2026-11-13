# Mission profiles

A mission profile describes a mission's needs. Mission Control uses it to turn a site's
series into metrics, vetoes and a score ([`science.md`](science.md) §9–10).

Presets are named after real missions. Each value is **sourced** from a published document
or **assumed** by us because none is published. The app shows the tag next to every value.

The editable copy of this data is `data/catalog/profiles.json`. Keep it and this page in
step.

## Fields

| Field | Meaning |
| :--- | :--- |
| `id`, `name`, `based_on` | Identity and the real mission it models |
| `duration_days` | Length of the mission window |
| `min_sun_fraction` | Disc fraction of the Sun needed for an hour to count as lit |
| `ops_sun_el_min_deg` | Optional. The Sun's centre must also be this high for an hour to count as lit. |
| `max_dark_h` | Longest dark stretch the mission survives. 0 means it must stay lit throughout. |
| `relay_available` | An orbiter relay exists, so there are no blackouts |
| `antenna_mask_deg` | Clearance Earth's centre needs for a link |
| `max_blackout_h` | Longest blackout the mission tolerates |
| `max_slope_deg` | Slope limit at the landing site |
| `slope_ideal_deg` | Slope at or below which the slope utility is 1 |
| `landing_sun_el_min_deg`, `landing_sun_el_max_deg` | Optional. Allowed Sun elevation at touchdown. |
| `weights` | `{ slope, power, comms }`, any non-negative numbers; they are normalised. A weight is a number from 0 to 1,000. |
| `provenance` | Per field: `sourced` with `source_url` and `quote`, or `assumed` with `reason` |

Observer height is not a profile field. It is fixed at 2 m in the pipeline because
changing it changes the skyline.

## Presets

**Bold** values are sourced. Plain values are assumed.

| Field | VIPER | IM-2 Athena | Chandrayaan-3 | Artemis crewed landing | Blue Ghost 1 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `viper` | `im2_athena` | `chandrayaan3` | `artemis_crewed` | `blue_ghost1` |
| `duration_days` | **100** | **10** | **14** | **6.5** | **14** |
| `min_sun_fraction` | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 |
| `ops_sun_el_min_deg` | none | none | 6 | none | none |
| `max_dark_h` | **50** | 6 | 6 | **0** | 5 |
| `relay_available` | **false** | false | false | **false** | false |
| `antenna_mask_deg` | 1 | 1 | 1 | 1 | 1 |
| `max_blackout_h` | **432** | 12 | 12 | **0** | 12 |
| `max_slope_deg` | **15** | 10 | **10** | **10** | 10 |
| `slope_ideal_deg` | 5 | 5 | 5 | 5 | 5 |
| `landing_sun_el_min_deg` | none | none | 6 | none | none |
| `landing_sun_el_max_deg` | none | none | 9 | none | none |
| `weights` (slope, power, comms) | 0.40, 0.35, 0.25 | same | same | same | same |

A sixth profile, **Custom**, starts as a copy of whichever preset is selected and lets the
user change every field. Changed fields lose their sourced tag.

Pip, the Academy lander, uses `im2_athena`.

## Sources

### VIPER (NASA polar rover)

- **100 days:** "until the end of its approximately 100-day mission".
  <https://science.nasa.gov/mission/viper/lunar-operations/>
- **50 h of darkness:** "the rover cannot endure more than 50 hours of continuous
  darkness" (same page). Earlier design documents said 70 h and 96 h; we use the current
  figure.
- **No relay, direct to Earth:** "As there are no satellites currently orbiting the Moon
  that could be used to relay communications, VIPER relies on NASA's Deep Space Network"
  (same page).
- **432 h blackout:** "Loss of Signal (LOS) period, for up to 18 days".
  <https://science.nasa.gov/wp-content/uploads/2024/08/viper-pip-final.pdf>
- **15° slope:** "15 deg slope limit". This is the rover's driving limit. No landing-site
  slope limit is published for its lander.
  <https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf>
- **Status:** cancelled in July 2024, revived in September 2025 on a Blue Origin Blue Moon
  MK1 lander, planned to land at Mons Mouton in September 2027.

### IM-2 Athena (Intuitive Machines, 2025)

- **10 days:** "Surface Operations: Approximately 10 days".
  <https://www.nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf>
- **Assumed no relay:** the mission used the company's ground network, direct to Earth.
  We have no document to cite for this, so the value is tagged assumed.
- **Assumed 10° slope:** a 10° figure appears only in a secondary source we could not read.
  Intuitive Machines publishes no limit.
- **Assumed 6 h darkness, 12 h blackout:** no figures are published. The lander "cannot
  survive lunar night"; 6 h allows a short eclipse on battery.
- **Outcome:** landed on its side in a 20 m crater on 6 March 2025; the mission ended in
  under a day. <https://www.lroc.asu.edu/images/1408>
- **Lighting:** the company's chief executive cited "long shadows and dim lighting
  conditions that challenged the precision capability of our landing system". This quote
  comes from a news report of an earnings call, not a company document.
  <https://aerospaceamerica.aiaa.org/intuitive-machines-lunar-south-pole-landing-attempt-highlights-challenges-for-artemis/>

### Chandrayaan-3 (ISRO, 2023)

- **14 days:** "Mission Life (Lander & Rover) One lunar day (~14 Earth days)".
  <https://www.isro.gov.in/Chandrayaan3_Details.html>
- **Assumed Sun 6–9° at landing, at least 6° to operate:** "For landing, the angle
  requirement was 6-9° elevation and we managed to land when elevation was 8.75°. For
  operations, we need a minimum of 6° elevation angle" (project director, Times of India
  interview). We have the quotation but no link to the interview, so these three values
  are tagged assumed until a link is found.
- **10° site slope:** "Slope less than 10 deg." The lander itself tolerated up to 12°.
  <https://www.hou.usra.edu/meetings/lpsc2023/pdf/1037.pdf>
- **Assumed no relay:** direct to Earth, with the Chandrayaan-2 orbiter as a contingency
  link. The preset models the direct link, so `relay_available` is false. We have no
  document to cite for this, so the value is tagged assumed.
- **Assumed 6 h darkness, 12 h blackout:** not published.
- **Note:** the 6–9° landing rule can never be met within a few degrees of the pole, where
  the Sun stays below about 2°. That is correct: Chandrayaan-3 landed at 69°S.

### Artemis crewed landing (NASA)

The numbers are from the original Artemis III landing plan. In February 2026 NASA changed
Artemis III into a low-Earth-orbit test; the first crewed landing is now Artemis IV.

- **6.5 days:** "continuous access to sunlight throughout a 6.5-day period – the planned
  duration of the Artemis III surface mission".
  <https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/>
- **0 h darkness:** "Artemis III will require the surface to be lit for the duration of the
  surface stay".
  <https://ntrs.nasa.gov/api/citations/20240009596/downloads/ArtemisHLSUpdate_2024.pdf>
- **No relay, 0 h blackout:** "Direct with Earth (DWE) communication; assume no comm relay
  is available" and "Artemis III will require Earth to be visible for communications"
  (same document). Reading "visible" as "continuously visible" is our interpretation.
- **10° slope over 100 m:** "Surface slope for landing (100m): <10 deg" (same document).

### Blue Ghost Mission 1 (Firefly, 2025)

- **14 days:** "operate on the Moon's surface for a lunar day (about 14 Earth days) and for
  several hours into the lunar night".
  <https://www.nasa.gov/wp-content/uploads/2025/01/np-2025-01-001-jsc-clps-firefly-press-kit-screen-508-1-10-25-final.pdf>
- **Assumed 5 h darkness:** the lander actually ran "just over 5 hours into the lunar
  night". We use that as its limit; the design figure is not published.
- **Assumed 10° slope, 12 h blackout:** not published.
- **Assumed no relay:** Firefly describes only the lander's own antennas; no relay is
  mentioned.

### Values no mission publishes

- **Antenna mask.** No mission publishes a minimum Earth elevation. 1° is assumed for all.
- **Minimum Sun fraction.** 0.5 (half the disc) is assumed for all.
- **Ideal slope and weights.** Team settings.

## Tuning checkpoint

These presets have not yet been run against real data. After the first full pipeline run,
check that:

1. `im2_athena` gives at least one GO window and at least one NO-GO window among the
   polar catalog sites in 2028, so the Academy story works.
2. No preset is NO-GO at every site on every date, unless the reason is real and
   explainable (as with Chandrayaan-3's landing rule at the pole).

If a check fails, change assumed values only, and record the change in
[`decisions/`](decisions/).

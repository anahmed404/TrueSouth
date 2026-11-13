# The science

Every formula TrueSouth uses, derived once. Code and lessons link here.
Terms are defined in [`CONTEXT.md`](../CONTEXT.md).

Each section names the Python function that implements it. All paths are under
`science/src/truesouth/`.

## 1. Conventions

- Angles are degrees in inputs and outputs. Formulas below use radians.
- Distances are metres unless a name ends in `_km`.
- Latitude $\varphi$ is positive north. East longitude $\lambda$ is in $[0, 360)$.
- Azimuth $A$ is clockwise from north in the local frame. Elevation $e$ is positive up.
- Times are UTC on the time grid.
- The Moon is a sphere of radius $R$. Terrain height $z$ is metres above that sphere.

| Constant | Value | Note |
| :--- | :--- | :--- |
| $R$ | 1,737,400 m | Reference sphere of the LOLA products |
| $R_\odot$ | 695,700 km | Sun radius |
| $R_\oplus$ | 6,378.137 km | Earth equatorial radius |
| $h_{obs}$ | 2 m | Observer height above the ground. Fixed in the pipeline. |
| Skyline bins | 1,440 | 0.25° each |

`constants.py`

## 2. Frames

### 2.1 Unit vectors

A point at latitude $\varphi$, longitude $\lambda$ has the Moon-fixed unit vector

$$\hat u(\varphi,\lambda) = (\cos\varphi\cos\lambda,\ \cos\varphi\sin\lambda,\ \sin\varphi)$$

The local frame at a site is

$$\hat e = (-\sin\lambda,\ \cos\lambda,\ 0) \qquad
\hat n = (-\sin\varphi\cos\lambda,\ -\sin\varphi\sin\lambda,\ \cos\varphi) \qquad
\hat{up} = \hat u(\varphi,\lambda)$$

A direction $\hat d$ has

$$e = \arcsin(\hat d\cdot\hat{up}) \qquad A = \operatorname{atan2}(\hat d\cdot\hat e,\ \hat d\cdot\hat n) \bmod 360°$$

East and north are undefined exactly at a pole. Sites with $|\varphi| > 89.999°$ are
rejected.

`frames.py::unit_vector`, `local_basis`, `az_el`

### 2.2 Walking along the surface

Start at $(\varphi_1,\lambda_1)$, head along azimuth $A$ for ground distance $s$.
With $\gamma = s/R$:

$$\varphi_2 = \arcsin(\sin\varphi_1\cos\gamma + \cos\varphi_1\sin\gamma\cos A)$$

$$\lambda_2 = \lambda_1 + \operatorname{atan2}(\sin A\sin\gamma\cos\varphi_1,\ \cos\gamma - \sin\varphi_1\sin\varphi_2)$$

`frames.py::destination`

### 2.3 The south-pole map projection

The LOLA polar maps use south polar stereographic coordinates $(x, y)$ in metres, true
scale at the pole, central meridian 0°:

$$\rho = 2R\tan\left(45° + \tfrac{\varphi}{2}\right) \qquad x = \rho\sin\lambda \qquad y = \rho\cos\lambda$$

Inverse:

$$\rho = \sqrt{x^2+y^2} \qquad \varphi = 2\arctan\left(\tfrac{\rho}{2R}\right) - 90° \qquad \lambda = \operatorname{atan2}(x, y)$$

Check: at 80°S, $\rho = 2R\tan 5° = 304.0$ km. The 80 m map is 7,600 pixels wide, which is
608 km, or 304 km each side of the pole.

Map distances are stretched by the scale factor

$$k(\varphi) = \frac{2}{1+\sin|\varphi|}$$

which is 1.000 at the pole, 1.008 at 80°S and 1.072 at 60°S.

The code reads the projection from each file's metadata and uses `pyproj`. A test compares
`pyproj` with the closed form above. If a file's central meridian is not 0° or its true-scale
latitude is not −90°, the pipeline stops with an error.

`frames.py::polar_stereo_forward`, `polar_stereo_inverse`, `dem.py`

## 3. Where the Sun and Earth are

### 3.1 One pull for the whole Moon

We ask JPL Horizons one question for the whole time grid: seen from Earth's centre, where
on the Moon are the sub-Earth point and the sub-solar point, and how far away are Earth
and the Sun?

Horizons request (observer table):

| Parameter | Value |
| :--- | :--- |
| `COMMAND` | `'301'` (the Moon) |
| `CENTER` | `'500@399'` (Earth's centre) |
| `EPHEM_TYPE` | `'OBSERVER'` |
| `QUANTITIES` | `'14,15,19,20'` |
| `START_TIME`, `STOP_TIME`, `STEP_SIZE` | the time grid, `'1h'` |
| `ANG_FORMAT`, `CSV_FORMAT`, `format` | `'DEG'`, `'YES'`, `'json'` |

- Quantity 14 gives the sub-Earth point $(\varphi_E,\lambda_E)$.
- Quantity 15 gives the sub-solar point $(\varphi_S,\lambda_S)$.
- Quantity 19 gives the Moon–Sun distance $D_S$.
- Quantity 20 gives the Moon–Earth distance $D_E$.

The time grid has 52,584 rows. Horizons allows 90,000 per request.

The parser must confirm from the response header that longitudes are east-positive, and
convert if they are not.

`horizons.py`, `ephemeris.py::load_global`

### 3.2 From the global pull to any site

For a site with unit vector $\hat u_s$ and radius $R_0 = R + z_0 + h_{obs}$, the site is at
$\vec r = R_0\,\hat u_s$. A body at distance $D$ above sub-point $(\varphi_b,\lambda_b)$ is at
$\vec b = D\,\hat u(\varphi_b,\lambda_b)$. The direction to it is

$$\hat d = \frac{\vec b - \vec r}{|\vec b - \vec r|}$$

and section 2.1 turns $\hat d$ into azimuth and elevation. The body's angular radius is

$$\rho_b = \arcsin\left(\frac{R_b}{|\vec b - \vec r|}\right)$$

The Sun's disc is about 0.53° wide. Earth's is about 1.9° wide.

This is exact geometry. It needs no per-site Horizons call, so custom sites work without
network access. See
[`decisions/0004-one-global-ephemeris.md`](decisions/0004-one-global-ephemeris.md).

`ephemeris.py::topocentric`

### 3.3 Checking it against Horizons

For every catalog site we also pull Horizons' own site table (`CENTER='coord@301'`,
`COORD_TYPE='GEODETIC'`, `SITE_COORD='lonE,lat,alt_km'`, `QUANTITIES='4'`, targets `'10'`
and `'399'`). Quantity 4 is azimuth and elevation with no atmosphere. Section 3.2 must
match it within 0.02° at every hour. This is a hard test; see
[`validation.md`](validation.md).

A first check from real data: at Connecting Ridge (longitude 222.6°E, 0.54° from the
pole), Earth's azimuth in December 2026 ranged from 129.5° to 144.9°. Earth sits near
longitude 0°, so the predicted azimuth is $360° - 222.6° = 137.4°$, plus or minus
libration. The data agrees.

## 4. How high a piece of terrain looks

An observer at radius $R_0$ looks at a terrain point at radius $R_1 = R + z$, a ground
distance $s$ away. With $\gamma = s/R$:

$$\tan e = \frac{R_1\cos\gamma - R_0}{R_1\sin\gamma}$$

This is exact for a sphere.

For intuition, when $s \ll R$ it becomes

$$e \approx \arctan\left(\frac{(z - z_0 - h_{obs}) - \dfrac{s^2}{2R}}{s}\right)$$

The term $s^2/2R$ is how far the round Moon drops away. At 20 km it is 115 m, which is
0.33°. The polar Sun is only 1–2° high, so the drop matters.

With flat terrain at $z = 0$ and the observer at height $h$, the horizon is at
$-\arccos\left(\tfrac{R}{R+h}\right) \approx -\sqrt{2h/R}$. For $h = 2$ m that is −0.087°.

`skyline.py::elevation_angle`

## 5. The skyline

For each of the 1,440 bins we want the highest elevation angle of any terrain in that
direction. Two methods cover two distance ranges. The switch distance is where one map
pixel is as wide as one bin:

$$s_{switch} = \frac{\text{pixel size}}{\tan 0.25°} \approx 229 \times \text{pixel size}$$

That is 18.3 km for the 80 m map and 55 km for the 240 m map.

**Near field, $40\text{ m} \le s \le s_{switch}$: march along rays.** For each bin's centre
azimuth, step outward by half a pixel. At each step find the point (section 2.2), read the
height by bilinear interpolation, and compute the elevation angle (section 4). Keep the
maximum.

**Far field, $s_{switch} < s \le 300$ km: visit every pixel.** For each valid map pixel in
range, compute its position $\vec p = (R+z)\,\hat u(\varphi_p,\lambda_p)$, then
$\hat d = (\vec p - \vec r)/|\vec p - \vec r|$, then azimuth and elevation (section 2.1).
Put the elevation in the pixel's bin and keep the maximum. No peak can fall between rays.

The skyline in a bin is the larger of the two. Far-field pixels come from the 80 m map
where it has coverage and from the 240 m map beyond it. A near-field ray that runs off the
edge of the 80 m map continues on the 240 m map.

Each bin stores the elevation, and for its blocker the ground distance, latitude,
longitude and height. Missing pixels are skipped and counted.

Between bins, the skyline $H(A)$ is linear interpolation, wrapping at 360°.

**Sphere tier.** A site with no terrain data has a flat skyline at −0.087° (section 4) and
no blockers.

Why 300 km: a peak $h$ above the observer disappears below the horizon beyond
$\sqrt{2Rh}$. For 8 km of relief that is 167 km. 300 km is safely beyond any lunar relief.

`skyline.py::compute_skyline`

## 6. How much of a disc is visible

A body's centre is at $(A_c, e_c)$ and its angular radius is $\rho$. Cut the disc into 33
vertical strips at horizontal offsets $x_i \in (-\rho, \rho)$. Strip $i$ has half-height
$c_i = \sqrt{\rho^2 - x_i^2}$ and sits at azimuth $A_i = A_c + x_i/\cos e_c$.

$$f = \frac{\sum_i \operatorname{clamp}\big(e_c + c_i - H(A_i),\ 0,\ 2c_i\big)}{\sum_i 2c_i}$$

$f$ is the disc fraction: 0 when the body is fully hidden, 1 when fully clear.

Check: for a flat skyline at height $H$, with $d = (H - e_c)/\rho$ between −1 and 1, the
exact answer is $f = \big(\arccos d - d\sqrt{1-d^2}\big)/\pi$. At $d = 0$ this is 0.5.

`discs.py::visible_fraction`

## 7. The per-hour series

For each site and each hour on the time grid, sections 3, 5 and 6 give eight values:

| Column | Meaning |
| :--- | :--- |
| `sun_az`, `sun_el` | Sun centre, local frame |
| `sun_frac` | Sun disc fraction |
| `sun_clear` | `sun_el` minus the skyline at `sun_az` |
| `earth_az`, `earth_el` | Earth centre, local frame |
| `earth_frac` | Earth disc fraction |
| `earth_clear` | `earth_el` minus the skyline at `earth_az` |

Everything above this line is computed in Python and stored. Everything below is computed
in the browser from the series and a mission profile.

`series.py::build_series`

## 8. Slope

Slope depends on the distance it is measured over. We always report that distance.

**From a close-up DEM (5 m pixels).** Fit a plane $z = a\,E + b\,N + c$ by least squares to
every valid pixel within 50 m of the site, with $E, N$ in local metres. The slope over a
100 m baseline is

$$\theta = \arctan\sqrt{a^2 + b^2}$$

**From a polar map (80 m or 240 m pixels).** Use central differences with pixel size $p$:

$$g_x = \frac{z_{r,c+1} - z_{r,c-1}}{2p} \qquad g_y = \frac{z_{r-1,c} - z_{r+1,c}}{2p} \qquad
\theta = \arctan\left(k(\varphi)\sqrt{g_x^2 + g_y^2}\right)$$

The baseline is $2p$: 160 m or 480 m. $k$ is the scale factor from section 2.3.

A site reports `slope: { deg, baseline_m, source }` as defined in
[`data-contracts.md`](data-contracts.md). A sphere-tier site reports no slope.

`slope.py`

## 9. Mission metrics

Inputs: a site's series, a mission profile, and a landing date at index $i_0$ on the time
grid. The mission window is the $N = \lfloor 24 \times \text{duration\_days} + 0.5 \rfloor$
hours from $i_0$; halves round up, and $N$ must be at least 1. A window that would run
past the end of the time grid has no result; this is not a NO-GO.

Per hour:

- **lit** when `sun_frac ≥ min_sun_fraction`, and also `sun_el ≥ ops_sun_el_min_deg` if the
  profile sets one.
- **link** when the profile has a relay, or `earth_clear ≥ antenna_mask_deg`.

Over the window:

| Metric | Definition |
| :--- | :--- |
| `sun_fraction_mean` | mean of `sun_frac` |
| `lit_fraction` | share of hours that are lit |
| `longest_dark_h` | longest unbroken run of dark hours |
| `link_fraction` | share of hours with a link |
| `longest_blackout_h` | longest unbroken run of blackout hours |
| `landing_sun_el_deg` | `sun_el` at $i_0$ |
| `landing_lit` | lit at $i_0$ |

**Countdowns** are measured from the scrubber's current time to the next change of the
same lit or link flag drawn on the timeline. Sunset is when the site stops being lit;
sunrise is when it becomes lit. Earthset is when the link ends; Earthrise is when it
starts. With a relay the link never ends, so both Earth countdowns are none. A change
occurs between neighbouring hourly samples whose flags differ. The crossing time is
linearly interpolated between the two hourly samples around it, for each condition that
changes there. Each condition passes when its value is greater than or equal to its
threshold. For sunset, use the earliest crossing among conditions changing from passing to
failing; for sunrise, use the latest crossing among conditions changing from failing to
passing, because all conditions must pass. The Sun conditions are disc fraction against
`min_sun_fraction` and, if set, Sun elevation against `ops_sun_el_min_deg`. The link
condition is Earth clearance against `antenna_mask_deg`. The next change is the first at
or after the current hour; if none occurs before the end of the time grid, the result is
none.

`web/src/lib/scoring/metrics.ts` (reference copy: `scoring.py`)

## 10. Vetoes, utilities, score, status

**Vetoes.** Each is checked only if the profile sets its limit. `landing_dark` always applies.

| Veto | Triggers when |
| :--- | :--- |
| `slope` | `slope_deg > max_slope_deg` |
| `darkness` | `longest_dark_h > max_dark_h` |
| `blackout` | no relay, and `longest_blackout_h > max_blackout_h` |
| `landing_dark` | not lit at $i_0$ |
| `landing_sun_low` | `landing_sun_el_deg < landing_sun_el_min_deg` |
| `landing_sun_high` | `landing_sun_el_deg > landing_sun_el_max_deg` |

**Utilities**, each from 0 to 1. Let $g(x, m) = \max(0,\ 1 - x/m)$ when $m > 0$, and 1 when
$m = 0$. So a limit of 0 does not reduce the utility; a limit of 0 is enforced by the veto.

A profile must have `slope_ideal_deg` less than `max_slope_deg`.

$$U_{slope} = \operatorname{clamp}\left(\frac{\text{max\_slope} - \text{slope}}{\text{max\_slope} - \text{slope\_ideal}},\ 0,\ 1\right)$$

$$U_{power} = \text{sun\_fraction\_mean} \times g(\text{longest\_dark\_h},\ \text{max\_dark\_h})$$

$$U_{comms} = \begin{cases} 1 & \text{with a relay} \\ \text{link\_fraction} \times g(\text{longest\_blackout\_h},\ \text{max\_blackout\_h}) & \text{otherwise} \end{cases}$$

**Score.** With weights $w$ from the profile, over the criteria that could be assessed:

$$\text{score} = 100 \times \frac{\sum_i w_i U_i}{\sum_i w_i}$$

A site with no slope leaves slope out of both sums and is flagged "slope not assessed".

**Status.**

- **NO-GO** if any veto triggers.
- **GO** if no veto triggers and score ≥ 70.
- **CAUTION** otherwise: feasible, but marginal.

Vetoes decide whether a mission can work. The score ranks the ones that can. The threshold
70 is a team setting, to be tuned once real data exists.

`web/src/lib/scoring/score.ts` (reference copy: `scoring.py`)

## 11. The slip sweep

The Slip Planner evaluates section 10 for a landing at 00:00 UTC on every day of the time
grid, for every selected site. Means use prefix sums. Longest runs are scanned directly.
It runs in a Web Worker. The reference in `scoring.py` evaluates every landing hour; the
Slip Planner reads the 00:00 UTC rows.

`web/src/lib/scoring/sweep.worker.ts`

## 12. Sensitivity grid

"Compute for my dates" evaluates a 9 × 9 grid of points spaced 250 m apart, centred on the
pin, for one mission window.

For each grid point:

1. Convert the Sun and Earth directions from the pin's local frame to the grid point's
   local frame. Take each direction as a Moon-fixed vector and apply section 2.1 at the
   grid point. Moving 2 km changes the direction to a body by a negligible amount, but
   near the pole it changes which way "north" is.
2. Compute a fast skyline: rays only, 720 bins, out to 150 km, with the step growing 1% per
   step beyond the switch distance.
3. Compute `sun_fraction_mean` and `link_fraction` for the window.

The fast skyline can miss narrow far-off peaks, so the grid is labelled an approximation.
The response also reports the centre point under both methods, so the gap is visible.

`sensitivity.py`

## 13. Local terrain coordinates

The local terrain mesh is a 257 × 257 grid over a 20 km square centred on the site. A
vertex at local offsets $(E, N)$ is found by walking distance $s = \sqrt{E^2+N^2}$ along
azimuth $\operatorname{atan2}(E, N)$ (section 2.2) and reading the height $z$. With
$\gamma = s/R$ its true local position is

$$\text{east} = (R+z)\sin\gamma\,\sin A \qquad \text{north} = (R+z)\sin\gamma\,\cos A \qquad \text{up} = (R+z)\cos\gamma - (R+z_0)$$

So the mesh includes the Moon's curvature, and sight-lines in the scene are straight.

The 3D scene uses kilometres with $x = \text{east}$, $y = \text{up}$, $z = -\text{north}$.
A direction with azimuth $A$ and elevation $e$ is

$$(x, y, z) = (\cos e\sin A,\ \sin e,\ -\cos e\cos A)$$

The skyline wall is a ring of radius 10 km. Its top edge at azimuth $A$ is at height
$10\text{ km} \times \tan H(A)$. It is drawn only for bins whose blocker is more than 10 km
away.

`terrain_mesh.py`, `web/src/lib/geo/scene.ts`

## 14. System view coordinates

The System view scene is fixed to the Moon. A Moon-fixed vector $(x, y, z)$ maps to scene
coordinates $(x,\ z,\ -y)$. Sunlight comes from $\hat u(\varphi_S, \lambda_S)$. Earth sits
along $\hat u(\varphi_E, \lambda_E)$.

A site's Sun elevation follows from the sub-solar point alone:

$$\sin e = \sin\varphi\sin\varphi_S + \cos\varphi\cos\varphi_S\cos(\lambda - \lambda_S)$$

The day/night line is where this is zero.

`web/src/lib/geo/system.ts`

## 15. Known limits

- **Resolution.** The 80 m map cannot see boulders, small craters or anything narrower
  than a pixel. Slope from it is a regional figure, not a footpad figure.
- **Frames.** The LOLA maps use the Moon's mean-Earth frame. Which lunar frame Horizons
  uses for site coordinates is still to be confirmed. The two common lunar frames differ by
  under 0.03°, which is below our skyline accuracy.
- **Skyline and close-up DEMs.** Skylines use only the polar maps. Close-up DEMs are used
  for slope and display, because mixing products with different height adjustments can
  create false ridges.
- **Earth link.** A clear line to Earth is not a radio link budget, and Earth being visible
  does not mean a specific ground station is.
- **Time step.** Events are sampled hourly and interpolated. A transition is good to a few
  minutes, not seconds.
- **Assumed numbers.** Many mission limits are not published. See
  [`mission-profiles.md`](mission-profiles.md).

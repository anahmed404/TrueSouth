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

### 2.4 Shaded relief for the polar map

The polar map's base image is the terrain shaded as if lit from one fixed direction. It
is a drawing, never a result: at the pole the real Sun circles the horizon, so no single
real Sun position would show the whole region.

With heights $z(x, y)$ on the map grid of section 2.3, the surface normal and the fixed
direction to the light, in map axes ($x$ right, $y$ up, third axis out of the ground), are

$$\hat n = \frac{(-\partial z/\partial x,\ -\partial z/\partial y,\ 1)}{\sqrt{(\partial z/\partial x)^2 + (\partial z/\partial y)^2 + 1}} \qquad \hat l = \left(-\tfrac{1}{2},\ \tfrac{1}{2},\ \tfrac{1}{\sqrt 2}\right)$$

$$\text{shade} = \operatorname{clamp}(\hat n \cdot \hat l,\ 0,\ 1)$$

So the light comes from the top-left of the image, 45° above the ground. A slope facing
up and to the left is brighter than flat ground, which has shade $1/\sqrt 2 = 0.707$.

Slopes are central differences in map metres at the image's own pixel size, with heights
not exaggerated. The map's scale factor $k$ is ignored: it is at most 1.008 inside 80°S,
which changes no pixel's shade visibly.

`maps.py`

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

The saved real response confirms `Target pole/equ : MOON_ME` and
`{East-longitude positive}`. Both sub-point column descriptions independently say
longitude is positive east. The site tables say `Center pole/equ : MEAN_ME (high
precision)`, also east-positive. These are the high-precision lunar **DE421 mean-Earth**
frame, not the principal-axes frame; the latter is not available in Horizons. See JPL's
[lunar frame definition](https://ssd.jpl.nasa.gov/horizons/manual.html#lunar-mean-earth-frame-of-de421).
The parser checks those words on every response, rejects an unknown frame or an
inconsistent sign, and converts west-positive sub-points to east longitude if encountered.
No rotation between lunar frames is applied.

The response gives `r` and `delta` in AU and prints its AU-to-kilometre conversion.
The parser applies that conversion once; `system.bin` stores kilometres. `STOP_TIME`
is the last included hour, 2031-12-31T23:00:00Z. The step requests `TIME_TYPE='UT'`
(UTC after 1962), `APPARENT='AIRLESS'` and `EXTRA_PREC='YES'` explicitly.

`horizons.py`, `ephemeris.py::load_global`

### 3.2 From the global pull to any site

For a site with unit vector $\hat u_s$ and radius $R_0 = R + z_0 + h_{obs}$, the site is at
$\vec r = R_0\,\hat u_s$. A body at distance $D$ above sub-point $(\varphi_b,\lambda_b)$ is at
$\vec b = D\,\hat u(\varphi_b,\lambda_b)$. The direction to it is

$$\hat d = \frac{\vec b - \vec r}{|\vec b - \vec r|}$$

and section 2.1 turns $\hat d$ into azimuth and elevation. The body's angular radius is

$$\rho_b = \arcsin\left(\frac{R_b}{|\vec b - \vec r|}\right)$$

The Sun's disc is about 0.53° wide. Earth's is about 1.9° wide.

The vector subtraction is exact for the supplied body positions. The observer-table
sub-points are **apparent**, not simultaneous geometric positions: quantity 14 includes
Moon-to-Earth down-leg light-time; quantity 15 includes Sun-to-Moon and Moon-to-Earth
light-time. Quantities 19 and 20 are light-time-aberrated ranges. Thus agreement with
a lunar observer's apparent direction must be measured by §3.3; it is not a claim of
identical light-time or aberration conventions. No fitted offset or extra light-time
correction is applied. It needs no per-site Horizons call, so custom sites work without
network access. See
[`decisions/0004-one-global-ephemeris.md`](decisions/0004-one-global-ephemeris.md).

`ephemeris.py::topocentric`

### 3.3 Checking it against Horizons

For every catalog site we also pull Horizons' own site table (`CENTER='coord@301'`,
`COORD_TYPE='GEODETIC'`, `SITE_COORD='lonE,lat,alt_km'`, `QUANTITIES='4'`, targets `'10'`
and `'399'`). Quantity 4 is **airless apparent** azimuth and elevation, not geometric
elevation: its column description includes light-time, gravitational light deflection,
stellar aberration, precession and nutation. Its azimuth is clockwise from north through
east and elevation is relative to the plane perpendicular to the local surface zenith.
Section 3.2 must
match it within 0.02° at every hour. This is a hard test; see
[`validation.md`](validation.md).

For G2 before terrain is available, use ground height $z_0=0$ plus the 2 m observer
height in both methods: `SITE_COORD='lonE,lat,0.002'` and $R_0=1{,}737{,}402$ m.
The site response confirms a spherical lunar reference surface of radius 1737.4 km.
Compare directions calculated from the **Float32 values read back from `system.bin`**,
including its quantisation error, against all 52,584 site-table hours.

Let $\Delta A$ be the azimuth difference wrapped into $[-180°,180°)$ and $e_H$ the
Horizons elevation. Compare azimuth as the angular separation of the two azimuths at
that same elevation on the sky:

$$\delta_A = 2\arcsin\left(\left|\cos e_H\sin\tfrac{\Delta A}{2}\right|\right)
\qquad \delta_e = |e-e_H|$$

This approaches $|\Delta A\cos e_H|$ for small differences and tends to zero when the
body is straight overhead or straight underfoot, where a compass direction has no
meaning; neither a 360° wrap nor that undefined azimuth causes a false failure.

**What this comparison is, and is not.** $\delta_A$ is an angle on the sky, not the raw
difference between two compass bearings. The two agree for a body near the horizon,
which is the only case at the polar sites. They part when a body is nearly overhead or
underfoot. Measured over all 20 catalog sites and 52,584 hours (2026-11-13):

| Quantity | Largest value | Where |
| :--- | :--- | :--- |
| Full direction separation on the sky | 0.0060° | Earth at Apollo 11, 2027-01-07T22:00Z |
| $\delta_A$, azimuth as an angle on the sky | 0.0060° | Earth at IM-1, same hour |
| $\delta_e$, elevation | 0.0060° | Earth at Apollo 11 |
| Raw compass azimuth $|\Delta A|$ | 0.082° | Sun at Apollo 11, 2031-10-14T01:00Z, at elevation −89.88° |

The raw compass azimuth is above 0.02° at 28 hours in six years, all of them the Sun at
Apollo 11 while it is within 0.52° of straight overhead or straight underfoot. At the
worst of those hours the direction on the sky differs by 0.00017°. At every other site
and hour the raw compass azimuth differs by at most 0.0093°, and at the polar sites by at
most 0.0060°.

Gate G2 in [`validation.md`](validation.md) compares $\delta_A$ and $\delta_e$, each
against 0.02°: directions on the sky, not raw compass bearings. The team lead decided
this on 2026-11-13
([`decisions/0011`](decisions/0011-g2-compares-directions-on-the-sky.md)). The raw
compass azimuth is still measured and reported beside the gate.
For each component, report the maximum, its UTC hour, and
$\operatorname{RMS}(\delta)=\sqrt{\operatorname{mean}(\delta^2)}$. Also report the full
direction separation, computed from local east/north/up unit vectors $\hat d$ and
$\hat d_H$ as $2\arcsin(\min(1,|\hat d-\hat d_H|/2))$, as an additional diagnostic.

A first check from real data: at Connecting Ridge (longitude 222.6°E, 0.54° from the
pole), Earth's azimuth in December 2026 ranged from 129.5° to 144.9°. Earth sits near
longitude 0°, so the predicted azimuth is $360° - 222.6° = 137.4°$, plus or minus
libration. The data agrees.

### 3.4 Two rules of thumb the Academy quotes

These are approximations for teaching. No result in TrueSouth is computed from them:
every direction comes from sections 3.1 and 3.2.

**The highest Sun.** The Moon's equator is tilted about 1.54° to the plane of its path
around the Sun, so the sub-solar latitude stays close to the equator. In the stored
ephemeris (2026 to 2031) it stays within ±1.59°. On a smooth sphere, seen from the
surface at latitude $\varphi$, the centre of the Sun's disc can rise to about

$$E_{max} \approx 90° - |\varphi| + 1.54°$$

above the local level. The rule ignores the terrain, the observer's height (which lowers
the horizon, section 4) and the Sun's disc, whose radius is about 0.27°. It gives the most
the Sun can reach in the best season, not what it reaches in a given month. At Connecting
Ridge ($\varphi = -89.4555°$) it gives 2.08°.

**Earth's off-centre shift.** Section 3.2 subtracts the site's position from the body's.
For Earth this moves its direction, compared with the direction from the Moon's centre,
by at most about

$$\arcsin\left(\frac{R}{D}\right) \approx 0.26°$$

with $R$ the Moon's radius and $D$ Earth's distance. Over the stored ephemeris the bound
runs from 0.24° at Earth's farthest to 0.28° at its nearest. The shift is largest for a
site that sees Earth at its horizon, which is where the polar sites are.

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

### 7.1 How much a sunlit peak depends on where you stand

A site's result is for one point. On a sharp ridge the answer changes a great deal over a
short distance: at the catalog's five sunlit peaks, mean `sun_frac` differs by 14 to 47
percentage points between map pixels less than 160 m apart
([`decisions/0012`](decisions/0012-sunlit-peaks-keep-their-listed-point.md)). So for every
catalog site in the group `sunlit_peak`, the pipeline also evaluates the centre of every
80 m map pixel whose centre is within 160 m of the listed point, measured in map metres
(section 2.3). Each such point gets its own skyline (section 5) and series, and the mean
of `sun_frac` over the time grid.

- **Nearby range.** The site reports the lowest and the highest of those means, the
  number of points, and the radius.
- **Best-lit variant.** The point with the highest mean becomes a second site with the id
  `<id>_best_lit`. A tie goes to the point nearest the listed one; if the mean and the distance are both
  equal, the smaller row index wins, then the smaller column index. It records which site
  it is a variant of and its distance from the listed point in metres. It is chosen by
  TrueSouth and is not a published site.

The listed point is never moved. The choice uses only our own series. It never uses NASA's
average-sunlight map, because that map is what our results are checked against
([`validation.md`](validation.md), R1).

Picking the highest of our own estimates favours points where the estimate happens to err
high. A best-lit variant's sunlight is therefore an upper reading, and the app says so.

This is computed in Python and stored, like the series.

`placement.py`

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

The pixel $(r, c)$ is the one whose centre is nearest the site, chosen separately in row and in
column; an exact half-way tie goes to the even index. The differences are taken at that pixel
and are not interpolated, and $k$ is evaluated at the site's latitude. So this slope changes in
steps as a site moves from one pixel to the next.

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
So that a score always exists, a profile's power and comms weights must not both be zero.

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

Each vertex also stores a slope for the slope overlay:
$\arctan\sqrt{(\partial z/\partial E)^2 + (\partial z/\partial N)^2}$ in degrees, from the
sampled heights $z$ in metres on the offset grid $(E, N)$ in metres, with no projection scale
factor. With grid spacing $\Delta = 1000 \times \text{window\_km} / (\text{size} - 1)$ metres,
interior vertices use central differences over $2\Delta$ and rim vertices use one-sided
differences over $\Delta$. That is a baseline of 156.25 m for the terrain mesh (78.125 m at the
rim) and 15.625 m for a close-up mesh. A vertex is NaN if its height, or any height its
differences need, is missing. This is a different baseline from the site's own slope in section
8, and the overlay's legend must say so.

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

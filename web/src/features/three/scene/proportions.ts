import {
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
  bodyDirections,
  trueEarthPlacement,
  type BodyPlacement,
  type SystemHour,
} from "../../../lib/geo";

/**
 * How big and how far the System view draws Earth and the Sun by default, when "True scale"
 * is off (docs/features/system-view.md, "Scale"). Scene units are Moon radii.
 *
 * A schematic, not a model: the Moon is the subject and leads, with Earth beside it a
 * little smaller and further out, and the Sun far beyond, so the circle the Moon would
 * trace around Earth never comes near it (the team lead, 2026-11-14). The true
 * values (docs/science.md §1, and the series):
 * - radii: Moon 1,737.4 km; Earth 6,378.137 km (3.67 Moons); Sun 695,700 km (400 Moons,
 *   109 Earths);
 * - distances from the Moon: Earth about 384,400 km (221 Moon radii; 356,000 to 407,000 km
 *   over a month); the Sun about 149.6 million km (86,100 Moon radii, 389 times Earth's).
 *
 * Distances increase with the true value, so a further body is always drawn further. Sizes
 * do not quite: by the team's choice (2026-11-14) Earth is drawn a little smaller than the
 * Moon, so the Moon leads; Earth is still smaller than the Sun, and "True scale" shows the
 * real sizes. Directions are not touched: they come from `system.bin` (computed in Python).
 *
 * To retune, change one constant:
 * - DRAWN_EARTH_RADIUS: 0.83 Moon radii (true 3.67): in the opening view, a little further
 *   from the camera than the Moon, it shows about 0.8 times the Moon. "Earth a bit smaller"
 *   lowers it.
 * - DRAWN_SUN_RADIUS: 3.5 Moon radii (true 400): clearly the largest, yet seen behind the
 *   Moon from "From Earth" (around new moon) never more than 1.5 times the Moon.
 * - DISTANCE_EXPONENT: 0.385, for both laws below.
 * - SUN_DISTANCE_SCALE: 0.372 puts the Sun about 29.5 Moon radii out (29.3 to 29.8).
 * - EARTH_DISTANCE_SCALE: 0.4125 puts Earth about 3.3 Moon radii out (3.20 at perigee to 3.37
 *   at apogee; 2.89 to 3.04 before), the furthest that still lets the opening view show it
 *   whole beside a Moon of about 45 px at 1024 x 768 (camera.ts, homePose); the Sun is then
 *   8.7 to 9.3 times further. Larger moves Earth out and shrinks the opening Moon.
 * A true distance up to NEAR_LAW_KM is drawn by Earth's law, from FAR_LAW_KM by the Sun's,
 * and between them on a straight line on log-log axes joining the two, so the mapping still
 * always increases.
 */
export const DRAWN_EARTH_RADIUS = 0.83;
export const DRAWN_SUN_RADIUS = 3.5;
export const DISTANCE_EXPONENT = 0.385;
export const SUN_DISTANCE_SCALE = 0.372;
export const EARTH_DISTANCE_SCALE = 0.4125;
export const NEAR_LAW_KM = 1_000_000;
export const FAR_LAW_KM = 100_000_000;

/** Earth's greatest distance from the Moon in the series (apogee), in km: the opening view leaves room for it. */
export const EARTH_FARTHEST_KM = 407_000;

/**
 * How far the System view can zoom out, in Moon radii above the surface: just far enough to
 * see the Moon, Earth and the Sun's disc and edge together in a 1024 × 768 window with the
 * panels open. At true scale, 900, far enough for Earth at its real distance.
 */
export const SYSTEM_MAX_ALTITUDE = 420;
export const TRUE_SCALE_MAX_ALTITUDE = 900;

/**
 * A true length the mapping can take: zero, a negative or a non-finite value (a bad record)
 * maps to zero, so it can never put NaN or Infinity into a position.
 */
function usable(km: number): number {
  return Number.isFinite(km) && km > 0 ? km : 0;
}

/**
 * The drawn radius, in Moon radii, of a body `radiusKm` across its radius: straight lines on
 * log-log axes through the Moon (1), Earth (DRAWN_EARTH_RADIUS) and the Sun
 * (DRAWN_SUN_RADIUS), extended past both ends with the end slopes. From Earth up it
 * increases; between the Moon and Earth it falls, by the team's choice (Earth drawn smaller
 * than the Moon). Zero (or a bad value) gives zero.
 */
export function drawnRadius(radiusKm: number): number {
  const km = usable(radiusKm);
  if (km === 0) return 0;
  const x = Math.log(km / MOON_RADIUS_KM);
  const xEarth = Math.log(EARTH_RADIUS_KM / MOON_RADIUS_KM);
  const xSun = Math.log(SUN_RADIUS_KM / MOON_RADIUS_KM);
  const yEarth = Math.log(DRAWN_EARTH_RADIUS);
  const ySun = Math.log(DRAWN_SUN_RADIUS);
  const y = x <= xEarth ? (yEarth / xEarth) * x : yEarth + ((ySun - yEarth) / (xSun - xEarth)) * (x - xEarth);
  return Math.exp(y);
}

/** The drawn distance from the Moon's centre, in Moon radii, of a body `distanceKm` away (see the laws above). */
export function drawnDistance(distanceKm: number): number {
  const km = usable(distanceKm);
  const law = (scale: number, d: number) => scale * Math.pow(d / MOON_RADIUS_KM, DISTANCE_EXPONENT);
  if (km <= NEAR_LAW_KM) return law(EARTH_DISTANCE_SCALE, km);
  if (km >= FAR_LAW_KM) return law(SUN_DISTANCE_SCALE, km);
  const t = Math.log(km / NEAR_LAW_KM) / Math.log(FAR_LAW_KM / NEAR_LAW_KM);
  const near = Math.log(law(EARTH_DISTANCE_SCALE, NEAR_LAW_KM));
  const far = Math.log(law(SUN_DISTANCE_SCALE, FAR_LAW_KM));
  return Math.exp(near + (far - near) * t);
}

function along(dir: readonly [number, number, number], length: number): [number, number, number] {
  return [dir[0] * length, dir[1] * length, dir[2] * length];
}

/** Where Earth is drawn at hour `hour`: the schematic, or its true distance and size at true scale. */
export function drawnEarth(hour: SystemHour, trueScale: boolean): BodyPlacement {
  if (trueScale) return trueEarthPlacement(hour);
  return { centre: along(bodyDirections(hour).earth, drawnDistance(hour.earthDistKm)), radius: DRAWN_EARTH_RADIUS };
}

/** Where the Sun is drawn by default, along `sunDir` (a unit vector) at `sunDistKm`. At true scale it is only a direction. */
export function drawnSun(sunDir: readonly [number, number, number], sunDistKm: number): BodyPlacement {
  return { centre: along(sunDir, drawnDistance(sunDistKm)), radius: DRAWN_SUN_RADIUS };
}

/** How far out the Sun is carried as "True scale" turns on, before it becomes only a direction. */
export const SUN_TRUE_SCALE_EXIT = 4_000;

/** Interpolates between two positive lengths on a log scale, so a move from 6 to 221 is even. */
function logLerp(a: number, b: number, t: number): number {
  if (!(a > 0) || !(b > 0)) return a + (b - a) * t;
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
}

function clamp01(t: number): number {
  return Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
}

/**
 * Earth while "True scale" turns on or off: `blend` 0 is the schematic, 1 is true scale. The
 * rig moves `blend` with the camera flight the toggle starts (rig.ts, scaleBlend), so Earth
 * glides out (or in) on a log scale in step with the camera, instead of jumping in one frame.
 */
export function earthDuringScale(earthDir: readonly [number, number, number], earthDistKm: number, blend: number): BodyPlacement {
  const t = clamp01(blend);
  const distance = logLerp(drawnDistance(earthDistKm), usable(earthDistKm) / MOON_RADIUS_KM, t);
  const radius = logLerp(DRAWN_EARTH_RADIUS, EARTH_RADIUS_KM / MOON_RADIUS_KM, t);
  return { centre: along(earthDir, distance), radius };
}

/** The Sun while "True scale" turns on or off: carried out to SUN_TRUE_SCALE_EXIT, then only a direction (visible: false). */
export function sunDuringScale(sunDir: readonly [number, number, number], sunDistKm: number, blend: number): BodyPlacement & { visible: boolean } {
  const t = clamp01(blend);
  return { centre: along(sunDir, logLerp(drawnDistance(sunDistKm), SUN_TRUE_SCALE_EXIT, t)), radius: DRAWN_SUN_RADIUS, visible: t < 1 };
}

/**
/**
 * Room kept clear around the Moon's disc, as a share of its angular radius: a body nearer than
 * the Moon whose disc comes within this of the Moon's is not drawn (the site labels sit there).
 */
export const IN_FRONT_MARGIN = 0.3;
/**
 * A body nearer than the Moon, larger than it on screen and in view is not drawn either, once
 * it is at least this much nearer (5 %). Below that it is beside the Moon at nearly its depth:
 * only a hair larger, as the Sun is when zoomed out, and stays drawn.
 */
export const IN_FRONT_NEARER = 0.05;
/** While a body is hidden it stays hidden until it is this much clear of each threshold (no flicker on a slow drag). */
export const IN_FRONT_HYSTERESIS = 0.15;

/**
 * True when a body is not drawn because it stands between the camera and the Moon, judged by
 * what is on screen, at any camera distance and in both scale modes:
 * - the camera is inside it; or
 * - it is nearer to the camera than the Moon's centre and its disc overlaps the Moon's disc,
 *   with IN_FRONT_MARGIN to spare; or
 * - it is at least IN_FRONT_NEARER nearer than the Moon's centre, larger than the Moon on
 *   screen, and `inView` (any part of it inside the camera's view).
 * `hidden`: whether it is hidden now; then the thresholds widen by IN_FRONT_HYSTERESIS so it
 * stays hidden until clearly out. The overlay shows its name and edge arrow instead.
 * Geometry only, whatever the preset; it holds for the Sun as for Earth. Decoration: it changes
 * no result.
 */
export function bodyInFront(camera: readonly [number, number, number], body: BodyPlacement, inView: boolean, hidden = false): boolean {
  const [cx, cy, cz] = camera;
  const [bx, by, bz] = body.centre;
  const toBody = Math.hypot(bx - cx, by - cy, bz - cz);
  if (toBody <= body.radius) return true;
  const toMoon = Math.hypot(cx, cy, cz);
  if (toMoon <= 1 || toBody >= toMoon) return false;
  const slack = hidden ? 1 + IN_FRONT_HYSTERESIS : 1;
  const bodyAngle = Math.asin(Math.min(1, body.radius / toBody));
  const moonAngle = Math.asin(1 / toMoon);
  const cos = (-(bx - cx) * cx - (by - cy) * cy - (bz - cz) * cz) / (toBody * toMoon);
  const apart = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (apart < (bodyAngle + moonAngle * (1 + IN_FRONT_MARGIN)) * slack) return true;
  const nearer = toBody < toMoon * (1 - IN_FRONT_NEARER / slack);
  return nearer && bodyAngle * slack > moonAngle && inView;
}

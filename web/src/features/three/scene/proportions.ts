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
 * A schematic, not a model: the Moon is the subject, with Earth beside it, a little larger
 * and clearly further out, and the Sun far beyond (the team lead, 2026-11-14). The true
 * values (docs/science.md §1, and the series):
 * - radii: Moon 1,737.4 km; Earth 6,378.137 km (3.67 Moons); Sun 695,700 km (400 Moons,
 *   109 Earths);
 * - distances from the Moon: Earth about 384,400 km (221 Moon radii; 356,000 to 407,000 km
 *   over a month); the Sun about 149.6 million km (86,100 Moon radii, 389 times Earth's).
 *
 * Both mappings increase with the true value, so the order can never invert: a larger body
 * is always drawn larger, a further body always further. Directions are not touched: they
 * come from `system.bin` (computed in Python).
 *
 * To retune, change one constant:
 * - DRAWN_EARTH_RADIUS: 1.2 Moon radii (true 3.67). "Earth a bit smaller" lowers it; it must
 *   stay above 1.
 * - DRAWN_SUN_RADIUS: 3.5 Moon radii (true 400): clearly the largest, three Earths, yet seen
 *   behind the Moon from "From Earth" (around new moon) never more than 1.5 times the Moon.
 * - DISTANCE_EXPONENT: 0.3 draws the Sun 6 times further than Earth (389^0.3). Higher
 *   spreads the two distances apart.
 * - DISTANCE_SCALE: 0.8 puts Earth about 4 Moon radii out (3.95 at perigee to 4.11 at
 *   apogee; it was 2.5 before), which lets the opening view show it whole beside a Moon of
 *   about 72 px at 1440 × 900 (camera.ts, homePose), and the Sun about 24, always outside
 *   the opening view. Larger moves both out ("a bit further") and shrinks the opening Moon.
 */
export const DRAWN_EARTH_RADIUS = 1.2;
export const DRAWN_SUN_RADIUS = 3.5;
export const DISTANCE_EXPONENT = 0.3;
export const DISTANCE_SCALE = 0.8;

/** Earth's greatest distance from the Moon in the series (apogee), in km: the opening view leaves room for it. */
export const EARTH_FARTHEST_KM = 407_000;

/**
 * How far the System view can zoom out, in Moon radii above the surface: just far enough to
 * see the Moon, Earth and the Sun's disc and edge together in a 1024 × 768 window with the
 * panels open. At true scale, 900, far enough for Earth at its real distance.
 */
export const SYSTEM_MAX_ALTITUDE = 380;
export const TRUE_SCALE_MAX_ALTITUDE = 900;

/**
 * A true length the mapping can take: zero, a negative or a non-finite value (a bad record)
 * maps to zero, so it can never put NaN or Infinity into a position.
 */
function usable(km: number): number {
  return Number.isFinite(km) && km > 0 ? km : 0;
}

/**
 * The drawn radius, in Moon radii, of a body `radiusKm` across its radius: a straight line
 * on log-log axes through the Moon (1), Earth (DRAWN_EARTH_RADIUS) and the Sun
 * (DRAWN_SUN_RADIUS), extended past both ends with the end slopes. Both slopes are positive,
 * so it always increases. Zero (or a bad value) gives zero.
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

/** The drawn distance from the Moon's centre, in Moon radii, of a body `distanceKm` away. */
export function drawnDistance(distanceKm: number): number {
  return DISTANCE_SCALE * Math.pow(usable(distanceKm) / MOON_RADIUS_KM, DISTANCE_EXPONENT);
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
 * A body this far or more from side-on, seen from the Moon's centre, counts as in front of the
 * Moon (bodyInFront). In the opening view Earth is always within 7° of side-on (libration), so
 * it is never hidden there.
 */
export const IN_FRONT_ANGLE_DEG = 10;

/**
 * True when a body stands between the camera and the Moon, so drawing it would cover or
 * crowd the subject: its centre lies on the camera's side of the Moon, more than
 * IN_FRONT_ANGLE_DEG away from side-on, and nearer to the camera than the Moon's centre is
 * (or the camera is inside it). The scene then does not draw it, and marks it with an edge
 * arrow and its label instead (overlay.tsx). Geometry only, whatever the preset; it holds for
 * the Sun as for Earth. Decoration: it changes no result.
 */
export function bodyInFront(camera: readonly [number, number, number], body: BodyPlacement): boolean {
  const [cx, cy, cz] = camera;
  const [bx, by, bz] = body.centre;
  const toBody = Math.hypot(bx - cx, by - cy, bz - cz);
  if (toBody <= body.radius) return true;
  const toMoon = Math.hypot(cx, cy, cz);
  const bodyFromMoon = Math.hypot(bx, by, bz);
  if (toMoon < 1e-9 || bodyFromMoon < 1e-9) return false;
  const facing = (bx * cx + by * cy + bz * cz) / (bodyFromMoon * toMoon);
  return facing > Math.sin((IN_FRONT_ANGLE_DEG * Math.PI) / 180) && toBody < toMoon;
}

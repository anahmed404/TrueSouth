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
 * A schematic, not a model: the Moon is the subject, and Earth and the Sun read as far away
 * (the team lead, 2026-11-14). The true values (docs/science.md §1, and the series):
 * - radii: Moon 1,737.4 km; Earth 6,378.137 km (3.67 Moons); Sun 695,700 km (400 Moons,
 *   109 Earths);
 * - distances from the Moon: Earth about 384,400 km (221 Moon radii; 356,000 to 407,000 km
 *   over a month); the Sun about 149.6 million km (86,100 Moon radii, 389 times Earth's).
 *
 * Each is a power below 1 of the true value relative to the Moon, so the order can never
 * invert: a larger body is always drawn larger, a further body always further. Directions
 * are not touched: they come from `system.bin` (computed in Python).
 *
 * To retune, change one constant:
 * - SIZE_EXPONENT: 0.25 draws Earth 1.38 and the Sun 4.47 Moon radii across: just larger
 *   than the Moon, and clearly the largest. Lower makes both smaller ("Earth a bit smaller").
 * - DISTANCE_EXPONENT: 0.3 draws the Sun 6 times further than Earth (389^0.3). Higher
 *   spreads the two distances apart.
 * - DISTANCE_SCALE: 1.35 puts Earth about 6.8 Moon radii out (6.67 at perigee to 6.94 at
 *   apogee), just outside the opening frame in every layout, the widest included (camera.ts,
 *   homePose; three zoom steps show its edge on a laptop), and the Sun about 41. Smaller
 *   brings both in ("a bit closer"), but below about 1.3 a sliver of Earth can show at a
 *   corner of the opening frame.
 */
export const SIZE_EXPONENT = 0.25;
export const DISTANCE_EXPONENT = 0.3;
export const DISTANCE_SCALE = 1.35;

/**
 * How far the System view can zoom out, in Moon radii above the surface: just far enough to
 * see the Moon, Earth and the Sun's disc and edge together in a 1024 × 768 window with the
 * panels open. At true scale, 900, far enough for Earth at its real distance.
 */
export const SYSTEM_MAX_ALTITUDE = 580;
export const TRUE_SCALE_MAX_ALTITUDE = 900;

/**
 * A true length the mapping can take: zero, a negative or a non-finite value (a bad record)
 * maps to zero, so it can never put NaN or Infinity into a position.
 */
function usable(km: number): number {
  return Number.isFinite(km) && km > 0 ? km : 0;
}

/** The drawn radius, in Moon radii, of a body `radiusKm` across its radius. The Moon is 1. */
export function drawnRadius(radiusKm: number): number {
  return Math.pow(usable(radiusKm) / MOON_RADIUS_KM, SIZE_EXPONENT);
}

/** The drawn distance from the Moon's centre, in Moon radii, of a body `distanceKm` away. */
export function drawnDistance(distanceKm: number): number {
  return DISTANCE_SCALE * Math.pow(usable(distanceKm) / MOON_RADIUS_KM, DISTANCE_EXPONENT);
}

export const DRAWN_EARTH_RADIUS = drawnRadius(EARTH_RADIUS_KM);
export const DRAWN_SUN_RADIUS = drawnRadius(SUN_RADIUS_KM);

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
 * How opaque to draw Earth, 0 to 1, from the camera at `camera`: Earth fades to a faint ghost
 * while it stands in front of the Moon's disc (so "From Earth" shows the Moon, not the back of
 * Earth), and is hidden while the camera is inside it. Decoration only.
 */
export function earthOpacity(camera: readonly [number, number, number], earth: BodyPlacement): number {
  const [cx, cy, cz] = camera;
  const ex = earth.centre[0] - cx;
  const ey = earth.centre[1] - cy;
  const ez = earth.centre[2] - cz;
  const toEarth = Math.hypot(ex, ey, ez);
  const toMoon = Math.hypot(cx, cy, cz);
  if (toEarth <= earth.radius) return 0;
  if (toMoon <= 1 || toEarth >= toMoon) return 1;
  const earthAngle = Math.asin(Math.min(1, earth.radius / toEarth));
  const moonAngle = Math.asin(Math.min(1, 1 / toMoon));
  const cos = (-(ex * cx + ey * cy + ez * cz)) / (toEarth * toMoon);
  const apart = Math.acos(Math.max(-1, Math.min(1, cos)));
  // 1 where Earth's disc covers the Moon's centre, 0 once the two discs are clear of each other.
  const t = Math.max(0, Math.min(1, (apart - earthAngle * 0.5) / Math.max(1e-9, earthAngle + moonAngle - earthAngle * 0.5)));
  const cover = 1 - t * t * (3 - 2 * t);
  return 1 - GHOST * cover;
}

/** How much of Earth fades away at most while it covers the Moon: 0.85 leaves a faint 15 % ghost. */
const GHOST = 0.85;

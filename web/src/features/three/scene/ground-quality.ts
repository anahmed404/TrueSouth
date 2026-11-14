/**
 * How much the ground's drawing effects cost (ground-material.ts). Each effect can be set
 * on its own to full, reduced or off, so a quality stage that measures frame time can
 * turn them down. The default is full. Every level only changes how the ground looks:
 * none changes a label, a state or a number.
 */

export type GroundLevel = "full" | "reduced" | "off";

export type GroundQuality = {
  /** Per-pixel relief from the polar cap's slope maps: full adds the ±76 km core at 160 m. */
  relief: GroundLevel;
  /** Shadows drawn by a march over the loaded heights toward the Sun. */
  shadows: GroundLevel;
  /** The illustrative regolith texture close to the camera. */
  grain: GroundLevel;
};

export const GROUND_QUALITY: Record<GroundLevel, GroundQuality> = {
  full: { relief: "full", shadows: "full", grain: "full" },
  reduced: { relief: "reduced", shadows: "reduced", grain: "reduced" },
  off: { relief: "off", shadows: "off", grain: "off" },
};

/** Steps of the shadow march for each level. */
export const SHADOW_STEPS: Record<GroundLevel, number> = { full: 64, reduced: 24, off: 0 };

/**
 * The shader's compile-time switches. A level that is off compiles its code out, so it
 * costs nothing.
 */
export function groundDefines(q: GroundQuality): Record<string, number> {
  const level = (l: GroundLevel) => (l === "full" ? 2 : l === "reduced" ? 1 : 0);
  return {
    GROUND_RELIEF: level(q.relief),
    GROUND_SHADOW_STEPS: SHADOW_STEPS[q.shadows],
    GROUND_GRAIN: level(q.grain),
  };
}

function isLevel(value: string | null): value is GroundLevel {
  return value === "full" || value === "reduced" || value === "off";
}

/**
 * Reads a quality from a query string, for measuring: `ground=reduced` sets every effect,
 * and `ground-shadows=off` (or `ground-relief`, `ground-grain`) sets one. Unknown values are
 * ignored. Returns null when the query names none.
 */
export function groundQualityFromQuery(search: string): GroundQuality | null {
  const params = new URLSearchParams(search);
  const all = params.get("ground");
  let quality: GroundQuality | null = isLevel(all) ? { ...GROUND_QUALITY[all] } : null;
  for (const key of ["relief", "shadows", "grain"] as const) {
    const value = params.get(`ground-${key}`);
    if (isLevel(value)) quality = { ...(quality ?? GROUND_QUALITY.full), [key]: value };
  }
  return quality;
}

/** True when two qualities draw the same. */
export function sameQuality(a: GroundQuality, b: GroundQuality): boolean {
  return a.relief === b.relief && a.shadows === b.shadows && a.grain === b.grain;
}

/*
  Shared pieces of Luna's faces. Her expressions are adapted from a reference sheet the
  team supplied on 2026-11-14: large glossy eyes (a cream white, a dark iris, two
  catch-lights), expressive mouths, a soft blush. Colours are theme tokens via Tailwind
  classes (`--luna-*` in app/theme.css), never literal values.
*/

/** Filled facial features (irises, open mouths). */
export const FEATURE_FILL = "fill-luna-feature";
/** Stroked facial features (smiles, brows, closed eyes). */
export const FEATURE_LINE =
  "fill-none stroke-luna-feature [stroke-linecap:round] [stroke-linejoin:round]";
/** Line weight in viewBox units. Thick enough to read at 28 px. */
export const LINE = 4;
/** The white of an eye, outlined so it holds against her grey face. */
const SCLERA = "fill-luna-sparkle stroke-luna-feature";
/** Catch-lights and sparkles. */
export const GLINT = "fill-luna-sparkle";
/** Cheeks, the tongue and hearts. */
export const BLUSH = "fill-luna-blush";
/** Tears and the music note. */
export const TEAR = "fill-luna-tear";

/** Where her eyes sit. */
export const EYE_X = [37, 63] as const;
export const EYE_Y = 48;

export type EyeProps = {
  /** Half-width and half-height of the eye white. */
  rx?: number;
  ry?: number;
  /** Iris radius. */
  iris?: number;
  /** Where the iris looks, as an offset from the eye's centre. */
  lookX?: number;
  lookY?: number;
  /** Moves both eyes up or down. */
  dy?: number;
};

/**
 * Open glossy eyes: a white, a dark iris and two catch-lights. The catch-lights are part
 * of the eye, so a blink squashes them with it.
 */
export function GlossyEyes({ rx = 7.5, ry = 9, iris = 5.2, lookX = 0, lookY = 0, dy = 0 }: EyeProps) {
  return (
    <>
      {EYE_X.map((cx) => {
        const cy = EYE_Y + dy;
        const ix = cx + lookX;
        const iy = cy + lookY;
        return (
          <g key={cx}>
            <ellipse className={SCLERA} cx={cx} cy={cy} rx={rx} ry={ry} strokeWidth={2} />
            <circle className={FEATURE_FILL} cx={ix} cy={iy} r={iris} />
            <circle className={GLINT} cx={ix + iris * 0.35} cy={iy - iris * 0.4} r={iris * 0.38} />
            <circle className={GLINT} cx={ix - iris * 0.4} cy={iy + iris * 0.42} r={iris * 0.17} />
          </g>
        );
      })}
    </>
  );
}

/** Two soft cheeks, clear of the craters. */
export function Blush() {
  return (
    <>
      <ellipse className={BLUSH} cx={31} cy={61} rx={4.8} ry={2.9} />
      <ellipse className={BLUSH} cx={69} cy={61} rx={4.8} ry={2.9} />
    </>
  );
}

/** A four-point sparkle centred on (x, y). */
export function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <path
      className={GLINT}
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
    />
  );
}

/** A small heart centred on (x, y), `s` viewBox units across its widest half. */
export function Heart({ x, y, s, tilt = 0 }: { x: number; y: number; s: number; tilt?: number }) {
  return (
    <path
      className={BLUSH}
      transform={`translate(${x} ${y}) rotate(${tilt}) scale(${s})`}
      d="M0 1 C-1.7 -0.1 -1 -1.45 0 -0.55 C1 -1.45 1.7 -0.1 0 1 Z"
    />
  );
}

/*
  Shared bits for the placeholder art. Colours are theme tokens via Tailwind classes.
  Placeholder only: replaced with the rest of this folder in work package A10.
*/

/** Filled facial features (pupils, open mouths). */
export const FEATURE_FILL = "fill-background";
/** Stroked facial features (smiles, brows, closed eyes). */
export const FEATURE_LINE =
  "fill-none stroke-background [stroke-linecap:round] [stroke-linejoin:round]";
/** Line weight in viewBox units. Thick enough to read at 48 px. */
export const LINE = 4;

export function RoundEyes({ r = 5.5, dx = 0, dy = 0 }: { r?: number; dx?: number; dy?: number }) {
  return (
    <>
      <circle className={FEATURE_FILL} cx={38 + dx} cy={48 + dy} r={r} />
      <circle className={FEATURE_FILL} cx={62 + dx} cy={48 + dy} r={r} />
    </>
  );
}

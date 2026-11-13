/**
 * Pip, the story's small lander: an original drawing, lit from the right.
 * Draw it inside an SVG at (x, y) with a scale. Decorative: the text beside it names it.
 */
export function PipGlyph({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <path d="M-14 22 L-8 8 M14 22 L8 8 M0 22 L0 10" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" />
      <rect x="-11" y="-4" width="22" height="14" rx="3" fill="var(--accent)" />
      <rect x="1" y="-4" width="10" height="14" rx="2" fill="var(--sun)" fillOpacity="0.55" />
      <rect x="-26" y="-1" width="13" height="7" rx="1.5" fill="var(--ink-4)" />
      <rect x="13" y="-1" width="13" height="7" rx="1.5" fill="var(--ink-4)" />
      <path d="M0 -4 L0 -12" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx="0" cy="-13" r="2.4" fill="var(--earth)" />
    </g>
  );
}

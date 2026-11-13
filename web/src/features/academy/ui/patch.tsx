import type { ReactNode } from "react";
import { PATCH_SHELF } from "../catalog";

/**
 * Mission patches: a round porthole badge with a line glyph.
 * Earned: a solid ring and full colour. Not yet: a dashed ring and a faint outline.
 * The nine glyphs follow the designer's notes (design/variants/c2-academy.md).
 */

type Ink = { stroke: string; fill: (colour: string) => string };

const GLYPHS: readonly ((ink: Ink) => ReactNode)[] = [
  // 1 Sun Chaser: the Sun circling a flat horizon.
  ({ stroke, fill }) => (
    <>
      <path d="M14 40 H50" stroke={stroke} />
      <ellipse cx="32" cy="40" rx="15" ry="5" stroke={stroke} strokeDasharray="1.5 3.5" />
      <circle cx="41" cy="36.5" r="5" fill={fill("var(--sun)")} stroke="none" />
    </>
  ),
  // 2 Skyline Sketcher: a ridge with the Sun behind it.
  ({ stroke, fill }) => (
    <>
      <circle cx="38" cy="30" r="5.5" fill={fill("var(--sun)")} stroke="none" />
      <path d="M13 44 L22 34 L28 38 L35 27 L43 37 L51 33 V46 H13Z" fill="var(--surface)" stroke={stroke} />
    </>
  ),
  // 3 Horizon Hunter: the curved ground under a level line.
  ({ stroke }) => (
    <>
      <path d="M12 46 Q32 28 52 46" stroke={stroke} />
      <path d="M27 33.5 L31 27 L35 33" stroke={stroke} />
      <path d="M12 30 H52" stroke={stroke} strokeDasharray="2 3" />
    </>
  ),
  // 4 Signal Keeper: Earth rising with radio arcs.
  ({ stroke, fill }) => (
    <>
      <path d="M14 42 H50" stroke={stroke} />
      <path d="M24 42 A8 8 0 0 1 40 42" fill={fill("var(--earth)")} stroke="none" />
      <path d="M22 30 A13 13 0 0 1 42 30 M26 25 A19 19 0 0 1 38 25" stroke={stroke} />
    </>
  ),
  // 5 Steady Feet: a lander on flat ground.
  ({ stroke }) => (
    <>
      <path d="M14 44 H50" stroke={stroke} />
      <rect x="25" y="25" width="14" height="10" rx="2" stroke={stroke} />
      <path d="M27 35 L22 44 M37 35 L42 44 M32 35 V44" stroke={stroke} />
    </>
  ),
  // 6 Decision Maker: a balance.
  ({ stroke }) => (
    <>
      <path d="M32 20 V44 M24 44 H40 M18 28 H46" stroke={stroke} />
      <path d="M14 38 L18 28 L22 38 Z M42 38 L46 28 L50 38 Z" stroke={stroke} />
    </>
  ),
  // 7 Time Bender: a calendar with a turning arrow.
  ({ stroke }) => (
    <>
      <rect x="19" y="21" width="26" height="24" rx="3" stroke={stroke} />
      <path d="M19 28 H45 M25 18 V24 M39 18 V24" stroke={stroke} />
      <path d="M26 38 a6 6 0 1 0 6-6" stroke={stroke} />
    </>
  ),
  // 8 Mission Planner: a target with a map pin.
  ({ stroke, fill }) => (
    <>
      <circle cx="32" cy="33" r="13" stroke={stroke} />
      <circle cx="32" cy="33" r="6" stroke={stroke} strokeDasharray="1.5 2.5" />
      <path
        d="M38 21 a5 5 0 0 1 5 5 c0 4 -5 8 -5 8 s-5-4-5-8 a5 5 0 0 1 5-5z"
        fill={fill("var(--accent)")}
        stroke={stroke}
      />
    </>
  ),
  // 9 True South: a compass needle pointing to the pole.
  ({ stroke, fill }) => (
    <>
      <circle cx="32" cy="32" r="14" stroke={stroke} />
      <path d="M32 18 L36 32 L32 46 L28 32Z" fill={fill("var(--ink)")} stroke="none" />
      <path d="M32 32 L36 32 L32 46Z" fill={fill("var(--ink-3)")} stroke="none" />
    </>
  ),
];

/** A plain ring with a dot, for a patch outside the nine (the sample lesson's). */
const GENERIC_GLYPH = ({ stroke }: Ink) => (
  <>
    <circle cx="32" cy="32" r="12" stroke={stroke} />
    <circle cx="32" cy="32" r="3" fill={stroke} stroke="none" />
  </>
);

/** The glyph index for a patch id: its place on the shelf, or -1 for any other. */
export function patchIndex(id: string): number {
  return PATCH_SHELF.findIndex((patch) => patch.id === id);
}

type MissionPatchProps = {
  /** A lesson id, "all-eight" for True South, or any other id for a generic patch. */
  id: string;
  earned: boolean;
  size?: number;
  /** The patch's name, read by screen readers. Leave unset when text beside it says so. */
  label?: string;
  className?: string;
};

export function MissionPatch({ id, earned, size = 64, label, className }: MissionPatchProps) {
  const index = patchIndex(id);
  const glyph = index >= 0 ? GLYPHS[index] : undefined;
  const ink: Ink = {
    stroke: earned ? "var(--ink)" : "var(--line-strong)",
    fill: (colour) => (earned ? colour : "none"),
  };
  const a11y = label
    ? { role: "img" as const, "aria-label": `${label} patch, ${earned ? "earned" : "not earned yet"}` }
    : { "aria-hidden": true as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} {...a11y}>
      {earned ? (
        <>
          <circle cx="32" cy="32" r="30" fill="var(--raised)" stroke="var(--ink-2)" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--line-strong)" />
        </>
      ) : (
        <circle cx="32" cy="32" r="30" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="3 4" />
      )}
      <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {glyph ? glyph(ink) : GENERIC_GLYPH(ink)}
      </g>
    </svg>
  );
}

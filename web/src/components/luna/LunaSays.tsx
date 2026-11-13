import type { ReactNode } from "react";
import { Luna } from "./Luna";
import type { Mood } from "./moods";

export type LunaSaysProps = {
  mood?: Mood;
  /** Luna's line. One idea, two short sentences at most (docs/academy/luna.md). */
  children: ReactNode;
  /** Luna's size in px. */
  size?: number;
  reduceMotion?: boolean;
  /**
   * Announce changes to the line to screen readers as they happen. Turn on for the
   * one bubble that speaks as the learner moves through steps, not for every bubble.
   */
  announce?: boolean;
  className?: string;
};

/**
 * Luna with a speech bubble. Placeholder styling, theme tokens only; restyled once the
 * Academy's look is chosen. The bubble shrinks and wraps to fit any width down to a
 * narrow phone column, breaking long words if it must.
 */
export function LunaSays({
  mood = "happy",
  children,
  size = 72,
  reduceMotion,
  announce = false,
  className,
}: LunaSaysProps) {
  // The tail points at Luna's middle, but never lower than the bubble's first line.
  const tailTop = Math.min(size / 2, 28) - 6;
  return (
    <div
      className={["flex w-full min-w-0 items-start gap-3", className].filter(Boolean).join(" ")}
    >
      <Luna mood={mood} size={size} reduceMotion={reduceMotion} className="shrink-0" />
      <div className="relative min-w-0 flex-1">
        <span
          aria-hidden="true"
          className="absolute -left-[6px] h-3 w-3 rotate-45 border-b border-l border-border bg-surface-2"
          style={{ top: tailTop }}
        />
        <div
          className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-base leading-snug text-text [hyphens:auto] [overflow-wrap:anywhere]"
          aria-live={announce ? "polite" : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

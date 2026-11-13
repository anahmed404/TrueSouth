import { Check, Eye, RotateCcw } from "lucide-react";

/**
 * The Academy's "right" mark: a bare GO-green check with a word. It is a mark, not a
 * status lamp, so it is never a filled disc.
 */
export function CorrectMark({ label = "Correct", showLabel = true }: { label?: string; showLabel?: boolean }) {
  return (
    <span className="ac-correct">
      <Check aria-hidden="true" />
      {showLabel ? <span>{label}</span> : <span className="ac-visually-hidden">{label}</span>}
    </span>
  );
}

/** A grey ring with an eye: the answer had to be shown. */
export function ShownMark() {
  return (
    <span className="ac-ring" aria-hidden="true">
      <Eye />
    </span>
  );
}

/** A grey ring with a retry arrow: a miss, try again. */
export function RetryMark() {
  return (
    <span className="ac-ring" aria-hidden="true">
      <RotateCcw />
    </span>
  );
}

const STAR_PATH =
  "M12 2.8l2.75 5.75 6.3.8-4.6 4.35 1.15 6.25L12 16.9l-5.6 3.05 1.15-6.25L2.95 9.35l6.3-.8z";

/** Three stars: filled Ink when earned, an outline when not. */
export function Stars({ count, size = 18, label = true }: { count: number; size?: number; label?: boolean }) {
  const a11y = label ? { role: "img" as const, "aria-label": `${count} of 3 stars` } : { "aria-hidden": true as const };
  return (
    <span className="ac-stars" {...a11y}>
      {[0, 1, 2].map((index) => (
        <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={STAR_PATH}
            fill={index < count ? "var(--ink)" : "none"}
            stroke={index < count ? "var(--ink)" : "var(--line-strong)"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export { STAR_PATH };

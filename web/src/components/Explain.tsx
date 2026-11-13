import { ArrowRight, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { explanations } from "../lib/explain";
import { Tip } from "./Tip";

type ExplainProps = {
  /** A key of `web/src/lib/explain.ts`, for example "antenna_mask". */
  term: string;
  /** The label the icon belongs to. Without it, only the info icon is drawn. */
  children?: ReactNode;
  /** The name read by screen readers, when `children` is not plain text. */
  label?: string;
};

/** "longest_blackout_h" → "longest blackout". */
function readableTerm(term: string): string {
  return term
    .replace(/_(h|deg|m)$/, "")
    .split("_")
    .join(" ");
}

function lessonNumber(lesson: string): string {
  const match = /^l(\d+)_/.exec(lesson);
  return match ? match[1] ?? lesson : lesson;
}

/**
 * An info icon that opens the term's plain-language text from `explain.ts`, and, when the
 * entry has one, a link to the Academy lesson that teaches it.
 *
 * `<Explain term="antenna_mask" />` draws the icon alone.
 * `<Explain term="antenna_mask">Antenna mask</Explain>` draws the label, then the icon.
 * An unknown term draws only its label.
 */
export function Explain({ term, children, label }: ExplainProps) {
  const entry = explanations[term];
  if (!entry) return children ? <>{children}</> : null;

  const name = label ?? (typeof children === "string" ? children : readableTerm(term));
  const lesson = entry.lesson;

  const tip = (
    <Tip
      // Always interactive, so a tap opens and pins the explanation on a touch screen,
      // where there is no hover. A term with no lesson simply has no link inside.
      interactive
      content={
        <>
          <span>{entry.text}</span>
          {entry.controls ? <span className="tip-meta">{entry.controls}</span> : null}
          {lesson ? (
            <Link to={`/academy/${lesson}`} className="tip-link">
              Learn it in Academy lesson {lessonNumber(lesson)}
              <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : null}
        </>
      }
    >
      {(trigger) => (
        <button {...trigger} type="button" className="explain-button" aria-label={`About ${name}`}>
          <Info size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </Tip>
  );

  if (!children) return tip;
  return (
    <span className="explain">
      {children}
      {tip}
    </span>
  );
}

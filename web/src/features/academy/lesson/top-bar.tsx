import { Antenna, ArrowRight, Sun, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useLiveValue, type LiveValue } from "../live-value";
import type { ProgressMark } from "../review";

/** Antenna with a slash: Pip has no link to Earth. */
function AntennaOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12 7 2M7 12l5-10M12 12l5-10M17 12l5-10M4.5 7h15M12 16v6" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Pip's two meters: power (Sun glyph, % and a Sun-cream bar) and the link to Earth. */
export function PipMeters({ power, link }: { power?: number; link?: boolean }) {
  return (
    <div className="ac-pip" role="group" aria-label="Pip's meters">
      <span className="ac-pip-name" aria-hidden="true">
        Pip
      </span>
      {power !== undefined ? (
        <span className="ac-meter" role="img" aria-label={`Pip's power: ${Math.round(power)}%`}>
          <Sun aria-hidden="true" />
          <b aria-hidden="true">{Math.round(power)}%</b>
          <span className="ac-meter-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, power))}%` }} />
          </span>
        </span>
      ) : null}
      {link !== undefined ? (
        <span className={link ? "ac-meter ac-meter--link" : "ac-meter"}>
          {link ? <Antenna aria-hidden="true" /> : <AntennaOff />}
          <b>{link ? "Link" : "Blackout"}</b>
        </span>
      ) : null}
    </div>
  );
}

/** Pip's meters, with the power following a live value when there is one. Only this re-renders with it. */
function LivePipMeters({ pip, live }: { pip: { power?: number; link?: boolean } | null; live: LiveValue<number | null> }) {
  const power = useLiveValue(live);
  if (power === null && !pip) return <span />;
  return <PipMeters power={power ?? pip?.power} link={pip?.link} />;
}

/**
 * The progress marks, one per step. A finished step's mark is a button that opens it for
 * review; while one is shown, the current step's mark goes back to it. A step not yet
 * reached is a plain mark, never a control. The row still reads as progress at a glance:
 * the buttons look exactly like the marks, with a taller hit area and a focus ring.
 */
function ProgressMarks({ marks, onMark }: { marks: readonly ProgressMark[]; onMark: (index: number) => void }) {
  return (
    <ol className="ac-prog" aria-label="Lesson steps">
      {marks.map((mark) => (
        <li key={mark.index}>
          {mark.control ? (
            <button
              type="button"
              className="ac-prog-mark"
              data-state={mark.state}
              aria-label={mark.label}
              title={mark.state === "done" ? `Review step ${mark.index + 1}` : `Back to step ${mark.index + 1}`}
              onClick={() => onMark(mark.index)}
            >
              <i aria-hidden="true" />
            </button>
          ) : (
            <span className="ac-prog-mark" data-state={mark.state} data-shown={mark.shown || undefined} aria-current={mark.shown ? "step" : undefined}>
              <i aria-hidden="true" />
              <span className="ac-visually-hidden">{mark.label}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

type LessonTopBarProps = {
  title: string;
  stepIndex: number;
  stepCount: number;
  /** One mark per step: finished steps are buttons that open them for review. */
  marks: readonly ProgressMark[];
  /** The finished step on screen for review, or null. */
  reviewing: number | null;
  onMark: (index: number) => void;
  pip: { power?: number; link?: boolean } | null;
  /** Pip's power while a step drives it live (the dragged Sun's disc fraction), or null. */
  livePower?: LiveValue<number | null>;
  onClose: () => void;
  onSkip: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/** Close, progress, "Step n of N", Pip's meters and the skip link. */
export function LessonTopBar({ title, stepIndex, stepCount, marks, reviewing, onMark, pip, livePower, onClose, onSkip }: LessonTopBarProps) {
  return (
    <header className="ac-lt">
      <div className="ac-lt-a">
        <button type="button" className="ac-icon-btn" aria-label="Leave the lesson" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <h1 className="ac-lt-title">{title}</h1>
        <ProgressMarks marks={marks} onMark={onMark} />
        <span className="ac-stepn" aria-live="polite">
          {reviewing !== null ? `Reviewing step ${reviewing + 1} of ${stepCount}` : `Step ${stepIndex + 1} of ${stepCount}`}
        </span>
      </div>
      <div className="ac-lt-b">
        {livePower ? <LivePipMeters pip={pip} live={livePower} /> : pip ? <PipMeters power={pip.power} link={pip.link} /> : <span />}
        <a className="ac-quiet" href="/mission" onClick={onSkip}>
          Skip to Mission Control
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

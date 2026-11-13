import type { KeyboardEvent, ReactNode } from "react";
import type { OptionView } from "../step-view";
import { CorrectMark, ShownMark } from "./marks";

/**
 * Which option in a radio group is in the tab order. A group is one tab stop: the checked
 * option if there is one, otherwise the first option that can still be picked. The arrow
 * keys move between the rest. Returns -1 when no option can take focus.
 */
export function optionTabStop(views: readonly OptionView[], checkedIndex?: number): number {
  const checked =
    checkedIndex !== undefined && checkedIndex >= 0
      ? checkedIndex
      : views.findIndex((view) => view.state === "selected" || view.state === "answer");
  if (checked >= 0) return checked;
  return views.findIndex((view) => view.state !== "missed");
}

type AnswerOptionProps = {
  index: number;
  view: OptionView;
  /** This option is the group's one tab stop (see `optionTabStop`). */
  tabStop: boolean;
  /** The group is answered: no option can be picked. */
  locked: boolean;
  onPick: (index: number) => void;
  children: ReactNode;
};

/**
 * One answer: a number keycap, the label and a note.
 * States: default, selected, missed (dashed and crossed out), answer, dimmed.
 * A `role="radio"` inside an `OptionGroup`.
 */
export function AnswerOption({ index, view, tabStop, locked, onPick, children }: AnswerOptionProps) {
  const checked = view.state === "selected" || view.state === "answer";
  const disabled = locked || view.state === "missed";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className="ac-opt"
      data-state={view.state}
      data-ac-option={index}
      tabIndex={tabStop ? 0 : -1}
      onClick={() => {
        if (!disabled) onPick(index);
      }}
    >
      <span className="ac-opt-key" aria-hidden="true">
        {index + 1}
      </span>
      <span className="ac-opt-label">{children}</span>
      {view.note ? (
        <span className="ac-opt-note">
          {view.state === "answer" ? (view.correct ? <CorrectMark showLabel={false} /> : <ShownMark />) : null}
          {view.note}
        </span>
      ) : null}
    </button>
  );
}

type OptionGroupProps = {
  label: string;
  views: readonly OptionView[];
  locked: boolean;
  onPick: (index: number) => void;
  className?: string;
  answered?: boolean;
  children: ReactNode;
};

/**
 * A `role="radiogroup"` of options. The arrow keys move to the next option that can still
 * be picked, and pick it.
 */
export function OptionGroup({ label, views, locked, onPick, className, answered, children }: OptionGroupProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !back) return;
    const target = event.target as HTMLElement;
    const current = Number(target.closest<HTMLElement>("[data-ac-option]")?.dataset.acOption ?? -1);
    const count = views.length;
    for (let step = 1; step <= count; step += 1) {
      const next = (current + (forward ? step : -step) + count * 2) % count;
      if (views[next]?.state !== "missed") {
        event.preventDefault();
        onPick(next);
        const group = event.currentTarget;
        requestAnimationFrame(() => group.querySelector<HTMLElement>(`[data-ac-option="${next}"]`)?.focus());
        return;
      }
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={className} data-answered={answered} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

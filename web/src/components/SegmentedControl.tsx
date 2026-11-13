import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./format";

export type SegmentOption<Value extends string = string> = {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedControlProps<Value extends string> = {
  /** What is being chosen, read by screen readers, for example "Centre on". */
  label: string;
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * accent: the selected option is filled moonlight (only for the mode switch's kind of
   * choice). quiet: a --hover fill, for controls inside a view.
   */
  tone?: "quiet" | "accent";
  className?: string;
};

/**
 * One choice out of a few, in a pill (a radio group). Arrow keys move the choice, as in a
 * native radio group; Tab enters and leaves the group as one stop.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
  tone = "quiet",
  className,
}: SegmentedControlProps<Value>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((option) => option.value === value);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else return;
    event.preventDefault();
    const option = enabled[next];
    if (!option) return;
    onChange(option.value);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(option.value)}"]`)?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={cx("seg", tone === "accent" ? "seg-accent" : "seg-quiet", className)}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            data-value={option.value}
            disabled={option.disabled}
            tabIndex={checked ? 0 : -1}
            className="seg-option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

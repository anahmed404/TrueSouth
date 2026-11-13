import type { ReactNode } from "react";
import { fillPlaceholders, type WorkedExamples } from "../placeholders";
import { MISSING_TEXT, PENDING_TEXT } from "../card/tex";

/**
 * Lesson text with its `{{example.key}}` placeholders filled from the worked examples.
 * A missing key stays visible as its token, so a gap in the data is never hidden.
 */
export function Filled({ value, examples }: { value: string; examples: WorkedExamples }) {
  return <>{fillPlaceholders(value, examples).text}</>;
}

export function filledText(value: string, examples: WorkedExamples): string {
  return fillPlaceholders(value, examples).text;
}

type FillChipProps =
  | { state?: "filled"; children: ReactNode }
  | { state: "missing" | "pending"; children?: never };

/**
 * The designer's `Fill` chip: a number filled in from `worked_examples.json`, boxed so a
 * learner can see it is real data. A key the file does not have yet draws a dashed chip
 * that says "value not built yet"; while the file loads it says "loading".
 */
export function FillChip(props: FillChipProps) {
  if (props.state === "missing") return <span className="ac-fill ac-fill--missing">{MISSING_TEXT}</span>;
  if (props.state === "pending") return <span className="ac-fill ac-fill--missing" data-pending="true">{PENDING_TEXT}</span>;
  return <span className="ac-fill">{props.children}</span>;
}

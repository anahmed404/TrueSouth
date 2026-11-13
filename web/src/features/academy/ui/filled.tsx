import { fillPlaceholders, type WorkedExamples } from "../placeholders";

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

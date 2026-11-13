/**
 * How a drag of the scrubber writes history: one drag adds exactly one entry, at its first
 * change of hour, and replaces that entry for every later change. A drag that never
 * changes the hour (a click on the knob, a press on the current hour) adds none.
 */

export type DragState = {
  /** Whether this drag has already added its history entry. */
  pushed: boolean;
  /** The hour last written (or the current hour when the drag began). */
  last: number;
};

export function dragStart(current: number): DragState {
  return { pushed: false, last: current };
}

/** The write for the hour under the pointer, or null when the hour has not changed. */
export function dragStep(state: DragState, hour: number): { write: "push" | "replace"; next: DragState } | null {
  if (hour === state.last) return null;
  return { write: state.pushed ? "replace" : "push", next: { pushed: true, last: hour } };
}

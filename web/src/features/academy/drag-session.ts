/**
 * The drag-body step's one rule for time: **the hour on screen is the hour "Check" judges.**
 *
 * A drag (on the body or on the time bar) moves the hour on screen; the lesson's draft, which
 * "Check" submits, is set when the drag ends. However it ends (the pointer is lifted, the
 * browser cancels it, capture is lost, the window loses focus or the tab is hidden) the hour
 * on screen is committed, so the two can never differ once the drag is over. A key press
 * moves and commits at once. Pure, so the rule is tested without a browser.
 */

export type HourDrag = {
  /** The pointer dragging, or null when no drag is under way. */
  pointer: number | null;
  /** The hour on screen. */
  shown: number;
  /** The hour last sent to the lesson as its draft: the one "Check" judges. */
  committed: number;
};

export function idleDrag(hour: number): HourDrag {
  return { pointer: null, shown: hour, committed: hour };
}

/** A pointer goes down on the body or the bar. A second pointer is ignored. */
export function beginDrag(state: HourDrag, pointer: number): HourDrag {
  if (state.pointer !== null) return state;
  return { ...state, pointer };
}

/** The dragging pointer moves to an hour. Other pointers are ignored. */
export function moveDrag(state: HourDrag, pointer: number, hour: number): HourDrag {
  if (state.pointer !== pointer || state.shown === hour) return state;
  return { ...state, shown: hour };
}

/**
 * The drag ends, by any route. `pointer` is the pointer that ended it, or null for the
 * window losing focus or the tab being hidden, which end any drag. The hour on screen is
 * committed.
 */
export function endDrag(state: HourDrag, pointer: number | null): HourDrag {
  if (state.pointer === null) return state;
  if (pointer !== null && pointer !== state.pointer) return state;
  return { pointer: null, shown: state.shown, committed: state.shown };
}

/** A key press, or the lesson setting the hour: moves and commits at once. */
export function setHourNow(state: HourDrag, hour: number): HourDrag {
  return { pointer: state.pointer, shown: hour, committed: hour };
}

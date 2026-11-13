/**
 * The focus and Escape rules of a floating window (docs/features/mission-control.md,
 * "Floating windows" and "Keyboard use"), as plain functions so they can be tested without
 * a browser.
 */

/** Anything that can take focus: an element, or a stand-in in a test. */
export type Focusable = { focus: (options?: FocusOptions) => void; isConnected: boolean };

/**
 * What the Escape key closes, in the spec's order: an open popover or tooltip first (they
 * close themselves), then the open window. Nothing when a text field has the key, so typing
 * is never interrupted.
 */
export function escapeCloses(state: {
  popoverOpen: boolean;
  tipOpen: boolean;
  windowOpen: boolean;
  inEditableField: boolean;
}): "nothing" | "popover" | "window" {
  if (state.popoverOpen || state.tipOpen) return "popover";
  if (state.inEditableField) return "nothing";
  if (state.windowOpen) return "window";
  return "nothing";
}

/**
 * Where focus goes when a window opens: its first control (the close button), or the window
 * itself. Focus moves in, so a keyboard user lands in what they opened.
 */
export function focusOnOpen(firstControl: Focusable | null, windowElement: Focusable | null): Focusable | null {
  if (firstControl?.isConnected) return firstControl;
  if (windowElement?.isConnected) return windowElement;
  return null;
}

/**
 * Where focus goes when a window closes, or null to leave it where it is.
 *
 * - Closed by the user, with Escape or the close button: focus returns to the window's
 *   button in the view bar, the button that opened it.
 * - Closed some other way (another view picked, Back pressed): focus returns there only if it
 *   was inside the window or was lost with it. If the user clicked something else, focus
 *   stays on what they clicked.
 *
 * A button that has left the page (a resize can move the view bar) cannot take focus.
 */
export function focusAfterClose(state: {
  closedByUser: boolean;
  focusWasInWindow: boolean;
  focusIsLost: boolean;
  button: Focusable | null;
}): Focusable | null {
  if (!state.closedByUser && !state.focusWasInWindow && !state.focusIsLost) return null;
  if (state.button?.isConnected) return state.button;
  return null;
}

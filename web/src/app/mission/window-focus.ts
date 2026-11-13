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
 * Where focus goes when a window opens: the window itself, which is labelled by its title and
 * described by its sentence, so a screen reader reads both, and Tab then reaches its close
 * button. Focusing the close button instead would open its tooltip, and the first Escape
 * would close only that. If the window cannot take focus, its first control does.
 */
export function focusOnOpen(windowElement: Focusable | null, firstControl: Focusable | null): Focusable | null {
  if (windowElement?.isConnected) return windowElement;
  if (firstControl?.isConnected) return firstControl;
  return null;
}

/**
 * Where focus goes when a window closes, or null to leave it where it is.
 *
 * - Closed by the user, with Escape or the close button: focus returns to the window's
 *   button in the view bar, the button that opened it.
 * - Closed some other way (another view or window picked, Back pressed): focus returns there
 *   only if it was lost with the window. If it is already somewhere (the button the user
 *   clicked, or the window that replaced this one), it stays.
 *
 * A button that has left the page (a resize can move the view bar) cannot take focus.
 */
export function focusAfterClose(state: { closedByUser: boolean; focusIsLost: boolean; button: Focusable | null }): Focusable | null {
  if (!state.closedByUser && !state.focusIsLost) return null;
  if (state.button?.isConnected) return state.button;
  return null;
}

/**
 * Whether Lander's eye's horizon chart is open in Mission Control (docs/features/panorama.md,
 * "What is behind and what floats above"). Closed by default, so the 3D horizon has the room.
 *
 * View state, like the shell's folded panels (app/mission/shell-layout.ts): never in the
 * scenario or the shareable link, read and saved through a storage that may be missing or
 * throw. Unlike those panels it is kept for the session only (sessionStorage): a reload in the
 * same tab keeps the choice, and a fresh visit starts with the chart closed again.
 */

/** Session-storage key. Bump the version if the stored value changes. */
export const CHART_FOLD_KEY = "truesouth.landers-eye-chart.v1";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

/** The remembered choice: open only when "open" was saved; anything else is the default, closed. */
export function loadChartOpen(storage: ReadableStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(CHART_FOLD_KEY) === "open";
  } catch {
    return false;
  }
}

/** Saves the choice. A storage that throws is ignored: the toggle still works, unsaved. */
export function saveChartOpen(storage: WritableStorage | null | undefined, open: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(CHART_FOLD_KEY, open ? "open" : "closed");
  } catch {
    // Storage full or blocked: keep going without remembering.
  }
}

/** The browser's session storage, or null where there is none or it throws (private mode). */
export function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The toggle's accessible name: what pressing it does. */
export function toggleName(open: boolean): string {
  return open ? "Hide the horizon chart" : "Show the horizon chart";
}

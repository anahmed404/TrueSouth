/**
 * The Mission Control shell's view state: which side panels are collapsed, and whether the
 * timeline is folded to one row.
 *
 * This is view state, not part of the scenario. It is not in the URL and does not go into
 * a shared link. It is remembered in the browser's local storage across reloads.
 */

export type ShellPanel = "sitesRail" | "focusPanel" | "timeline";

/** The two side panels, which have keyboard shortcuts. */
export type SidePanel = Exclude<ShellPanel, "timeline">;

export type ShellLayout = Readonly<Record<ShellPanel, { collapsed: boolean }>>;

export const SHELL_PANELS: readonly ShellPanel[] = ["sitesRail", "focusPanel", "timeline"];

const SIDE_PANELS: readonly SidePanel[] = ["sitesRail", "focusPanel"];

export const DEFAULT_SHELL_LAYOUT: ShellLayout = {
  sitesRail: { collapsed: false },
  focusPanel: { collapsed: false },
  timeline: { collapsed: false },
};

/** Local-storage key. Bump the version if the stored shape changes. */
export const SHELL_STORAGE_KEY = "truesouth.shell.v1";

/** Keyboard shortcuts: "[" folds the left panel, "]" the right one. */
export const SHELL_SHORTCUTS: Readonly<Record<SidePanel, string>> = {
  sitesRail: "[",
  focusPanel: "]",
};

export function toggleShellPanel(layout: ShellLayout, panel: ShellPanel): ShellLayout {
  return { ...layout, [panel]: { collapsed: !layout[panel].collapsed } };
}

export function setShellPanel(layout: ShellLayout, panel: ShellPanel, collapsed: boolean): ShellLayout {
  if (layout[panel].collapsed === collapsed) return layout;
  return { ...layout, [panel]: { collapsed } };
}

/** Reads a stored layout. Anything unreadable falls back to the default, per panel. */
export function parseShellLayout(raw: string | null | undefined): ShellLayout {
  if (!raw) return DEFAULT_SHELL_LAYOUT;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SHELL_LAYOUT;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_SHELL_LAYOUT;
  const record = data as Record<string, unknown>;
  const read = (panel: ShellPanel) => {
    const entry = record[panel];
    if (typeof entry === "object" && entry !== null && typeof (entry as { collapsed?: unknown }).collapsed === "boolean") {
      return { collapsed: (entry as { collapsed: boolean }).collapsed };
    }
    return DEFAULT_SHELL_LAYOUT[panel];
  };
  return { sitesRail: read("sitesRail"), focusPanel: read("focusPanel"), timeline: read("timeline") };
}

export function serializeShellLayout(layout: ShellLayout): string {
  return JSON.stringify({
    sitesRail: { collapsed: layout.sitesRail.collapsed },
    focusPanel: { collapsed: layout.focusPanel.collapsed },
    timeline: { collapsed: layout.timeline.collapsed },
  });
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

/** Loads the layout. Storage that is missing or throws (private mode) gives the default. */
export function loadShellLayout(storage: ReadableStorage | null | undefined): ShellLayout {
  if (!storage) return DEFAULT_SHELL_LAYOUT;
  try {
    return parseShellLayout(storage.getItem(SHELL_STORAGE_KEY));
  } catch {
    return DEFAULT_SHELL_LAYOUT;
  }
}

/** Saves the layout. A storage that throws is ignored: the layout still works, unsaved. */
export function saveShellLayout(storage: WritableStorage | null | undefined, layout: ShellLayout): void {
  if (!storage) return;
  try {
    storage.setItem(SHELL_STORAGE_KEY, serializeShellLayout(layout));
  } catch {
    // Storage full or blocked: keep going without remembering.
  }
}

/** Names for the three folding panels, as the announcements and toggles say them. */
const PANEL_NAMES: Readonly<Record<ShellPanel, string>> = {
  sitesRail: "Sites rail",
  focusPanel: "Focused-site panel",
  timeline: "Timeline",
};

/**
 * The sentence a screen reader hears when a panel folds or opens. The toggle's
 * `aria-expanded` says it when the toggle is pressed; this covers the `[` and `]` keys,
 * which fold a panel without focusing its toggle.
 */
export function foldAnnouncement(panel: ShellPanel, collapsed: boolean): string {
  return `${PANEL_NAMES[panel]} ${collapsed ? "folded" : "open"}.`;
}

/**
 * The widths the floating layout uses, in CSS pixels (DESIGN.md, "Layout"). They match the
 * `--shell-*` and `--float-gap` tokens in theme.css.
 */
export const FLOAT_SIZES = {
  gap: 16,
  rail: 256,
  focus: 328,
  slim: 48,
  /** The view bar's width with its six entries, at the C2 type sizes. */
  viewBar: 640,
} as const;

/**
 * Whether the view bar and its sentence fit between the two side panels. When they do not
 * (a 1,024 px window with both panels open), they sit above the side panels instead, across
 * the whole width, so nothing overlaps or clips.
 */
export function viewBarFitsBetween(viewportWidth: number, layout: ShellLayout): boolean {
  const { gap, rail, focus, slim, viewBar } = FLOAT_SIZES;
  const left = layout.sitesRail.collapsed ? slim : rail;
  const right = layout.focusPanel.collapsed ? slim : focus;
  const between = viewportWidth - 4 * gap - left - right;
  return between >= viewBar;
}

/**
 * The narrowest window at which the view bar sits in the app bar's row, between the brand
 * and the profile (docs/features/mission-control.md, "Layout"). From 1,440 px it fits as it
 * is; from 1,280 px to 1,439 px the row is compacted (shell.css): the profile card drops its
 * "Mission profile" label, Share shows its icon only and the tabs lose 4 px of padding.
 * Narrower, the view bar keeps its own row under the app bar. Never on a phone.
 */
export const VIEW_BAR_IN_TOP_ROW_MIN = 1280;

export function viewBarInTopRow(viewportWidth: number, phone: boolean): boolean {
  return !phone && viewportWidth >= VIEW_BAR_IN_TOP_ROW_MIN;
}

/**
 * The app bar's row with the view bar in it, at its narrowest: the pieces' widths in px,
 * measured in the app (Chrome, the C2 type) and kept in step with shell.css. Only the
 * profile card shrinks: its chrome (trigger padding, chevron, duration, the sourced or
 * assumed tag) stays, and the name truncates down to `nameMin`. Compact is 1,280 to
 * 1,439 px: no "Mission profile" label, Share as its icon, tabs 4 px narrower.
 */
export const TOP_ROW_PARTS = {
  padding: 32,
  gaps: 3 * 8,
  brand: 346,
  viewBar: 605,
  viewBarCompact: 581,
  share: 92,
  shareCompact: 44,
  profileChrome: 253,
  profileChromeCompact: 166,
  nameMin: 48,
} as const;

/** The row's narrowest total at a window width: the fit rule the view bar's place rests on. */
export function topRowMinWidth(viewportWidth: number): number {
  const p = TOP_ROW_PARTS;
  const compact = viewportWidth < 1440;
  return (
    p.padding +
    p.gaps +
    p.brand +
    (compact ? p.viewBarCompact : p.viewBar) +
    (compact ? p.shareCompact : p.share) +
    (compact ? p.profileChromeCompact : p.profileChrome) +
    p.nameMin
  );
}

export type ShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** True when the key went to a text field, where "[" and "]" are typed, not shortcuts. */
  inEditableField: boolean;
  /**
   * True when focus is inside a dialog, popover, menu or listbox (a floating window, the
   * profile editor), or a popover is open: the keys must not fold a panel behind it.
   */
  inOverlay: boolean;
};

/** The roles and attributes that mark an overlay, for `isInOverlay`. */
export const OVERLAY_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"], [popover]';

/** The panel a key press folds or unfolds, or null if the key is not a shell shortcut. */
export function shortcutPanel(event: ShortcutEvent): SidePanel | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.inEditableField || event.inOverlay) return null;
  for (const panel of SIDE_PANELS) {
    if (event.key === SHELL_SHORTCUTS[panel]) return panel;
  }
  return null;
}

// ── The strip folded for a window ──────────────────────────────────────────

/**
 * The bottom strip, folded while Compare is open so its table gets the height
 * (docs/features/compare.md, "Room for the table"). A temporary fold beside the remembered
 * one: it is never saved, so the fold the user chose is what comes back next visit.
 *
 * - Opening Compare with the strip open folds it; with the strip already folded, nothing
 *   changes and nothing is restored.
 * - Unfolding the strip by hand while Compare is open lets go of the fold, for good: the
 *   window never folds it again until it is opened again.
 * - Closing Compare, by any route (the close button, Escape, picking a camera view or
 *   another window), restores the strip to what it was.
 */
export type WindowFold = { readonly window: string | null; readonly folded: boolean };

export const NO_WINDOW_FOLD: WindowFold = { window: null, folded: false };

/** The window whose opening folds the strip. */
export const STRIP_FOLDING_WINDOW = "compare";

/** The temporary fold once the open window is `window`. The same object when nothing changed. */
export function windowFoldFor(fold: WindowFold, window: string | null, stripCollapsed: boolean): WindowFold {
  if (window === fold.window) return fold;
  if (window === STRIP_FOLDING_WINDOW) return { window, folded: !stripCollapsed };
  return { window, folded: false };
}

/**
 * The user presses the strip's fold button. While a window holds the strip folded, that
 * unfolds it and lets go of the window's fold, leaving the remembered fold alone; otherwise
 * it toggles the remembered fold as usual.
 */
export function toggleStrip(fold: WindowFold): { fold: WindowFold; toggleRemembered: boolean } {
  if (fold.folded) return { fold: { ...fold, folded: false }, toggleRemembered: false };
  return { fold, toggleRemembered: true };
}

/** Whether the strip shows folded: the user's fold, or a window's. */
export function stripFolded(layout: ShellLayout, fold: WindowFold): boolean {
  return layout.timeline.collapsed || fold.folded;
}

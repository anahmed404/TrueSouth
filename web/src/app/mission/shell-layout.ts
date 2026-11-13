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

/**
 * The shell's grid columns: sites rail, main view, focused-site panel. A collapsed panel
 * keeps a slim rail; the main view takes every pixel that is freed.
 */
export function shellColumns(layout: ShellLayout): string {
  const rail = layout.sitesRail.collapsed ? "var(--shell-slim)" : "var(--shell-rail)";
  const focus = layout.focusPanel.collapsed ? "var(--shell-slim)" : "var(--shell-focus)";
  return `${rail} minmax(0, 1fr) ${focus}`;
}

export type ShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** True when the key went to a text field, where "[" and "]" are typed, not shortcuts. */
  inEditableField: boolean;
};

/** The panel a key press folds or unfolds, or null if the key is not a shell shortcut. */
export function shortcutPanel(event: ShortcutEvent): SidePanel | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.inEditableField) return null;
  for (const panel of SIDE_PANELS) {
    if (event.key === SHELL_SHORTCUTS[panel]) return panel;
  }
  return null;
}

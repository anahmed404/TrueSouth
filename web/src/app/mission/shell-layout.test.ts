import { describe, expect, it } from "vitest";
import { closeWindow, pickView, viewState, type ViewId } from "./views";
import {
  DEFAULT_SHELL_LAYOUT,
  SHELL_STORAGE_KEY,
  loadShellLayout,
  parseShellLayout,
  saveShellLayout,
  serializeShellLayout,
  setShellPanel,
  OVERLAY_SELECTOR,
  foldAnnouncement,
  VIEW_BAR_IN_TOP_ROW_MIN,
  viewBarFitsBetween,
  viewBarInTopRow,
  shortcutPanel,
  toggleShellPanel,
  type ShellLayout,
  type ShortcutEvent,
  NO_WINDOW_FOLD,
  stripFolded,
  toggleStrip,
  windowFoldFor,
  type WindowFold,
} from "./shell-layout";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const bothCollapsed: ShellLayout = {
  sitesRail: { collapsed: true },
  focusPanel: { collapsed: true },
  timeline: { collapsed: false },
};

describe("toggleShellPanel", () => {
  it("folds and unfolds one panel and leaves the other alone", () => {
    const once = toggleShellPanel(DEFAULT_SHELL_LAYOUT, "sitesRail");
    expect(once.sitesRail.collapsed).toBe(true);
    expect(once.focusPanel.collapsed).toBe(false);
    const twice = toggleShellPanel(once, "sitesRail");
    expect(twice).toEqual(DEFAULT_SHELL_LAYOUT);
  });

  it("does not change the layout it is given", () => {
    const before = serializeShellLayout(DEFAULT_SHELL_LAYOUT);
    toggleShellPanel(DEFAULT_SHELL_LAYOUT, "focusPanel");
    expect(serializeShellLayout(DEFAULT_SHELL_LAYOUT)).toBe(before);
  });
});

describe("setShellPanel", () => {
  it("returns the same object when nothing changes", () => {
    expect(setShellPanel(DEFAULT_SHELL_LAYOUT, "sitesRail", false)).toBe(DEFAULT_SHELL_LAYOUT);
  });

  it("sets one panel", () => {
    expect(setShellPanel(DEFAULT_SHELL_LAYOUT, "focusPanel", true).focusPanel.collapsed).toBe(true);
  });
});

describe("parseShellLayout", () => {
  it("round-trips through serializeShellLayout", () => {
    for (const layout of [
      DEFAULT_SHELL_LAYOUT,
      bothCollapsed,
      toggleShellPanel(DEFAULT_SHELL_LAYOUT, "focusPanel"),
    ]) {
      expect(parseShellLayout(serializeShellLayout(layout))).toEqual(layout);
    }
  });

  it("falls back to the default for missing or broken input", () => {
    expect(parseShellLayout(null)).toEqual(DEFAULT_SHELL_LAYOUT);
    expect(parseShellLayout("")).toEqual(DEFAULT_SHELL_LAYOUT);
    expect(parseShellLayout("{not json")).toEqual(DEFAULT_SHELL_LAYOUT);
    expect(parseShellLayout("42")).toEqual(DEFAULT_SHELL_LAYOUT);
    expect(parseShellLayout("null")).toEqual(DEFAULT_SHELL_LAYOUT);
  });

  it("keeps the panels it can read and defaults the rest", () => {
    const parsed = parseShellLayout(JSON.stringify({ sitesRail: { collapsed: true }, focusPanel: { collapsed: "yes" } }));
    expect(parsed).toEqual({
      sitesRail: { collapsed: true },
      focusPanel: { collapsed: false },
      timeline: { collapsed: false },
    });
  });
});

describe("the timeline's fold", () => {
  it("folds and unfolds without touching the side panels, and is remembered", () => {
    const folded = toggleShellPanel(DEFAULT_SHELL_LAYOUT, "timeline");
    expect(folded.timeline.collapsed).toBe(true);
    expect(folded.sitesRail).toEqual(DEFAULT_SHELL_LAYOUT.sitesRail);
    expect(folded.focusPanel).toEqual(DEFAULT_SHELL_LAYOUT.focusPanel);
    const storage = memoryStorage();
    saveShellLayout(storage, folded);
    expect(loadShellLayout(storage).timeline.collapsed).toBe(true);
  });

  it("reads a layout saved before the timeline could fold as unfolded", () => {
    const old = JSON.stringify({ sitesRail: { collapsed: true }, focusPanel: { collapsed: true } });
    expect(parseShellLayout(old)).toEqual(bothCollapsed);
  });
});

describe("loadShellLayout and saveShellLayout", () => {
  it("remembers the layout across a reload", () => {
    const storage = memoryStorage();
    saveShellLayout(storage, bothCollapsed);
    expect(storage.data.has(SHELL_STORAGE_KEY)).toBe(true);
    expect(loadShellLayout(storage)).toEqual(bothCollapsed);
  });

  it("works with no storage, or storage that throws", () => {
    expect(loadShellLayout(null)).toEqual(DEFAULT_SHELL_LAYOUT);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadShellLayout(broken)).toEqual(DEFAULT_SHELL_LAYOUT);
    expect(() => saveShellLayout(broken, bothCollapsed)).not.toThrow();
    expect(() => saveShellLayout(undefined, bothCollapsed)).not.toThrow();
  });
});

describe("foldAnnouncement", () => {
  it("says which panel folded or opened, for the [ and ] keys", () => {
    expect(foldAnnouncement("sitesRail", true)).toBe("Sites rail folded.");
    expect(foldAnnouncement("focusPanel", false)).toBe("Focused-site panel open.");
    expect(foldAnnouncement("timeline", true)).toBe("Timeline folded.");
  });
});

describe("viewBarInTopRow (M14)", () => {
  it("puts the view bar in the app bar's row from 1,280 px wide", () => {
    expect(viewBarInTopRow(1920, false)).toBe(true);
    expect(viewBarInTopRow(1440, false)).toBe(true);
    expect(viewBarInTopRow(VIEW_BAR_IN_TOP_ROW_MIN, false)).toBe(true);
    expect(VIEW_BAR_IN_TOP_ROW_MIN).toBe(1280);
  });

  it("keeps its own row below 1,280 px, and on a phone", () => {
    expect(viewBarInTopRow(1279, false)).toBe(false);
    expect(viewBarInTopRow(1024, false)).toBe(false);
    expect(viewBarInTopRow(1440, true)).toBe(false);
  });
});

describe("viewBarFitsBetween", () => {
  it("keeps the view bar between the side panels at 1440 px", () => {
    expect(viewBarFitsBetween(1440, DEFAULT_SHELL_LAYOUT)).toBe(true);
  });

  it("moves it above the side panels at 1024 px with both open", () => {
    expect(viewBarFitsBetween(1024, DEFAULT_SHELL_LAYOUT)).toBe(false);
  });

  it("brings it back between them when the panels fold", () => {
    expect(viewBarFitsBetween(1024, bothCollapsed)).toBe(true);
    expect(viewBarFitsBetween(1024, toggleShellPanel(DEFAULT_SHELL_LAYOUT, "sitesRail"))).toBe(false);
    expect(viewBarFitsBetween(1024, toggleShellPanel(DEFAULT_SHELL_LAYOUT, "focusPanel"))).toBe(true);
  });
});

describe("shortcutPanel", () => {
  const press = (key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    inEditableField: false,
    inOverlay: false,
    ...extra,
  });

  it("maps [ to the sites rail and ] to the focused-site panel", () => {
    expect(shortcutPanel(press("["))).toBe("sitesRail");
    expect(shortcutPanel(press("]"))).toBe("focusPanel");
  });

  it("ignores other keys, modified keys and typing in a field", () => {
    expect(shortcutPanel(press("a"))).toBeNull();
    expect(shortcutPanel(press("[", { ctrlKey: true }))).toBeNull();
    expect(shortcutPanel(press("]", { metaKey: true }))).toBeNull();
    expect(shortcutPanel(press("[", { altKey: true }))).toBeNull();
    expect(shortcutPanel(press("[", { inEditableField: true }))).toBeNull();
  });

  it("does nothing inside a floating window, a popover, a menu or a listbox", () => {
    expect(shortcutPanel(press("[", { inOverlay: true }))).toBeNull();
    expect(shortcutPanel(press("]", { inOverlay: true }))).toBeNull();
  });

  it("names every overlay role in the selector the shell checks", () => {
    for (const part of ['[role="dialog"]', '[role="menu"]', '[role="listbox"]', "[popover]"]) {
      expect(OVERLAY_SELECTOR).toContain(part);
    }
  });
});

describe("the strip folded while Compare is open", () => {
  // The shell's own path from a view to the open window: `viewState`, and the two ways to
  // close (`closeWindow` for the close button and Escape, `pickView` for a camera view).
  const open = viewState("compare", "system");
  const windowAfter = (view: ViewId) => viewState(view, open.camera).window;
  const OPEN_STRIP = DEFAULT_SHELL_LAYOUT;
  const FOLDED_STRIP = setShellPanel(DEFAULT_SHELL_LAYOUT, "timeline", true);

  /** The fold once Compare opens over `layout`. */
  function opened(layout: ShellLayout): WindowFold {
    const fold = windowFoldFor(NO_WINDOW_FOLD, null, layout.timeline.collapsed);
    return windowFoldFor(fold, open.window, layout.timeline.collapsed);
  }

  it("folds an open strip when Compare opens, without touching the remembered fold", () => {
    const fold = opened(OPEN_STRIP);
    expect(fold).toEqual({ window: "compare", folded: true });
    expect(stripFolded(OPEN_STRIP, fold)).toBe(true);
    expect(OPEN_STRIP.timeline.collapsed).toBe(false);
    expect(serializeShellLayout(OPEN_STRIP)).toContain('"timeline":{"collapsed":false}');
  });

  it.each([
    ["the close button", closeWindow(open)],
    ["Escape", closeWindow(open)],
    ["picking a camera view", pickView(open, "map")],
  ])("restores the open strip when Compare closes by %s", (_how, view) => {
    const closed = windowFoldFor(opened(OPEN_STRIP), windowAfter(view), false);
    expect(closed.window).toBeNull();
    expect(stripFolded(OPEN_STRIP, closed)).toBe(false);
  });

  it("leaves a strip the user folded folded, before, during and after", () => {
    const fold = opened(FOLDED_STRIP);
    expect(fold.folded).toBe(false);
    expect(stripFolded(FOLDED_STRIP, fold)).toBe(true);
    const closed = windowFoldFor(fold, windowAfter(closeWindow(open)), true);
    expect(stripFolded(FOLDED_STRIP, closed)).toBe(true);
  });

  it("lets the user unfold it while Compare is open, and does not fold it again", () => {
    const { fold, toggleRemembered } = toggleStrip(opened(OPEN_STRIP));
    expect(toggleRemembered).toBe(false);
    expect(stripFolded(OPEN_STRIP, fold)).toBe(false);
    // The next render with Compare still open keeps it unfolded (the same object back).
    expect(windowFoldFor(fold, "compare", false)).toBe(fold);
    // A second press is the user's own fold, remembered as usual.
    expect(toggleStrip(fold).toggleRemembered).toBe(true);
    // And closing leaves the strip as the user left it.
    expect(stripFolded(OPEN_STRIP, windowFoldFor(fold, null, false))).toBe(false);
  });

  it("folds again the next time Compare opens", () => {
    const { fold } = toggleStrip(opened(OPEN_STRIP));
    const closed = windowFoldFor(fold, null, false);
    expect(windowFoldFor(closed, "compare", false).folded).toBe(true);
  });

  it("does nothing for any other window, or with no window", () => {
    expect(windowFoldFor(NO_WINDOW_FOLD, "another-window", false).folded).toBe(false);
    expect(windowFoldFor(NO_WINDOW_FOLD, null, false)).toBe(NO_WINDOW_FOLD);
    expect(toggleStrip(NO_WINDOW_FOLD).toggleRemembered).toBe(true);
  });

  it("folds when the page opens straight onto Compare from a link", () => {
    expect(windowFoldFor(NO_WINDOW_FOLD, "compare", false)).toEqual({ window: "compare", folded: true });
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_LAYOUT,
  SHELL_STORAGE_KEY,
  loadShellLayout,
  parseShellLayout,
  saveShellLayout,
  serializeShellLayout,
  setShellPanel,
  shellColumns,
  shortcutPanel,
  toggleShellPanel,
  type ShellLayout,
  type ShortcutEvent,
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
    expect(parsed).toEqual({ sitesRail: { collapsed: true }, focusPanel: { collapsed: false } });
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

describe("shellColumns", () => {
  it("gives the freed width to the main view", () => {
    expect(shellColumns(DEFAULT_SHELL_LAYOUT)).toBe("var(--shell-rail) minmax(0, 1fr) var(--shell-focus)");
    expect(shellColumns(bothCollapsed)).toBe("var(--shell-slim) minmax(0, 1fr) var(--shell-slim)");
    expect(shellColumns(toggleShellPanel(DEFAULT_SHELL_LAYOUT, "sitesRail"))).toBe(
      "var(--shell-slim) minmax(0, 1fr) var(--shell-focus)",
    );
  });
});

describe("shortcutPanel", () => {
  const press = (key: string, extra: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    inEditableField: false,
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
});

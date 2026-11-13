import { describe, expect, it } from "vitest";
import { escapeCloses, focusAfterClose, focusOnOpen, type Focusable } from "./window-focus";
import { sceneMode, showStill, stillLabel, stillNote } from "./scene-status";

function element(isConnected = true): Focusable & { focused: number } {
  return {
    isConnected,
    focused: 0,
    focus() {
      this.focused += 1;
    },
  };
}

describe("escapeCloses", () => {
  const base = { popoverOpen: false, tipOpen: false, windowOpen: true, inEditableField: false };

  it("closes the open window", () => {
    expect(escapeCloses(base)).toBe("window");
  });

  it("leaves an open popover or tooltip to close first", () => {
    expect(escapeCloses({ ...base, popoverOpen: true })).toBe("popover");
    expect(escapeCloses({ ...base, tipOpen: true })).toBe("popover");
  });

  it("does nothing in a text field, or with no window open", () => {
    expect(escapeCloses({ ...base, inEditableField: true })).toBe("nothing");
    expect(escapeCloses({ ...base, windowOpen: false })).toBe("nothing");
  });
});

describe("focusOnOpen", () => {
  it("moves focus into the window itself", () => {
    const win = element();
    const close = element();
    expect(focusOnOpen(win, close)).toBe(win);
  });

  it("falls back to the first control, then to nothing", () => {
    const close = element();
    expect(focusOnOpen(element(false), close)).toBe(close);
    expect(focusOnOpen(null, null)).toBeNull();
  });
});

describe("focusAfterClose", () => {
  const button = element();

  it("returns focus to the view bar's button after Escape or the close button", () => {
    expect(focusAfterClose({ closedByUser: true, focusIsLost: false, button })).toBe(button);
  });

  it("returns it when focus was lost with the window (Back pressed while in it)", () => {
    expect(focusAfterClose({ closedByUser: false, focusIsLost: true, button })).toBe(button);
  });

  it("leaves focus where it is when the user moved it: a clicked view, or the window that replaced this one", () => {
    expect(focusAfterClose({ closedByUser: false, focusIsLost: false, button })).toBeNull();
  });

  it("does not focus a button that has left the page", () => {
    expect(focusAfterClose({ closedByUser: true, focusIsLost: true, button: element(false) })).toBeNull();
  });
});

describe("the scene's mode and the shell's still picture", () => {
  it("draws in 3D until the scene reports, and while it is ready", () => {
    expect(sceneMode(null, false)).toBe("3d");
    expect(sceneMode("ready", false)).toBe("3d");
  });

  it("tells the scene to draw flat when it is slow or has no WebGL", () => {
    expect(sceneMode("slow", false)).toBe("flat");
    expect(sceneMode("no-webgl", false)).toBe("flat");
  });

  it("goes back to 3D for a slow scene after 'Try 3D anyway', but not without WebGL", () => {
    expect(sceneMode("slow", true)).toBe("3d");
    expect(sceneMode("no-webgl", true)).toBe("flat");
  });

  it("shows the still picture in flat mode only for views the scene does not draw flat", () => {
    expect(showStill("3d", null, "system")).toBe(false);
    expect(showStill("flat", null, "system")).toBe(true);
    expect(showStill("flat", { flatViews: [] }, "map")).toBe(true);
    expect(showStill("flat", { flatViews: ["map"] }, "map")).toBe(false);
    expect(showStill("flat", { flatViews: ["map"] }, "terrain")).toBe(true);
  });

  it("says why, names the current view, and says the rest still works", () => {
    expect(stillNote("slow", "system")).toBe(
      "3D is slow on this device, so the System view shows a still picture instead of the 3D scene. The panels, timeline and windows still work.",
    );
    expect(stillNote("no-webgl", "terrain")).toMatch(/^This device could not start 3D, so Local terrain shows a still picture/);
    expect(stillNote("slow", "panorama")).toMatch(/so Lander's eye shows/);
    expect(stillLabel("map")).toMatch(/for the Polar map/);
  });
});

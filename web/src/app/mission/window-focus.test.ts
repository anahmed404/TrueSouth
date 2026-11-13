import { describe, expect, it } from "vitest";
import { escapeCloses, focusAfterClose, focusOnOpen, type Focusable } from "./window-focus";
import { sceneDisplay, stillNote } from "./scene-status";

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

describe("the scene slot's still picture", () => {
  it("shows the scene until it reports, and while it is ready", () => {
    expect(sceneDisplay(null, false)).toBe("scene");
    expect(sceneDisplay("ready", false)).toBe("scene");
  });

  it("shows the still picture when the scene is slow or has no WebGL", () => {
    expect(sceneDisplay("slow", false)).toBe("still");
    expect(sceneDisplay("no-webgl", false)).toBe("still");
  });

  it("draws a slow scene anyway after 'Try 3D anyway', but not one without WebGL", () => {
    expect(sceneDisplay("slow", true)).toBe("scene");
    expect(sceneDisplay("no-webgl", true)).toBe("still");
  });

  it("says why, and that the rest still works", () => {
    expect(stillNote("slow")).toMatch(/^3D is slow on this device/);
    expect(stillNote("no-webgl")).toMatch(/^This device could not start 3D/);
    expect(stillNote("slow")).toMatch(/panels, timeline and windows still work\.$/);
  });
});

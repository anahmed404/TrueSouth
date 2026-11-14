import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { allNodes, installDocument, propsOf, type FakeNode } from "../app/mission/fake-dom";
import { shortcutPanel } from "../app/mission/shell-layout";
import { escapeCloses } from "../app/mission/window-focus";
import { OVERLAY_CHANGED_EVENT, PANEL_MIN_ROOM, announceOverlayChange, bridgeTab, overOverlay, overlayHost, placePanel, returnsFocus, withinEither } from "./overlay-host";
import { Popover } from "./Popover";
import { Tip } from "./Tip";

/** Stand-ins for elements, enough for the pure functions. */
const el = (name: string) => ({ name }) as unknown as Element;

describe("Tab across a portalled panel or bubble (bridgeTab)", () => {
  const trigger = el("trigger");
  const first = el("first");
  const middle = el("middle");
  const last = el("last");
  const after = el("next on the page");
  const items = [first, middle, last];

  it("Tab from the trigger enters the panel at its first control", () => {
    expect(bridgeTab({ shift: false, active: trigger, trigger, items, after })).toBe(first);
  });

  it("Tab from the panel's last control goes on to the page's next stop after the trigger", () => {
    expect(bridgeTab({ shift: false, active: last, trigger, items, after })).toBe(after);
  });

  it("Shift+Tab from the panel's first control goes back to the trigger", () => {
    expect(bridgeTab({ shift: true, active: first, trigger, items, after: null })).toBe(trigger);
  });

  it("leaves Tab inside the panel, and an empty or closed panel, to the browser", () => {
    expect(bridgeTab({ shift: false, active: middle, trigger, items, after })).toBeNull();
    expect(bridgeTab({ shift: true, active: middle, trigger, items, after: null })).toBeNull();
    expect(bridgeTab({ shift: false, active: trigger, trigger, items: [], after })).toBeNull();
    expect(bridgeTab({ shift: false, active: null, trigger, items, after })).toBeNull();
  });

  it("lets the browser go on when the trigger is the page's last stop", () => {
    expect(bridgeTab({ shift: false, active: last, trigger, items, after: null })).toBeNull();
  });
});

describe("where an overlay is rendered (overlayHost)", () => {
  const hadDocument = "document" in globalThis;
  afterEach(() => {
    if (!hadDocument) delete (globalThis as { document?: unknown }).document;
  });

  it("is the open popover the trigger sits in, so a tip inside a popover does not light-dismiss it", () => {
    const panel = el("popover panel");
    (globalThis as { document?: unknown }).document = { body: el("body") };
    const trigger = { closest: (selector: string) => (selector === ".popover" ? panel : null) } as unknown as Element;
    expect(overlayHost(trigger)).toBe(panel);
  });

  it("is the page's body otherwise, never the panel that holds the trigger", () => {
    const body = el("body");
    (globalThis as { document?: unknown }).document = { body };
    const inRail = { closest: () => null } as unknown as Element;
    expect(overlayHost(inRail)).toBe(body);
    expect(overlayHost(null)).toBe(body);
  });

  it("is nothing without a document (server rendering renders in place)", () => {
    delete (globalThis as { document?: unknown }).document;
    expect(overlayHost(null)).toBeNull();
  });
});

describe("clicks and focus across the portal", () => {
  const node = (children: Node[] = []) => {
    const n = { children, contains(other: Node): boolean { return (other as unknown) === n || children.some((c) => (c as unknown as { contains: (o: Node) => boolean }).contains(other)); } };
    return n as unknown as Node;
  };

  it("counts a click in the portalled overlay as inside, so a pinned tip stays pinned (withinEither)", () => {
    const link = node();
    const bubble = node([link]);
    const trigger = node();
    const wrap = node([trigger]);
    expect(withinEither(link, wrap, bubble)).toBe(true);
    expect(withinEither(trigger, wrap, bubble)).toBe(true);
    expect(withinEither(node(), wrap, bubble)).toBe(false);
  });

  it("returns focus to the trigger on close when focus was in the portalled overlay (returnsFocus)", () => {
    const field = node();
    const panel = node([field]);
    const body = el("body");
    expect(returnsFocus(field as unknown as Element, panel, body)).toBe(true);
    expect(returnsFocus(body, panel, body)).toBe(true);
    expect(returnsFocus(null, panel, body)).toBe(true);
    expect(returnsFocus(el("elsewhere"), panel, body)).toBe(false);
  });

  it("keeps the shell's rules: Escape closes an open popover or tip first, and [ and ] do nothing in an overlay", () => {
    expect(escapeCloses({ popoverOpen: true, tipOpen: false, windowOpen: true, inEditableField: false })).toBe("popover");
    expect(escapeCloses({ popoverOpen: false, tipOpen: true, windowOpen: true, inEditableField: false })).toBe("popover");
    const press = (key: string) => ({ key, ctrlKey: false, metaKey: false, altKey: false, inEditableField: false, inOverlay: true });
    expect(shortcutPanel(press("["))).toBeNull();
    expect(shortcutPanel(press("]"))).toBeNull();
  });
});

describe("a popover panel and a tip bubble mounted inside a panel", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  it("are portalled to the page's body, not left inside the panel their trigger sits in", async () => {
    const document = installDocument();
    const body = (document as unknown as { body: FakeNode }).body;
    const rail = document.createElement("aside");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(rail as unknown as Element);
    await act(async () => {
      root?.render(
        createElement(
          "div",
          { className: "shell-rail" },
          createElement(Popover, {
            label: "Add a site",
            trigger: (props) => createElement("button", { ...props, type: "button" }, "+"),
            children: "the list",
          }),
          createElement(Tip, { content: "Connecting Ridge", children: (trigger) => createElement("button", { ...trigger, type: "button" }, "lamp") }),
        ),
      );
    });

    const panel = allNodes(body).find((node) => propsOf(node).role === "dialog");
    const bubble = allNodes(body).find((node) => propsOf(node).className === "tip-bubble");
    expect(panel, "the popover panel is on the body").toBeDefined();
    expect(bubble, "the tip bubble is on the body").toBeDefined();
    expect(panel!.parentNode).toBe(body);
    expect(bubble!.parentNode).toBe(body);
    // Nothing of either is inside the panel that holds the triggers.
    expect(allNodes(rail).includes(panel!)).toBe(false);
    expect(allNodes(rail).includes(bubble!)).toBe(false);

    // The ids the triggers point at still name them, across the portal.
    const buttons = allNodes(rail).filter((node) => node.nodeName === "BUTTON");
    const plus = buttons.find((node) => propsOf(node)["aria-haspopup"] === "dialog")!;
    const lamp = buttons.find((node) => propsOf(node)["aria-describedby"] !== undefined)!;
    expect(propsOf(plus)["aria-controls"]).toBe(propsOf(panel!).id);
    expect(propsOf(plus).popoverTarget).toBe(propsOf(panel!).id);
    expect(propsOf(lamp)["aria-describedby"]).toBe(propsOf(bubble!).id);

    // What the shell's Escape rule queries for is still there: the popover class and attribute.
    expect(String(propsOf(panel!).className)).toContain("popover");
    expect(propsOf(panel!).popover).toBe("auto");
    expect(propsOf(bubble!).popover).toBe("manual");
  });
});

describe("a popover panel always ends inside the window (placePanel)", () => {
  const base = { width: 320, align: "start" as const, margin: 16, gap: 6 };
  // The folded rail's "+" (44 px), 16 px from the left, its top this far down the window.
  const plus = (top: number) => ({ top, bottom: top + 44, left: 20, right: 64 });
  // 1024 × 768 at 100 %, 125 % and 150 % zoom, and 1440 × 900 at 125 % and 150 %, in CSS px.
  const windows = [
    { name: "1024 × 768", viewW: 1024, viewH: 768 },
    { name: "1024 × 768 at 125 %", viewW: 819, viewH: 614 },
    { name: "1024 × 768 at 150 %", viewW: 683, viewH: 512 },
    { name: "1440 × 900 at 125 %", viewW: 1152, viewH: 720 },
    { name: "1440 × 900 at 150 %", viewW: 960, viewH: 600 },
  ];

  it.each(windows.map((w) => [w.name, w] as const))("%s: the add-site list, opened below the folded rail's +", (_name, w) => {
    for (const top of [180, 272, 360, w.viewH - 120]) {
      const spot = placePanel({ ...base, trigger: plus(top), viewW: w.viewW, viewH: w.viewH, placement: "below" });
      const panelTop = spot.top ?? w.viewH - spot.bottom! - spot.maxHeight;
      const panelBottom = spot.top !== null ? spot.top + spot.maxHeight : w.viewH - spot.bottom!;
      expect(panelTop, `top ${top}`).toBeGreaterThanOrEqual(base.margin);
      expect(panelBottom, `top ${top}`).toBeLessThanOrEqual(w.viewH - base.margin);
      expect(spot.left + spot.width).toBeLessThanOrEqual(w.viewW - base.margin);
      expect(spot.left).toBeGreaterThanOrEqual(base.margin);
    }
  });

  it("flips above when there is too little room below, as for a trigger near the window's foot", () => {
    const spot = placePanel({ ...base, trigger: plus(560), viewW: 1024, viewH: 640, placement: "below" });
    expect(spot.top).toBeNull();
    expect(spot.maxHeight).toBeGreaterThan(PANEL_MIN_ROOM);
  });

  it("keeps an above-placed picker (the landing date, in the bottom strip) above, and inside", () => {
    const spot = placePanel({ ...base, trigger: { top: 690, bottom: 720, left: 200, right: 360 }, viewW: 1440, viewH: 900, placement: "above" });
    expect(spot.top).toBeNull();
    expect(900 - spot.bottom! - spot.maxHeight).toBeGreaterThanOrEqual(base.margin);
  });

  it("narrows to the window less its margins on a narrow window", () => {
    expect(placePanel({ ...base, width: 440, trigger: plus(100), viewW: 390, viewH: 844, placement: "below" }).width).toBe(358);
  });
});

describe("the scene hears when an overlay over it changes (the black box mitigation)", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("announces a moved or resized popover or tip on the document", () => {
    const heard: string[] = [];
    (globalThis as { document?: unknown }).document = { dispatchEvent: (event: Event) => heard.push(event.type) };
    announceOverlayChange();
    expect(heard).toEqual([OVERLAY_CHANGED_EVENT]);
  });

  it("does nothing without a document", () => {
    delete (globalThis as { document?: unknown }).document;
    expect(() => announceOverlayChange()).not.toThrow();
  });

  it("counts the pointer entering a row of a popover or tip, not anything else", () => {
    const inside = { closest: (selector: string) => (selector.includes(".popover") ? el("panel") : null) };
    const outside = { closest: () => null };
    expect(overOverlay(inside as unknown as EventTarget)).toBe(true);
    expect(overOverlay(outside as unknown as EventTarget)).toBe(false);
    expect(overOverlay(null)).toBe(false);
    expect(overOverlay({} as EventTarget)).toBe(false);
  });
});

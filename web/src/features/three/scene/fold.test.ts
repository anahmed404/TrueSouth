import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FOLD_CLOSED, foldOpen, foldStep, type FoldEvent, type FoldState } from "./fold";
import { FoldedPlate } from "./overlay";
import type { Plate } from "./plates";

const run = (...events: FoldEvent[]): FoldState => events.reduce(foldStep, FOLD_CLOSED);

describe("a folded plate opens on hover, keyboard focus or a click, and closes on a second click or Escape (fold.ts)", () => {
  it("starts closed", () => {
    expect(foldOpen(FOLD_CLOSED)).toBe(false);
  });

  it("mouse: open while hovering; a click keeps it open after leaving; a second click closes it", () => {
    expect(foldOpen(run("enter"))).toBe(true);
    expect(foldOpen(run("enter", "leave"))).toBe(false);
    expect(foldOpen(run("enter", "click", "leave"))).toBe(true);
    expect(foldOpen(run("enter", "click", "click"))).toBe(false);
    // Closed by the second click while still hovering; opens again on the next visit.
    expect(foldOpen(run("enter", "click", "click", "leave", "enter"))).toBe(true);
  });

  it("touch: a tap opens it, a second tap closes it", () => {
    expect(foldOpen(run("click"))).toBe(true);
    expect(foldOpen(run("click", "click"))).toBe(false);
  });

  it("keyboard: focus opens it, Escape closes it until the focus moves away", () => {
    expect(foldOpen(run("focus"))).toBe(true);
    expect(foldOpen(run("focus", "escape"))).toBe(false);
    expect(foldOpen(run("focus", "escape", "blur", "focus"))).toBe(true);
    expect(foldOpen(run("focus", "click"))).toBe(true);
    expect(foldOpen(run("click", "escape"))).toBe(false);
  });
});

describe("the folded plate's markup", () => {
  const plate: Plate = {
    id: "decoration",
    text: "Lit · drawing only",
    details: [
      "The shape of the ground nearest the lander comes from NASA's close-up DEM of this site, with squares 5 metres across.",
      "The series says: lit. 100 % of the Sun's disc is above the skyline.",
      "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.",
    ],
    place: "foot",
  };
  const closed = renderToStaticMarkup(createElement(FoldedPlate, { plate }));
  const open = renderToStaticMarkup(createElement(FoldedPlate, { plate, initial: { ...FOLD_CLOSED, pinned: true } }));

  it("is a real button with the short line, an accessible name and aria-expanded", () => {
    expect(closed).toMatch(/<button type="button" class="scene-fold-button" aria-expanded="false" aria-controls="[^"]+"/);
    expect(closed).toContain("Lit · drawing only");
    expect(closed).toContain(", show the full note");
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain(", hide the full note");
  });

  it("carries the full sentences of both notes; closed they are hidden, open they show", () => {
    for (const html of [closed, open]) for (const line of plate.details!) expect(html).toContain(line.replace(/'/g, "&#x27;"));
    expect(closed).toMatch(/class="scene-fold-details" hidden=""/);
    expect(open).not.toMatch(/class="scene-fold-details" hidden/);
  });

  it("is a plate, not a label: the Labels toggle's rule (.scene-label) never matches it", () => {
    for (const html of [closed, open]) {
      expect(html).toContain("scene-plate-top");
      expect(html).not.toMatch(/scene-label/);
    }
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { labelsAttr, labelsStore } from "./labels";
import { LabelsToggle } from "./overlay";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = (file: string) => readFileSync(path.resolve(here, file), "utf8");

afterEach(() => labelsStore.getState().setOn(true));

describe("the Labels toggle", () => {
  it("is on by default and flips with setOn", () => {
    expect(labelsStore.getState().on).toBe(true);
    labelsStore.getState().setOn(false);
    expect(labelsStore.getState().on).toBe(false);
    labelsStore.getState().setOn(true);
    expect(labelsStore.getState().on).toBe(true);
  });

  it("is a pressed-state button named Labels, in the scene toggles' style", () => {
    const on = renderToStaticMarkup(createElement(LabelsToggle, { on: true, onChange: () => undefined }));
    const off = renderToStaticMarkup(createElement(LabelsToggle, { on: false, onChange: () => undefined }));
    for (const html of [on, off]) {
      expect(html).toContain(">Labels<");
      expect(html).toMatch(/class="[^"]*scene-toggle/);
    }
    expect(on).toContain('aria-pressed="true"');
    expect(off).toContain('aria-pressed="false"');
  });

  it("turns the labels off in the System view, Slip Planner and Local terrain, but never in Lander's eye", () => {
    for (const view of ["system", "slip", "terrain", "map"] as const) {
      expect(labelsAttr(view, true)).toBe("on");
      expect(labelsAttr(view, false)).toBe("off");
    }
    expect(labelsAttr("panorama", false)).toBe("on");
  });

  it("hides the name tags but not the edge pointers, pins or plates; the Slip Planner hides its tags and leaders", () => {
    // The overlay's rule: every .scene-label except the edge pointers (.scene-marker). The pins
    // (.scene-pin) and the plates (.scene-plate-top, the honesty notes) are other classes.
    const scene = css("scene.css");
    expect(scene).toMatch(/\.scene-overlay\[data-labels="off"\] \.scene-label:not\(\.scene-marker\) \{\s*visibility: hidden !important;/);
    expect(scene).not.toMatch(/data-labels="off"\][^{]*\.scene-(pin|plate)/);
    const slip = css("../../mission-control/slip-planner/slip-planner.css");
    expect(slip).toMatch(/\.slip-layer\[data-labels="off"\] \.slip-label,\s*\.slip-layer\[data-labels="off"\] \.slip-leaders \{\s*visibility: hidden !important;/);
    expect(slip).not.toMatch(/data-labels="off"\][^{]*\.slip-(spot|hover|off)/);
  });
});

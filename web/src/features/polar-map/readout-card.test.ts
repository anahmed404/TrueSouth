import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Site } from "../../contracts/generated";
import { ReadoutCard, requestSiteAt } from "./map";
import { polarMapLayer } from "./layer";
import { NNBSP, NUDGE_CAVEAT, NUDGE_CAVEAT_SHORT, readLookup, type LookupGrid, type OverlayId } from "./readout";
import { clampView, fitView, type MapView } from "./view";

const readRepo = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url));
const sites = JSON.parse(readRepo("data/derived/sites.json").toString("utf8")) as Site[];
const grid = (file: string): LookupGrid => {
  const bytes = readRepo(file);
  return { values: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), size: 2048, halfWidthM: 304_000 };
};
const grids: Record<OverlayId, LookupGrid> = {
  sunlight: grid("data/derived/maps/sunlight_u8.bin"),
  earthvis: grid("data/derived/maps/earthvis_u8.bin"),
};
const valueAt = (layer: OverlayId, at: { latDeg: number; lonDeg: number }) => readLookup(grids[layer], at.latDeg, at.lonDeg);
const siteById = (id: string) => sites.find((s) => s.id === id) ?? null;
const view: MapView = { k: 25, x: 720, y: 450 };
const frame = { x: 0, y: 0, width: 1440, height: 900 };

/** The card as React renders it, with the markup's tags removed and spaces made plain. */
function cardText(props: Partial<Parameters<typeof ReadoutCard>[0]> & Pick<Parameters<typeof ReadoutCard>[0], "readout">): string {
  const html = renderToStaticMarkup(
    createElement(ReadoutCard, {
      view,
      frame,
      siteById,
      valueAt,
      gridsReady: true,
      onClose: () => undefined,
      selectedIds: ["connecting_ridge"],
      ...props,
    }),
  );
  // Only ASCII spaces collapse: the narrow no-break space before a unit is part of the text.
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/ ([,.])/g, "$1");
}

// Connecting Ridge's listed point reads byte 138 (54 %) for sunlight; Shackleton rim's 133 (52 %).
const ridge = siteById("connecting_ridge") as Site;
const rim = siteById("shackleton_rim") as Site;
const dragged = { latDeg: rim.lat_deg, lonDeg: rim.lon_deg };

describe("the nudge readout, rendered", () => {
  it("keeps whose number it is on screen while the pin is dragged", () => {
    const text = cardText({ readout: { kind: "nudge", siteId: "connecting_ridge", at: dragged, dragging: true } });
    expect(text).toContain(NUDGE_CAVEAT_SHORT);
    expect(text).toContain("NASA's average sunlight");
  });

  it("starts from the site's listed point, not from where the pin is dragged", () => {
    const text = cardText({ readout: { kind: "nudge", siteId: "connecting_ridge", at: dragged, dragging: true } });
    expect(text).toContain(`NASA's average sunlight 54${NNBSP}% → 52${NNBSP}%, lower`);
  });

  it("after release, shows the full caveat, the nearby range rounded outward and the best-lit point", () => {
    const text = cardText({ readout: { kind: "nudge", siteId: "connecting_ridge", at: dragged, dragging: false } });
    expect(text).toContain(NUDGE_CAVEAT);
    expect(text).toContain(`Within 160${NNBSP}m: 39${NNBSP}% to 87${NNBSP}%`);
    expect(text).toContain(`Best-lit map pixel, 149${NNBSP}m from Connecting Ridge, chosen by TrueSouth`);
  });

  it("offers Compute this point only when a callback is given", () => {
    const readout = { kind: "nudge", siteId: "connecting_ridge", at: dragged, dragging: false } as const;
    expect(cardText({ readout })).not.toContain("Compute this point");
    expect(cardText({ readout, onRequestSite: () => undefined })).toContain("Compute this point");
  });
});

describe("New site here?, rendered", () => {
  const readout = { kind: "point", at: { latDeg: ridge.lat_deg, lonDeg: ridge.lon_deg } } as const;

  it("labels both values as NASA's averages, not for your date", () => {
    const text = cardText({ readout });
    expect(text).toContain(`NASA's average sunlight 54${NNBSP}%`);
    expect(text).toContain("NASA's average Earth visibility");
    expect(text).toContain("not for your date");
  });

  it("has no button without a callback, and Compute this site with one", () => {
    expect(cardText({ readout })).not.toContain("Compute this site");
    expect(cardText({ readout, onRequestSite: () => undefined })).toContain("Compute this site");
  });

  it("calls back with latitude and east longitude from 0 to 360", () => {
    const onRequestSite = vi.fn();
    requestSiteAt({ latDeg: -89.4555, lonDeg: 222.6192 }, onRequestSite);
    requestSiteAt({ latDeg: -85, lonDeg: -20 }, onRequestSite);
    requestSiteAt({ latDeg: -85, lonDeg: 360 }, onRequestSite);
    expect(onRequestSite.mock.calls).toEqual([
      [-89.4555, 222.6192],
      [-85, 340],
      [-85, 0],
    ]);
    expect(() => requestSiteAt({ latDeg: -85, lonDeg: 10 }, undefined)).not.toThrow();
  });

  it("keeps the layer's callback for the map it mounts", () => {
    const onRequestSite = vi.fn();
    const layer = polarMapLayer({ onRequestSite });
    expect(layer.views).toEqual(["map"]);
    expect(layer.onRequestSite).toBe(onRequestSite);
    expect(polarMapLayer().onRequestSite).toBeUndefined();
  });
});

describe("the pan limit", () => {
  const rect = { x: 288, y: 200, width: 864, height: 420 };
  const fit = fitView({ rect, boxHeight: 900 });

  it("leaves a fitted map where it is", () => {
    expect(clampView(fit, rect)).toEqual(fit);
  });

  it("keeps at least a third of the map, or half the free space, inside it at every zoom", () => {
    for (const k of [fit.k * 0.7, fit.k, 5, 40]) {
      const side = (2 * 304_000 * k) / 1000;
      for (const [x, y] of [
        [-1e6, -1e6],
        [1e6, 1e6],
        [-1e6, 1e6],
      ] as const) {
        const c = clampView({ k, x, y }, rect);
        const inside = (start: number, length: number, centre: number) =>
          Math.min(start + length, centre + side / 2) - Math.max(start, centre - side / 2);
        const need = (length: number) => Math.min(side / 3, length / 2) - 1e-6;
        expect(inside(rect.x, rect.width, c.x)).toBeGreaterThanOrEqual(need(rect.width));
        expect(inside(rect.y, rect.height, c.y)).toBeGreaterThanOrEqual(need(rect.height));
        expect(c.k).toBe(k);
      }
    }
  });
});

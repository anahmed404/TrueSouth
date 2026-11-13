import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Feature, Site } from "../../contracts/generated";
import type { FreeSpace } from "../../app/mission/free-space";
import { latLonToPixel, latLonToScene, polarStereoForward } from "../../lib/geo";
import { SPACE_FOV, polarPose, polarScale } from "../three/scene/camera";
import { imageRect } from "./draw";
import { PIN, featuresToName, onMap, pinAt, pinRadius, placePins, type PinState } from "./pins";
import {
  NNBSP,
  coordinatesText,
  distanceText,
  nearbyRangeLine,
  nudgeLine,
  readLookup,
  type LookupGrid,
} from "./readout";
import {
  ARRIVAL_TIMEOUT_MS,
  GLOBE_LENS_DEG,
  REDUCED_FADE_MS,
  TAKEOVER_FADE_MS,
  arrivalView,
  entryFor,
  scaleBar,
  takeoverView,
} from "./takeover";
import {
  fitView,
  latLonToScreen,
  metresPerPixel,
  reliefLevel,
  screenToLatLon,
  zoomAbout,
  zoomExtent,
  type MapView,
} from "./view";

const readRepo = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url));
const fixtureSites = JSON.parse(readRepo("data/fixtures/sites.json").toString("utf8")) as Site[];
const realSites = JSON.parse(readRepo("data/derived/sites.json").toString("utf8")) as Site[];
const realFeatures = JSON.parse(readRepo("data/derived/features.json").toString("utf8")) as Feature[];

function grid(file: string, size: number): LookupGrid {
  const bytes = readRepo(file);
  return { values: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), size, halfWidthM: 304_000 };
}

function space(width: number, height: number, rect: { x: number; y: number; width: number; height: number }): FreeSpace {
  return { ...rect, viewport: { width, height }, windowOpen: false };
}

const VIEWS: MapView[] = [
  { k: 0.7, x: 720, y: 450 },
  { k: 5.3, x: -1200.5, y: 980.25 },
  { k: 83, x: 40_000, y: -12_000 },
];

describe("the map's screen mapping", () => {
  it("round-trips a pixel through latitude and longitude back to the same pixel", () => {
    for (const view of VIEWS) {
      for (const [x, y] of [
        [0, 0],
        [101.5, 333.25],
        [720, 450],
        [1439, 899],
        [12, 860],
      ] as const) {
        const { latDeg, lonDeg } = screenToLatLon(x, y, view);
        expect(lonDeg).toBeGreaterThanOrEqual(0);
        expect(lonDeg).toBeLessThan(360);
        const back = latLonToScreen(latDeg, lonDeg, view);
        expect(Math.abs(back.x - x)).toBeLessThan(1e-6);
        expect(Math.abs(back.y - y)).toBeLessThan(1e-6);
      }
    }
  });

  it("puts 0° E straight up from the pole and 90° E to the right", () => {
    const view: MapView = { k: 2, x: 500, y: 400 };
    const up = latLonToScreen(-88, 0, view);
    const right = latLonToScreen(-88, 90, view);
    expect(up.x).toBeCloseTo(500, 9);
    expect(up.y).toBeLessThan(400);
    expect(right.y).toBeCloseTo(400, 9);
    expect(right.x).toBeGreaterThan(500);
  });

  it("draws every relief pixel where its latitude and longitude put a pin", () => {
    // Pins sit on their features: the relief image is drawn by the same transform that
    // places pins, so a site's own image pixel lands under its pin at any zoom.
    for (const view of VIEWS) {
      for (const size of [4096, 8192]) {
        const rect = imageRect(view, 304_000);
        for (const site of realSites.filter((s) => onMap(s))) {
          const { col, row } = latLonToPixel(site.lat_deg, site.lon_deg, { half_width_m: 304_000, size_px: size });
          const fromImage = { x: rect.x + ((col + 0.5) / size) * rect.width, y: rect.y + ((row + 0.5) / size) * rect.height };
          const pin = latLonToScreen(site.lat_deg, site.lon_deg, view);
          expect(Math.abs(fromImage.x - pin.x)).toBeLessThan(1e-6 * Math.max(1, rect.width));
          expect(Math.abs(fromImage.y - pin.y)).toBeLessThan(1e-6 * Math.max(1, rect.width));
        }
      }
    }
  });

  it("puts Shackleton's rim site on the rim, by coordinates", () => {
    const shackleton = realFeatures.find((f) => f.name === "Shackleton");
    const rim = realSites.find((s) => s.id === "shackleton_rim");
    expect(shackleton && rim).toBeTruthy();
    if (!shackleton || !rim) return;
    const view: MapView = { k: 50, x: 0, y: 0 }; // 20 m a pixel
    const centre = latLonToScreen(shackleton.lat_deg, shackleton.lon_deg, view);
    const pin = latLonToScreen(rim.lat_deg, rim.lon_deg, view);
    const fromCentreKm = (Math.hypot(pin.x - centre.x, pin.y - centre.y) * metresPerPixel(view)) / 1000;
    const radiusKm = shackleton.diameter_km / 2;
    // Within 1.5 km of the 10.5 km rim radius: on the rim, not in the crater or out on the plain.
    expect(Math.abs(fromCentreKm - radiusKm)).toBeLessThan(1.5);
  });

  it("fits the ±304 km square in the free space, at the 3D camera's own scale", () => {
    for (const [w, h, rect] of [
      [1440, 900, { x: 288, y: 200, width: 864, height: 420 }],
      [1024, 768, { x: 80, y: 180, width: 864, height: 330 }],
      [390, 844, { x: 8, y: 150, width: 374, height: 520 }],
    ] as const) {
      const s = space(w, h, rect);
      const fit = fitView({ rect, boxHeight: h });
      const fromScene = arrivalView({ view: "map", pole: polarScale(polarPose(s), s) });
      expect(fromScene).not.toBeNull();
      if (!fromScene) return;
      expect(fit.x).toBeCloseTo(fromScene.x, 6);
      expect(fit.y).toBeCloseTo(fromScene.y, 6);
      expect(fit.k / fromScene.k).toBeCloseTo(1, 9);
    }
  });
});

/**
 * Where the 3D camera's Polar map pose draws a point on the globe: a pinhole camera straight
 * below the pole (features/three/scene/camera.ts `polarPose`), screen up along scene +x.
 */
function globeToScreen(latDeg: number, lonDeg: number, s: FreeSpace): { x: number; y: number } {
  const pose = polarPose(s);
  const [px, py, pz] = latLonToScene(latDeg, lonDeg);
  const depth = py - pose.pos[1];
  const focal = s.viewport.height / 2 / Math.tan((pose.fov * Math.PI) / 360);
  const centre = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  // Up the screen is scene +x; right is scene −z (Moon-fixed +y, 90° E).
  return { x: centre.x + (-pz * focal) / depth, y: centre.y - (px * focal) / depth };
}

describe("the takeover from the globe", () => {
  it("keeps every pin within 1 % of the map's width at 80°S across the swap", () => {
    for (const [w, h, rect] of [
      [1440, 900, { x: 288, y: 200, width: 864, height: 420 }],
      [1024, 768, { x: 80, y: 180, width: 864, height: 330 }],
      [1440, 900, { x: 64, y: 120, width: 1312, height: 600 }],
    ] as const) {
      const s = space(w, h, rect);
      const view = takeoverView({ view: "map", pole: polarScale(polarPose(s), s) }, { x: 0, y: 0 }, h);
      if (!view) throw new Error("no view");
      const { x_m } = polarStereoForward(-80, 90);
      const widthAt80 = (2 * x_m) / metresPerPixel(view);
      const points = [
        ...fixtureSites.filter((site) => onMap(site)).map((site) => [site.lat_deg, site.lon_deg] as const),
        ...realSites.filter((site) => onMap(site)).map((site) => [site.lat_deg, site.lon_deg] as const),
        [-80, 0],
        [-80, 135],
        [-80, 270],
      ];
      for (const [lat, lon] of points) {
        const before = globeToScreen(lat, lon, s);
        const after = latLonToScreen(lat, lon, view);
        expect(Math.hypot(after.x - before.x, after.y - before.y) / widthAt80).toBeLessThan(0.01);
      }
    }
  });

  it("uses the 3D camera's own lens", () => {
    expect(GLOBE_LENS_DEG).toBe(SPACE_FOV);
  });

  it("measures the arrival from the window, and the map from its own box", () => {
    const view = arrivalView({ view: "map", pole: { x: 700, y: 420, metresPerPixel: 1500 } }, { x: 100, y: 20 });
    expect(view).toEqual({ k: 1000 / 1500, x: 600, y: 400 });
  });

  it("ignores an arrival that is not the Polar map's", () => {
    expect(arrivalView({ view: "system" })).toBeNull();
    expect(arrivalView({ view: "map" })).toBeNull();
    expect(arrivalView(null)).toBeNull();
  });

  it("waits for the flight in 3D, and opens at once with reduced motion or no WebGL", () => {
    expect(entryFor("3d", false)).toEqual({ wait: true, fadeMs: TAKEOVER_FADE_MS });
    expect(entryFor("3d", true)).toEqual({ wait: false, fadeMs: REDUCED_FADE_MS });
    expect(entryFor("flat", false)).toEqual({ wait: false, fadeMs: TAKEOVER_FADE_MS });
    expect(entryFor("flat", true)).toEqual({ wait: false, fadeMs: REDUCED_FADE_MS });
    expect(TAKEOVER_FADE_MS).toBe(260);
    expect(REDUCED_FADE_MS).toBe(400);
    expect(ARRIVAL_TIMEOUT_MS).toBeGreaterThan(1500);
  });
});

describe("the lookup readout", () => {
  const sunlight = grid("data/derived/maps/sunlight_u8.bin", 2048);
  const earthvis = grid("data/derived/maps/earthvis_u8.bin", 2048);

  it("reads the stored byte at hand-checked points", () => {
    // Bytes read by hand from the files (row × 2048 + column), cells by docs/science.md §2.3:
    // Connecting Ridge is cell (986, 1064), Shackleton rim (1014, 1045); 85°S 20° E is
    // (1198, 543) and 80°S 45° E is (1748, 299).
    expect(readLookup(sunlight, -89.4555, 222.6192)).toEqual({ kind: "value", fraction: 138 / 255 });
    expect(readLookup(sunlight, -89.7742, 203.4952)).toEqual({ kind: "value", fraction: 133 / 255 });
    expect(readLookup(earthvis, -89.4555, 222.6192)).toEqual({ kind: "value", fraction: 125 / 255 });
    expect(readLookup(earthvis, -89.7742, 203.4952)).toEqual({ kind: "value", fraction: 113 / 255 });
    expect(readLookup(sunlight, -85, 20)).toEqual({ kind: "value", fraction: 53 / 255 });
    expect(readLookup(sunlight, -80, 45)).toEqual({ kind: "value", fraction: 8 / 255 });
  });

  it("says no data for the byte 255, and outside off the grid", () => {
    const values = new Uint8Array(4 * 4).fill(100);
    values[1 * 4 + 1] = 255; // the cell just up and left of the pole
    const tiny: LookupGrid = { values, size: 4, halfWidthM: 304_000 };
    // Cell (1, 1) covers x from −152 to 0 km and y from 0 to +152 km: 315° E.
    expect(readLookup(tiny, -86, 315)).toEqual({ kind: "no-data" });
    expect(readLookup(tiny, -86, 45)).toEqual({ kind: "value", fraction: 100 / 255 });
    expect(readLookup(tiny, -60, 45)).toEqual({ kind: "outside" });
  });

  it("reads the shared fixture's small grid too", () => {
    const fixture = grid("data/fixtures/maps/sunlight_u8.bin", 64);
    const pole = readLookup(fixture, -89.999, 0);
    expect(pole.kind).toBe("value");
  });
});

describe("the nudge readout", () => {
  const v = (f: number) => ({ kind: "value", fraction: f }) as const;

  it("states both values and the direction, in whole percentages", () => {
    expect(nudgeLine("sunlight", v(0.83), v(0.55))).toBe(`Average sunlight 83${NNBSP}% → 55${NNBSP}%, lower`);
    expect(nudgeLine("earthvis", v(0.4), v(0.62))).toBe(`Average Earth visibility 40${NNBSP}% → 62${NNBSP}%, higher`);
  });

  it("calls two values the same when their whole percentages are", () => {
    expect(nudgeLine("sunlight", v(0.541), v(0.538))).toBe(`Average sunlight 54${NNBSP}% → 54${NNBSP}%, the same`);
    // 0.545 rounds to 55 and 0.535 to 54: the words follow the shown numbers.
    expect(nudgeLine("sunlight", v(0.546), v(0.535))).toBe(`Average sunlight 55${NNBSP}% → 54${NNBSP}%, lower`);
  });

  it("drops the direction word when either end has no data", () => {
    expect(nudgeLine("sunlight", v(0.5), { kind: "no-data" })).toBe(`Average sunlight 50${NNBSP}% → no data`);
    expect(nudgeLine("sunlight", { kind: "outside" }, v(0.5))).toBe(`Average sunlight no data → 50${NNBSP}%`);
  });

  it("matches the lookup grid at a hand-checked nudge", () => {
    const sunlight = grid("data/derived/maps/sunlight_u8.bin", 2048);
    const from = readLookup(sunlight, -89.4555, 222.6192); // 138 → 54 %
    const to = readLookup(sunlight, -89.7742, 203.4952); // 133 → 52 %
    expect(nudgeLine("sunlight", from, to)).toBe(`Average sunlight 54${NNBSP}% → 52${NNBSP}%, lower`);
  });

  it("words a sunlit peak's nearby range as TrueSouth's estimate", () => {
    expect(nearbyRangeLine({ radius_m: 160, points: 13, min: 0.397, max: 0.87 })).toBe(
      `Within 160${NNBSP}m of the listed point, average sunlight ranges from 40${NNBSP}% to 87${NNBSP}% (TrueSouth's six-year estimate).`,
    );
  });

  it("writes coordinates and distances plainly", () => {
    expect(coordinatesText(-89.45551, 222.6192)).toBe("−89.4555°, 222.62° E");
    expect(distanceText(149)).toBe(`150${NNBSP}m`);
    expect(distanceText(1234)).toBe(`1.2${NNBSP}km`);
    expect(distanceText(23_400)).toBe(`23${NNBSP}km`);
  });
});

describe("pins and labels keep their screen size", () => {
  const states = new Map<string, PinState>([["connecting_ridge", { kind: "status", status: "GO" }]]);
  const withVariant: Site[] = [
    ...realSites,
    {
      ...(realSites.find((s) => s.id === "connecting_ridge") as Site),
      id: "connecting_ridge_best_lit",
      name: "Connecting Ridge, best lit",
      lat_deg: -89.4567,
      lon_deg: 222.5,
      variant_of: "connecting_ridge",
      offset_m: 149,
    },
  ];

  it("draws each kind of pin at one radius at every zoom", () => {
    const radii = (view: MapView) =>
      placePins({ sites: realSites, selectedIds: ["connecting_ridge", "im2_athena"], focusedId: "connecting_ridge", states, view }).map(
        (pin) => [pin.site.id, pinRadius(pin)] as const,
      );
    const near = new Map(radii({ k: 80, x: 0, y: 0 }));
    const far = new Map(radii({ k: 0.7, x: 0, y: 0 }));
    for (const [id, r] of near) if (far.has(id)) expect(far.get(id)).toBe(r);
    expect(near.get("connecting_ridge")).toBe(PIN.focusRing);
  });

  it("keeps a scale bar between 30 and 120 px and words it as the spec does", () => {
    for (const k of [0.6, 1, 3, 10, 40, 83]) {
      const bar = scaleBar({ k, x: 0, y: 0 });
      expect(bar.px).toBeLessThanOrEqual(120);
      expect(bar.px).toBeGreaterThan(30);
      expect(bar.text).toMatch(/ · north is outward from the pole$/);
    }
    expect(scaleBar({ k: 2, x: 0, y: 0 }).text).toBe(`50${NNBSP}km · north is outward from the pole`);
  });

  it("names features only once they are wide enough on screen", () => {
    expect(featuresToName(realFeatures, { k: 0.7, x: 0, y: 0 }).map((f) => f.feature.name)).not.toContain("Shackleton");
    const named = featuresToName(realFeatures, { k: 4, x: 0, y: 0 }).map((f) => f.feature.name);
    expect(named).toContain("Shackleton");
  });

  it("never hides a best-lit variant under its parent", () => {
    const view: MapView = { k: 0.7, x: 600, y: 400 };
    const pins = placePins({
      sites: withVariant,
      selectedIds: ["connecting_ridge", "connecting_ridge_best_lit"],
      focusedId: "connecting_ridge",
      states,
      view,
    });
    const parent = pins.find((p) => p.site.id === "connecting_ridge");
    const variant = pins.find((p) => p.site.id === "connecting_ridge_best_lit");
    expect(parent && variant).toBeTruthy();
    if (!parent || !variant) return;
    expect(parent.folded).not.toContain("connecting_ridge_best_lit");
    expect(Math.hypot(variant.drawAt.x - parent.drawAt.x, variant.drawAt.y - parent.drawAt.y)).toBeGreaterThan(
      pinRadius(parent) + PIN.catalog,
    );
    expect(variant.parentId).toBe("connecting_ridge");
    // A click on the callout picks the variant, not its parent.
    expect(pinAt(pins, variant.drawAt)?.site.id).toBe("connecting_ridge_best_lit");
    // Far enough apart on screen, it is drawn where it really is.
    const close = placePins({ sites: withVariant, selectedIds: [], focusedId: null, states, view: { k: 600, x: 0, y: 0 } });
    const free = close.find((p) => p.site.id === "connecting_ridge_best_lit");
    expect(free?.drawAt).toEqual(free?.at);
  });

  it("folds crowded pins into the focused one", () => {
    const pins = placePins({ sites: realSites, selectedIds: [], focusedId: "shackleton_rim", states, view: { k: 0.7, x: 0, y: 0 } });
    const rim = pins.find((p) => p.site.id === "shackleton_rim");
    expect(rim?.folded.length).toBeGreaterThan(0);
    expect(pins.at(-1)?.site.id).toBe("shackleton_rim");
  });

  it("leaves the far contrast sites off the map", () => {
    expect(onMap(realSites.find((s) => s.id === "apollo11") as Site)).toBe(false);
    expect(onMap(realSites.find((s) => s.id === "chandrayaan3") as Site)).toBe(false);
    expect(onMap(realSites.find((s) => s.id === "im1_odysseus") as Site)).toBe(true);
  });
});

describe("zoom", () => {
  it("keeps the point under the pointer still", () => {
    const view: MapView = { k: 1, x: 500, y: 400 };
    const at = { x: 650, y: 300 };
    const before = screenToLatLon(at.x, at.y, view);
    const next = zoomAbout(view, 3, at, zoomExtent(view));
    const after = latLonToScreen(before.latDeg, before.lonDeg, next);
    expect(after.x).toBeCloseTo(at.x, 6);
    expect(after.y).toBeCloseTo(at.y, 6);
  });

  it("switches to the 8K relief once a 4K pixel would cover more than a device pixel", () => {
    expect(reliefLevel({ k: 1, x: 0, y: 0 }, 1)).toBe("4k");
    expect(reliefLevel({ k: 1000 / 140, x: 0, y: 0 }, 1)).toBe("8k");
    expect(reliefLevel({ k: 1000 / 280, x: 0, y: 0 }, 2)).toBe("8k");
  });
});

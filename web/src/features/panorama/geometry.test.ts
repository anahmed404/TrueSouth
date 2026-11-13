/**
 * The horizon chart's "Done when" checks (docs/features/panorama.md) that pure code can
 * show, against the shared fixture and the committed Connecting Ridge data.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Feature, Manifest, MissionProfile, SiteMeta } from "../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries, decodeSkyline, type DecodedSeries, type DecodedSkyline } from "../../data/decode/index";
import { windowLength } from "../../lib/scoring";
import { buildDrawing } from "./chart";
import {
  autoRange,
  azimuthAtX,
  chartFrame,
  chartScales,
  discShape,
  meanAzimuth,
  offsetFrom,
  skylineElAtOffset,
  skylineVertices,
  trackSegments,
  xOfAzimuth,
  zoomRange,
  type ChartScales,
  type SkylineVertex,
} from "./geometry";
import { answerSentence, bodyAt, labelTitle, skylineReading, visibility, VISIBILITY_WORDS } from "./readings";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type Site = { series: DecodedSeries; skyline: DecodedSkyline; meta: SiteMeta };

function loadSite(root: "fixtures" | "derived", siteId: string): Site {
  const dir = path.join(repoRoot, "data", root);
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  const read = (file: string) => {
    const bytes = readFileSync(path.join(dir, "sites", siteId, file));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
  };
  return {
    series: decodeSeries(read("series.bin"), SERIES_COLUMNS, manifest.time_grid.count, "series.bin"),
    skyline: decodeSkyline(read("skyline.bin"), manifest.skyline_bins, "skyline.bin"),
    meta: JSON.parse(readFileSync(path.join(dir, "sites", siteId, "meta.json"), "utf8")) as SiteMeta,
  };
}

const FIXTURE_SITES = ["fixture_ridge", "fixture_crater", "fixture_edge", "fixture_wide", "fixture_sphere"] as const;
const sites = Object.fromEntries(FIXTURE_SITES.map((id) => [id, loadSite("fixtures", id)])) as Record<(typeof FIXTURE_SITES)[number], Site>;
const ridge = loadSite("derived", "connecting_ridge");
const profiles = JSON.parse(readFileSync(path.join(repoRoot, "data", "fixtures", "profiles.json"), "utf8")) as MissionProfile[];
const im2 = profiles.find((p) => p.id === "im2_athena") ?? profiles[0]!;
const WINDOW = windowLength(im2.duration_days);

function scalesFor(site: Site, centreDeg: number, from: number, width = 720): ChartScales {
  const range = autoRange({
    skylineEl: site.skyline.el_deg,
    sunEl: site.series.sun_el,
    earthEl: site.series.earth_el,
    from,
    to: from + WINDOW,
    sunRadiusDeg: site.meta.sun_radius_deg,
    earthRadiusDeg: site.meta.earth_radius_deg,
  });
  return chartScales(chartFrame(width), centreDeg, range);
}

/** The vertices of an SVG path made of M and L commands. */
function pathPoints(d: string): [number, number][] {
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe("the skyline is the stored el_deg, bin by bin", () => {
  for (const id of FIXTURE_SITES) {
    it(`${id}: every bin is a vertex at its centre azimuth and its stored elevation`, () => {
      const { skyline } = sites[id];
      for (const centre of [0, 137.3, 222.125, 359.9]) {
        const vertices = skylineVertices(skyline.el_deg, centre);
        const seen = new Set<number>();
        vertices.forEach((v, i) => {
          expect(v.el).toBe(skyline.el_deg[v.bin]);
          expect(offsetFrom(centre, v.bin * 0.25)).toBeCloseTo(((v.offset + 540) % 360) - 180, 9);
          if (i > 0) expect(v.offset - (vertices[i - 1] as SkylineVertex).offset).toBeCloseTo(0.25, 9);
          seen.add(v.bin);
        });
        expect(seen.size).toBe(1440);
        // The line spans the whole chart, edge to edge.
        expect(vertices[0]!.offset).toBeLessThan(-180);
        expect(vertices.at(-1)!.offset).toBeGreaterThanOrEqual(180);
      }
    });
  }

  it("the drawn path's y values give back el_deg (Connecting Ridge, real data)", () => {
    const scales = scalesFor(ridge, 137, 0);
    const drawing = buildDrawing(scales, ridge.skyline, null, null, null);
    const points = pathPoints(drawing.skylineD ?? "");
    expect(points).toHaveLength(drawing.vertices.length);
    points.forEach(([px, py], i) => {
      const v = drawing.vertices[i]!;
      // Two decimals of a pixel, so within 0.005 px.
      expect(Math.abs(scales.y.invert(py) - ridge.skyline.el_deg[v.bin]!)).toBeLessThan(0.006 / scales.pyPerDeg);
      expect(Math.abs(px - scales.x(v.offset))).toBeLessThanOrEqual(0.0051);
    });
  });
});

/** The share of a drawn disc above the drawn skyline line, by sampling the ellipse in pixels. */
function drawnFractionAbove(scales: ChartScales, vertices: SkylineVertex[], azDeg: number, elDeg: number, radius: number): number {
  const disc = discShape(scales, azDeg, elDeg, radius);
  let inside = 0;
  let above = 0;
  const n = 200;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = -1 + (2 * (i + 0.5)) / n;
      const w = -1 + (2 * (j + 0.5)) / n;
      if (u * u + w * w > 1) continue;
      const px = disc.cx + u * disc.rx;
      const py = disc.cy + w * disc.ry;
      inside++;
      const skyY = scales.y(skylineElAtOffset(vertices, scales.x.invert(px)));
      if (py < skyY) above++;
    }
  }
  return above / inside;
}

describe("a disc whose stored disc fraction is 0.5 is drawn half above the skyline", () => {
  const cases: [string, Site, number][] = [
    ["fixture_crater", sites.fixture_crater, 3095],
    ["fixture_ridge", sites.fixture_ridge, 4776],
    ["fixture_wide", sites.fixture_wide, 213],
    ["connecting_ridge (real data)", ridge, 201],
  ];
  for (const [name, site, hour] of cases) {
    it(`${name}, hour ${hour}`, () => {
      const sun = bodyAt(site.series, "sun", hour)!;
      expect(sun.frac).toBeCloseTo(0.5, 2);
      const scales = scalesFor(site, sun.azDeg, hour);
      const vertices = skylineVertices(site.skyline.el_deg, scales.centreDeg);
      const drawn = drawnFractionAbove(scales, vertices, sun.azDeg, sun.elDeg, site.meta.sun_radius_deg);
      expect(Math.abs(drawn - sun.frac)).toBeLessThan(0.06);
    });
  }

  it("and a disc with fraction 1 or 0 is drawn wholly above or below", () => {
    const site = sites.fixture_ridge;
    let checked = 0;
    for (let hour = 0; hour < 2000 && checked < 16; hour += 7) {
      const sun = bodyAt(site.series, "sun", hour)!;
      if (sun.frac !== 0 && sun.frac !== 1) continue;
      const scales = scalesFor(site, 0, hour);
      const vertices = skylineVertices(site.skyline.el_deg, 0);
      expect(drawnFractionAbove(scales, vertices, sun.azDeg, sun.elDeg, site.meta.sun_radius_deg)).toBeCloseTo(sun.frac, 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("centred on Earth, Earth's path is never split", () => {
  const all: [string, Site][] = [...FIXTURE_SITES.map((id) => [id, sites[id]] as [string, Site]), ["connecting_ridge", ridge]];
  for (const [name, site] of all) {
    it(name, () => {
      const count = site.series.earth_az.length;
      for (let landing = 0; landing + WINDOW <= count; landing += 977) {
        const centre = meanAzimuth(site.series.earth_az, landing, landing + WINDOW);
        expect(centre).not.toBeNull();
        const segments = trackSegments(site.series.earth_az, site.series.earth_el, landing, landing + WINDOW, centre!);
        expect(segments).toHaveLength(1);
      }
    });
  }
});

describe("tracks split where they wrap past the chart's edge", () => {
  it("splits a crossing into two pieces that each run to the edge", () => {
    const az = [170, 175, 179, 181, 185];
    const el = [1, 1.1, 1.2, 1.3, 1.4];
    const segments = trackSegments(az, el, 0, az.length, 0);
    expect(segments).toHaveLength(2);
    const [left, right] = segments as [ReturnType<typeof trackSegments>[0], ReturnType<typeof trackSegments>[0]];
    expect(left.map((p) => p.hour)).toEqual([0, 1, 2, 3]);
    expect(left.at(-1)!.offset).toBeCloseTo(181, 9);
    expect(right.map((p) => p.hour)).toEqual([2, 3, 4]);
    expect(right[0]!.offset).toBeCloseTo(-181, 9);
    for (const segment of segments) {
      for (let i = 1; i < segment.length; i++) expect(Math.abs(segment[i]!.offset - segment[i - 1]!.offset)).toBeLessThan(180);
    }
  });

  it("the Sun circling the sky over a month splits once per lap", () => {
    const { series } = sites.fixture_ridge;
    const from = 0;
    const to = 24 * 30;
    const segments = trackSegments(series.sun_az, series.sun_el, from, to, 0);
    let crossings = 0;
    for (let h = from + 1; h < to; h++) {
      if (Math.abs(offsetFrom(0, series.sun_az[h]!) - offsetFrom(0, series.sun_az[h - 1]!)) > 180) crossings++;
    }
    expect(crossings).toBeGreaterThan(0);
    expect(segments).toHaveLength(crossings + 1);
    const hours = new Set(segments.flat().map((p) => p.hour));
    expect(hours.size).toBe(to - from);
  });

  it("averages directions across north", () => {
    expect(meanAzimuth([359, 1], 0, 2)).toBeCloseTo(0, 6);
    expect(meanAzimuth([350, 20], 0, 2)).toBeCloseTo(5, 6);
    expect(meanAzimuth([Number.NaN], 0, 1)).toBeNull();
  });
});

describe("hover values are the stored skyline arrays", () => {
  const features = JSON.parse(readFileSync(path.join(repoRoot, "data", "derived", "features.json"), "utf8")) as Feature[];
  it("on Connecting Ridge, at every 7th bin and between bins", () => {
    const scales = scalesFor(ridge, 137, 0);
    const sky = ridge.skyline;
    for (let bin = 0; bin < 1440; bin += 7) {
      for (const nudge of [0, 0.1, -0.12]) {
        const az = bin * 0.25 + nudge;
        const r = skylineReading(sky, az, features);
        expect(r.bin).toBe(bin);
        expect(r.azDeg).toBe(bin * 0.25);
        expect(r.elDeg).toBe(sky.el_deg[bin]);
        expect(r.blocker?.distKm).toBe(sky.dist_km[bin]);
        expect(r.blocker?.heightM).toBe(sky.height_m[bin]);
        expect(r.blocker?.latDeg).toBe(sky.lat_deg[bin]);
        expect(r.blocker?.lonDeg).toBe(sky.lon_deg[bin]);
      }
      // The pointer's x reads back the same bin.
      const x = xOfAzimuth(scales, bin * 0.25);
      expect(skylineReading(sky, azimuthAtX(scales, x), []).bin).toBe(bin);
    }
  });

  it("a sphere-tier site has no blocker to read", () => {
    const r = skylineReading(sites.fixture_sphere.skyline, 123.4, []);
    expect(r.elDeg).toBe(sites.fixture_sphere.skyline.el_deg[r.bin]);
    expect(r.blocker).toBeNull();
  });
});

describe('"in view" and "behind the skyline" are the series\' answer', () => {
  for (const id of ["fixture_ridge", "fixture_crater", "fixture_edge"] as const) {
    it(`${id}: every hour of a mission window`, () => {
      const { series } = sites[id];
      for (const landing of [0, 4700, 20000]) {
        for (let hour = landing; hour < landing + WINDOW; hour++) {
          for (const body of ["sun", "earth"] as const) {
            const frac = (body === "sun" ? series.sun_frac : series.earth_frac)[hour]!;
            const clear = (body === "sun" ? series.sun_clear : series.earth_clear)[hour]!;
            const now = bodyAt(series, body, hour)!;
            const expected = frac >= 1 ? "in_view" : frac <= 0 ? "blocked" : "partly";
            expect(visibility(now.frac)).toBe(expected);
            expect(labelTitle(now)).toContain(VISIBILITY_WORDS[expected]);
            // A disc wholly clear has its centre above the skyline; one wholly hidden, below.
            if (expected === "in_view") expect(clear).toBeGreaterThan(0);
            if (expected === "blocked") expect(clear).toBeLessThan(0);
          }
          const sentence = answerSentence(bodyAt(series, "sun", hour), bodyAt(series, "earth", hour));
          expect(sentence).toContain(`Sun `);
          expect(sentence).toContain(`; Earth `);
        }
      }
    });
  }
});

describe("the vertical range", () => {
  it("holds 0°, the skyline and both paths with their discs", () => {
    const site = sites.fixture_crater;
    const from = 3000;
    const range = scalesFor(site, 0, from).range;
    expect(range.lo).toBeLessThan(0);
    expect(range.hi).toBeGreaterThan(0);
    for (let h = from; h < from + WINDOW; h++) {
      expect(site.series.sun_el[h]! + site.meta.sun_radius_deg).toBeLessThanOrEqual(range.hi);
      expect(site.series.sun_el[h]! - site.meta.sun_radius_deg).toBeGreaterThanOrEqual(range.lo);
      expect(site.series.earth_el[h]! + site.meta.earth_radius_deg).toBeLessThanOrEqual(range.hi);
    }
    for (const el of site.skyline.el_deg) expect(el).toBeGreaterThanOrEqual(range.lo);
  });

  it("grows to fit a high Sun on a sphere-tier site", () => {
    const range = scalesFor(sites.fixture_sphere, 0, 3898).range;
    expect(range.hi - range.lo).toBeGreaterThan(30);
  });

  it("zooms about the pointer and stays inside ±90°", () => {
    const zoomed = zoomRange({ lo: -2, hi: 6 }, 0.5, 2);
    expect(zoomed).toEqual({ lo: 0, hi: 4 });
    const out = zoomRange({ lo: -80, hi: 80 }, 2, 0);
    expect(out.lo).toBeGreaterThanOrEqual(-90);
    expect(out.hi).toBeLessThanOrEqual(90);
  });
});

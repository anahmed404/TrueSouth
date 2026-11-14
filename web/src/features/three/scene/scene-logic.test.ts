import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import type { MissionProfile } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index.ts";
import { MOON_RADIUS_M, latLonToScene, siteFrameScene, siteGroundScene } from "../../../lib/geo";
import { hourFlags } from "../../../lib/scoring";
import {
  EYE_HEIGHT,
  TERRAIN_DISTANCE,
  easeInOutCubic,
  eyePose,
  fitDistance,
  freeCentre,
  homePose,
  lerpPose,
  polarPose,
  polarScale,
  terrainPose,
  viewOffset,
  type Pose,
  type SiteFrame,
  type Subjects,
} from "./camera";
import { groupPins, moreSitesLine } from "./pins";
import { DRAWN_EARTH_RADIUS, EARTH_FARTHEST_KM, bodyInFront, drawnDistance, drawnSun } from "./proportions";
import { bodyLabel, formatSignedDeg, sightGood, sightLabel, sightState } from "./sight";
import { cross, dot, len, norm, sub } from "./vec";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../../../../data/fixtures");

function space(x: number, y: number, width: number, height: number, vw = 1440, vh = 900): FreeSpace {
  return { x, y, width, height, viewport: { width: vw, height: vh }, windowOpen: false };
}

/** Where a scene point lands on screen for a pose, with the principal point at the free space's centre. */
function project(pose: Pose, point: readonly [number, number, number], fs: FreeSpace): { x: number; y: number } {
  const forward = norm(pose.look);
  const up = norm(sub(pose.up, [forward[0] * dot(pose.up, forward), forward[1] * dot(pose.up, forward), forward[2] * dot(pose.up, forward)]));
  const right = norm(cross(forward, up));
  const rel = sub(point, pose.pos);
  const depth = dot(rel, forward);
  const f = fs.viewport.height / 2 / Math.tan((pose.fov * Math.PI) / 360);
  const centre = freeCentre(fs);
  return { x: centre.x + (dot(rel, right) / depth) * f, y: centre.y - (dot(rel, up) / depth) * f };
}

describe("the camera keeps its subject in the free space", () => {
  it("moves the principal point to the free space's centre", () => {
    // Laptop: rail 320 px on the left, focused-site panel 360 px on the right.
    const fs = space(336, 120, 728, 560);
    const offset = viewOffset(fs);
    // The full frustum's centre (720, 450) lands at the free space's centre (700, 400).
    expect(offset).toEqual({ x: 720 - 700, y: 450 - 400, width: 1440, height: 900 });
    expect(freeCentre(fs)).toEqual({ x: 700, y: 400 });
  });

  it("with no free space left, keeps the window's centre", () => {
    expect(viewOffset(space(700, 400, 0, 0))).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  });

  it("backs off further when the free space is smaller", () => {
    const open = fitDistance(1, 1, 30, space(336, 120, 728, 560));
    const folded = fitDistance(1, 1, 30, space(16, 120, 1408, 700));
    expect(folded).toBeLessThan(open);
  });

  const inside = (p: { x: number; y: number }, fs: FreeSpace) =>
    p.x > fs.x && p.x < fs.x + fs.width && p.y > fs.y && p.y < fs.y + fs.height;
  /** The four layouts: 1440 × 900 and 1024 × 768, panels open and folded (measured in the app). */
  const layouts = {
    "1440 open": space(288, 131, 793, 424),
    "1440 folded": space(80, 131, 1280, 424),
    "1024 open": space(288, 131, 376, 244, 1024, 768),
    "1024 folded": space(80, 131, 864, 244, 1024, 768),
  };
  /** Earth at the series' extremes: libration ±7° by ±8.5° (proportions.test.ts checks the series stays inside), perigee and apogee. */
  const earths: Subjects["earth"][] = [];
  for (const lat of [-7, 0, 7]) {
    for (const lon of [-8.5, 0, 8.5]) {
      for (const km of [356_000, EARTH_FARTHEST_KM]) {
        const u = latLonToScene(lat, lon);
        const d = drawnDistance(km);
        earths.push({ centre: [u[0] * d, u[1] * d, u[2] * d], radius: DRAWN_EARTH_RADIUS });
      }
    }
  }
  const sunAt = (deg: number, km: number): NonNullable<Subjects["sun"]> => {
    const dir: [number, number, number] = [Math.cos((deg * Math.PI) / 180), 0.03, Math.sin((deg * Math.PI) / 180)];
    return { dir, ...drawnSun(dir, km) };
  };
  /** A disc's on-screen centre and radius, seen from `pose`. */
  const disc = (pose: Pose, centre: readonly [number, number, number], radius: number, fs: FreeSpace) => {
    const c = project(pose, centre, fs);
    const up = norm(pose.up);
    const edge = project(pose, [centre[0] + up[0] * radius, centre[1] + up[1] * radius, centre[2] + up[2] * radius], fs);
    return { x: c.x, y: c.y, r: Math.hypot(edge.x - c.x, edge.y - c.y) };
  };

  it("System view home: the Moon centred where main puts it, the same camera at every hour", () => {
    for (const fs of Object.values(layouts)) {
      const first = homePose({ earth: earths[0]!, sun: sunAt(0, 149_600_000) }, fs);
      for (const earth of earths) {
        for (const deg of [0, 90, 180, 270]) {
          expect(homePose({ earth, sun: sunAt(deg, 149_600_000) }, fs)).toEqual(first);
        }
      }
      const moon = project(first, [0, 0, 0], fs);
      expect(moon.x).toBeCloseTo(freeCentre(fs).x, 6);
      expect(moon.y).toBeCloseTo(freeCentre(fs).y, 6);
      // Looking at the Moon from under the south pole, leaning 15° away from Earth's side.
      expect(first.look[1]).toBeCloseTo(Math.cos((15 * Math.PI) / 180), 12);
    }
  });

  it("System view home: the Moon at least 90 px in radius at 1440 × 900 with the panels open, and about 45 px at 1024 × 768", () => {
    for (const [name, fs] of Object.entries(layouts)) {
      const pose = homePose({ earth: earths[0]!, sun: sunAt(0, 149_600_000) }, fs);
      const moon = disc(pose, [0, 0, 0], 1, fs);
      expect(moon.r).toBeGreaterThanOrEqual(name === "1440 open" ? 90 : 44.5);
    }
  });

  it("System view home: Earth whole in view beside the Moon, about 0.8 times its size, clear of the Moon, the marks and its label room", () => {
    for (const fs of Object.values(layouts)) {
      for (const earth of earths) {
        const pose = homePose({ earth, sun: sunAt(0, 149_600_000) }, fs);
        const moon = disc(pose, [0, 0, 0], 1, fs);
        const e = disc(pose, earth.centre, earth.radius, fs);
        // Smaller than the Moon on screen, so the Moon leads: drawn 0.83, a little further from the camera.
        expect(e.r / moon.r).toBeGreaterThanOrEqual(0.75);
        // Behind the Moon's centre as seen from the camera, so it is never "in front" and always drawn.
        expect(bodyInFront(pose.pos, earth, true)).toBe(false);
        expect(e.r / moon.r).toBeLessThanOrEqual(0.85);
        // To the Moon's left, clear of its disc and of the sight-line marks' far ends (1.15 Moon
        // radii from the site, with their labels to the right of them).
        expect(e.x + e.r).toBeLessThan(moon.x - 1.15 * moon.r - 10);
        // Its label (about 30 px) fits below it, and it stays inside the free space top to bottom.
        expect(e.y - e.r).toBeGreaterThan(fs.y);
        expect(e.y + e.r + 34).toBeLessThan(fs.y + fs.height);
        // Whole inside the free space in every layout: never a slice behind or between panels.
        expect(e.x - e.r).toBeGreaterThan(fs.x);
      }
    }
  });

  it("System view home: the Sun's disc and glow stay outside the free space at any hour", () => {
    for (const fs of Object.values(layouts)) {
      const pose = homePose({ earth: earths[0]!, sun: sunAt(0, 149_600_000) }, fs);
      for (let deg = 0; deg < 360; deg += 5) {
        for (const km of [147_000_000, 152_200_000]) {
          const sun = sunAt(deg, km);
          const d = disc(pose, sun.centre, sun.radius * 1.8, fs);
          const nearestX = Math.max(fs.x, Math.min(d.x, fs.x + fs.width));
          const nearestY = Math.max(fs.y, Math.min(d.y, fs.y + fs.height));
          expect(Math.hypot(d.x - nearestX, d.y - nearestY)).toBeGreaterThan(d.r);
        }
      }
    }
  });

  it("System view home: a tall phone free space puts Earth above the Moon", () => {
    const fs = space(8, 150, 374, 480, 390, 844);
    const pose = homePose({ earth: earths[0]!, sun: sunAt(0, 149_600_000) }, fs);
    const e = project(pose, earths[0]!.centre, fs);
    const moon = project(pose, [0, 0, 0], fs);
    expect(moon.y - e.y).toBeGreaterThan(Math.abs(e.x - moon.x));
  });

  const subjects: Subjects = { earth: earths[0]!, sun: sunAt(0, 149_600_000) };

  it("True scale home still frames the Moon and Earth at its real distance, the Moon centred", () => {
    const fs = layouts["1440 open"];
    const pose = homePose({ earth: { centre: [221, 0, 0], radius: 3.67 }, sun: null }, fs);
    const e = project(pose, [221, 0, 0], fs);
    expect(inside(e, fs)).toBe(true);
    const moon = project(pose, [0, 0, 0], fs);
    expect(moon.x).toBeCloseTo(freeCentre(fs).x, 6);
  });

  it("Polar map: straight below the pole, map north (0° E, scene +x) at the top, the cap filling the free space", () => {
    const fs = space(336, 120, 728, 560);
    const pose = polarPose(fs);
    expect(pose.look).toEqual([0, 1, 0]);
    expect(pose.up).toEqual([1, 0, 0]);
    const pole = project(pose, [0, -1, 0], fs);
    expect(pole.x).toBeCloseTo(700, 6);
    expect(pole.y).toBeCloseTo(400, 6);
    // 80° S on the 0° meridian is straight up the screen from the pole, inside the free space.
    const rim = project(pose, [304_000 / MOON_RADIUS_M, -1, 0], fs);
    expect(rim.x).toBeCloseTo(700, 6);
    expect(rim.y).toBeLessThan(pole.y);
    expect(rim.y).toBeGreaterThan(fs.y);
    // The scale reported to the flat map: 304 km over the pixels from the pole to the rim.
    const scale = polarScale(pose, fs);
    expect(scale.metresPerPixel).toBeCloseTo(304_000 / (pole.y - rim.y), 0);
  });

  it("Local terrain and Lander's eye: the camera's target is the focused site", () => {
    const lat = -89.4555;
    const lon = 222.6192;
    const f = siteFrameScene(lat, lon);
    const frame: SiteFrame = { ground: siteGroundScene(lat, lon, 1950.5), ...f };
    const terrain = terrainPose(frame, 100, 340);
    expect(len(sub(terrain.pos, frame.ground))).toBeCloseTo(TERRAIN_DISTANCE, 12);
    // It looks straight at the site's ground point.
    expect(dot(norm(sub(frame.ground, terrain.pos)), terrain.look)).toBeCloseTo(1, 12);
    const fs = space(336, 120, 728, 560);
    const site = project(terrain, frame.ground, fs);
    expect(site.x).toBeCloseTo(700, 4);
    expect(site.y).toBeCloseTo(400, 4);

    const eye = eyePose(frame, 340, 4);
    expect(len(sub(eye.pos, frame.ground)) * MOON_RADIUS_M).toBeCloseTo(2, 6);
    expect(EYE_HEIGHT * MOON_RADIUS_M).toBeCloseTo(2, 12);
    // Looking along the horizon toward azimuth 340°, tipped up by half the body's elevation.
    const elevation = (Math.asin(dot(eye.look, frame.up)) * 180) / Math.PI;
    expect(elevation).toBeCloseTo(2, 9);
  });

  it("a flight never passes through the Moon and ends on its target", () => {
    const fs = space(336, 120, 728, 560);
    const from = homePose(subjects, fs);
    const lat = -89.4555;
    const lon = 222.6192;
    const frame: SiteFrame = { ground: siteGroundScene(lat, lon, 1950.5), ...siteFrameScene(lat, lon) };
    const to = terrainPose(frame, 100, 340);
    for (let i = 0; i <= 100; i += 1) {
      const p = lerpPose(from, to, easeInOutCubic(i / 100));
      expect(len(p.pos)).toBeGreaterThan(1);
    }
    const end = lerpPose(from, to, 1);
    expect(len(sub(end.pos, to.pos))).toBeLessThan(1e-9);
  });
});

describe("pins that crowd together", () => {
  it("fold into the focused pin when closer than 18 px", () => {
    const groups = groupPins(
      [
        { id: "a", x: 100, y: 100, visible: true },
        { id: "b", x: 110, y: 104, visible: true },
        { id: "c", x: 105, y: 92, visible: true },
        { id: "d", x: 300, y: 100, visible: true },
        { id: "e", x: 101, y: 101, visible: false },
      ],
      "c",
    );
    expect(groups).toEqual([
      { leader: "c", folded: ["a", "b"] },
      { leader: "d", folded: [] },
    ]);
    expect(moreSitesLine(2)).toBe("and 2 more sites here");
    expect(moreSitesLine(1)).toBe("and 1 more site here");
    expect(moreSitesLine(0)).toBeNull();
  });

  it("keep apart when 18 px or more apart", () => {
    const groups = groupPins(
      [
        { id: "a", x: 0, y: 0, visible: true },
        { id: "b", x: 18, y: 0, visible: true },
      ],
      null,
    );
    expect(groups.map((g) => g.leader)).toEqual(["a", "b"]);
  });
});

describe("sight-line states come from the fixture series through the hour flags", () => {
  const raw = readFileSync(path.join(fixtures, "sites/fixture_crater/series.bin"));
  const count = raw.byteLength / (SERIES_COLUMNS.length * 2);
  const series = decodeSeries(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    SERIES_COLUMNS,
    count,
    "series.bin",
  );
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const profile = profiles.find((p) => p.id === "im2_athena") ?? (profiles[0] as MissionProfile);
  const flags = hourFlags(series, profile);
  const find = (array: Uint8Array, value: number) => array.findIndex((v) => v === value);

  it("a lit hour and a dark hour", () => {
    const lit = find(flags.lit, 1);
    const dark = find(flags.lit, 0);
    expect(lit).toBeGreaterThanOrEqual(0);
    expect(dark).toBeGreaterThanOrEqual(0);
    const atLit = sightState(flags, lit)!;
    const atDark = sightState(flags, dark)!;
    expect(atLit.sun).toBe("lit");
    expect(atDark.sun).toBe("dark");
    expect(sightLabel("sun", atLit)).toBe("To the Sun: lit");
    expect(sightLabel("sun", atDark)).toBe("To the Sun: dark");
    expect(sightGood("sun", atLit)).toBe(true);
    expect(sightGood("sun", atDark)).toBe(false);
  });

  it("a link hour and a no-link hour", () => {
    const link = find(flags.link, 1);
    const none = find(flags.link, 0);
    expect(link).toBeGreaterThanOrEqual(0);
    expect(none).toBeGreaterThanOrEqual(0);
    expect(sightLabel("earth", sightState(flags, link)!)).toBe("To Earth: link");
    expect(sightLabel("earth", sightState(flags, none)!)).toBe("To Earth: no link");
    expect(sightGood("earth", sightState(flags, none)!)).toBe(false);
  });

  it("has no state outside the time grid", () => {
    expect(sightState(flags, -1)).toBeNull();
    expect(sightState(flags, flags.lit.length)).toBeNull();
  });
});

describe("the body labels in Lander's eye", () => {
  it("say up above the level and below level under it, never a negative up", () => {
    // Connecting Ridge, 2028-03-01T00:00Z: sun_el −1.07°, sun_frac 1.00 (the ridge sees past the level).
    expect(bodyLabel("sun", -1.07, 1, 0.7)).toBe("Sun, 1.1° below level · in view");
    expect(bodyLabel("earth", 0.9, 1, 1.4)).toBe("Earth, 0.9° up · in view");
  });

  it("take in view or not from the disc fraction, and the reason from the clearance", () => {
    expect(bodyLabel("sun", 0.8, 0, -0.6)).toBe("Sun, 0.8° up · behind the ridge");
    expect(bodyLabel("sun", 0.3, 0.4, -0.05)).toBe("Sun, 0.3° up · partly in view");
    expect(bodyLabel("earth", -2.4, 0, -3.1)).toBe("Earth, 2.4° below level · below the horizon");
  });

  it("never prints an ASCII hyphen for a negative number", () => {
    expect(formatSignedDeg(-1.07)).toBe("\u22121.1°");
    expect(formatSignedDeg(0.04)).toBe("0.0°");
    expect(formatSignedDeg(-0.04)).toBe("0.0°");
    for (const el of [-12.3, -0.06, 0, 0.06, 45]) {
      expect(bodyLabel("sun", el, 0.5, 0.1)).not.toMatch(/-/);
    }
  });
});

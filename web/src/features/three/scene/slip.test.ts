import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M, polarStereoForward, polarStereoInverse, surfacePointScene } from "../../../lib/geo";
import {
  SLIP_FIT_INSET,
  SLIP_MAX_DISTANCE,
  SLIP_MAX_EL_DEG,
  SLIP_MIN_DISTANCE,
  SLIP_MIN_EL_DEG,
  inSlipView,
  projectPose,
  slipLightBlend,
  slipOrbit,
  slipPose,
  slipZoom,
  type SlipSite,
} from "./slip";
import { add, cross, dot, len, mul, norm, sub } from "./vec";

const viewport = { width: 1440, height: 900 };
/** The free space with the side panels open and the landing-date panel below. */
const space: FreeSpace = { x: 272, y: 120, width: 824, height: 520, viewport, windowOpen: false };

/** Catalog-like polar sites (lat, east lon). */
const polar: SlipSite[] = [
  { latDeg: -89.45, lonDeg: 222.69 }, // Connecting Ridge
  { latDeg: -89.67, lonDeg: 230.0 }, // Shackleton rim
  { latDeg: -85.99, lonDeg: 0.97 }, // Malapert Massif
  { latDeg: -84.79, lonDeg: 1.39 }, // Mons Mouton
  { latDeg: -88.33, lonDeg: 291.0 }, // de Gerlache rim
];

const DEG = 180 / Math.PI;

function ringPoints(sites: readonly SlipSite[], ringM: number) {
  const points = [];
  for (const site of sites) {
    const p = polarStereoForward(site.latDeg, site.lonDeg);
    for (let a = 0; a < 8; a += 1) {
      const q = polarStereoInverse(p.x_m + ringM * Math.cos((a * Math.PI) / 4), p.y_m + ringM * Math.sin((a * Math.PI) / 4));
      points.push(surfacePointScene(q.latDeg, q.lonDeg));
    }
  }
  return points;
}

function inside(s: { x: number; y: number; front: boolean }) {
  return (
    s.front &&
    s.x > space.x + SLIP_FIT_INSET.side - 0.5 &&
    s.x < space.x + space.width - SLIP_FIT_INSET.side + 0.5 &&
    s.y > space.y + SLIP_FIT_INSET.top - 0.5 &&
    s.y < space.y + space.height - SLIP_FIT_INSET.bottom + 0.5
  );
}

describe("the Slip Planner's camera fit", () => {
  it("fits every site with 16 km around it inside the free space, leaving 90 px at the sides", () => {
    const pose = slipPose(polar, space);
    for (const point of ringPoints(polar, 16_000)) expect(inside(projectPose(pose, space, point))).toBe(true);
  });

  it("is tight: a little closer and some ground around a site leaves the free space", () => {
    const pose = slipPose(polar, space);
    const closer = { ...pose, pos: add(pose.centre, mul(sub(pose.pos, pose.centre), 0.9)) };
    const all = ringPoints(polar, 16_000).every((point) => inside(projectPose(closer, space, point)));
    expect(all).toBe(false);
  });

  it("frames one or two sites with 70 km of ground around them", () => {
    const one = [polar[2] as SlipSite];
    const pose = slipPose(one, space);
    for (const point of ringPoints(one, 70_000)) expect(inside(projectPose(pose, space, point))).toBe(true);
    const distanceKm = (len(sub(pose.pos, pose.centre)) * MOON_RADIUS_M) / 1000;
    expect(distanceKm).toBeGreaterThan(100);
  });

  it("stands on the pole's side of the sites, 30° up, and aims a little above them", () => {
    const pose = slipPose(polar, space);
    const rel = norm(sub(pose.pos, pose.centre));
    expect(Math.asin(dot(rel, pose.up0)) * DEG).toBeCloseTo(30, 6);
    // The camera is nearer the pole than the sites' centre is.
    const pole: [number, number, number] = [0, -1, 0];
    expect(len(sub(pose.pos, pole))).toBeLessThan(len(sub(pose.centre, pole)) + len(sub(pose.pos, pose.centre)));
    expect(dot(sub(pose.pos, pose.centre), sub(pole, pose.centre))).toBeGreaterThan(0);
    // The centre lands below the free space's middle: the curve shows above the sites.
    const c = projectPose(pose, space, pose.centre);
    expect(c.front).toBe(true);
    expect(c.y).toBeGreaterThan(space.y + space.height / 2 + 10);
    expect(Math.abs(c.x - (space.x + space.width / 2))).toBeLessThan(1);
  });

  it("refits for a new site set and for a smaller free space", () => {
    const wide = slipPose(polar, space);
    const narrow = slipPose(polar, { ...space, width: 420 });
    expect(len(sub(narrow.pos, narrow.centre))).toBeGreaterThan(len(sub(wide.pos, wide.centre)));
    const two = slipPose(polar.slice(0, 2), space);
    expect(len(sub(two.centre, wide.centre))).toBeGreaterThan(0);
  });

  it("frames the pole when no site is in the polar cap", () => {
    const pose = slipPose([], space);
    expect(pose.centre[1]).toBeCloseTo(-1, 6);
    expect(Number.isFinite(pose.pos[0])).toBe(true);
  });

  it("lights the ground from the view's top left, 55° up, whatever the date", () => {
    const pose = slipPose(polar, space);
    const elevation = Math.asin(dot(pose.light, pose.up0)) * DEG;
    expect(elevation).toBeGreaterThan(53);
    expect(elevation).toBeLessThan(57);
    const look = norm(pose.look);
    const right = norm(cross(look, pose.up));
    expect(dot(pose.light, right)).toBeLessThan(0); // from the left
    // Its level part points away from the camera, beyond the sites: the top of the view.
    const away = sub(pose.centre, pose.pos);
    const level = sub(away, mul(pose.up0, dot(away, pose.up0)));
    expect(dot(pose.light, level)).toBeGreaterThan(0);
    // The pose and light take no date: the same sites give the same light.
    expect(slipPose(polar, space).light).toEqual(pose.light);
  });
});

describe("which sites the Slip Planner draws", () => {
  it("draws sites in the polar cap with terrain, and leaves the rest to the off-view note", () => {
    expect(inSlipView({ lat_deg: -89.4, terrain_tier: "core80" })).toBe(true);
    expect(inSlipView({ lat_deg: -80.01, terrain_tier: "core80" })).toBe(true);
    expect(inSlipView({ lat_deg: -69, terrain_tier: "wide240" })).toBe(false);
    expect(inSlipView({ lat_deg: 0.67, terrain_tier: "sphere" })).toBe(false);
  });
});

describe("the Slip Planner's light blend", () => {
  it("blends in over the last 70 % of the flight in", () => {
    expect(slipLightBlend(0, true, 0)).toBe(0);
    expect(slipLightBlend(0, true, 0.3)).toBe(0);
    expect(slipLightBlend(0, true, 0.65)).toBeGreaterThan(0.3);
    expect(slipLightBlend(0, true, 1)).toBe(1);
  });

  it("blends back to the real Sun in the first 60 % of the next flight", () => {
    expect(slipLightBlend(1, false, 0)).toBe(1);
    expect(slipLightBlend(1, false, 0.3)).toBeGreaterThan(0.3);
    expect(slipLightBlend(1, false, 0.6)).toBe(0);
    expect(slipLightBlend(1, false, 1)).toBe(0);
  });
});

describe("the Slip Planner's orbit and zoom", () => {
  const pose = slipPose(polar, space);

  it("keeps the distance and stays between 28° and 88° up", () => {
    let pos = pose.pos;
    for (let i = 0; i < 40; i += 1) pos = slipOrbit(pos, pose.centre, pose.up0, 7, 25).pos;
    const rel = sub(pos, pose.centre);
    expect(len(rel)).toBeCloseTo(len(sub(pose.pos, pose.centre)), 9);
    expect(Math.asin(dot(norm(rel), pose.up0)) * DEG).toBeCloseTo(SLIP_MAX_EL_DEG, 6);
    for (let i = 0; i < 80; i += 1) pos = slipOrbit(pos, pose.centre, pose.up0, -3, -25).pos;
    expect(Math.asin(dot(norm(sub(pos, pose.centre)), pose.up0)) * DEG).toBeCloseTo(SLIP_MIN_EL_DEG, 6);
  });

  it("zooms from 60 km to 2,600 km from the sites' centre", () => {
    let pos = pose.pos;
    for (let i = 0; i < 60; i += 1) pos = slipZoom(pos, pose.centre, 0.7);
    expect(len(sub(pos, pose.centre))).toBeCloseTo(SLIP_MIN_DISTANCE, 12);
    for (let i = 0; i < 60; i += 1) pos = slipZoom(pos, pose.centre, 1.5);
    expect(len(sub(pos, pose.centre))).toBeCloseTo(SLIP_MAX_DISTANCE, 12);
  });
});

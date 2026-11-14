import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GLOBE_FULL_SEGMENTS } from "./ground";
import { MOON_SEGMENTS } from "./perf";
import { World } from "./world";

/** World.setMoonSegments, as the quality governor calls it while moving (scene-root.tsx). */
describe("the globe's mesh with ground on screen", () => {
  const widthSegments = (world: World) => {
    const moon = world.root.children.find((o) => o.name === "moon") as THREE.Mesh;
    return (moon.geometry as THREE.SphereGeometry).parameters.widthSegments;
  };

  it("keeps the finest mesh whatever the governor asks for, and follows it again once no ground is drawn", () => {
    const world = new World(() => undefined, 1);
    const ground = (world as unknown as { ground: THREE.Group }).ground;
    ground.visible = true;
    for (const n of MOON_SEGMENTS) {
      world.setMoonSegments(n);
      expect(widthSegments(world)).toBe(GLOBE_FULL_SEGMENTS);
    }
    ground.visible = false;
    world.setMoonSegments(96);
    expect(widthSegments(world)).toBe(96);
    world.dispose();
  });
});

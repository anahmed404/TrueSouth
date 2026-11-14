import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeTerrain } from "../../../data/decode";
import { siteFrameScene, siteGroundScene } from "../../../lib/geo";
import { createDataStore } from "../../../state/data";
import { CLOSEUP_GRACE_MS, CloseupHold, isGroundView, requestCloseup } from "./closeup-loading";
import { World, type WorldSite } from "./world";

/**
 * When the close-up is fetched and when it is let go (closeup-loading.ts): a spy on the fetch
 * behind a real data store, serving the shared fixtures (fixture_ridge has a close-up,
 * fixture_crater has none), with the view changing as the scene changes it.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtureRoot = path.join(repoRoot, "data", "fixtures");

function fixtureFetch() {
  return vi.fn(async (url: string) => {
    const file = path.join(fixtureRoot, url.replace(/^\/data\//, ""));
    try {
      const bytes = readFileSync(file);
      const type = file.endsWith(".json") ? "application/json" : "application/octet-stream";
      return new Response(bytes, { status: 200, headers: { "content-type": type } });
    } catch {
      return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
    }
  });
}

const closeupCalls = (spy: ReturnType<typeof fixtureFetch>) => spy.mock.calls.filter(([url]) => url.endsWith("/closeup.bin")).length;

/** Drives the hold through views as the scene does, asking the store whenever it wants the close-up. */
async function drive(siteId: string, views: string[], spy: ReturnType<typeof fixtureFetch>) {
  const store = createDataStore(spy);
  let wanted = false;
  const hold = new CloseupHold("system", (w) => (wanted = w));
  for (const view of views) {
    hold.setView(view);
    wanted = hold.wanted;
    if (wanted) await requestCloseup(store, siteId);
  }
  return { store, hold, wanted: () => wanted };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the close-up is fetched only for the views that draw it", () => {
  it("the ground views are Local terrain and Lander's eye", () => {
    expect(["terrain", "panorama"].map(isGroundView)).toEqual([true, true]);
    expect(["system", "map", "slip"].map(isGroundView)).toEqual([false, false, false]);
  });

  it("none in the System view, the Polar map or the Slip Planner", async () => {
    const spy = fixtureFetch();
    const run = await drive("fixture_ridge", ["system", "map", "slip", "system"], spy);
    expect(run.wanted()).toBe(false);
    expect(closeupCalls(spy)).toBe(0);
    run.hold.dispose();
  });

  it("one on entering a ground view (as its flight starts), and none more between the two ground views", async () => {
    const spy = fixtureFetch();
    const run = await drive("fixture_ridge", ["system", "terrain"], spy);
    expect(closeupCalls(spy)).toBe(1);
    expect(spy.mock.calls.find(([url]) => url.endsWith("/closeup.bin"))![0]).toBe("/data/sites/fixture_ridge/closeup.bin");
    for (const view of ["panorama", "terrain", "panorama"]) {
      run.hold.setView(view);
      await requestCloseup(run.store, "fixture_ridge");
    }
    expect(closeupCalls(spy)).toBe(1);
    run.hold.dispose();
  });

  it("a site without a close-up requests nothing, even in a ground view", async () => {
    const spy = fixtureFetch();
    const run = await drive("fixture_crater", ["system", "terrain", "panorama"], spy);
    expect(run.wanted()).toBe(true);
    expect(closeupCalls(spy)).toBe(0);
    run.hold.dispose();
  });
});

describe("the close-up is let go a grace period after leaving the ground views", () => {
  it("kept for CLOSEUP_GRACE_MS after leaving, then released; coming back within it keeps it", () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const hold = new CloseupHold("terrain", (w) => changes.push(w));
    expect(hold.wanted).toBe(true);
    hold.setView("system");
    vi.advanceTimersByTime(CLOSEUP_GRACE_MS - 1);
    expect(hold.wanted).toBe(true);
    // A quick look at the System view and back: nothing released, nothing built again.
    hold.setView("panorama");
    vi.advanceTimersByTime(CLOSEUP_GRACE_MS * 2);
    expect(hold.wanted).toBe(true);
    expect(changes).toEqual([]);
    // Leaving for good.
    hold.setView("map");
    hold.setView("slip");
    vi.advanceTimersByTime(CLOSEUP_GRACE_MS);
    expect(hold.wanted).toBe(false);
    expect(changes).toEqual([false]);
    hold.setView("terrain");
    expect(changes).toEqual([false, true]);
    hold.dispose();
  });

  it("released: the scene gives the ground without its close-up, and its geometry and height texture go", () => {
    const bytes = (name: string) => {
      const b = readFileSync(path.join(fixtureRoot, "sites", "fixture_ridge", name));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    };
    const patch = { data: decodeTerrain(bytes("terrain.bin"), 33, "terrain.bin"), size: 33, windowKm: 20 };
    const closeup = { data: decodeTerrain(bytes("closeup.bin"), 33, "closeup.bin"), size: 33, windowKm: 2 };
    const site: WorldSite = {
      id: "fixture_ridge",
      name: "Fixture ridge",
      latDeg: -85.3,
      lonDeg: 31.2,
      groundHeightM: 0,
      sphere: false,
      frame: { ground: siteGroundScene(-85.3, 31.2, 0), ...siteFrameScene(-85.3, 31.2) },
    };
    const world = new World(() => undefined, 1);
    world.setGround(site, { ...patch, closeup }, null);
    const ground = (world as unknown as { ground: THREE.Group }).ground;
    const meshes = ground.children.filter((m): m is THREE.Mesh => m instanceof THREE.Mesh);
    expect(meshes).toHaveLength(2);
    const spies = meshes.map((m) => vi.spyOn(m.geometry, "dispose"));
    // The same site, the close-up no longer wanted.
    world.setGround(site, { ...patch, closeup: null }, null);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(ground.children.filter((m) => m instanceof THREE.Mesh)).toHaveLength(1);
    expect(world.groundLook.uniforms.uClose.value.w).toBe(0);
    world.dispose();
  });
});

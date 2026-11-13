import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeApron } from "./decode/apron.ts";
import { loadSceneImage, type FetchLike } from "./load.ts";
import { parseSceneMeta } from "./parse.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureMeta = JSON.parse(
  readFileSync(path.join(repoRoot, "data", "fixtures", "scene", "meta.json"), "utf8"),
);

function arrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("scene meta", () => {
  it("accepts the fixture", () => {
    const meta = parseSceneMeta(fixtureMeta);
    expect(meta.schema_version).toBe(1);
    expect(meta.images.length).toBeGreaterThan(0);
    expect(meta.aprons.some((apron) => apron.site_id === "fixture_ridge")).toBe(true);
    expect(meta.aprons.some((apron) => apron.site_id === "fixture_sphere")).toBe(false);
  });

  it("rejects a wrong shape", () => {
    expect(() => parseSceneMeta({ ...fixtureMeta, schema_version: 2 })).toThrow(/schema_version 2/);
    expect(() => parseSceneMeta({ ...fixtureMeta, images: "moon" })).toThrow(/images/);
    expect(() => parseSceneMeta({ ...fixtureMeta, images: [] })).toThrow(/empty/);
    expect(() => parseSceneMeta({ ...fixtureMeta, apron: { dtype: "float32" } })).toThrow(/uint16/);
    expect(() => parseSceneMeta({ ...fixtureMeta, aprons: [{ site_id: "ridge" }] })).toThrow(/file/);
  });
});

describe("apron decoder", () => {
  it("reads two fixture cells that a transpose would swap", () => {
    const bytes = readFileSync(path.join(repoRoot, "data", "fixtures", "scene", "aprons", "fixture_ridge.bin"));
    const apron = decodeApron(arrayBuffer(bytes), 5, 5, "fixture_ridge.bin");
    // height = 1000 + 100 * row + 10 * column. (0, 1) is 1010 and (1, 0) is 1100.
    expect(apron.heights[0 * 5 + 1]).toBe(1010);
    expect(apron.heights[1 * 5 + 0]).toBe(1100);
    expect(apron.heights[1]).not.toBe(apron.heights[5]);
  });
});

describe("optional scene files", () => {
  it("reports a missing optional file as not available", async () => {
    const fetchImpl: FetchLike = async () => new Response("missing", { status: 404 });
    await expect(loadSceneImage("scene/moon_8k_w.webp", true, fetchImpl)).resolves.toBe("not available");
    await expect(loadSceneImage("scene/moon_4k.webp", false, fetchImpl)).rejects.toThrow(/moon_4k\.webp is missing/);
  });
});

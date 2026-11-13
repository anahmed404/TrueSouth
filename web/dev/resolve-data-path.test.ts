import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDataFile } from "./resolve-data-path";

const repoRoot = path.resolve("/repo");

describe("resolveDataFile", () => {
  it("serves derived data from data/derived", () => {
    expect(resolveDataFile(repoRoot, "/data/manifest.json", "derived")).toBe(
      path.resolve(repoRoot, "data/derived/manifest.json"),
    );
  });

  it("serves fixtures when VITE_DATA asks for them", () => {
    expect(resolveDataFile(repoRoot, "/data/sites/connecting_ridge/meta.json?x=1", "fixtures")).toBe(
      path.resolve(repoRoot, "data/fixtures/sites/connecting_ridge/meta.json"),
    );
  });

  it("rejects path traversal", () => {
    expect(resolveDataFile(repoRoot, "/data/../../package.json", "derived")).toBeNull();
    expect(resolveDataFile(repoRoot, "/data/foo/../../../package.json", "derived")).toBeNull();
    expect(resolveDataFile(repoRoot, "/data/%2e%2e/%2e%2e/package.json", "derived")).toBeNull();
    expect(resolveDataFile(repoRoot, "/data/..\\..\\package.json", "derived")).toBeNull();
  });

  it("ignores urls outside /data", () => {
    expect(resolveDataFile(repoRoot, "/api/health", "derived")).toBeNull();
  });
});

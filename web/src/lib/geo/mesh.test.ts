import { describe, expect, it } from "vitest";
import {
  LOCAL_TERRAIN_HALF_M,
  LOCAL_TERRAIN_SIZE,
  SKYLINE_BINS,
  SKYLINE_BIN_DEG,
} from "./constants";
import { skylineBinCentreDeg, skylineBinForAzimuth, terrainIndex, terrainOffsetM, terrainRowCol } from "./mesh";

describe("terrain.bin index", () => {
  it("puts row 0 on the northern edge and column 0 on the western edge", () => {
    expect(LOCAL_TERRAIN_SIZE).toBe(257);
    expect(LOCAL_TERRAIN_HALF_M).toBe(10_000);
    const size = LOCAL_TERRAIN_SIZE;
    const northWest = terrainOffsetM(0, 0, size, LOCAL_TERRAIN_HALF_M);
    const northEast = terrainOffsetM(0, size - 1, size, LOCAL_TERRAIN_HALF_M);
    const southWest = terrainOffsetM(size - 1, 0, size, LOCAL_TERRAIN_HALF_M);
    const centre = terrainOffsetM(128, 128, size, LOCAL_TERRAIN_HALF_M);

    expect(northWest.northM).toBeCloseTo(10_000, 8);
    expect(northWest.eastM).toBeCloseTo(-10_000, 8);
    expect(northEast.eastM).toBeCloseTo(10_000, 8);
    expect(southWest.northM).toBeCloseTo(-10_000, 8);
    expect(centre.eastM).toBeCloseTo(0, 8);
    expect(centre.northM).toBeCloseTo(0, 8);
  });

  it("round-trips a row-major index", () => {
    const size = 257;
    const index = terrainIndex(12, 40, size);
    expect(index).toBe(12 * size + 40);
    expect(terrainRowCol(index, size)).toEqual({ row: 12, col: 40 });
    expect(terrainIndex(0, 0, size)).toBe(0);
    expect(terrainRowCol(size * size - 1, size)).toEqual({ row: size - 1, col: size - 1 });
  });
});

describe("skyline bins", () => {
  it("centres bin k on azimuth 0.25k degrees", () => {
    expect(SKYLINE_BINS).toBe(1_440);
    expect(SKYLINE_BIN_DEG).toBe(0.25);
    expect(skylineBinCentreDeg(0)).toBe(0);
    expect(skylineBinCentreDeg(1)).toBe(0.25);
    expect(skylineBinCentreDeg(4)).toBe(1);
    expect(skylineBinCentreDeg(1_439)).toBeCloseTo(359.75, 12);
  });

  it("round-trips a bin centre and wraps 360° to bin 0", () => {
    expect(skylineBinForAzimuth(skylineBinCentreDeg(90))).toBe(90);
    expect(skylineBinForAzimuth(360)).toBe(0);
    expect(skylineBinForAzimuth(-0.25)).toBe(1_439);
  });
});

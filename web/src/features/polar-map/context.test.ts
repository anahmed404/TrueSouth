import { describe, expect, it } from "vitest";
import { latLonToPixel, polarStereoForward, type MapImage } from "../../lib/geo";
import { CONTEXT_LEVELS, contextTexel, equirectPixel, fillContextRows, toneContext } from "./context";

const W = 4096;
const H = 2048;

describe("where a place falls in the scene's Moon map (equirectangular, 0° E centred, north up)", () => {
  it("puts the poles, the equator and the meridians on the expected pixels", () => {
    expect(equirectPixel(-90, 0, W, H)).toEqual({ x: W / 2 - 0.5, y: H - 0.5 });
    expect(equirectPixel(90, 0, W, H).y).toBe(-0.5);
    expect(equirectPixel(0, 0, W, H)).toEqual({ x: W / 2 - 0.5, y: H / 2 - 0.5 });
    expect(equirectPixel(0, 90, W, H).x).toBe((3 * W) / 4 - 0.5);
    expect(equirectPixel(0, 270, W, H).x).toBe(W / 4 - 0.5);
    expect(equirectPixel(0, -90, W, H).x).toBe(W / 4 - 0.5);
    // 180° is the seam at the image's left (and right) edge.
    expect(equirectPixel(0, 180, W, H).x).toBe(-0.5);
  });

  it("places 80°S and 60°S at 0°, 90°, 180° and 270° E", () => {
    expect(equirectPixel(-80, 0, W, H)).toEqual({ x: 2047.5, y: (170 / 180) * H - 0.5 });
    expect(equirectPixel(-80, 90, W, H)).toEqual({ x: 3071.5, y: (170 / 180) * H - 0.5 });
    expect(equirectPixel(-60, 180, W, H)).toEqual({ x: -0.5, y: (150 / 180) * H - 0.5 });
    expect(equirectPixel(-60, 270, W, H)).toEqual({ x: 1023.5, y: (150 / 180) * H - 0.5 });
  });
});

describe("the context images, in the map's projection", () => {
  for (const level of CONTEXT_LEVELS) {
    const n = level.size_px;
    const centre = n / 2 - 0.5;

    it(`round-trips 80°S and 60°S at the four meridians (${n} px, ±${level.half_width_m / 1000} km)`, () => {
      for (const lat of [-80, -60]) {
        for (const lon of [0, 90, 180, 270]) {
          const { col, row } = latLonToPixel(lat, lon, level);
          const back = contextTexel(col, row, level);
          expect(back).not.toBeNull();
          expect(back?.latDeg).toBeCloseTo(lat, 9);
          expect(((back?.lonDeg ?? 0) - lon + 540) % 360 - 180).toBeCloseTo(0, 9);
        }
      }
    });

    it(`puts 0° E up, 90° E right, 180° down and 270° E left (${n} px)`, () => {
      const at = (lon: number) => latLonToPixel(-75, lon, level);
      expect(at(0).row).toBeLessThan(centre);
      expect(at(0).col).toBeCloseTo(centre, 6);
      expect(at(90).col).toBeGreaterThan(centre);
      expect(at(180).row).toBeGreaterThan(centre);
      expect(at(270).col).toBeLessThan(centre);
    });
  }

  it("reaches the equator in the outer image and about 59°S in the inner one", () => {
    const [outer, inner] = CONTEXT_LEVELS as [MapImage, MapImage];
    const r = (lat: number) => Math.hypot(polarStereoForward(lat, 0).x_m, polarStereoForward(lat, 0).y_m);
    expect(r(0)).toBeCloseTo(outer.half_width_m, 0);
    expect(r(-60)).toBeLessThan(inner.half_width_m);
    expect(inner.half_width_m).toBeLessThan(r(-59));
  });

  it("leaves everything north of the equator clear", () => {
    const [outer] = CONTEXT_LEVELS as [MapImage];
    // The outer image's corner is beyond the equator.
    expect(contextTexel(0, 0, outer)).toBeNull();
    expect(contextTexel(outer.size_px / 2, outer.size_px / 2, outer)).not.toBeNull();
  });
});

/** A made-up southern half of a W × H map whose brightness is set per pixel. */
function source(width: number, height: number, brightness: (x: number, yFull: number) => number) {
  const rowOffset = height / 2;
  const half = height - rowOffset;
  const data = new Uint8ClampedArray(width * half * 4);
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = brightness(x, y + rowOffset);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height: half, rowOffset };
}

describe("redrawing the Moon map, on a made-up source", () => {
  const level: MapImage = { half_width_m: 2 * 1_737_400, size_px: 64 };
  const n = level.size_px;
  const grey = (out: Uint8ClampedArray, col: number, row: number) => out[(row * n + col) * 4] as number;
  const alpha = (out: Uint8ClampedArray, col: number, row: number) => out[(row * n + col) * 4 + 3] as number;

  it("keeps east on the right: a bright eastern hemisphere lands right of the pole", () => {
    // Columns right of the centre are east longitudes (0° to 180° E).
    const src = source(256, 128, (x) => (x >= 128 ? 255 : 0));
    const out = new Uint8ClampedArray(n * n * 4);
    fillContextRows(out, level, src, 128, 0, n);
    const right = latLonToPixel(-45, 90, level);
    const left = latLonToPixel(-45, 270, level);
    expect(grey(out, Math.round(right.col), Math.round(right.row))).toBe(toneContext(255));
    expect(grey(out, Math.round(left.col), Math.round(left.row))).toBe(toneContext(0));
  });

  it("keeps the rows the right way: bright low latitudes land at the rim, a dark pole at the centre", () => {
    // Bright north of 45°S, dark south of it.
    const src = source(256, 128, (_x, y) => ((90 - ((y + 0.5) / 128) * 180) > -45 ? 255 : 0));
    const out = new Uint8ClampedArray(n * n * 4);
    fillContextRows(out, level, src, 128, 0, n);
    const pole = latLonToPixel(-89, 0, level);
    const rim = latLonToPixel(-20, 0, level);
    expect(grey(out, Math.round(pole.col), Math.round(pole.row))).toBe(toneContext(0));
    expect(grey(out, Math.round(rim.col), Math.round(rim.row))).toBe(toneContext(255));
  });

  it("is quieter than the relief: never brighter than about half white", () => {
    expect(toneContext(255)).toBeLessThanOrEqual(130);
    expect(toneContext(0)).toBeGreaterThan(0);
  });

  it("is clear north of the equator", () => {
    const src = source(256, 128, () => 200);
    const out = new Uint8ClampedArray(n * n * 4);
    fillContextRows(out, level, src, 128, 0, n);
    expect(alpha(out, 0, 0)).toBe(0);
    expect(alpha(out, n / 2, n / 2)).toBe(255);
  });

  it("joins across the ±180° seam without a dark line", () => {
    const src = source(256, 128, () => 200);
    const out = new Uint8ClampedArray(n * n * 4);
    fillContextRows(out, level, src, 128, 0, n);
    const seam = latLonToPixel(-45, 180, level);
    expect(grey(out, Math.round(seam.col), Math.round(seam.row))).toBe(toneContext(200));
  });
});

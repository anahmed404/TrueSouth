/**
 * The rest of the Moon around the Polar map's detailed square: NASA's LROC colour map (the
 * scene's own `scene/moon_4k.webp`), redrawn once in the map's south polar stereographic
 * projection (docs/science.md §2.3), greyed and dimmed so it reads as context, never as the
 * same quality as the 80 m terrain map. It is a picture: nothing reads a value from it.
 *
 * The source is equirectangular with 0° E at the centre and north up, as the scene's Moon
 * material samples it (features/three/scene/materials.ts): u = λ/360° + ½ with λ in
 * (−180°, 180°], v from the north pole at the top to the south pole at the bottom.
 */

import { useEffect, useState } from "react";
import { sceneImageUrl } from "../../data";
import { MOON_RADIUS_M, pixelToLatLon, type MapImage } from "../../lib/geo";

/** The scene's Moon colour map: 4,096 × 2,048, equirectangular (scene/meta.json). */
export const CONTEXT_SOURCE = "scene/moon_4k.webp";

/**
 * The two context images, drawn outer first. Each is a square centred on the pole, like the
 * maps in `maps/`:
 * - the whole southern hemisphere (out to the equator, ρ = 2R), coarse, 1,024 px: 6.8 km a pixel;
 * - out to 960 km from the pole (about 59°S), 2,048 px: 0.94 km a pixel, so the ground just
 *   around the detailed square is not blurred at the opening zoom.
 */
export const CONTEXT_LEVELS: readonly MapImage[] = [
  { half_width_m: 2 * MOON_RADIUS_M, size_px: 1024 },
  { half_width_m: 960_000, size_px: 2048 },
];

/**
 * Where a latitude and longitude falls in an equirectangular image of `width` × `height`
 * pixels with 0° E at the centre and north up, in pixel-centre coordinates (0 is the centre
 * of the first column or row). Longitude may be given from 0 to 360 or signed.
 */
export function equirectPixel(latDeg: number, lonDeg: number, width: number, height: number): { x: number; y: number } {
  // Signed longitude in [−180°, 180°): 180° E lands on the seam at the left edge.
  const signed = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  return {
    x: ((signed + 180) / 360) * width - 0.5,
    y: ((90 - latDeg) / 180) * height - 0.5,
  };
}

/**
 * The latitude and longitude a context pixel shows, by the map projection in lib/geo, or
 * null north of the equator (outside the southern hemisphere, which the context covers).
 */
export function contextTexel(col: number, row: number, level: MapImage): { latDeg: number; lonDeg: number } | null {
  const point = pixelToLatLon(col, row, level);
  return point.latDeg > 0 ? null : point;
}

/** Context tone: grey from the source's brightness, dimmed and flattened (0–255 in, 0–255 out). */
export const CONTEXT_TONE = { base: 16, gain: 0.4 } as const;

export function toneContext(luminance: number): number {
  return Math.round(CONTEXT_TONE.base + luminance * CONTEXT_TONE.gain);
}

/** The southern half of an equirectangular image's pixels, as RGBA. */
type Source = { data: Uint8ClampedArray; width: number; height: number; rowOffset: number };

/** Bilinear sample of the source's brightness, wrapping across the ±180° seam. */
function sampleLuminance(source: Source, x: number, yFull: number): number {
  const { data, width, height, rowOffset } = source;
  const y = Math.min(height - 1, Math.max(0, yFull - rowOffset));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = ((x0 % width) + width) % width;
  const xb = (xa + 1) % width;
  const ya = y0;
  const yb = Math.min(height - 1, y0 + 1);
  const lum = (xi: number, yi: number) => {
    const i = (yi * width + xi) * 4;
    return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
  };
  const top = lum(xa, ya) * (1 - fx) + lum(xb, ya) * fx;
  const bottom = lum(xa, yb) * (1 - fx) + lum(xb, yb) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Fills one context image's RGBA pixels, rows `from` to `to`. Pure apart from writing into
 * `out`, so a test can run it on a made-up source.
 */
export function fillContextRows(
  out: Uint8ClampedArray,
  level: MapImage,
  source: Source,
  fullHeight: number,
  from: number,
  to: number,
): void {
  const n = level.size_px;
  for (let row = from; row < to; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const i = (row * n + col) * 4;
      const point = contextTexel(col, row, level);
      if (!point) {
        out[i + 3] = 0;
        continue;
      }
      const { x, y } = equirectPixel(point.latDeg, point.lonDeg, source.width, fullHeight);
      const grey = toneContext(sampleLuminance(source, x, y));
      out[i] = grey;
      out[i + 1] = grey;
      out[i + 2] = grey;
      out[i + 3] = 255;
    }
  }
}

export type ContextLayer = { canvas: HTMLCanvasElement; level: MapImage };

const SLICE_MS = 8;

/**
 * Yields to the browser between slices. A message port is not clamped to 4 ms the way a
 * nested `setTimeout(0)` is, so the build does not idle between slices.
 */
function nextSlice(): Promise<void> {
  if (typeof MessageChannel === "undefined") return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

/**
 * Loads the Moon map and redraws it in the map's projection, a few rows at a time so no
 * frame stalls (each slice is about 8 ms). The source's pixels are let go when done.
 */
async function buildContext(signal: { cancelled: boolean }): Promise<ContextLayer[]> {
  const image = await loadImage(sceneImageUrl(CONTEXT_SOURCE));
  if (typeof image.decode === "function") await image.decode().catch(() => undefined);
  const fullHeight = image.naturalHeight;
  const width = image.naturalWidth;
  const rowOffset = Math.floor(fullHeight / 2);
  const half = document.createElement("canvas");
  half.width = width;
  half.height = fullHeight - rowOffset;
  const hctx = half.getContext("2d", { willReadFrequently: true });
  if (!hctx) throw new Error("No 2D canvas");
  hctx.drawImage(image, 0, rowOffset, width, half.height, 0, 0, width, half.height);
  const source: Source = { data: hctx.getImageData(0, 0, width, half.height).data, width, height: half.height, rowOffset };
  half.width = 0;
  half.height = 0;

  const layers: ContextLayer[] = [];
  for (const level of CONTEXT_LEVELS) {
    const n = level.size_px;
    const pixels = new ImageData(n, n);
    let row = 0;
    while (row < n) {
      if (signal.cancelled) throw new Error("cancelled");
      const start = performance.now();
      while (row < n && performance.now() - start < SLICE_MS) {
        const to = Math.min(n, row + 16);
        fillContextRows(pixels.data, level, source, fullHeight, row, to);
        row = to;
      }
      await nextSlice();
    }
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    canvas.getContext("2d")?.putImageData(pixels, 0, 0);
    layers.push({ canvas, level });
  }
  return layers;
}

let cached: ContextLayer[] | null = null;
let building: { promise: Promise<ContextLayer[]>; signal: { cancelled: boolean } } | null = null;

/** Starts the build if it is neither done nor running, and returns it. */
function startBuild(): Promise<ContextLayer[]> {
  if (building) return building.promise;
  const signal = { cancelled: false };
  const promise = buildContext(signal).then((layers) => {
    if (!signal.cancelled) cached = layers;
    return layers;
  });
  building = { promise, signal };
  promise.catch(() => {
    if (building?.promise === promise) building = null;
  });
  return promise;
}

/**
 * Starts building the context early, for example when the Polar map is picked and the camera
 * is still flying there, so it is ready by the time the flat map takes over.
 */
export function prefetchContext(): void {
  if (!cached) void startBuild().catch(() => undefined);
}

/** Lets the context images go (when the view is left). A build in progress stops. */
export function releaseContext(): void {
  if (building) building.signal.cancelled = true;
  building = null;
  if (cached) for (const layer of cached) layer.canvas.width = 0;
  cached = null;
}

export type ContextState = { status: "idle" | "building" | "error"; layers: null } | { status: "ready"; layers: ContextLayer[] };

/**
 * The context images: built when `build` is true (after the map's first paint), or used
 * from this session's cache when they already exist even if `build` is false.
 */
export function useMoonContext(build: boolean): ContextState {
  const [state, setState] = useState<ContextState>(() =>
    cached ? { status: "ready", layers: cached } : { status: "idle", layers: null },
  );
  useEffect(() => {
    if (cached) {
      setState({ status: "ready", layers: cached });
      return;
    }
    if (!build) return;
    let live = true;
    const promise = startBuild();
    setState({ status: "building", layers: null });
    promise.then(
      (layers) => live && setState({ status: "ready", layers }),
      (error: unknown) => live && !(error instanceof Error && error.message === "cancelled") && setState({ status: "error", layers: null }),
    );
    return () => {
      live = false;
    };
  }, [build]);
  return state;
}

/**
 * Draws the Polar map on a 2D canvas: the relief, an overlay, the graticule, pins and labels.
 *
 * Everything drawn is a picture. The relief's shading and the overlays never decide a result:
 * pin colours come from the evaluation (docs/features/polar-map.md, "What is behind").
 * Colours are read from the theme's tokens (web/src/app/theme.css), never typed here.
 */

import type { Feature } from "../../contracts/generated";
import type { Status } from "../../lib/scoring";
import { PIN, featuresToName, moreSitesLine, overlaps, type Box, type PlacedPin } from "./pins";
import { latLonToScreen, latitudeRadiusPx, planeToScreen, type MapView, type ScreenPoint } from "./view";

export type Palette = {
  space: string;
  ink: string;
  ink2: string;
  ink4: string;
  line: string;
  accent: string;
  plate: string;
  glyph: string;
  sun: string;
  earth: string;
  go: string;
  caution: string;
  nogo: string;
  font: string;
};

/** The theme's tokens, read from the document. */
export function readPalette(element: Element = document.documentElement): Palette {
  const style = getComputedStyle(element);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    space: v("--space", "#0b0b0c"),
    ink: v("--ink", "#ececee"),
    ink2: v("--ink-2", "#b3b3b8"),
    ink4: v("--ink-4", "#5c5c63"),
    line: v("--line-strong", "#37373b"),
    accent: v("--accent", "#f3efe6"),
    plate: v("--plate", "rgb(20 20 21 / 0.92)"),
    glyph: v("--status-glyph", "#0b0b0c"),
    sun: v("--sun", "#ffe2a0"),
    earth: v("--earth", "#6cc4ff"),
    go: v("--status-go", "#45c98b"),
    caution: v("--status-caution", "#f2a33a"),
    nogo: v("--status-nogo", "#f0646d"),
    font: v("--font", "system-ui, sans-serif"),
  };
}

/** Where a square map image centred on the pole is drawn, in CSS pixels. */
export function imageRect(view: MapView, halfWidthM: number): Box {
  const topLeft = planeToScreen(-halfWidthM, halfWidthM, view);
  const side = (2 * halfWidthM * view.k) / 1000;
  return { x: topLeft.x, y: topLeft.y, width: side, height: side };
}

type Drawable = CanvasImageSource & { width: number; height: number };

/** Draws only the part of a square image that is on screen, so the 8K image stays cheap. */
function drawClipped(ctx: CanvasRenderingContext2D, image: Drawable, rect: Box, width: number, height: number): void {
  if (image.width <= 0 || image.height <= 0) return;
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(width, rect.x + rect.width);
  const y1 = Math.min(height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return;
  const sx = ((x0 - rect.x) / rect.width) * image.width;
  const sy = ((y0 - rect.y) / rect.height) * image.height;
  const sw = ((x1 - x0) / rect.width) * image.width;
  const sh = ((y1 - y0) / rect.height) * image.height;
  ctx.drawImage(image, sx, sy, sw, sh, x0, y0, x1 - x0, y1 - y0);
}

export type OverlayLayer = { image: Drawable; tint: string; opacity: number };

export type Marker =
  /** The "New site here?" point. */
  | { kind: "point"; at: ScreenPoint }
  /** The nudged pin's position, tied to the site it came from. */
  | { kind: "nudge"; at: ScreenPoint; from: ScreenPoint; dragging: boolean };

export type DrawInput = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  view: MapView;
  halfWidthM: number;
  palette: Palette;
  relief: Drawable | null;
  overlay: OverlayLayer | null;
  /** A screen-sized scratch canvas for tinting the overlay. */
  scratch: HTMLCanvasElement | null;
  pins: readonly PlacedPin[];
  features: readonly Feature[];
  /** The lesson box: no catalog names and fewer labels. */
  compact: boolean;
  marker: Marker | null;
  /** The rest of the Moon around the square, drawn under it, quieter (context.ts). */
  context?: { layers: readonly { canvas: Drawable; level: { half_width_m: number } }[]; alpha: number } | null;
};

/** The label on the detailed square's border (CONTEXT.md, "Polar cap": the 80 m terrain map). */
export const DETAIL_LABEL = "Detailed terrain · 80 m map";

/**
 * Where the detailed square's label goes: just outside its top edge, from its left corner,
 * kept inside the box; under the bottom edge when the top one is off screen; or nowhere when
 * neither edge is on screen. Its size never changes with the zoom.
 */
export function detailLabelBox(rect: Box, labelWidth: number, box: { width: number; height: number }): Box | null {
  const h = 20;
  const w = labelWidth;
  if (rect.x + rect.width < 8 || rect.x > box.width - 8 || rect.width < w) return null;
  const x = Math.min(Math.max(rect.x, 8), rect.x + rect.width - w, box.width - 8 - w);
  if (rect.y - h - 4 >= 4 && rect.y <= box.height) return { x, y: rect.y - h - 4, width: w, height: h };
  const below = rect.y + rect.height + 4;
  if (below >= 4 && below + h <= box.height - 4) return { x, y: below, width: w, height: h };
  return null;
}

/** Draws one frame. */
export function drawMap(input: DrawInput): void {
  const { ctx, width, height, dpr, view, halfWidthM, palette } = input;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.space;
  ctx.fillRect(0, 0, width, height);

  if (input.context && input.context.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = input.context.alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const layer of input.context.layers) drawClipped(ctx, layer.canvas, imageRect(view, layer.level.half_width_m), width, height);
    ctx.restore();
  }

  const rect = imageRect(view, halfWidthM);
  if (input.relief) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawClipped(ctx, input.relief, rect, width, height);
  }
  if (input.overlay && input.scratch) drawOverlay(input, rect);
  drawGraticule(input);

  const taken: Box[] = [];
  const plates: (() => void)[] = [];
  drawDetailBorder(input, rect, taken, plates);
  drawTies(input);
  for (const pin of input.pins) drawPin(ctx, pin, palette);
  drawMarker(input);
  // Labels after pins, the focused pin's plate first so nothing covers it.
  const focused = input.pins.find((pin) => pin.focused);
  if (focused) labelPin(input, focused, taken, plates);
  for (const pin of input.pins) if (!pin.focused && pin.selected) labelPin(input, pin, taken, plates);
  for (const pin of input.pins) if (!pin.selected && !pin.focused && pin.folded.length > 0) foldBadge(input, pin, taken, plates);
  for (const pin of input.pins) for (const box of pinBoxes(pin)) taken.push(box);
  if (!input.compact) for (const pin of input.pins) if (!pin.selected && !pin.focused) labelCatalog(input, pin, taken, plates);
  labelFeatures(input, taken, plates);
  for (const plate of plates) plate();
}

function drawOverlay(input: DrawInput, rect: Box): void {
  const { ctx, width, height, dpr, overlay, scratch } = input;
  if (!overlay || !scratch) return;
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const s = scratch.getContext("2d");
  if (!s) return;
  s.setTransform(dpr, 0, 0, dpr, 0, 0);
  s.globalCompositeOperation = "source-over";
  s.clearRect(0, 0, width, height);
  s.imageSmoothingEnabled = true;
  s.imageSmoothingQuality = "high";
  // Grey 0..1 becomes black..tint; "no data" stays clear.
  drawClipped(s, overlay.image, rect, width, height);
  s.globalCompositeOperation = "multiply";
  s.fillStyle = overlay.tint;
  s.fillRect(0, 0, width, height);
  s.globalCompositeOperation = "destination-in";
  drawClipped(s, overlay.image, rect, width, height);
  s.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = overlay.opacity;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

/** Rings every degree from 80°S, meridians every 30°, labelled where they have room. */
function drawGraticule(input: DrawInput): void {
  const { ctx, view, palette } = input;
  const pole = planeToScreen(0, 0, view);
  const outer = latitudeRadiusPx(-80, view);
  const perDegree = latitudeRadiusPx(-89, view);
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lat = -89; lat <= -80; lat += 1) {
    const r = latitudeRadiusPx(lat, view);
    ctx.moveTo(pole.x + r, pole.y);
    ctx.arc(pole.x, pole.y, r, 0, Math.PI * 2);
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const end = latLonToScreen(-80, lon, view);
    ctx.moveTo(pole.x, pole.y);
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();
  ctx.restore();

  // Latitude labels along 0° E (straight up), every 1, 2 or 5 degrees as room allows.
  const every = [1, 2, 5, 10].find((n) => perDegree * n >= 30) ?? 10;
  ctx.save();
  ctx.font = `400 12px ${palette.font}`;
  for (let lat = -89; lat <= -80; lat += 1) {
    // 80°S is the map's edge, where the meridian labels sit.
    if (Math.abs(lat) % every !== 0 || lat === -80) continue;
    const r = latitudeRadiusPx(lat, view);
    const at = { x: pole.x + 4, y: pole.y - r };
    gridLabel(ctx, `${Math.abs(lat)}°S`, at, palette);
  }
  if (outer > 90) {
    for (let lon = 0; lon < 360; lon += 30) {
      const at = latLonToScreen(-79.6, lon, view);
      gridLabel(ctx, lon === 0 ? "0°" : lon === 180 ? "180°" : `${lon}° E`, at, palette, "centre");
    }
  }
  ctx.restore();
}

function gridLabel(ctx: CanvasRenderingContext2D, text: string, at: ScreenPoint, palette: Palette, align: "left" | "centre" = "left"): void {
  const w = ctx.measureText(text).width + 8;
  const x = align === "centre" ? at.x - w / 2 : at.x;
  const y = at.y - 9;
  plateRect(ctx, x, y, w, 18, palette.plate);
  ctx.fillStyle = palette.ink2;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 4, y + 9.5);
}

function plateRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
}

const GLYPH: Record<Status, string> = {
  GO: "M5 12.5l4.5 4.5L19 7.5",
  CAUTION: "M12 5.5v8M12 18.5v.2",
  "NO-GO": "M7 7l10 10M17 7L7 17",
};

function statusColour(status: Status, palette: Palette): string {
  return status === "GO" ? palette.go : status === "CAUTION" ? palette.caution : palette.nogo;
}

function circle(ctx: CanvasRenderingContext2D, at: ScreenPoint, r: number): void {
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
}

/** The hairlines that tie a best-lit variant to its true point and to its parent. */
function drawTies(input: DrawInput): void {
  const { ctx, palette, pins } = input;
  ctx.save();
  ctx.strokeStyle = palette.ink2;
  ctx.lineWidth = 1;
  for (const pin of pins) {
    if (pin.parentId === null) continue;
    const parent = pins.find((p) => p.site.id === pin.parentId || p.folded.includes(pin.parentId ?? ""));
    const moved = pin.drawAt.x !== pin.at.x || pin.drawAt.y !== pin.at.y;
    ctx.setLineDash([]);
    if (parent) {
      const d = Math.hypot(parent.drawAt.x - pin.drawAt.x, parent.drawAt.y - pin.drawAt.y);
      if (d < 160) {
        ctx.beginPath();
        ctx.moveTo(parent.drawAt.x, parent.drawAt.y);
        ctx.lineTo(pin.drawAt.x, pin.drawAt.y);
        ctx.stroke();
      }
    }
    if (moved) {
      // Its true point: a small dot under the parent's ring.
      ctx.fillStyle = palette.ink;
      circle(ctx, pin.at, 1.5);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPin(ctx: CanvasRenderingContext2D, pin: PlacedPin, palette: Palette): void {
  const at = pin.drawAt;
  ctx.save();
  if (!pin.selected && !pin.focused) {
    ctx.fillStyle = palette.space;
    circle(ctx, at, PIN.catalog + PIN.ring);
    ctx.fill();
    ctx.fillStyle = palette.ink2;
    circle(ctx, at, PIN.catalog);
    ctx.fill();
    if (pin.parentId !== null) dottedRing(ctx, at, PIN.catalog + 4, palette.ink2);
    ctx.restore();
    return;
  }
  // The selected ring, or the focused Moonlight ring.
  ctx.fillStyle = palette.space;
  circle(ctx, at, (pin.focused ? PIN.focusRing : PIN.selectedRing) + 1.5);
  ctx.fill();
  ctx.lineWidth = pin.focused ? 2 : 1.5;
  ctx.strokeStyle = pin.focused ? palette.accent : palette.ink2;
  circle(ctx, at, pin.focused ? PIN.focusRing : PIN.selectedRing);
  if (pin.parentId !== null) ctx.setLineDash([1.5, 2.5]);
  ctx.stroke();
  ctx.setLineDash([]);
  // The lamp with its cut glyph, or a grey lamp while loading or with no result.
  const state = pin.state;
  const fill = state.kind === "status" ? statusColour(state.status, palette) : palette.ink4;
  ctx.fillStyle = fill;
  circle(ctx, at, PIN.lamp);
  ctx.fill();
  const scale = (PIN.lamp * 2) / 24;
  ctx.translate(at.x - PIN.lamp, at.y - PIN.lamp);
  ctx.scale(scale, scale);
  ctx.strokeStyle = palette.glyph;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (state.kind === "status") ctx.stroke(new Path2D(GLYPH[state.status]));
  else if (state.kind === "none" || state.kind === "error") ctx.stroke(new Path2D("M7 12h10"));
  ctx.restore();
}

function dottedRing(ctx: CanvasRenderingContext2D, at: ScreenPoint, r: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.setLineDash([1.5, 2.5]);
  circle(ctx, at, r);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMarker(input: DrawInput): void {
  const { ctx, marker, palette } = input;
  if (!marker) return;
  ctx.save();
  if (marker.kind === "nudge") {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(marker.from.x, marker.from.y);
    ctx.lineTo(marker.at.x, marker.at.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = palette.space;
  circle(ctx, marker.at, 9);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  if (marker.kind === "nudge") ctx.setLineDash([4, 3]);
  circle(ctx, marker.at, 7.5);
  ctx.stroke();
  ctx.setLineDash([]);
  // A crosshair dot at the exact point.
  ctx.fillStyle = palette.accent;
  circle(ctx, marker.at, 1.75);
  ctx.fill();
  ctx.restore();
}

/** The box a pin covers, so labels avoid it. */
function pinBoxes(pin: PlacedPin): Box[] {
  const r = pin.focused ? PIN.focusRing + 2 : pin.selected ? PIN.selectedRing + 2 : PIN.catalog + 3;
  return [{ x: pin.drawAt.x - r, y: pin.drawAt.y - r, width: 2 * r, height: 2 * r }];
}

type PlateLines = { text: string; colour: string; weight: number; size: number }[];

/**
 * Measures and queues a plate of one or two lines: to the right of a point, else the left,
 * below or above, or (a negative gap) centred on it. It skips a place another plate or pin has.
 */
function plateAt(
  input: DrawInput,
  anchor: ScreenPoint,
  gap: number,
  lines: PlateLines,
  taken: Box[],
  plates: (() => void)[],
  force = false,
): boolean {
  const { ctx, palette } = input;
  const widths = lines.map((line) => {
    ctx.font = `${line.weight} ${line.size}px ${palette.font}`;
    return ctx.measureText(line.text).width;
  });
  const w = Math.ceil(Math.max(...widths)) + 16;
  const h = lines.reduce((sum, line) => sum + line.size + 5, 0) + 6;
  const candidates = gap < 0 ? [{ x: anchor.x - w / 2, y: anchor.y - h / 2 }] : [
    { x: anchor.x + gap, y: anchor.y - h / 2 },
    { x: anchor.x - gap - w, y: anchor.y - h / 2 },
    { x: anchor.x - w / 2, y: anchor.y + gap },
    { x: anchor.x - w / 2, y: anchor.y - gap - h },
  ];
  const fits = (box: Box) =>
    box.x >= 2 && box.y >= 2 && box.x + box.width <= input.width - 2 && box.y + box.height <= input.height - 2;
  let chosen = candidates.map((c) => ({ ...c, width: w, height: h })).find((box) => fits(box) && !taken.some((t) => overlaps(t, box)));
  if (!chosen && force) chosen = { ...(candidates[0] as ScreenPoint), width: w, height: h };
  if (!chosen) return false;
  const box = chosen;
  taken.push(box);
  plates.push(() => {
    plateRect(ctx, box.x, box.y, box.width, box.height, palette.plate);
    let y = box.y + 4;
    for (const line of lines) {
      ctx.font = `${line.weight} ${line.size}px ${palette.font}`;
      ctx.fillStyle = line.colour;
      ctx.textBaseline = "middle";
      ctx.fillText(line.text, box.x + 8, y + (line.size + 5) / 2);
      y += line.size + 5;
    }
  });
  return true;
}

function labelPin(input: DrawInput, pin: PlacedPin, taken: Box[], plates: (() => void)[]): void {
  const { palette } = input;
  const lines: PlateLines = [{ text: pin.site.name, colour: palette.ink, weight: pin.focused ? 600 : 400, size: 13 }];
  if (pin.focused) {
    const state = pin.state;
    const word =
      state.kind === "status"
        ? state.status
        : state.kind === "loading"
          ? "Loading…"
          : state.kind === "none"
            ? "No result for this date"
            : state.kind === "error"
              ? "Could not load"
              : null;
    if (word) {
      lines.push({ text: word, colour: state.kind === "status" ? statusColour(state.status, palette) : palette.ink2, weight: 600, size: 12 });
    }
    const more = moreSitesLine(pin.folded.length);
    if (more) lines.push({ text: more, colour: palette.ink2, weight: 400, size: 12 });
  }
  if (pin.parentId !== null) lines.push({ text: "Chosen by TrueSouth", colour: palette.ink2, weight: 400, size: 12 });
  if (!pin.detailed) lines.push({ text: "Outside the detailed map", colour: palette.ink2, weight: 400, size: 12 });
  const gap = (pin.focused ? PIN.focusRing : PIN.selectedRing) + 6;
  plateAt(input, pin.drawAt, gap, lines, taken, plates, pin.focused);
}

function foldBadge(input: DrawInput, pin: PlacedPin, taken: Box[], plates: (() => void)[]): void {
  plateAt(
    input,
    pin.drawAt,
    PIN.catalog + 6,
    [{ text: `+${pin.folded.length}`, colour: input.palette.ink2, weight: 400, size: 12 }],
    taken,
    plates,
  );
}

/** Catalog sites are named only once zoomed in enough that names do not pile up. */
function labelCatalog(input: DrawInput, pin: PlacedPin, taken: Box[], plates: (() => void)[]): void {
  if (input.view.k < 6) return;
  plateAt(input, pin.drawAt, PIN.catalog + 6, [{ text: pin.site.name, colour: input.palette.ink2, weight: 400, size: 12 }], taken, plates);
}

function labelFeatures(input: DrawInput, taken: Box[], plates: (() => void)[]): void {
  for (const { feature, at } of featuresToName(input.features, input.view)) {
    if (at.x < -50 || at.y < -50 || at.x > input.width + 50 || at.y > input.height + 50) continue;
    plateAt(input, at, -1, [{ text: feature.name, colour: input.palette.ink2, weight: 400, size: 12 }], taken, plates);
  }
}

/**
 * The detailed square's edge: a 1 px Control Edge hairline (the panels' edge token) along the
 * relief image's extent, which is also the lookup grids' extent, with its label. It follows
 * the square, not the 80°S ring: the 80 m data fill the whole square, and the ring is already
 * drawn as a latitude circle.
 */
function drawDetailBorder(input: DrawInput, rect: Box, taken: Box[], plates: (() => void)[]): void {
  const { ctx, palette } = input;
  ctx.save();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  const x = Math.round(rect.x) + 0.5;
  const y = Math.round(rect.y) + 0.5;
  ctx.strokeRect(x, y, Math.round(rect.width) - 1, Math.round(rect.height) - 1);
  ctx.restore();
  if (input.compact) return;
  ctx.font = `400 12px ${palette.font}`;
  const w = Math.ceil(ctx.measureText(DETAIL_LABEL).width) + 16;
  const box = detailLabelBox(rect, w, { width: input.width, height: input.height });
  if (!box) return;
  taken.push(box);
  plates.push(() => {
    plateRect(ctx, box.x, box.y, box.width, box.height, palette.plate);
    ctx.font = `400 12px ${palette.font}`;
    ctx.fillStyle = palette.ink2;
    ctx.textBaseline = "middle";
    ctx.fillText(DETAIL_LABEL, box.x + 8, box.y + box.height / 2 + 0.5);
  });
}

/**
 * Close sites (docs/features/slip-planner.md, "Close sites and the best-lit variant"):
 * spots never overlap, and labels never overlap. Pure, so it is tested without a browser.
 */

export type SpotInput = {
  id: string;
  /** The site's true place on screen. */
  x: number;
  y: number;
  /** False when the site is behind the Moon or off screen: no spot. */
  visible: boolean;
  priority: number;
  variant: boolean;
};

export type PlacedSpot = {
  id: string;
  /** Where the spot is drawn. */
  x: number;
  y: number;
  /** The true place, where a displaced spot keeps a hairline and a small dot. */
  ax: number;
  ay: number;
  moved: boolean;
  visible: boolean;
};

/** A spot closer than this to a more important one steps aside. */
export const SPOT_MIN_PX = 28;

/**
 * Places spots in priority order. A spot within `minPx` of one already placed steps aside to
 * the first free place around it: 34, 46 then 58 px away (40, 52, 64 for a variant), turning
 * from the direction it already lies in. `scale` grows every distance (1.375 for the phone's
 * 44 px spots).
 */
export function placeSpots(inputs: readonly SpotInput[], scale = 1): PlacedSpot[] {
  const minPx = SPOT_MIN_PX * scale;
  const order = [...inputs].sort((a, b) => b.priority - a.priority);
  const placed: PlacedSpot[] = [];
  const out = new Map<string, PlacedSpot>();
  for (const q of order) {
    const spot: PlacedSpot = { id: q.id, x: q.x, y: q.y, ax: q.x, ay: q.y, moved: false, visible: q.visible };
    out.set(q.id, spot);
    if (!q.visible) continue;
    const near = placed.find((o) => Math.hypot(o.x - q.x, o.y - q.y) < minPx);
    if (near) {
      const base = Math.atan2(q.y - near.ay, q.x - near.ax) || -Math.PI / 4;
      const turns = [0, -0.6, 0.6, -1.2, 1.2, -1.9, 1.9, Math.PI];
      const distances = (q.variant ? [40, 52, 64, 80, 96] : [34, 46, 58, 74, 90]).map((d) => d * scale);
      let done = false;
      for (const distance of distances) {
        for (const turn of turns) {
          const a = base + turn;
          const x = near.x + Math.cos(a) * distance;
          const y = near.y + Math.sin(a) * distance;
          if (placed.every((o) => Math.hypot(o.x - x, o.y - y) >= minPx)) {
            spot.x = x;
            spot.y = y;
            spot.moved = true;
            done = true;
            break;
          }
        }
        if (done) break;
      }
    }
    placed.push(spot);
  }
  return inputs.map((q) => out.get(q.id) as PlacedSpot);
}

export type Box = { l: number; r: number; t: number; b: number };

export type LabelInput = {
  id: string;
  x: number;
  y: number;
  /** The label's measured size. */
  w: number;
  h: number;
};

export type LabelPlace =
  | { id: string; kind: "side"; side: "r" | "l" | "b" | "t"; box: Box }
  /** Out as a callout, with a hairline from the spot's edge to `anchor`. */
  | { id: string; kind: "callout"; box: Box; anchor: { x: number; y: number }; from: { x: number; y: number } }
  /** No room: the lamp alone, with its name on hover. */
  | { id: string; kind: "hidden" };

export function overlaps(a: Box, b: Box): boolean {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

/**
 * Labels in priority order (the order given): each tries right, left, below and above the
 * spot; then a callout further out with a hairline back; then the lamp alone. A label never
 * covers a spot or another label, and stays inside `bounds`.
 */
export function placeLabels(labels: readonly LabelInput[], spots: readonly { x: number; y: number }[], radius: number, bounds: Box): LabelPlace[] {
  const boxes: Box[] = spots.map((s) => ({ l: s.x - radius, r: s.x + radius, t: s.y - radius, b: s.y + radius }));
  const free = (box: Box) =>
    box.l >= bounds.l && box.r <= bounds.r && box.t >= bounds.t && box.b <= bounds.b && boxes.every((o) => !overlaps(box, o));
  const out: LabelPlace[] = [];
  const g = radius + 4;
  for (const q of labels) {
    const sides: { side: "r" | "l" | "b" | "t"; box: Box }[] = [
      { side: "r", box: { l: q.x + g, r: q.x + g + q.w, t: q.y - q.h / 2, b: q.y + q.h / 2 } },
      { side: "l", box: { l: q.x - g - q.w, r: q.x - g, t: q.y - q.h / 2, b: q.y + q.h / 2 } },
      { side: "b", box: { l: q.x - q.w / 2, r: q.x + q.w / 2, t: q.y + g, b: q.y + g + q.h } },
      { side: "t", box: { l: q.x - q.w / 2, r: q.x + q.w / 2, t: q.y - g - q.h, b: q.y - g } },
    ];
    const side = sides.find((s) => free(s.box));
    if (side) {
      boxes.push(side.box);
      out.push({ id: q.id, kind: "side", side: side.side, box: side.box });
      continue;
    }
    let callout: LabelPlace | null = null;
    for (const d of [56, 84, 112]) {
      for (const deg of [-30, 30, -150, 150, -60, 60, -120, 120]) {
        const a = (deg * Math.PI) / 180;
        const cx = q.x + Math.cos(a) * d;
        const cy = q.y + Math.sin(a) * d;
        const right = Math.cos(a) >= 0;
        const box: Box = { l: right ? cx : cx - q.w, r: right ? cx + q.w : cx, t: cy - q.h / 2, b: cy + q.h / 2 };
        if (!free(box)) continue;
        const anchor = { x: right ? box.l : box.r, y: cy };
        const toward = Math.atan2(anchor.y - q.y, anchor.x - q.x);
        callout = { id: q.id, kind: "callout", box, anchor, from: { x: q.x + Math.cos(toward) * (radius + 1), y: q.y + Math.sin(toward) * (radius + 1) } };
        break;
      }
      if (callout) break;
    }
    if (callout && callout.kind === "callout") {
      boxes.push(callout.box);
      out.push(callout);
      continue;
    }
    out.push({ id: q.id, kind: "hidden" });
  }
  return out;
}

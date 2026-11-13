/**
 * The free space: the part of the window that no floating panel covers (CONTEXT.md). The
 * scene keeps its subject centred in it (docs/features/system-view.md, "Camera").
 *
 * The shell lays its panels out with CSS. It measures one empty box, the gap the layout
 * leaves between the panels (under the view bar and its sentence, between the side panels,
 * above the controls at the foot and the timeline). Anything that floats over that gap,
 * such as an open floating window, is then cut out of it here.
 *
 * Every value is in CSS pixels from the top left of the browser window.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type FreeSpace = Rect & {
  /** The browser window's size, so the scene can turn the rectangle into insets. */
  viewport: { width: number; height: number };
  /**
   * True while a floating window is open. The rectangle is then what is still visible beside
   * the window, and may be empty. The spec keeps the camera still while a window is open.
   */
  windowOpen: boolean;
};

export const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

export function area(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/** The overlap of two rectangles, or null when they do not overlap. */
export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * The largest rectangle of `space` that `cover` leaves visible: the strip to its left, to
 * its right, above or below it, whichever has the most area. A cover that misses `space`
 * leaves it whole; one that hides all of it leaves an empty rectangle at its centre.
 */
export function uncovered(space: Rect, cover: Rect): Rect {
  const hit = intersect(space, cover);
  if (!hit) return space;
  const right = space.x + space.width;
  const bottom = space.y + space.height;
  const pieces: Rect[] = [
    { x: space.x, y: space.y, width: hit.x - space.x, height: space.height },
    { x: hit.x + hit.width, y: space.y, width: right - (hit.x + hit.width), height: space.height },
    { x: space.x, y: space.y, width: space.width, height: hit.y - space.y },
    { x: space.x, y: hit.y + hit.height, width: space.width, height: bottom - (hit.y + hit.height) },
  ];
  let best: Rect | null = null;
  for (const piece of pieces) {
    if (area(piece) > 0 && (!best || area(piece) > area(best))) best = piece;
  }
  if (best) return best;
  return { x: space.x + space.width / 2, y: space.y + space.height / 2, width: 0, height: 0 };
}

/** Clamps a rectangle to the browser window and rounds it to whole pixels. */
export function clampToViewport(rect: Rect, viewport: { width: number; height: number }): Rect {
  const x = Math.min(Math.max(Math.round(rect.x), 0), viewport.width);
  const y = Math.min(Math.max(Math.round(rect.y), 0), viewport.height);
  const right = Math.min(Math.max(Math.round(rect.x + rect.width), x), viewport.width);
  const bottom = Math.min(Math.max(Math.round(rect.y + rect.height), y), viewport.height);
  return { x, y, width: right - x, height: bottom - y };
}

export type FreeSpaceInput = {
  /** The browser window's size. */
  viewport: { width: number; height: number };
  /** The measured gap between the panels. */
  gap: Rect;
  /** Panels that float over the gap: the open floating window, an open phone sheet. */
  covers: readonly Rect[];
  windowOpen: boolean;
};

/** The free space for the scene: the gap between the panels, less whatever floats over it. */
export function freeSpace({ viewport, gap, covers, windowOpen }: FreeSpaceInput): FreeSpace {
  let space = clampToViewport(gap, viewport);
  for (const cover of covers) space = uncovered(space, cover);
  return { ...clampToViewport(space, viewport), viewport: { ...viewport }, windowOpen };
}

/** Two free spaces are the same when nothing the scene reads has changed. */
export function sameFreeSpace(a: FreeSpace, b: FreeSpace): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.viewport.width === b.viewport.width &&
    a.viewport.height === b.viewport.height &&
    a.windowOpen === b.windowOpen
  );
}

/**
 * The free space as distances from each edge of the browser window, the form a camera's
 * projection offset needs (docs/features/system-view.md, "Free space").
 */
export function insetsOf(space: FreeSpace): { top: number; right: number; bottom: number; left: number } {
  return {
    top: space.y,
    left: space.x,
    right: space.viewport.width - (space.x + space.width),
    bottom: space.viewport.height - (space.y + space.height),
  };
}

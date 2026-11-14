/**
 * The scene's pointer bookkeeping, without the DOM: which pointers are down, what each move
 * means (turn, slide, pinch), double taps, and how a gesture ends however it ends. The scene
 * turns the commands it returns into calls on the camera rig.
 *
 * A gesture ends on pointer up, pointer cancel, lost pointer capture, the window losing focus
 * or the tab being hidden, and, for a mouse, on a move with no button held, or with the
 * button that started it no longer held (it was released outside the window, or while
 * another button was down). After any of these, no pointer is remembered, so the view never
 * turns with no button down and the next touch never counts as a pinch.
 *
 * Mouse buttons: the left button turns; the middle button (the wheel pressed) does what
 * `MIDDLE_BUTTON_DRAG` says, turning by default, so it works like the left button in every
 * view; the right button slides; Shift with the left or middle button slides. A middle click
 * without a drag does nothing (no double-click centring). The back and forward buttons are
 * ignored.
 */

/**
 * What a middle-button drag does: "turn" like the left button, or "slide" like the right
 * button. One line to flip if the team prefers the middle button to slide the view.
 */
export const MIDDLE_BUTTON_DRAG: "turn" | "slide" = "turn";

/** `PointerEvent.button` values, and each one's bit in `PointerEvent.buttons`. */
const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;
const BUTTON_BIT: Record<number, number> = { [LEFT]: 1, [MIDDLE]: 4, [RIGHT]: 2 };

/** Whether a drag started with `button` slides rather than turns. */
function slides(button: number, shift: boolean): boolean {
  return button === RIGHT || shift || (button === MIDDLE && MIDDLE_BUTTON_DRAG === "slide");
}

export type PointerKind = "mouse" | "touch" | "pen";

export type Command =
  /** A turn starts (or starts again): fix its axis from here. */
  | { type: "begin" }
  | { type: "orbit"; dx: number; dy: number }
  /** Slide the view; a view with no slide turns instead when `orFallback` is set. */
  | { type: "pan"; dx: number; dy: number; orFallback: boolean }
  /** Zoom by `factor` (above 1 zooms out) toward the window point (x, y) in CSS pixels. */
  | { type: "zoom"; factor: number; x: number; y: number }
  /** A double click or double tap at (x, y). */
  | { type: "focus"; x: number; y: number };

type Point = { x: number; y: number; kind: PointerKind };

/** A tap is shorter than this and moves less than TAP_SLOP. */
const TAP_MS = 300;
const TAP_SLOP = 6;
/** A second tap within this time and distance of the first is a double tap. */
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_DISTANCE = 24;

export class PointerTracker {
  private readonly points = new Map<number, Point>();
  /** The first pointer's button, and whether it is sliding (right button or Shift). */
  private gesture: { button: number; pan: boolean } | null = null;
  private tap = { x: 0, y: 0, t: 0, moved: false };
  private lastTap: { x: number; y: number; t: number } | null = null;

  /** How many pointers are down. */
  get size(): number {
    return this.points.size;
  }

  /** The ids of the pointers down, so the caller can release their capture. */
  ids(): number[] {
    return [...this.points.keys()];
  }

  down(id: number, x: number, y: number, kind: PointerKind, button: number, shift: boolean, now: number): Command[] {
    // Only the left, middle and right mouse buttons drag; back and forward do nothing here.
    if (kind === "mouse" && BUTTON_BIT[button] === undefined) return [];
    this.points.set(id, { x, y, kind });
    if (this.points.size === 1) {
      this.gesture = { button, pan: slides(button, shift) };
      this.tap = { x, y, t: now, moved: false };
      return [{ type: "begin" }];
    }
    this.tap.moved = true;
    return [];
  }

  /**
   * A move of pointer `id` to (x, y). `buttons` is the pointer event's `buttons` (for a mouse,
   * 0, or a mask without the button that started the drag, means that button is no longer
   * held: the drag ends here).
   */
  move(id: number, x: number, y: number, buttons: number, shift: boolean): Command[] {
    const previous = this.points.get(id);
    if (!previous) return [];
    const bit = BUTTON_BIT[this.gesture?.button ?? LEFT] ?? 1;
    if (previous.kind === "mouse" && (buttons === 0 || (this.points.size === 1 && (buttons & bit) === 0))) {
      this.end(id);
      this.lastTap = null;
      return [];
    }
    this.points.set(id, { ...previous, x, y });
    if (Math.hypot(x - this.tap.x, y - this.tap.y) > TAP_SLOP) this.tap.moved = true;
    if (this.points.size >= 2) {
      // Two fingers: the midpoint slides the view, the spread zooms toward the midpoint.
      const [[ia, a], [ib, b]] = [...this.points.entries()].slice(0, 2) as [[number, Point], [number, Point]];
      if (id !== ia && id !== ib) return [];
      const pa = ia === id ? previous : a;
      const pb = ib === id ? previous : b;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const midBefore = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      const out: Command[] = [{ type: "pan", dx: mid.x - midBefore.x, dy: mid.y - midBefore.y, orFallback: false }];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      const spreadBefore = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (spread > 0 && spreadBefore > 0) out.push({ type: "zoom", factor: spreadBefore / spread, x: mid.x, y: mid.y });
      return out;
    }
    const g = this.gesture;
    if (!g) return [];
    const dx = x - previous.x;
    const dy = y - previous.y;
    const pan = slides(g.button, shift);
    const out: Command[] = [];
    if (g.pan && !pan) out.push({ type: "begin" }); // back from sliding to turning: a fresh turn
    g.pan = pan;
    out.push(pan ? { type: "pan", dx, dy, orFallback: true } : { type: "orbit", dx, dy });
    return out;
  }

  /** Pointer `id` lifted at (x, y). May report a double tap. */
  up(id: number, x: number, y: number, now: number): Command[] {
    if (!this.points.has(id)) return [];
    const button = this.gesture?.button ?? LEFT;
    const out = this.end(id);
    if (this.points.size > 0) return out;
    // A middle click is not a tap: it never centres a spot, and it ends any double click.
    if (button === MIDDLE) {
      this.lastTap = null;
      return out;
    }
    // A double click or double tap: two short taps close together.
    const t = this.tap;
    if (t.moved || now - t.t > TAP_MS) {
      this.lastTap = null;
      return out;
    }
    const last = this.lastTap;
    if (last && now - last.t < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_DISTANCE) {
      this.lastTap = null;
      return [...out, { type: "focus", x, y }];
    }
    this.lastTap = { x, y, t: now };
    return out;
  }

  /** Pointer `id` cancelled, or its capture lost: it ends with no tap. */
  cancel(id: number): Command[] {
    if (!this.points.has(id)) return [];
    this.lastTap = null;
    this.tap.moved = true;
    return this.end(id);
  }

  /** The window lost focus or the tab was hidden: forget every pointer. */
  clear(): void {
    this.points.clear();
    this.gesture = null;
    this.lastTap = null;
    this.tap.moved = true;
  }

  private end(id: number): Command[] {
    this.points.delete(id);
    if (this.points.size === 0) {
      this.gesture = null;
      return [];
    }
    if (this.points.size === 1) {
      // One finger left after a pinch: it turns from here.
      this.gesture = { button: 0, pan: false };
      return [{ type: "begin" }];
    }
    return [];
  }
}

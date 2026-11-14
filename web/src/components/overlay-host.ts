/**
 * Where popover panels and tip bubbles are rendered, and how Tab moves between a trigger and
 * the panel or bubble it opens.
 *
 * Popover panels and tip bubbles are portalled out of the panel that holds their trigger, so
 * they are never a DOM descendant of a clipped, rounded, scrolling or transitioning panel.
 * A conforming browser already lifts them out (they are in the top layer and fixed), but on
 * the team lead's browser the folded sites rail painted its background across the bounding
 * box of the overlays opened from inside it: "the black box" (DEVLOG, "MC rail overlays").
 * Rendering them elsewhere removes the dependency.
 *
 * The host is `document.body`, except inside an open popover panel: a tip opened from a
 * control in a popover (an "About" icon in the profile editor) stays inside that panel, so
 * a click on the tip is not a click outside the popover, which would light-dismiss it. The
 * panel itself is already on the body and in the top layer, so nothing clips the tip.
 */

/** The element a popover panel or tip bubble opened from `trigger` is portalled into. */
export function overlayHost(trigger: Element | null): Element | null {
  if (typeof document === "undefined" || !document.body) return null;
  const panel = trigger?.closest?.(".popover") ?? null;
  return panel ?? document.body;
}

/** Elements Tab can reach, in the order a selector query returns them (document order). */
export const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The visible tab stops inside `root`. */
export function tabbables(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((element) => element.getClientRects().length > 0);
}

/**
 * The tab stop after `trigger` in the page, skipping anything inside `skip` (the portalled
 * panel or bubble itself), or null when the trigger is the last one.
 */
export function tabStopAfter(trigger: Element, skip: Element | null): HTMLElement | null {
  const all = tabbables(document);
  const index = all.indexOf(trigger as HTMLElement);
  if (index < 0) return null;
  for (const element of all.slice(index + 1)) {
    if (!skip?.contains(element)) return element;
  }
  return null;
}

export type TabBridge = {
  shift: boolean;
  active: Element | null;
  trigger: Element | null;
  /** The tab stops inside the open panel or bubble, in order. */
  items: readonly Element[];
  /** The page's next tab stop after the trigger, outside the panel. */
  after: Element | null;
};

/**
 * Where Tab should go so a portalled panel or bubble keeps its place in the tab order, as if
 * it still followed its trigger: Tab from the trigger enters it; Tab from its last stop goes
 * on to the stop after the trigger; Shift+Tab from its first stop goes back to the trigger.
 * Null means "leave Tab to the browser".
 */
export function bridgeTab({ shift, active, trigger, items, after }: TabBridge): Element | null {
  if (!active || !trigger || items.length === 0) return null;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (!shift && active === trigger) return first;
  if (!shift && active === last) return after;
  if (shift && active === first) return trigger;
  return null;
}

/** Whether `node` is inside the trigger's wrapper or the portalled overlay (an outside click is neither). */
export function withinEither(node: Node | null, wrap: Node | null, overlay: Node | null): boolean {
  return Boolean(node && (wrap?.contains(node) || overlay?.contains(node)));
}

/**
 * Whether closing the overlay should hand focus back to its trigger: when focus was inside the
 * overlay (wherever it is portalled), or has nowhere to be (the body, or nothing).
 */
export function returnsFocus(active: Element | null, overlay: Node | null, body: Element | null): boolean {
  return !active || active === body || Boolean(overlay?.contains(active));
}

/** A popover panel's place in the window: CSS pixels, from the top left. */
export type PanelPlace = { left: number; width: number; top: number | null; bottom: number | null; maxHeight: number };

/** Less room than this on the asked-for side flips the panel to the other side, if that has more. */
export const PANEL_MIN_ROOM = 160;

/**
 * Where a popover panel goes next to its trigger: under it (or above it), lined up with its
 * left or right edge, kept `margin` from the window's edges, and never taller than the room
 * on its side, so it always ends inside the window. When the asked-for side has less than
 * PANEL_MIN_ROOM and the other side has more, it opens on the other side.
 */
export function placePanel(input: {
  trigger: { top: number; bottom: number; left: number; right: number };
  viewW: number;
  viewH: number;
  width: number;
  align: "start" | "end";
  placement: "below" | "above" | "auto";
  margin: number;
  gap: number;
}): PanelPlace {
  const { trigger, viewW, viewH, align, placement, margin, gap } = input;
  const width = Math.max(0, Math.min(input.width, viewW - margin * 2));
  let left = align === "end" ? trigger.right - width : trigger.left;
  left = Math.min(Math.max(left, margin), viewW - margin - width);
  const roomBelow = viewH - (trigger.bottom + gap) - margin;
  const roomAbove = trigger.top - gap - margin;
  let above = placement === "above" || (placement === "auto" && roomAbove > roomBelow);
  if (placement !== "auto") {
    const own = above ? roomAbove : roomBelow;
    const other = above ? roomBelow : roomAbove;
    if (own < PANEL_MIN_ROOM && other > own) above = !above;
  }
  if (above) return { left, width, top: null, bottom: viewH - trigger.top + gap, maxHeight: Math.max(0, roomAbove) };
  return { left, width, top: trigger.bottom + gap, bottom: null, maxHeight: Math.max(0, roomBelow) };
}


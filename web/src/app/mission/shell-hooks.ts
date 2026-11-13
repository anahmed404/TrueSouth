import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { freeSpace, sameFreeSpace, type FreeSpace, type Rect } from "./free-space";

/** The phone layout's breakpoint, the same as every other phone rule in the CSS. */
export const PHONE_QUERY = "(max-width: 760px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** The operating system's "reduce motion" setting. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCE_QUERY);
}

/** True on a phone-width window: the one-column layout. */
export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** The browser window's width, updated on resize. */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

const NO_SPACE: FreeSpace = { x: 0, y: 0, width: 0, height: 0, viewport: { width: 0, height: 0 }, windowOpen: false };

/**
 * The free space, kept up to date. `gap` is the empty box the layout leaves between the
 * panels; `covers` are the panels open over it (the floating window, an open phone sheet).
 * It is measured again when any of them changes size (a panel folding resizes the gap frame
 * by frame), when the browser window resizes, and when `coverKey` changes (a window or a
 * sheet opening or closing).
 */
export function useFreeSpace(
  gap: RefObject<HTMLElement | null>,
  covers: readonly RefObject<HTMLElement | null>[],
  windowOpen: boolean,
  coverKey: string,
): FreeSpace {
  const [space, setSpace] = useState<FreeSpace>(NO_SPACE);
  const coversRef = useRef(covers);
  coversRef.current = covers;

  useLayoutEffect(() => {
    let frame = 0;
    const nodes = () => coversRef.current.map((ref) => ref.current).filter((node): node is HTMLElement => node !== null);
    const measure = () => {
      frame = 0;
      const gapNode = gap.current;
      if (!gapNode) return;
      const next = freeSpace({
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: rectOf(gapNode),
        covers: nodes().map(rectOf),
        windowOpen,
      });
      setSpace((current) => (sameFreeSpace(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    if (gap.current) observer.observe(gap.current);
    for (const node of nodes()) observer.observe(node);
    window.addEventListener("resize", schedule);
    // A panel that slides without changing the gap's size still moves it.
    document.addEventListener("transitionend", schedule, true);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("transitionend", schedule, true);
    };
  }, [gap, windowOpen, coverKey]);

  return space;
}

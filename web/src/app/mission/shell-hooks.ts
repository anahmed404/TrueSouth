import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { freeSpace, freeSpaceInput, sameFreeSpace, type FreeSpace, type Rect, type ShellState } from "./free-space";

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

/** An element's rectangle in window coordinates. */
export function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

const NO_SPACE: FreeSpace = { x: 0, y: 0, width: 0, height: 0, viewport: { width: 0, height: 0 }, windowOpen: false };

/**
 * The free space, kept up to date. `read` gathers the shell's layout state (measuring its
 * panels); `watch` are the elements whose size changes it. It is measured again when any of
 * them resizes, when the browser window resizes, after a transition, and when `key` changes
 * (a panel folding, a window or a sheet opening or closing).
 */
export function useFreeSpace(read: () => ShellState | null, watch: readonly RefObject<HTMLElement | null>[], key: string): FreeSpace {
  const [space, setSpace] = useState<FreeSpace>(NO_SPACE);
  const readRef = useRef(read);
  readRef.current = read;
  const watchRef = useRef(watch);
  watchRef.current = watch;

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const state = readRef.current();
      if (!state) return;
      const next = freeSpace(freeSpaceInput(state));
      setSpace((current) => (sameFreeSpace(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    for (const ref of watchRef.current) if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("transitionend", schedule, true);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("transitionend", schedule, true);
    };
  }, [key]);

  return space;
}

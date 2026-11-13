import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * A small bubble of text tied to one control: a tooltip, or, with `interactive`, a
 * toggletip that can hold a link.
 *
 * - Opens on hover and on keyboard focus. An interactive tip also opens and pins on click.
 * - Escape closes it (WCAG 1.4.13: dismissable, hoverable, persistent).
 * - The bubble stays in the DOM after its trigger, so Tab reaches a link inside it, and
 *   the trigger's `aria-describedby` points at it so screen readers read the text.
 * - The bubble sits in the browser's top layer (the popover API) and is positioned in
 *   viewport coordinates, so a panel's scrolling or clipping never cuts it off.
 */

export type TipTriggerProps = {
  ref: (node: HTMLElement | null) => void;
  "aria-describedby"?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  onClick?: () => void;
};

type TipProps = {
  /** The bubble's content. Keep it to one or two sentences. */
  content: ReactNode;
  /** Renders the trigger. Spread the props onto a focusable element. */
  children: (trigger: TipTriggerProps) => ReactElement;
  /** The bubble holds a link or another control: click pins it open. */
  interactive?: boolean;
  /** Preferred side; flips when there is no room. */
  placement?: "top" | "bottom";
  /**
   * Point the trigger's `aria-describedby` at the bubble (the default). Turn it off when
   * the bubble only repeats the trigger's own label, as for an icon button.
   */
  describe?: boolean;
};

type Position = { left: number; top: number };

const MARGIN = 8;
const GAP = 6;
const CLOSE_DELAY_MS = 140;

function supportsPopover(element: HTMLElement): boolean {
  return typeof element.showPopover === "function";
}

export function Tip({ content, children, interactive = false, placement = "top", describe = true }: TipProps) {
  const id = useId();
  const bubbleId = `tip-${id}`;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const open = (hovered || focused || pinned) && !dismissed;

  // Once the pointer and focus have both left, a dismissed tip may open again.
  useEffect(() => {
    if (!hovered && !focused && !pinned) setDismissed(false);
  }, [hovered, focused, pinned]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const roomAbove = t.top - GAP - MARGIN;
    const roomBelow = vh - t.bottom - GAP - MARGIN;
    const above =
      placement === "top"
        ? roomAbove >= b.height || roomAbove > roomBelow
        : roomBelow < b.height && roomAbove > roomBelow;
    const top = above ? t.top - GAP - b.height : t.bottom + GAP;
    const centred = t.left + t.width / 2 - b.width / 2;
    const left = Math.min(Math.max(centred, MARGIN), vw - b.width - MARGIN);
    setPosition({ left: Math.round(left), top: Math.round(Math.max(top, MARGIN)) });
  }, [placement]);

  // Show or hide the bubble in the top layer, then place it.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    if (open) {
      if (supportsPopover(bubble) && !bubble.matches(":popover-open")) bubble.showPopover();
      place();
    } else if (supportsPopover(bubble) && bubble.matches(":popover-open")) {
      bubble.hidePopover();
    }
  }, [open, place, content]);

  // Keep it attached to its trigger while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const update = () => place();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, place]);

  // Escape closes; a click elsewhere unpins.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDismissed(true);
      setPinned(false);
      if (bubbleRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setPinned(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const onPointerEnter = () => {
    window.clearTimeout(closeTimer.current);
    setHovered(true);
  };
  const onPointerLeave = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };

  const trigger: TipTriggerProps = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
  };
  if (describe) trigger["aria-describedby"] = bubbleId;
  if (interactive) {
    trigger["aria-expanded"] = open;
    trigger["aria-controls"] = bubbleId;
    trigger.onClick = () => {
      setDismissed(false);
      setPinned((was) => !was);
    };
  }

  return (
    <span
      ref={wrapRef}
      className="inline-flex align-baseline"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={(event) => {
        // Keyboard focus opens the tip; focus left behind by a mouse click does not.
        const target = event.target as HTMLElement;
        if (bubbleRef.current?.contains(target) || target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {children(trigger)}
      <span
        ref={bubbleRef}
        id={bubbleId}
        role={interactive ? undefined : "tooltip"}
        aria-hidden={describe || interactive ? undefined : true}
        popover="manual"
        hidden={!open}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        style={position ? { left: position.left, top: position.top } : undefined}
        className="tip-bubble"
      >
        {content}
      </span>
    </span>
  );
}

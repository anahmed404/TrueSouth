import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { cx } from "./format";
import { bridgeTab, overlayHost, placePanel, returnsFocus, tabStopAfter, tabbables } from "./overlay-host";

export type PopoverTriggerProps = {
  ref: (node: HTMLButtonElement | null) => void;
  popoverTarget: string;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog";
};

/** Opens or closes a popover from code, for a trigger whose click does something else first. */
export type PopoverHandle = { open: () => void; close: () => void };

type PopoverProps = {
  /** The dialog's accessible name, for example "Mission profile". */
  label: string;
  /** Renders the button that opens it. Spread the props onto a `<button>`. */
  trigger: (props: PopoverTriggerProps) => ReactElement;
  /** The content. A function gets a `close` callback, for a choice that ends the task. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Line the popover up with the trigger's left edge (start) or right edge (end). */
  align?: "start" | "end";
  /** Width in px on a wide screen. A phone gets the window width less 16 px each side. */
  width?: number;
  /**
   * Open under the trigger (the default), or above it, for a trigger at the foot of the
   * window. `auto` takes the side with more room when it opens.
   */
  placement?: "below" | "above" | "auto";
  className?: string;
  /**
   * Opens it from code. A trigger that leaves `popoverTarget` off its button is then not a
   * toggle: its click can do something else and open the popover only when needed (the
   * Share fallback). Escape, light dismiss and the focus return work as usual.
   */
  handleRef?: Ref<PopoverHandle>;
};

const MARGIN = 16;
const GAP = 6;

/**
 * A panel of controls that opens under its button (or above it): a non-modal dialog in the browser's
 * top layer (the popover API), so no panel's scrolling or clipping cuts it off.
 *
 * - The panel is portalled to the page's body (or into the open popover that holds the
 *   trigger), never left inside the panel its trigger sits in (overlay-host.ts). Tab still
 *   moves as if it followed the trigger: from the trigger into it, from its last control on
 *   to the page, and back to the trigger with Shift+Tab.
 * - The button toggles it; Escape or a click outside closes it (light dismiss).
 * - On open, focus moves to the first control inside. On close, it returns to the button.
 * - Flat Raised surface, Control Edge border and the popover shadow (DESIGN.md, Elevation).
 */
export function Popover({ label, trigger, children, align = "start", width = 360, placement = "below", className, handleRef }: PopoverProps) {
  const id = `popover-${useId()}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);

  // Where the panel lives: the body, or the open popover the trigger is in.
  useLayoutEffect(() => {
    setHost(overlayHost(triggerRef.current));
  }, []);

  // The panel is out of the page order: bridge Tab between it and its trigger.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const button = triggerRef.current;
    if (!panel || !button) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const target = bridgeTab({
        shift: event.shiftKey,
        active: document.activeElement,
        trigger: button,
        items: tabbables(panel),
        after: event.shiftKey ? null : tabStopAfter(button, panel),
      });
      if (target instanceof HTMLElement) {
        event.preventDefault();
        target.focus();
      }
    };
    button.addEventListener("keydown", onKey);
    panel.addEventListener("keydown", onKey);
    return () => {
      button.removeEventListener("keydown", onKey);
      panel.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const place = useCallback(() => {
    const button = triggerRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;
    const spot = placePanel({
      trigger: button.getBoundingClientRect(),
      viewW: document.documentElement.clientWidth,
      viewH: window.innerHeight,
      width,
      align,
      placement,
      margin: MARGIN,
      gap: GAP,
    });
    panel.style.width = `${spot.width}px`;
    panel.style.left = `${spot.left}px`;
    panel.style.top = spot.top === null ? "auto" : `${spot.top}px`;
    panel.style.bottom = spot.bottom === null ? "auto" : `${spot.bottom}px`;
    panel.style.maxHeight = `${spot.maxHeight}px`;
  }, [align, width, placement]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onBefore = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") place();
    };
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) return;
      if (returnsFocus(document.activeElement, panel, document.body)) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    panel.addEventListener("beforetoggle", onBefore);
    panel.addEventListener("toggle", onToggle);
    return () => {
      panel.removeEventListener("beforetoggle", onBefore);
      panel.removeEventListener("toggle", onToggle);
    };
    // The panel mounts once its host is known.
  }, [place, host]);

  // Focus the first control once the content has rendered.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      "[data-autofocus], button:not(:disabled), input:not(:disabled), select, a[href], [tabindex='0']",
    );
    (first ?? panel).focus({ preventScroll: true });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const close = useCallback(() => {
    const panel = panelRef.current;
    if (panel?.matches(":popover-open")) panel.hidePopover();
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      open: () => {
        const panel = panelRef.current;
        if (panel && !panel.matches(":popover-open")) panel.showPopover();
      },
      close,
    }),
    [close],
  );

  return (
    <>
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        popoverTarget: id,
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "dialog",
      })}
      {portal(
        host,
        <div
          ref={panelRef}
          id={id}
          popover="auto"
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cx("popover", className)}
        >
          {open ? (typeof children === "function" ? children(close) : children) : null}
        </div>,
      )}
    </>
  );
}

/**
 * The panel in its host. Where there is no document (server rendering) it is rendered in
 * place; in a browser, nothing is rendered until the host is known (the first layout pass).
 */
function portal(host: Element | null, node: ReactElement): ReactNode {
  if (host) return createPortal(node, host);
  // In a browser, wait for the host rather than mount here and move (a move remounts it).
  return typeof document === "undefined" ? node : null;
}

import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode, type Ref, type RefObject } from "react";
import { IconButton } from "../../components/Button";
import { assignRef } from "../../components/refs";
import { focusAfterClose, focusOnOpen } from "./window-focus";

type FloatingWindowProps = {
  /** The element id, which the view bar's button names in `aria-controls`. */
  id: string;
  title: string;
  /** The close button's name, for example "Close the Slip Planner". */
  closeLabel: string;
  /** One sentence saying what the window shows. */
  description: ReactNode;
  onClose: () => void;
  /** The view bar's button for this window: focus returns to it on close. */
  button: () => HTMLElement | null;
  /** True when the user closed it (Escape or the close button), read as it unmounts. */
  closedByUser: RefObject<boolean>;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
};

/**
 * A floating window over the scene: the Slip Planner or Compare
 * (docs/features/mission-control.md, "Floating windows").
 *
 * - A solid panel with the popover shadow, a title, a one-sentence description and a close
 *   button. It opens with a 180 ms rise (none under reduced motion).
 * - `role="dialog"` and `aria-modal="false"`: not modal. The app bar, the side panels and
 *   the timeline stay usable, and the timeline stays in view below it.
 * - Focus moves to the window on open, and back to its view-bar button on close.
 *   Escape is handled by the shell, which knows what else is open.
 */
export function FloatingWindow({ id, title, closeLabel, description, onClose, button, closedByUser, ref, children }: FloatingWindowProps) {
  const titleId = useId();
  const descriptionId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // The latest values, read when the window closes.
  const buttonRef = useRef(button);
  buttonRef.current = button;

  useLayoutEffect(() => {
    closedByUser.current = false;
    focusOnOpen(sectionRef.current, closeRef.current)?.focus({ preventScroll: true });
    return () => {
      const userClosed = closedByUser.current;
      // Once the window has left the page, see where focus ended up.
      const section = sectionRef.current;
      requestAnimationFrame(() => {
        // Still in the page: the effect re-ran (React's development double run), not a close.
        if (section?.isConnected) return;
        const active = document.activeElement;
        const target = focusAfterClose({
          closedByUser: userClosed,
          focusIsLost: active === null || active === document.body,
          button: buttonRef.current(),
        });
        target?.focus({ preventScroll: true });
      });
    };
  }, [closedByUser]);

  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
        assignRef(ref, node);
      }}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className="panel floating-window"
    >
      <header className="floating-window-head">
        <div className="floating-window-titles">
          <h2 id={titleId} className="floating-window-title">
            {title}
          </h2>
          <p id={descriptionId} className="floating-window-description">
            {description}
          </p>
        </div>
        <IconButton
          ref={closeRef}
          label={closeLabel}
          hint="· Escape"
          icon={<X size={18} strokeWidth={1.8} />}
          onClick={onClose}
          className="floating-window-close"
        />
      </header>
      <div className="floating-window-body">{children}</div>
    </section>
  );
}

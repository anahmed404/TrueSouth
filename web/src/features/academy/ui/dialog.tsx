import { useEffect, useRef, type ReactNode } from "react";
import { Luna } from "../../../components/luna";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The safe choice: the filled button, focused first, and what Escape does. */
  keepLabel: string;
  /** The choice that loses something: the quieter button. */
  confirmLabel: string;
  onKeep: () => void;
  onConfirm: () => void;
};

/**
 * The Academy's one kind of modal, for a choice that cannot be undone. A native
 * `<dialog>`: it traps focus, and Escape keeps things as they are.
 */
export function ConfirmDialog({ open, title, children, keepLabel, confirmLabel, onKeep, onConfirm }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      keepRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="ac-dialog"
      aria-labelledby="ac-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
    >
      <h2 id="ac-dialog-title">
        <Luna mood="worried" size={48} decorative />
        {title}
      </h2>
      {children}
      <div className="ac-dialog-acts">
        <button type="button" className="ac-btn ac-btn--secondary ac-btn--compact" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button ref={keepRef} type="button" className="ac-btn ac-btn--primary ac-btn--compact" onClick={onKeep}>
          {keepLabel}
        </button>
      </div>
    </dialog>
  );
}

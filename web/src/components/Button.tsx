import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "./format";
import { assignRef } from "./refs";
import { Tip } from "./Tip";

type ButtonVariant = "secondary" | "quiet" | "door";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  /**
   * secondary: grey text, a 1 px control edge (the default).
   * quiet: no border, for icon buttons and low-weight actions.
   * door: the start screen's pill.
   */
  variant?: ButtonVariant;
  /** sm 28 px, md 36 px. */
  size?: ButtonSize;
  /** An icon before the label, 16 px, from lucide-react. */
  icon?: ReactNode;
};

/** Shared class names, for a link that must look like a button. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "sm") {
  return cx("btn", `btn-${variant}`, `btn-${size}`);
}

/** A button. Every one has a visible focus ring and a disabled look. */
export function Button({
  variant = "secondary",
  size = "sm",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClass(variant, size), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  /** What the button does, read by screen readers and shown in a tip on hover and focus. */
  label: string;
  /** Extra words for the tip only, such as a keyboard shortcut. */
  hint?: string;
  icon: ReactNode;
  size?: ButtonSize;
};

/** A square, borderless button that shows only an icon. Its label is required. */
export function IconButton({ label, hint, icon, size = "sm", className, type = "button", ref, ...rest }: IconButtonProps) {
  return (
    <Tip describe={false} content={hint ? `${label} ${hint}` : label}>
      {(trigger) => (
        <button
          {...rest}
          ref={(node) => {
            trigger.ref(node);
            assignRef(ref, node);
          }}
          type={type}
          aria-label={label}
          className={cx("btn btn-quiet btn-icon", `btn-${size}`, className)}
        >
          {icon}
        </button>
      )}
    </Tip>
  );
}

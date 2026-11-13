import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "./format";
import { assignRef } from "./refs";

type PanelElement = "section" | "aside" | "div" | "main" | "nav";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: PanelElement;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
};

/**
 * A panel: flat, opaque --surface, a 1 px hairline, 14 px corners. No shadow; depth is
 * tonal. In Mission Control it floats over the scene with a Control Edge border (shell.css);
 * in the Academy panels sit 8 px apart.
 */
export function Panel({ as: Element = "section", className, children, ref, ...rest }: PanelProps) {
  return (
    <Element ref={(node: HTMLElement | null) => assignRef(ref, node)} className={cx("panel", className)} {...rest}>
      {children}
    </Element>
  );
}

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  /** "nogo" draws the broken-rule border; "caution" the under-6-hours border. */
  tone?: "plain" | "nogo" | "caution";
  children?: ReactNode;
};

/** A card inside a panel: --raised, 10 px corners, 12–16 px padding. */
export function Card({ as: Element = "div", tone = "plain", className, children, ...rest }: CardProps) {
  return (
    <Element className={cx("card", tone !== "plain" && `card-${tone}`, className)} {...rest}>
      {children}
    </Element>
  );
}

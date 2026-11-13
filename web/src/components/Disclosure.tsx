import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./format";

type DisclosureProps = {
  /** The summary line, for example "Mission window metrics". */
  title: ReactNode;
  /** A quiet count at the end of the summary line, for example "8 values, 240 h". */
  meta?: ReactNode;
  /** Closed by default: detail waits until it is asked for. */
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Detail behind a click: native `<details>`, so it works with the keyboard and screen
 * readers for free. The chevron turns 90° in 150 ms.
 */
export function Disclosure({ title, meta, defaultOpen = false, className, children }: DisclosureProps) {
  return (
    <details className={cx("disclosure", className)} open={defaultOpen}>
      <summary>
        <ChevronRight className="disclosure-chevron" size={14} strokeWidth={2} aria-hidden="true" />
        <span className="disclosure-title">{title}</span>
        {meta ? <span className="disclosure-meta">{meta}</span> : null}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

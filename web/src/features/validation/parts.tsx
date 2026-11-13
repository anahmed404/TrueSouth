import { FlaskConical, MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { StatusLamp } from "../../components/StatusLamp";
import { cx } from "../../components/format";
import {
  COMPARISON_VERDICT_LABEL,
  GATE_VERDICT_LABEL,
  type ComparisonVerdict,
  type GateVerdict,
} from "./model";

/**
 * A gate's result: always a glyph and a word, never colour alone.
 * Passed is a GO check, failed a NO-GO cross, and a gate this run did not measure a grey
 * flask with "Checked in the web tests": neither a pass nor a failure.
 */
export function GateResult({ verdict }: { verdict: GateVerdict }) {
  return (
    <span className={cx("vl-verdict", `vl-verdict-${verdict}`)}>
      {verdict === "elsewhere" ? (
        <FlaskConical size={14} strokeWidth={1.8} aria-hidden="true" className="vl-verdict-icon" />
      ) : (
        <StatusLamp status={verdict === "passed" ? "GO" : "NO-GO"} size="xs" />
      )}
      {GATE_VERDICT_LABEL[verdict]}
    </span>
  );
}

/**
 * A comparison's result. Outside the mark is a CAUTION "!", because it asks to be
 * investigated: it is not a failed gate. Within the mark is a quiet GO check.
 */
export function ComparisonResult({ verdict }: { verdict: ComparisonVerdict }) {
  return (
    <span className={cx("vl-verdict", `vl-verdict-${verdict}`)}>
      <StatusLamp status={verdict === "outside" ? "CAUTION" : "GO"} size="xs" />
      {COMPARISON_VERDICT_LABEL[verdict]}
    </span>
  );
}

function useOverflows(ref: RefObject<HTMLElement | null>): boolean {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const check = () => setOverflows(node.scrollWidth > node.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return overflows;
}

/**
 * A table that may scroll sideways inside its own box, never the page. When it does, a
 * line under it says so, and the box takes keyboard focus so arrow keys scroll it.
 */
export function TableBox({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const overflows = useOverflows(ref);
  return (
    <div className="vl-table-box">
      <div
        ref={ref}
        className="vl-table-scroll"
        role="region"
        aria-label={label}
        tabIndex={overflows ? 0 : undefined}
      >
        {children}
      </div>
      {overflows ? (
        <p className="vl-scroll-cue">
          <MoveHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
          Scroll the table sideways to see every column.
        </p>
      ) : null}
    </div>
  );
}

/** The width of an element, kept up to date, so a chart draws at its real size. */
export function useWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

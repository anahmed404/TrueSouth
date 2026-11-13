import { cx } from "./format";

/** A mission window's status. Always shown with a glyph and the word, never colour alone. */
export type Status = "GO" | "CAUTION" | "NO-GO";

const GLYPH: Record<Status, string> = {
  GO: "M5 12.5l4.5 4.5L19 7.5",
  CAUTION: "M12 5.5v8M12 18.5v.2",
  "NO-GO": "M7 7l10 10M17 7L7 17",
};

const TONE: Record<Status, string> = {
  GO: "status-go",
  CAUTION: "status-caution",
  "NO-GO": "status-nogo",
};

type LampSize = "xs" | "sm" | "lg";

const LAMP_SIZE: Record<LampSize, string> = {
  xs: "lamp-xs",
  sm: "lamp-sm",
  lg: "lamp-lg",
};

type StatusLampProps = {
  status: Status;
  /** xs 13 px (inline flags), sm 16 px (lists), lg 24 px (the status block). */
  size?: LampSize;
  className?: string;
};

/**
 * A flat circle in the status colour with a dark cut glyph: ✓ GO, ! CAUTION, ✕ NO-GO.
 * Decorative on its own (hidden from screen readers): put the word next to it, or use
 * `StatusBadge`.
 */
export function StatusLamp({ status, size = "sm", className }: StatusLampProps) {
  return (
    <span aria-hidden="true" className={cx("lamp", TONE[status], LAMP_SIZE[size], className)}>
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={GLYPH[status]} />
      </svg>
    </span>
  );
}

type StatusBadgeProps = {
  status: Status;
  size?: "sm" | "lg";
  className?: string;
};

/** The lamp and the status word together, in the status colour at weight 600. */
export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  return (
    <span className={cx("status-badge", TONE[status], size === "lg" && "status-badge-lg", className)}>
      <StatusLamp status={status} size={size} />
      {status}
    </span>
  );
}

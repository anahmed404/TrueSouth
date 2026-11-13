import type { ReactNode } from "react";
import { cx, formatNumber } from "./format";

type NumberUnitProps = {
  /** The value. A number is formatted with `decimals`; a string is shown as given. */
  value: number | string;
  /**
   * The unit: "h", "°", "%", "km". Pass "" only for a dimensionless ratio such as a disc
   * fraction or a utility, which is shown without one.
   */
  unit: string;
  decimals?: number;
  /**
   * A display number (a status value, a countdown): the unit is set at 0.7 em in --ink-2.
   * Off by default: inside running text the unit stays full size, after a thin space.
   */
  display?: boolean;
  className?: string;
};

const TIGHT_UNITS = new Set(["°", "′", "″"]);

/** A no-break space narrower than a word space, between a number and its unit. */
const UNIT_SPACE = " ";

/**
 * A number with its unit, in tabular figures, never broken across lines: "31 h", "3.1°".
 * The unit is part of the accessible text, so "31 h" is read as one value.
 */
export function NumberUnit({ value, unit, decimals = 0, display = false, className }: NumberUnitProps) {
  const text = typeof value === "number" ? formatNumber(value, decimals) : value;
  let suffix: ReactNode = null;
  if (unit !== "") {
    if (TIGHT_UNITS.has(unit)) suffix = unit;
    else if (display) suffix = <span className="unit">{unit}</span>;
    else suffix = `${UNIT_SPACE}${unit}`;
  }
  return (
    <span className={cx("tabular whitespace-nowrap", className)}>
      {text}
      {suffix}
    </span>
  );
}

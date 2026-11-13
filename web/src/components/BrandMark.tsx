import { Link } from "react-router";
import { cx } from "./format";

/** The TrueSouth mark: a compass needle in a ring, the south half shaded. */
export function BrandGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="brand-glyph">
      <circle cx="16" cy="16" r="14" fill="none" strokeWidth="1.6" className="brand-ring" />
      <path d="M16 4 L19 16 L16 28 L13 16Z" className="brand-north" />
      <path d="M16 16 L19 16 L16 28Z" className="brand-south" />
    </svg>
  );
}

/** The mark and the name, linking home. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx("brand", className)} aria-label="TrueSouth, home">
      <BrandGlyph />
      <span aria-hidden="true">TrueSouth</span>
    </Link>
  );
}

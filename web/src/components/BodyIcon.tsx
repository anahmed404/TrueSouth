import { cx } from "./format";

type BodyIconProps = {
  body: "sun" | "earth";
  /** Pixel size; 16 by default. */
  size?: number;
  className?: string;
};

/**
 * The small Sun and Earth marks from the C2 prototypes: a cream Sun with eight rays, and a
 * sky-blue Earth with two strokes of land. Decorative: always beside the word.
 */
export function BodyIcon({ body, size = 16, className }: BodyIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cx("body-icon", body === "sun" ? "body-icon-sun" : "body-icon-earth", className)}
    >
      {body === "sun" ? (
        <>
          <circle cx="12" cy="12" r="4.2" className="body-icon-disc" />
          <path
            className="body-icon-rays"
            d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
          />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8" className="body-icon-disc" />
          <path className="body-icon-land" d="M7 9c2 0 2.5 1.5 4 1.5S13 9 14.5 9.5 16 12 18 12M8 15.5c1.5-.5 3 .5 4.5 0" />
        </>
      )}
    </svg>
  );
}

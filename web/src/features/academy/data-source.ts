/**
 * Which data the app is reading, so the Academy never calls test numbers real.
 *
 * Nothing in the client says so on its own: `web/src/data/` fetches `/data/…`, and the Vite
 * middleware in `vite.config.ts` decides whether that is `data/fixtures/` (when
 * `VITE_DATA=fixtures`) or `data/derived/` (otherwise). Vite also hands `VITE_`-prefixed
 * environment variables to the client as `import.meta.env`, so this helper reads the same
 * `VITE_DATA` with the same rule. A production build without `VITE_DATA` reads derived data.
 */
export type DataSource = "derived" | "fixtures";

export function academyDataSource(env: Readonly<Record<string, unknown>> = import.meta.env): DataSource {
  return env["VITE_DATA"] === "fixtures" ? "fixtures" : "derived";
}

/** The card's line under a worked example: what a boxed number is. */
export function boxedNumbersNote(source: DataSource): string {
  return source === "fixtures"
    ? "Numbers in a box are sample values for testing, not real."
    : "Numbers in a box are real data, made by TrueSouth's pipeline from NASA data.";
}

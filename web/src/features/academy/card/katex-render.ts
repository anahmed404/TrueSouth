/**
 * KaTeX, loaded only when an Under-the-hood card first opens. Nothing outside this file
 * may import `katex`: `card/math.tsx` loads this module with a dynamic `import()`, so KaTeX
 * and its CSS and fonts stay out of the first page's bundle. `bundle.test.ts` checks it.
 *
 * The CSS and fonts come from the `katex` package itself (no CDN). The "swap" build of the
 * CSS shows the formula in a fallback face at once and swaps in KaTeX's fonts when they
 * arrive, instead of hiding it while they load.
 */
import katex, { type TrustContext } from "katex";
import "katex/dist/katex-swap.min.css";
import { FILL_CLASS } from "./tex";

export type TexResult = { ok: true; html: string } | { ok: false; error: string };

/** Only our own `\htmlClass{ac-fill…}` wrapper is trusted; every other HTML command is refused. */
function trust(context: TrustContext): boolean {
  return context.command === "\\htmlClass" && context.class.split(" ").every((name) => name.startsWith(FILL_CLASS));
}

const reported = new Set<string>();

/** Logs a formula that fails to parse, once per formula, in development only. */
function reportOnce(tex: string, error: string): void {
  if (!import.meta.env.DEV || reported.has(tex)) return;
  reported.add(tex);
  console.warn(`[Under the hood] A formula failed to parse and is shown as TeX: ${error}\n${tex}`);
}

/**
 * Renders TeX to KaTeX's visual HTML with MathML beside it, which screen readers read.
 * A formula that fails to parse gives `ok: false`; it never throws.
 */
export function renderTex(tex: string, display: boolean): TexResult {
  try {
    const html = katex.renderToString(tex, {
      displayMode: display,
      output: "htmlAndMathml",
      throwOnError: true,
      trust,
      strict: "ignore",
    });
    return { ok: true, html };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportOnce(tex, message);
    return { ok: false, error: message };
  }
}

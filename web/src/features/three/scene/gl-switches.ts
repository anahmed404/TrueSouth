/**
 * Switches for the scene's WebGL canvas, read once from the address when the app loads, for
 * finding "the black box" on a machine that shows it (DEVLOG, "MC rail overlays"). The app
 * rewrites the address to its own form soon after, so they are read at module load.
 *
 * - `diag=1`: the diagnostic capture (web/src/app/diag.ts): F9 saves an .html file with the
 *   canvases' pixels, the page's paint list and the WebGL state.
 * - `gl-preserve=1`: `preserveDrawingBuffer: true` (the canvas keeps its last frame).
 * - `gl-loop=always`: draw every frame instead of only when something changes.
 * - `gl-aa=0`: no antialiasing.
 * - `gl-power=default`: let the browser pick the GPU (default is "high-performance").
 *
 * Without them the scene is exactly as before.
 */

export type GlSwitches = {
  diag: boolean;
  preserveDrawingBuffer: boolean;
  frameloop: "demand" | "always";
  antialias: boolean;
  powerPreference: "high-performance" | "default";
};

export const GL_DEFAULTS: GlSwitches = {
  diag: false,
  preserveDrawingBuffer: false,
  frameloop: "demand",
  antialias: true,
  powerPreference: "high-performance",
};

/** The switches in an address's query string ("?diag=1&gl-aa=0"). */
export function readGlSwitches(search: string): GlSwitches {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return GL_DEFAULTS;
  }
  const on = (name: string) => ["1", "true", "on", "yes"].includes((params.get(name) ?? "").toLowerCase());
  return {
    diag: on("diag"),
    preserveDrawingBuffer: on("gl-preserve"),
    frameloop: params.get("gl-loop") === "always" ? "always" : "demand",
    antialias: params.get("gl-aa") !== "0",
    powerPreference: params.get("gl-power") === "default" ? "default" : "high-performance",
  };
}

/** The switches this page was opened with. */
export const GL_SWITCHES: GlSwitches = readGlSwitches(typeof window === "undefined" ? "" : window.location.search);

/** How many fresh frames the scene draws after a popover or tip changes over it. */
export const OVERLAY_REDRAW_FRAMES = 4;

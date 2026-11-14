/**
 * The black box diagnostic: open any page with `?diag=1`, make the box appear, press F9. The
 * page saves one self-contained .html file (a download, nothing is sent anywhere) with:
 *
 * - every canvas's pixels, twice for the 3D scene: as it is at the key press, read without
 *   drawing (`drawImage` and `toDataURL`, what the compositor would show), and right after a
 *   forced frame read in the same task (with `preserveDrawingBuffer: false` a late read is
 *   blank, so the second is the scene's true picture). If the Moon is missing inside the box
 *   in both, the canvas itself is empty there; if only in the first, or in neither, the fault
 *   is in compositing;
 * - the page's paint list: every element (and ::before or ::after with content) on screen that
 *   paints something, with its box and the styles that decide compositing;
 * - the WebGL state, the renderer's pixel ratio, the quality stage and the camera's view
 *   offset;
 * - the browser, window and display: user agent, device pixel ratio, sizes and a few media
 *   queries.
 *
 * Works on a plain http:// address (no clipboard or screen capture, which need https). F9 is
 * not one of the app's keys and closes nothing, so a popover stays open while it is pressed.
 */

type SceneBridge = {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext | WebGL2RenderingContext;
  render: () => void;
  pixelRatio: () => number;
  qualityStage: () => number;
  switches: unknown;
  cameraView: () => unknown;
};

export const DIAG_KEY = "F9";

/** Listens for F9 (`?diag=1` only, see main.tsx). */
export function installDiagnostics(): void {
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== DIAG_KEY) return;
      event.preventDefault();
      event.stopPropagation();
      void capture();
    },
    true,
  );
  console.info(`TrueSouth diagnostics on: press ${DIAG_KEY} to save a report.`);
}

/** One canvas's picture as a PNG data URL, drawn through a 2D canvas, or null. */
function picture(canvas: HTMLCanvasElement): { drawn: string | null; direct: string | null } {
  let drawn: string | null = null;
  let direct: string | null = null;
  try {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")?.drawImage(canvas, 0, 0);
    drawn = copy.toDataURL("image/png");
  } catch (error) {
    drawn = null;
    void error;
  }
  try {
    direct = canvas.toDataURL("image/png");
  } catch {
    direct = null;
  }
  return { drawn, direct };
}

function rectOf(element: Element) {
  const r = element.getBoundingClientRect();
  return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
}

function alpha(colour: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(colour);
  if (!match) return colour === "transparent" ? 0 : 1;
  const parts = match[1]!.split(/[,/ ]+/).filter(Boolean);
  return parts.length >= 4 ? Number(parts[3]) : 1;
}

function isTopLayer(element: Element): boolean {
  try {
    return element.matches(":popover-open") || element.matches(":modal");
  } catch {
    return false;
  }
}

const PAINTED_TAGS = new Set(["CANVAS", "IMG", "SVG", "VIDEO", "IFRAME", "svg"]);

/** Every element on screen that paints something, with what decides how it is composited. */
function paintList() {
  const out: Record<string, unknown>[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const element of Array.from(document.querySelectorAll("*"))) {
    const r = element.getBoundingClientRect();
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh || r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(element);
    const borders = ["Top", "Right", "Bottom", "Left"].some(
      (side) => parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && alpha(cs.getPropertyValue(`border-${side.toLowerCase()}-color`)) > 0,
    );
    const pseudo = (["::before", "::after"] as const)
      .map((which) => {
        const p = getComputedStyle(element, which);
        return p.content && p.content !== "none" && p.content !== "normal" ? { which, content: p.content.slice(0, 40), background: p.backgroundColor, position: p.position } : null;
      })
      .filter(Boolean);
    const paints =
      alpha(cs.backgroundColor) > 0 ||
      cs.backgroundImage !== "none" ||
      borders ||
      cs.boxShadow !== "none" ||
      PAINTED_TAGS.has(element.tagName) ||
      pseudo.length > 0;
    if (!paints) continue;
    out.push({
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      class: typeof element.className === "string" ? element.className.slice(0, 80) : undefined,
      rect: rectOf(element),
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage === "none" ? undefined : cs.backgroundImage.slice(0, 60),
      boxShadow: cs.boxShadow === "none" ? undefined : cs.boxShadow,
      opacity: cs.opacity,
      visibility: cs.visibility,
      display: cs.display,
      position: cs.position,
      zIndex: cs.zIndex,
      overflow: `${cs.overflowX} ${cs.overflowY}`,
      transform: cs.transform === "none" ? undefined : cs.transform,
      contain: cs.contain === "none" ? undefined : cs.contain,
      willChange: cs.willChange === "auto" ? undefined : cs.willChange,
      filter: cs.filter === "none" ? undefined : cs.filter,
      backdropFilter: cs.getPropertyValue("backdrop-filter") || undefined,
      mixBlendMode: cs.mixBlendMode === "normal" ? undefined : cs.mixBlendMode,
      isolation: cs.isolation === "auto" ? undefined : cs.isolation,
      pointerEvents: cs.pointerEvents,
      topLayer: isTopLayer(element) || undefined,
      scroll: element.scrollTop || element.scrollLeft ? { top: element.scrollTop, left: element.scrollLeft } : undefined,
      pseudo: pseudo.length > 0 ? pseudo : undefined,
    });
  }
  return out;
}

function animations() {
  try {
    return document.getAnimations().map((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
      return {
        name: (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id,
        playState: a.playState,
        target: target ? `${target.tagName.toLowerCase()}.${typeof target.className === "string" ? target.className.slice(0, 40) : ""}` : null,
      };
    });
  } catch {
    return [];
  }
}

function webglState(bridge: SceneBridge | undefined) {
  if (!bridge) return { scene: "no 3D scene on this page (or it has not started)" };
  const gl = bridge.context;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    version: gl.getParameter(gl.VERSION),
    drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    canvasAttributes: [bridge.canvas.width, bridge.canvas.height],
    canvasCss: rectOf(bridge.canvas),
    viewport: Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array),
    scissorBox: Array.from(gl.getParameter(gl.SCISSOR_BOX) as Int32Array),
    scissorTest: gl.isEnabled(gl.SCISSOR_TEST),
    contextAttributes: gl.getContextAttributes(),
    contextLost: gl.isContextLost(),
    rendererPixelRatio: bridge.pixelRatio(),
    qualityStage: bridge.qualityStage(),
    cameraView: bridge.cameraView(),
    switches: bridge.switches,
  };
}

function environment() {
  const queries = [
    "(prefers-reduced-motion: reduce)",
    "(forced-colors: active)",
    "(prefers-contrast: more)",
    "(prefers-contrast: less)",
    "(prefers-reduced-transparency: reduce)",
    "(dynamic-range: high)",
  ];
  const vv = window.visualViewport;
  return {
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    inner: [window.innerWidth, window.innerHeight],
    outer: [window.outerWidth, window.outerHeight],
    screen: [screen.width, screen.height, screen.availWidth, screen.availHeight],
    visualViewport: vv ? { width: vv.width, height: vv.height, scale: vv.scale, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop } : null,
    media: Object.fromEntries(queries.map((q) => [q, window.matchMedia(q).matches])),
    url: location.pathname + location.search,
    time: new Date().toISOString(),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/** Captures everything, then saves the report. */
export async function capture(): Promise<void> {
  const bridge = (window as unknown as { __truesouthDiag?: SceneBridge }).__truesouthDiag;
  // 1. Every canvas as it is now, before anything is drawn.
  const canvases = Array.from(document.querySelectorAll("canvas")).map((canvas) => ({
    which: canvas === bridge?.canvas ? "3D scene" : canvas.className || "canvas",
    size: [canvas.width, canvas.height],
    css: rectOf(canvas),
    asIs: picture(canvas),
  }));
  // 2. The 3D scene after one forced frame, read in the same task.
  let afterRender: { drawn: string | null; direct: string | null } | null = null;
  if (bridge) {
    try {
      bridge.render();
      afterRender = picture(bridge.canvas);
    } catch {
      afterRender = null;
    }
  }
  const report = {
    environment: environment(),
    webgl: webglState(bridge),
    paintList: paintList(),
    animations: animations(),
  };

  const img = (label: string, src: string | null) =>
    src ? `<figure><figcaption>${label}</figcaption><img src="${src}" alt="${label}"></figure>` : `<p>${label}: could not be read</p>`;
  const html = `<!doctype html><meta charset="utf-8"><title>TrueSouth diagnostic ${report.environment.time}</title>
<style>body{font:13px/1.4 system-ui,sans-serif;background:#111;color:#eee;margin:16px}img{max-width:100%;border:1px solid #444;background:repeating-conic-gradient(#333 0 25%,#222 0 50%) 0 0/16px 16px}figure{margin:8px 0 16px}pre{white-space:pre-wrap;font-size:11px;background:#1b1b1d;padding:8px}</style>
<h1>TrueSouth diagnostic</h1>
<p>Saved ${escapeHtml(report.environment.time)} at ${escapeHtml(report.environment.url)}. Hand this file back; nothing was sent anywhere.</p>
<h2>Canvases</h2>
${canvases
  .map(
    (c) => `<h3>${escapeHtml(c.which)} (${c.size.join(" × ")} px, on screen ${c.css.w} × ${c.css.h} at ${c.css.x}, ${c.css.y})</h3>
${img("As it was at the key press, drawn through a 2D canvas", c.asIs.drawn)}
${img("As it was at the key press, toDataURL", c.asIs.direct)}`,
  )
  .join("\n")}
${afterRender ? `<h3>3D scene after one forced frame, read at once</h3>${img("After a forced frame, drawn through a 2D canvas", afterRender.drawn)}${img("After a forced frame, toDataURL", afterRender.direct)}` : ""}
<h2>Report</h2>
<pre>${escapeHtml(JSON.stringify(report, null, 1))}</pre>`;

  const name = `truesouth-diag-${report.environment.time.replace(/[:.]/g, "-")}.html`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  console.info(`TrueSouth diagnostic saved as ${name}.`);
}

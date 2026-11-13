import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * KaTeX must not be in the first page's bundle. Vite puts into the first chunk every module
 * reachable from src/main.tsx by static imports; a dynamic `import()` starts a new chunk.
 * This test walks that static import graph from the source and checks that `katex` and
 * `card/katex-render.ts` are not on it, and that `katex-render.ts` is reached by a dynamic
 * import instead. The build output confirms it too: `pnpm --dir web build` lists a separate
 * `katex-render-*.js` chunk and `katex-render-*.css`.
 */

const webSrc = fileURLToPath(new URL("../../../", import.meta.url));
const entry = resolve(webSrc, "main.tsx");
const katexRender = resolve(webSrc, "features/academy/card/katex-render.ts");

const STATIC_FROM = /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?[^;'"`]*?\bfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /(?:^|[\s;])import\s*["']([^"']+)["']/g;
const DYNAMIC = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveLocal(from: string, specifier: string): string | null {
  for (const extension of EXTENSIONS) {
    const candidate = resolve(dirname(from), specifier + extension);
    if (existsSync(candidate) && /\.(tsx?|css)$/.test(candidate)) return candidate;
  }
  return null;
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

/** Modules and packages reachable from `start` by static imports only. */
function staticGraph(start: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    if (file.endsWith(".css")) continue;
    // Drop `import type …` lines: they vanish at build time.
    const source = readFileSync(file, "utf8").replace(/^\s*import\s+type\s[^;]*;/gm, "");
    const specifiers = [...source.matchAll(STATIC_FROM), ...source.matchAll(SIDE_EFFECT)].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        const resolved = resolveLocal(file, specifier);
        if (resolved) queue.push(resolved);
      } else {
        packages.add(packageName(specifier));
      }
    }
  }
  return { files, packages };
}

describe("KaTeX stays out of the first page's bundle", () => {
  const graph = staticGraph(entry);

  it("walks the real app: the router and the card are on the static graph", () => {
    expect(graph.files.has(resolve(webSrc, "app/router.tsx"))).toBe(true);
    expect(graph.files.has(resolve(webSrc, "features/academy/card/index.tsx"))).toBe(true);
    expect(graph.packages.has("react")).toBe(true);
  });

  it("has no static path to katex or to katex-render.ts", () => {
    expect(graph.packages.has("katex")).toBe(false);
    expect(graph.files.has(katexRender)).toBe(false);
  });

  it("reaches katex-render.ts by a dynamic import, and only it imports katex", () => {
    const math = readFileSync(resolve(webSrc, "features/academy/card/math.tsx"), "utf8");
    expect([...math.matchAll(DYNAMIC)].map((match) => match[1])).toContain("./katex-render");
    expect(staticGraph(katexRender).packages.has("katex")).toBe(true);
  });
});

import path from "node:path";

export type DataSource = "derived" | "fixtures";

/**
 * Map a request path under `/data/` to a file inside `data/derived` or
 * `data/fixtures`. Returns null when the path is not a data URL or would
 * leave that folder.
 */
export function resolveDataFile(
  repoRoot: string,
  requestPath: string,
  source: DataSource,
): string | null {
  const pathname = requestPath.split("?")[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded !== "/data" && !decoded.startsWith("/data/")) {
    return null;
  }

  const relativeUrl = decoded === "/data" ? "" : decoded.slice("/data/".length);
  if (relativeUrl.includes("\0")) {
    return null;
  }

  const segments = relativeUrl.split(/[/\\]/).filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === ".." || segment.includes(":"))) {
    return null;
  }

  const base = path.resolve(repoRoot, "data", source);
  const target = path.resolve(base, ...segments);
  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return target;
}

/**
 * What a custom site's row says while it is not a normal site yet: sending, checking a
 * link's id, queued, computing, not computed on this server, or failed. Words only, so the
 * states can be tested without a browser.
 */

import type { CustomEntry } from "../../state/custom-sites";
import { formatCoordinates } from "./custom-site-form";

export const COMPUTING_TEXT = "Computing terrain for your site…";
export const NOT_COMPUTED_TEXT = "Not computed on this server yet";
export const YOUR_SITE_TAG = "Your site";
export const YOUR_SITE_TIP =
  "A point typed into TrueSouth (by you, or by whoever shared the link). TrueSouth computes it from NASA's terrain; it is not a sourced mission site.";
export const STOPPED_WAITING =
  "Stopped waiting. The server may still finish this site; if it does, asking again later finds it ready.";

export type RowAction = "stop" | "retry" | "compute" | "remove";

export type CustomRowView = {
  title: string;
  coordinates: string;
  /** The state, in words. */
  line: string;
  /** A quieter second line: the queue position, the time so far, or when to try again. */
  detail: string | null;
  busy: boolean;
  failed: boolean;
  /** The primary action, if any, and whether it waits for a time. */
  primary: { action: "retry" | "compute"; label: string; disabled: boolean } | null;
  /** The row's close button: stop waiting, or remove. */
  close: { action: "stop" | "remove"; label: string };
};

/** "0:07", "1:32", "12:05". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "14:32 UTC" for a moment in ms since 1970. */
export function formatClockUtc(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "later";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}

const FIELD_NAMES: Record<string, string> = { lat_deg: "Latitude", lon_deg: "East longitude", name: "Name" };

/** A 422's field messages, each after its field's name: "Latitude: …". */
function fieldText(fields: readonly { field: string; message: string }[]): string | null {
  if (fields.length === 0) return null;
  return fields.map((f) => (FIELD_NAMES[f.field] ? `${FIELD_NAMES[f.field]}: ${f.message}` : f.message)).join(" ");
}

export function customRowView(entry: CustomEntry, nowMs: number): CustomRowView {
  const title = entry.site?.name ?? entry.name ?? "Custom site";
  const coordinates = formatCoordinates(entry.site?.lat_deg ?? entry.latDeg, entry.site?.lon_deg ?? entry.lonDeg);
  const base = { title, coordinates, detail: null, busy: false, failed: false, primary: null };
  const stop = { action: "stop" as const, label: `Stop waiting for ${title}` };
  const remove = { action: "remove" as const, label: `Remove ${title}` };
  const elapsed = formatElapsed(nowMs - entry.sinceMs);

  switch (entry.phase) {
    case "sending":
      return { ...base, line: COMPUTING_TEXT, detail: "Sending it to the server", busy: true, close: stop };
    case "checking":
      return { ...base, line: "Asking the server for this site…", busy: true, close: remove };
    case "queued":
      return {
        ...base,
        line: COMPUTING_TEXT,
        detail: entry.position !== null ? `Number ${entry.position} in the queue · ${elapsed}` : `In the server's queue · ${elapsed}`,
        busy: true,
        close: stop,
      };
    case "running":
      return { ...base, line: COMPUTING_TEXT, detail: `${elapsed} so far · usually about a minute`, busy: true, close: stop };
    case "not_computed":
      return {
        ...base,
        line: NOT_COMPUTED_TEXT,
        primary: { action: "compute", label: "Compute this site", disabled: false },
        close: remove,
      };
    case "failed": {
      const waitUntil = entry.retryAtMs !== null && entry.retryAtMs > nowMs ? entry.retryAtMs : null;
      const fields = fieldText(entry.problem?.fields ?? []);
      const wait = waitUntil !== null && waitUntil - nowMs > 5000 ? `You can try again after ${formatClockUtc(waitUntil)}.` : null;
      return {
        ...base,
        line: entry.problem?.message ?? "This site could not be computed.",
        detail: [fields, wait].filter(Boolean).join(" ") || null,
        failed: true,
        primary: { action: "retry", label: "Try again", disabled: waitUntil !== null },
        close: remove,
      };
    }
    case "ready":
      return { ...base, line: "Ready", close: remove };
  }
}

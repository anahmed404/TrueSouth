/**
 * What every TrueSouth export carries, and saving a file from the browser
 * (docs/features/share-export.md, "Export data"). Nothing is uploaded.
 */

import type { MissionProfile, TimeGrid } from "../../contracts/generated";
import { hourIndexToUtc } from "../time";

export { neutraliseFormula, parseCsv, toCsv, type CsvValue, type ParsedCsv } from "./csv";

/** The validation caveat, as the footer line says it. */
export const CAVEAT = "Planning aid, not flight certification";

/** Where the numbers come from. */
export const DATA_SOURCE =
  "TrueSouth: Sun and Earth positions from JPL Horizons, terrain from LOLA (NASA PGDA), skylines and per-hour series computed by the TrueSouth Python pipeline, mission metrics and scores computed in the browser (docs/science.md sections 9 and 10)";

/** A UTC timestamp to the second, ending in Z: "2026-11-13T09:41:05Z". */
export function utcSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The time grid's first and last hour, both UTC ending in Z. */
export function gridRange(grid: TimeGrid): { start_utc: string; end_utc: string; step_s: number; hours: number } {
  return { start_utc: grid.start_utc, end_utc: hourIndexToUtc(grid, grid.count - 1), step_s: grid.step_s, hours: grid.count };
}

/** "2028-03-14", for a file name. */
export function fileDate(utc: string): string {
  return utc.slice(0, 10);
}

/** A profile id that is safe in a file name: "im2_athena", or "custom". */
export function fileProfile(profile: MissionProfile): string {
  return profile.id.replace(/[^a-z0-9_]+/gi, "_").toLowerCase() || "profile";
}

/** Saves a text file through the browser's download, made from a Blob in memory. */
export function saveTextFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL goes.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

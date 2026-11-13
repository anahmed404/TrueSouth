import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { decodeSeries } from "../../../data/decode";
import { columnsFromMeta } from "../../../data/load";
import { hourFlags } from "../../../lib/scoring";
import { sceneContent, seriesSunAnswer, type PlateInput } from "./plates";

/**
 * The decoration plate's link to the series, on the shared fixture: what the plate says at an
 * hour must be what the series and the profile's hour flag say. The scene builds the plate's
 * input with `seriesSunAnswer` (scene-root.tsx), so a constant there fails these tests.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
const profile = (JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[]).find(
  (p) => p.id === "im2_athena",
)!;
const site = path.join(fixtures, "sites", "fixture_ridge");
const meta = JSON.parse(readFileSync(path.join(site, "meta.json"), "utf8"));
const bytes = readFileSync(path.join(site, "series.bin"));
const series = decodeSeries(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  columnsFromMeta(meta),
  manifest.time_grid.count,
  "series.bin",
);
const flags = hourFlags(series, profile);

function firstHour(test: (frac: number, lit: boolean) => boolean): number {
  for (let h = 0; h < series.sun_frac.length; h += 1) if (test(series.sun_frac[h]!, flags.lit[h] === 1)) return h;
  throw new Error("the fixture has no such hour");
}

function plateAt(hour: number, view: PlateInput["view"] = "terrain") {
  return sceneContent({
    view,
    trueScale: false,
    system: "ready",
    site: { name: "Fixture ridge", sphere: false },
    series: "ready",
    terrain: "ready",
    apron: "ready",
    sun: seriesSunAnswer(series, flags, hour),
  }).plates.find((p) => p.id === "decoration");
}

describe("the decoration plate says what the series says (fixture_ridge, IM-2 Athena)", () => {
  it("at a lit hour: lit, with the series' disc fraction", () => {
    const hour = firstHour((frac, lit) => lit && frac > 0.999);
    expect(plateAt(hour)?.text).toBe(`The series says: lit. ${Math.round(series.sun_frac[hour]! * 100)} % of the Sun's disc is above the skyline.`);
  });

  it("at a dark hour: dark, with the series' disc fraction", () => {
    let hour = firstHour((_frac, lit) => !lit);
    for (let h = hour; h < series.sun_frac.length; h += 1) if (flags.lit[h] === 0 && series.sun_frac[h]! < series.sun_frac[hour]!) hour = h;
    expect(plateAt(hour)?.text).toBe(`The series says: dark. Sun disc fraction ${series.sun_frac[hour]!.toFixed(2)} above the skyline.`);
  });

  it("at a partly hidden hour: the hour flag decides the word, the series gives the fraction", () => {
    const hour = firstHour((frac) => frac > 0.01 && frac < 0.99);
    const frac = series.sun_frac[hour]!;
    const text = plateAt(hour)?.text;
    if (flags.lit[hour] === 1) expect(text).toBe(`The series says: lit. ${Math.round(frac * 100)} % of the Sun's disc is above the skyline.`);
    else expect(text).toBe(`The series says: dark. Sun disc fraction ${frac.toFixed(2)} above the skyline.`);
  });

  it("at every hour of the fixture, lit or dark matches the hour flag", () => {
    for (let hour = 0; hour < series.sun_frac.length; hour += 97) {
      const text = plateAt(hour)?.text ?? "";
      expect(text.startsWith(flags.lit[hour] === 1 ? "The series says: lit." : "The series says: dark.")).toBe(true);
    }
  });

  it("without the series or the flags, says only what the drawing is", () => {
    expect(seriesSunAnswer(null, flags, 3)).toBeNull();
    expect(seriesSunAnswer(series, null, 3)).toBeNull();
    expect(seriesSunAnswer(series, flags, null)).toBeNull();
    expect(seriesSunAnswer(series, flags, series.sun_frac.length + 5)).toBeNull();
  });

  it("is what the scene passes: scene-root builds the plate's input with seriesSunAnswer from the focused series", () => {
    // Mounting the scene needs WebGL, so this reads the one line that wires it.
    const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "scene-root.tsx"), "utf8");
    expect(source).toContain("sun: seriesSunAnswer(focusReady?.series, focusReady?.flags, hourIndex),");
  });
});

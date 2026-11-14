import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Luna } from "./Luna";
import { lunaArt } from "./art";
import { PART_NAMES } from "./art-contract";
import {
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  celebrationPlan,
  confettiPieces,
  lunaMotionPlan,
  nextBlinkDelayMs,
  resolveReducedMotion,
} from "./motion-plan";
import { isMood, MOOD_USE, MOODS } from "./moods";
import {
  DETAIL_MIN_SIZE,
  EXTRAS_MIN_SIZE,
  FALLBACK_MOOD,
  resolveMoodArt,
  showsDetail,
  showsExtras,
} from "./resolve-art";

const artDir = fileURLToPath(new URL("./art/", import.meta.url));
const artFiles = readdirSync(artDir).filter((name) => name.endsWith(".tsx"));
const artSource = (name: string) => readFileSync(`${artDir}${name}`, "utf8");
const theme = readFileSync(fileURLToPath(new URL("../../app/theme.css", import.meta.url)), "utf8");

describe("moods", () => {
  it("are exactly the eight in docs/academy/luna.md", () => {
    expect([...MOODS]).toEqual([
      "idle",
      "happy",
      "thinking",
      "cheering",
      "worried",
      "surprised",
      "sleepy",
      "proud",
    ]);
    expect(Object.keys(MOOD_USE).sort()).toEqual([...MOODS].sort());
  });

  it("isMood accepts only listed moods", () => {
    expect(isMood("happy")).toBe(true);
    expect(isMood("angry")).toBe(false);
    expect(isMood(3)).toBe(false);
  });
});

describe("art", () => {
  it("has art for every mood and no extra moods", () => {
    expect(Object.keys(lunaArt.moods).sort()).toEqual([...MOODS].sort());
  });

  it.each(MOODS)("%s resolves to art with eyes, a mouth and a text alternative", (mood) => {
    const art = resolveMoodArt(mood);
    expect(art).toBe(lunaArt.moods[mood]);
    expect(art.eyes).toBeTruthy();
    expect(art.mouth).toBeTruthy();
    expect(art.label.trim().length).toBeGreaterThan(0);
    expect(art.label).toMatch(/^Luna\b/);
  });

  it("gives each mood a different text alternative", () => {
    const labels = MOODS.map((m) => lunaArt.moods[m].label);
    expect(new Set(labels).size).toBe(MOODS.length);
  });

  it("uses only the shared part names", () => {
    const allowed = new Set<string>([...PART_NAMES, "label", "blinks"]);
    for (const mood of MOODS) {
      for (const key of Object.keys(lunaArt.moods[mood])) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });

  it("has no literal colours anywhere in the art", () => {
    for (const name of artFiles) {
      const source = artSource(name);
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, name).not.toMatch(/\b(rgba?|hsla?|oklch|oklab|color-mix)\(/);
      expect(source, name).not.toMatch(/\b(fill|stroke|color)=["{]/);
    }
  });

  it("colours the faces only with Luna's tokens, each defined in the theme", () => {
    const used = new Set<string>();
    for (const name of artFiles) {
      if (name === "body.tsx") continue; // the body and craters are unchanged by A10
      for (const match of artSource(name).matchAll(/(?<=["\s])(?:fill|stroke)-([a-z][a-z0-9-]*)/g)) {
        const token = match[1]!;
        if (token === "none" || token.startsWith("[")) continue;
        expect(token, `${name} uses ${token}`).toMatch(/^luna-/);
        used.add(token);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const token of used) {
      expect(theme, `--${token}`).toMatch(new RegExp(`--${token}:\\s*#`));
      expect(theme, `--color-${token}`).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it("falls back to idle for an unknown mood", () => {
    expect(resolveMoodArt("grumpy")).toBe(lunaArt.moods[FALLBACK_MOOD]);
  });

  it("drops crater detail below the readable-size threshold", () => {
    expect(showsDetail(48)).toBe(false);
    expect(showsDetail(DETAIL_MIN_SIZE)).toBe(true);
    expect(showsDetail(160)).toBe(true);
  });

  it("drops extras (sparkles, hearts, the note, the z, cheeks) below their threshold", () => {
    expect(EXTRAS_MIN_SIZE).toBeLessThanOrEqual(48); // the lesson avatar keeps them
    expect(showsExtras(28)).toBe(false);
    expect(showsExtras(EXTRAS_MIN_SIZE - 1)).toBe(false);
    expect(showsExtras(EXTRAS_MIN_SIZE)).toBe(true);
    // idle's music note is the only tear-blue thing on her face.
    const draw = (size: number) =>
      renderToStaticMarkup(createElement(Luna, { mood: "idle", size, reduceMotion: true }));
    expect(draw(28)).not.toContain("fill-luna-tear");
    expect(draw(64)).toContain("fill-luna-tear");
    // Eyes and mouth stay at every size.
    expect(draw(28)).toContain("fill-luna-sparkle");
    expect(draw(28)).toContain("fill-luna-feature");
  });

  it("keeps worried's welling tear at the smallest size: it belongs to the eyes", () => {
    const small = renderToStaticMarkup(
      createElement(Luna, { mood: "worried", size: 28, reduceMotion: true }),
    );
    expect(small).toContain("fill-luna-tear");
  });

  it("does not blink eyes that are already closed", () => {
    expect(lunaArt.moods.happy.blinks).toBe(false);
    for (const mood of ["idle", "thinking", "cheering", "worried", "surprised", "proud"] as const) {
      expect(lunaArt.moods[mood].blinks, mood).not.toBe(false);
    }
  });
});

describe("reduced motion", () => {
  it("prefers the prop, then the system, then full motion", () => {
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(false, true)).toBe(false);
    expect(resolveReducedMotion(undefined, true)).toBe(true);
    expect(resolveReducedMotion(undefined, false)).toBe(false);
    expect(resolveReducedMotion(undefined, null)).toBe(false);
  });

  it("turns off every Luna animation and swaps moods instantly", () => {
    expect(lunaMotionPlan(true)).toEqual({
      idleBob: false,
      blink: false,
      moodFade: 0,
      moodPop: false,
    });
    const full = lunaMotionPlan(false);
    expect(full.idleBob && full.blink && full.moodPop).toBe(true);
    expect(full.moodFade).toBeGreaterThan(0);
    expect(full.moodFade).toBeLessThan(0.5);
  });

  it("keeps the celebration but drops hop and confetti", () => {
    for (const kind of ["correct", "lesson-complete"] as const) {
      const plan = celebrationPlan(kind, true);
      expect(plan.confetti).toBe(0);
      expect(plan.hop).toBe(0);
      expect(plan.lunaSize).toBeGreaterThan(0);
    }
  });
});

describe("celebrations", () => {
  it("make lesson end bigger than a correct answer", () => {
    const small = celebrationPlan("correct", false);
    const big = celebrationPlan("lesson-complete", false);
    expect(big.confetti).toBeGreaterThan(small.confetti);
    expect(big.lunaSize).toBeGreaterThan(small.lunaSize);
    expect(big.duration).toBeGreaterThan(small.duration);
    expect(small.duration).toBeLessThanOrEqual(1);
  });

  it("can switch confetti off", () => {
    expect(celebrationPlan("lesson-complete", false, false).confetti).toBe(0);
  });

  it("builds a repeatable confetti burst", () => {
    const a = confettiPieces(20, 100, 5, 7);
    expect(a).toHaveLength(20);
    expect(confettiPieces(20, 100, 5, 7)).toEqual(a);
    for (const p of a) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(100);
      expect(p.rise).toBeGreaterThan(0);
      expect(p.colour).toBeGreaterThanOrEqual(0);
      expect(p.colour).toBeLessThan(5);
    }
    expect(confettiPieces(0, 100, 5)).toEqual([]);
  });
});

describe("blink timing", () => {
  it("waits a few seconds between blinks", () => {
    expect(nextBlinkDelayMs(0)).toBe(BLINK_MIN_MS);
    expect(nextBlinkDelayMs(1)).toBe(BLINK_MAX_MS);
    expect(nextBlinkDelayMs(-5)).toBe(BLINK_MIN_MS);
    const mid = nextBlinkDelayMs(0.5);
    expect(mid).toBeGreaterThan(BLINK_MIN_MS);
    expect(mid).toBeLessThan(BLINK_MAX_MS);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { panelName } from "../ui/panels";
import type { Lesson, PanelId } from "../types";
import { lesson1 } from "./l1";
import { lesson2 } from "./l2";
import { lesson3 } from "./l3";
import { lesson4 } from "./l4";

const lessons = [lesson1, lesson2, lesson3, lesson4] satisfies readonly Lesson[];

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const lessonsDoc = readFileSync(`${repoRoot}docs/academy/lessons.md`, "utf8");
const contractSource = readFileSync(`${repoRoot}web/src/contracts/generated.ts`, "utf8");
const panelSource = readFileSync(`${repoRoot}web/src/features/academy/ui/panels.ts`, "utf8");

function contractKeys(): Set<string> {
  const start = contractSource.indexOf("export interface WorkedExamples");
  const end = contractSource.indexOf("\n}", start);
  const block = contractSource.slice(start, end);
  return new Set([...block.matchAll(/"([^"]+)":/g)].map((match) => match[1] ?? ""));
}

/** `{{example.key}}` and the doc's `{{key}}` become the same text. */
function canon(text: string): string {
  return text.replace(/\{\{example\.([^}]+)\}\}/g, "{{$1}}").replace(/\s+/g, " ").trim();
}

type DocRow = { kind: string; asks: string; happens: string };

function sectionRows(number: number): DocRow[] {
  const marker = `## ${number}. `;
  const start = lessonsDoc.indexOf(marker);
  const next = lessonsDoc.indexOf("\n## ", start + marker.length);
  const section = lessonsDoc.slice(start, next === -1 ? undefined : next);
  const rows: DocRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    const kind = cells[1]?.match(/`([a-z-]+)`/)?.[1] ?? "";
    const asks = cells[2]?.match(/"([^"]*)"/)?.[1] ?? "";
    rows.push({ kind, asks, happens: cells[3] ?? "" });
  }
  return rows;
}

function allowed(row: DocRow): string[] {
  const pieces = [row.asks, row.happens];
  const reveal = row.happens.split("Reveal:")[1];
  if (reveal) pieces.push(reveal.trim());
  for (const quote of row.happens.matchAll(/"([^"]*)"/g)) {
    if (quote[1]) pieces.push(quote[1]);
  }
  return pieces.map(canon);
}

function walk(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item, visit);
  }
}

function exampleKeys(lesson: Lesson): string[] {
  const keys: string[] = [];
  walk(lesson, (text) => {
    for (const match of text.matchAll(/\{\{example\.([^}]+)\}\}/g)) {
      if (match[1]) keys.push(match[1]);
    }
  });
  return keys;
}

function todoBodies(value: unknown): string[] {
  const bodies: string[] = [];
  walk(value, (text) => {
    const marker = "TODO(words): ";
    if (text.startsWith(marker)) bodies.push(text.slice(marker.length));
  });
  return bodies;
}

function panelsOf(lesson: Lesson): PanelId[] {
  const ids: PanelId[] = [lesson.unlocks];
  for (const step of lesson.steps) {
    if (step.kind === "drag-body") ids.push(step.panel);
    if ((step.kind === "predict" || step.kind === "choice") && step.kind === "predict" && step.reveal.kind === "panel") {
      ids.push(step.reveal.panel);
    }
    if (step.kind === "tune-slider" && step.slider.panel) ids.push(step.slider.panel);
    if (step.kind === "drop-pin" && step.map.aside) ids.push(step.map.aside);
  }
  return ids;
}

function bolds(text: string): string[] {
  return [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => canon(match[1] ?? ""));
}

describe("lessons 1 to 4 skeletons", () => {
  const keys = contractKeys();

  it.each(lessons.map((lesson, index) => [index + 1, lesson] as const))(
    "lesson %s matches the doc's steps and only uses contract keys and real panels",
    (number, lesson) => {
      const rows = sectionRows(number);
      expect(lesson.steps).toHaveLength(rows.length);
      lesson.steps.forEach((step, index) => {
        const row = rows[index];
        expect(row, `step ${index + 1}`).toBeDefined();
        if (!row) return;
        expect(step.kind).toBe(row.kind);
        expect(canon(step.luna.says)).toBe(canon(row.asks));
        expect(step.hint.length).toBeGreaterThan(0);
        expect(step.explain.length).toBeGreaterThan(0);
        const ok = allowed(row);
        for (const body of todoBodies(step)) {
          expect(ok, body).toContain(canon(body));
          const source = ok.find((piece) => piece === canon(body)) ?? "";
          expect(canon(body).length).toBeGreaterThanOrEqual(source.length);
        }
        if ((step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") && typeof step.answer === "number") {
          const option = canon(step.options[step.answer] ?? "");
          expect(bolds(row.happens).some((bold) => bold.includes(option) || option.includes(bold))).toBe(true);
        }
        if (step.kind === "spot-bug") {
          const line = canon(step.lines[step.buggyLine] ?? "");
          expect(bolds(row.happens).some((bold) => bold.includes(line))).toBe(true);
        }
      });

      for (const key of exampleKeys(lesson)) {
        expect(keys.has(key), key).toBe(true);
      }

      for (const panel of panelsOf(lesson)) {
        expect(panelSource).toContain(`${panel}:`);
        expect(panelName(panel).length).toBeGreaterThan(0);
      }

      const count = todoBodies(lesson).length;
      console.log(`TODO(words) ${lesson.id}: ${count}`);
      expect(count).toBeGreaterThan(0);
    },
  );
});

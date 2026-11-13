import type { Lesson } from "../types";
import { lesson1 } from "./l1";
import { lesson2 } from "./l2";
import { lesson3 } from "./l3";
import { lesson4 } from "./l4";

/**
 * The lessons that are written and open from the path, in path order. Lessons 5 to 8 are
 * outside the deadline and show "not written yet". The sample stays at /academy/sample.
 */
export const WRITTEN_LESSONS: readonly Lesson[] = [lesson1, lesson2, lesson3, lesson4];

const byId = new Map<string, Lesson>(WRITTEN_LESSONS.map((lesson) => [lesson.id, lesson]));

export function writtenLesson(id: string): Lesson | undefined {
  return byId.get(id);
}

export function isWritten(id: string): boolean {
  return byId.has(id);
}

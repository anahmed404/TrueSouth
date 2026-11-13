import { create } from "zustand";
import { ALL_EIGHT_PATCH_ID, CATALOG_IDS } from "./catalog";

export const STORAGE_KEY = "truesouth.academy.v1";

export type LessonProgress = {
  stars: 0 | 1 | 2 | 3;
  xp: number;
  patch: boolean;
};

export type AcademyProgress = {
  version: 1;
  lessons: Record<string, LessonProgress>;
  /** Off by default. */
  sound: boolean;
};

export type AcademyStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type AcademyData = AcademyProgress & {
  xp: number;
  patches: readonly string[];
};

export type AcademyState = AcademyData & {
  recordCompletion: (lessonId: string, stars: 1 | 2 | 3, xp: number, patch?: boolean) => void;
  setSound: (sound: boolean) => void;
  reset: () => void;
};

export function createAcademyStore(storage: AcademyStorage) {
  const loaded = loadProgress(storage);
  return create<AcademyState>((set) => ({
    ...withDerived(loaded),
    recordCompletion: (lessonId, stars, xp, patch = true) => {
      set((current) => {
        const next = applyCompletion(toProgress(current), lessonId, stars, xp, patch);
        saveProgress(storage, next);
        return withDerived(next);
      });
    },
    setSound: (sound) => {
      set((current) => {
        const next = { ...toProgress(current), sound };
        saveProgress(storage, next);
        return { sound };
      });
    },
    reset: () => {
      const empty = emptyProgress();
      saveProgress(storage, empty);
      set(withDerived(empty));
    },
  }));
}

export function loadProgress(storage: AcademyStorage): AcademyProgress {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") return emptyProgress();
    return parseProgress(raw);
  } catch {
    return emptyProgress();
  }
}

function emptyProgress(): AcademyProgress {
  return { version: 1, lessons: {}, sound: false };
}

function parseProgress(raw: string): AcademyProgress {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return emptyProgress();
  const record = data as Record<string, unknown>;
  if (record.version !== 1) return emptyProgress();
  if (typeof record.lessons !== "object" || record.lessons === null || Array.isArray(record.lessons)) {
    return emptyProgress();
  }
  const lessons: Record<string, LessonProgress> = {};
  for (const [id, value] of Object.entries(record.lessons)) {
    const parsed = parseLesson(value);
    if (!parsed) return emptyProgress();
    lessons[id] = parsed;
  }
  const sound = record.sound === true;
  return { version: 1, lessons, sound };
}

function parseLesson(value: unknown): LessonProgress | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.stars !== 0 && record.stars !== 1 && record.stars !== 2 && record.stars !== 3) {
    return null;
  }
  if (typeof record.xp !== "number" || !Number.isFinite(record.xp) || record.xp < 0) return null;
  if (typeof record.patch !== "boolean") return null;
  return { stars: record.stars, xp: record.xp, patch: record.patch };
}

function applyCompletion(
  progress: AcademyProgress,
  lessonId: string,
  stars: 1 | 2 | 3,
  xp: number,
  patch: boolean,
): AcademyProgress {
  const previous = progress.lessons[lessonId];
  const bestStars = Math.max(previous?.stars ?? 0, stars) as 1 | 2 | 3;
  const bestXp = Math.max(previous?.xp ?? 0, xp);
  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lessonId]: { stars: bestStars, xp: bestXp, patch: (previous?.patch ?? false) || patch },
    },
  };
}

function toProgress(state: AcademyProgress): AcademyProgress {
  return { version: 1, lessons: state.lessons, sound: state.sound };
}

export function totalXp(progress: AcademyProgress): number {
  return Object.values(progress.lessons).reduce((sum, lesson) => sum + lesson.xp, 0);
}

export function listPatches(progress: AcademyProgress): string[] {
  const earned = new Set(
    Object.entries(progress.lessons)
      .filter(([, lesson]) => lesson.patch)
      .map(([id]) => id),
  );
  const extras = [...earned].filter((id) => !CATALOG_IDS.includes(id)).sort();
  const ordered = [...CATALOG_IDS.filter((id) => earned.has(id)), ...extras];
  const finishedAllEight = CATALOG_IDS.every((id) => earned.has(id));
  return finishedAllEight ? [...ordered, ALL_EIGHT_PATCH_ID] : ordered;
}

function withDerived(progress: AcademyProgress): AcademyData {
  return {
    ...progress,
    xp: totalXp(progress),
    patches: listPatches(progress),
  };
}

function saveProgress(storage: AcademyStorage, progress: AcademyProgress): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage is unavailable. The in-memory state still updates.
  }
}

function memoryStorage(): AcademyStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function safeBrowserStorage(): AcademyStorage {
  try {
    if (typeof localStorage === "undefined") return memoryStorage();
    const probe = `${STORAGE_KEY}.probe`;
    localStorage.setItem(probe, "ok");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

export const useAcademyStore = createAcademyStore(safeBrowserStorage());

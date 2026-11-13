import { describe, expect, it } from "vitest";
import { ALL_EIGHT_PATCH_ID, CATALOG_IDS } from "./catalog";
import { createAcademyStore, STORAGE_KEY, type AcademyStorage } from "./store";

function memoryStorage(initial?: string): AcademyStorage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(STORAGE_KEY, initial);
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

describe("academy store", () => {
  it("starts empty when storage is empty", () => {
    const store = createAcademyStore(memoryStorage());
    expect(store.getState().xp).toBe(0);
    expect(store.getState().lessons).toEqual({});
    expect(store.getState().patches).toEqual([]);
    expect(store.getState().sound).toBe(false);
  });

  it("survives a reload", () => {
    const storage = memoryStorage();
    const first = createAcademyStore(storage);
    first.getState().recordCompletion("l2_skyline", 2, 37);
    first.getState().setSound(true);

    const second = createAcademyStore(storage);
    expect(second.getState().xp).toBe(37);
    expect(second.getState().lessons.l2_skyline).toEqual({ stars: 2, xp: 37, patch: true });
    expect(second.getState().patches).toEqual(["l2_skyline"]);
    expect(second.getState().sound).toBe(true);
  });

  it("falls back when the saved value is corrupt", () => {
    const broken = createAcademyStore(memoryStorage("{"));
    expect(broken.getState().xp).toBe(0);
    expect(broken.getState().lessons).toEqual({});
    expect(broken.getState().patches).toEqual([]);
    expect(broken.getState().sound).toBe(false);

    const wrongVersion = createAcademyStore(memoryStorage('{"version":2,"lessons":{},"sound":true}'));
    expect(wrongVersion.getState().xp).toBe(0);
    expect(wrongVersion.getState().sound).toBe(false);

    const badLesson = createAcademyStore(
      memoryStorage('{"version":1,"lessons":{"l1_sun":{"stars":9,"xp":10,"patch":true}},"sound":false}'),
    );
    expect(badLesson.getState().lessons).toEqual({});
    expect(badLesson.getState().xp).toBe(0);
  });

  it("falls back when storage is unavailable and still records in memory", () => {
    const storage: AcademyStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    const store = createAcademyStore(storage);
    expect(store.getState().xp).toBe(0);
    expect(() => store.getState().recordCompletion("l1_sun", 2, 15)).not.toThrow();
    expect(store.getState().xp).toBe(15);
    expect(store.getState().lessons.l1_sun).toEqual({ stars: 2, xp: 15, patch: true });
  });

  it("keeps the best stars and the best XP on a replay", () => {
    const store = createAcademyStore(memoryStorage());
    store.getState().recordCompletion("l1_sun", 1, 12);
    store.getState().recordCompletion("l1_sun", 3, 40);
    store.getState().recordCompletion("l1_sun", 2, 20);
    expect(store.getState().lessons.l1_sun).toEqual({ stars: 3, xp: 40, patch: true });
    expect(store.getState().xp).toBe(40);
  });

  it("awards the ninth mission patch only after all eight lessons", () => {
    const store = createAcademyStore(memoryStorage());
    store.getState().recordCompletion("sample", 3, 80);
    expect(store.getState().patches).toEqual(["sample"]);

    for (const id of CATALOG_IDS.slice(0, -1)) {
      store.getState().recordCompletion(id, 1, 2);
    }
    expect(store.getState().patches).not.toContain(ALL_EIGHT_PATCH_ID);

    const last = CATALOG_IDS[CATALOG_IDS.length - 1];
    if (!last) throw new Error("catalog is empty");
    store.getState().recordCompletion(last, 1, 2);
    expect(store.getState().patches).toContain(ALL_EIGHT_PATCH_ID);
    expect(store.getState().xp).toBe(80 + CATALOG_IDS.length * 2);
  });

  it("clears saved progress", () => {
    const storage = memoryStorage();
    const first = createAcademyStore(storage);
    first.getState().recordCompletion("l1_sun", 3, 50);
    first.getState().reset();
    expect(first.getState().xp).toBe(0);
    expect(first.getState().patches).toEqual([]);
    expect(first.getState().lessons).toEqual({});

    const second = createAcademyStore(storage);
    expect(second.getState().xp).toBe(0);
    expect(second.getState().lessons).toEqual({});
  });
});

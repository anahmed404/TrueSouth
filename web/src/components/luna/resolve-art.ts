import type { LunaArtSet, LunaMoodArt } from "./art-contract";
import { lunaArt } from "./art";
import { isMood, type Mood } from "./moods";

export const FALLBACK_MOOD: Mood = "idle";

/** The art for a mood. An unknown mood (bad lesson data) falls back to `idle`. */
export function resolveMoodArt(mood: Mood | string, art: LunaArtSet = lunaArt): LunaMoodArt {
  return art.moods[isMood(mood) ? mood : FALLBACK_MOOD];
}

/** Below this size craters are dropped so the face stays readable. */
export const DETAIL_MIN_SIZE = 72;

export function showsDetail(size: number): boolean {
  return size >= DETAIL_MIN_SIZE;
}

/**
 * Below this size the extras (sparkles, hearts, the music note, the "z", cheeks) are
 * dropped: they would only be specks, and eyes and mouth carry the mood on their own.
 */
export const EXTRAS_MIN_SIZE = 40;

export function showsExtras(size: number): boolean {
  return size >= EXTRAS_MIN_SIZE;
}

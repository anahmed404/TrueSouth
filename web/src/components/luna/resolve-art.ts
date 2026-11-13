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

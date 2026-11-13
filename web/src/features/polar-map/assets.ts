/**
 * The Polar map's images, loaded once and kept for the session, so leaving and coming back
 * to the view draws at once. The lookup grids go through the shared data store
 * (`useMapLookup`), not through here.
 */

import { useEffect, useState } from "react";
import { mapImageUrl } from "../../data";

const cache = new Map<string, Promise<HTMLImageElement>>();
const ready = new Map<string, HTMLImageElement>();

/** Starts loading a `maps/` image (or returns the one already loading). */
export function loadMapImage(file: string): Promise<HTMLImageElement> {
  let promise = cache.get(file);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const done = () => {
          ready.set(file, image);
          resolve(image);
        };
        // decode() keeps the first draw from stalling on the big images.
        if (typeof image.decode === "function") image.decode().then(done, done);
        else done();
      };
      image.onerror = () => {
        cache.delete(file);
        reject(new Error(`Could not load ${file}`));
      };
      image.src = mapImageUrl(file);
    });
    cache.set(file, promise);
  }
  return promise;
}

/**
 * Forgets a `maps/` image so the browser can free its decoded pixels (the 8K relief alone is
 * 8,192 × 8,192). The next use loads it again, from the HTTP cache when it is still there.
 */
export function releaseMapImage(file: string): void {
  // Dropping every reference is enough: a hook still holding the image lets it go on its
  // next render. Clearing `src` here could leave a frame drawing a broken image.
  ready.delete(file);
  cache.delete(file);
}

export type ImageState = { status: "idle" | "loading" | "error"; image: null } | { status: "ready"; image: HTMLImageElement };

/** A `maps/` image, loaded when `file` is set. */
export function useMapImage(file: string | null): ImageState {
  const [state, setState] = useState<ImageState>(() => {
    const done = file ? ready.get(file) : undefined;
    return done ? { status: "ready", image: done } : { status: file ? "loading" : "idle", image: null };
  });
  useEffect(() => {
    if (!file) {
      setState({ status: "idle", image: null });
      return;
    }
    const done = ready.get(file);
    if (done) {
      setState({ status: "ready", image: done });
      return;
    }
    let live = true;
    setState({ status: "loading", image: null });
    loadMapImage(file).then(
      (image) => live && setState({ status: "ready", image }),
      () => live && setState({ status: "error", image: null }),
    );
    return () => {
      live = false;
    };
  }, [file]);
  return state;
}

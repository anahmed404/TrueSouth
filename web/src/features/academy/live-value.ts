import { useSyncExternalStore } from "react";

/**
 * A value that changes many times a second (Pip's power while the Sun is dragged), read by
 * one small component only, so the rest of the lesson screen does not re-render with it.
 */
export type LiveValue<T> = {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
};

export function createLiveValue<T>(initial: T): LiveValue<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useLiveValue<T>(live: LiveValue<T>): T {
  return useSyncExternalStore(live.subscribe, live.get, live.get);
}

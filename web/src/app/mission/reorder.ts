/** Reordering the selected sites: pure list moves for the keyboard and the pointer. */

/** The list with the item at `from` moved to `to`. Out-of-range indexes are clamped. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= items.length) return next;
  const target = Math.min(Math.max(to, 0), items.length - 1);
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item as T);
  return next;
}

/** One step up (-1) or down (+1), as the arrow keys do. */
export function moveById(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  return moveItem(ids, from, from + delta);
}

/**
 * Where a dragged row lands, from the pointer's y and each row's vertical middle (in the
 * same coordinates, top to bottom). The row goes before the first middle below the
 * pointer; the dragged row's own middle is skipped.
 */
export function dropIndex(pointerY: number, middles: readonly number[], from: number): number {
  let index = 0;
  for (let i = 0; i < middles.length; i++) {
    if (i === from) continue;
    if (pointerY > (middles[i] ?? 0)) index++;
  }
  return index;
}

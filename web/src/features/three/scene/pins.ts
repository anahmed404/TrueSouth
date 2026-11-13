/**
 * Which pins fold together (docs/features/system-view.md, "Pins and sight-lines"): pins
 * closer than 18 px fold into the focused pin, whose plate then says "and N more sites
 * here". A crowd without the focused pin folds into its first pin in the sites' order.
 */
export const PIN_FOLD_PX = 18;

export type ScreenPin = { id: string; x: number; y: number; visible: boolean };

export type PinGroup = {
  /** The pin that is drawn. */
  leader: string;
  /** The other pins folded into it, in the sites' order. */
  folded: string[];
};

export function groupPins(pins: readonly ScreenPin[], focusedId: string | null, minPx = PIN_FOLD_PX): PinGroup[] {
  const shown = pins.filter((pin) => pin.visible);
  const ordered = [
    ...shown.filter((pin) => pin.id === focusedId),
    ...shown.filter((pin) => pin.id !== focusedId),
  ];
  const groups: { pin: ScreenPin; group: PinGroup }[] = [];
  for (const pin of ordered) {
    const near = groups.find(({ pin: leader }) => Math.hypot(leader.x - pin.x, leader.y - pin.y) < minPx);
    if (near) near.group.folded.push(pin.id);
    else groups.push({ pin, group: { leader: pin.id, folded: [] } });
  }
  return groups.map(({ group }) => group);
}

/** The focused pin's plate line for folded pins. */
export function moreSitesLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "and 1 more site here" : `and ${count} more sites here`;
}

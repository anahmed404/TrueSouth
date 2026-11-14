/**
 * When a folded plate (local-terrain.md, "Shadows are decoration") shows its full text. It
 * opens while a mouse hovers it or the keyboard focuses it, and stays open after a click or a
 * tap; a second click, or Escape, closes it, and it stays closed until the pointer leaves and
 * the focus moves away. Mouse hover and keyboard focus only: a tap focuses and clicks at once,
 * and must open it, not open and close it.
 */
export type FoldState = { hover: boolean; focus: boolean; pinned: boolean; dismissed: boolean };

export type FoldEvent = "enter" | "leave" | "focus" | "blur" | "click" | "escape";

export const FOLD_CLOSED: FoldState = { hover: false, focus: false, pinned: false, dismissed: false };

export function foldOpen(s: FoldState): boolean {
  return !s.dismissed && (s.pinned || s.hover || s.focus);
}

export function foldStep(s: FoldState, event: FoldEvent): FoldState {
  switch (event) {
    case "enter":
      return { ...s, hover: true };
    case "focus":
      return { ...s, focus: true };
    case "leave":
      return { ...s, hover: false, dismissed: s.dismissed && s.focus };
    case "blur":
      return { ...s, focus: false, dismissed: s.dismissed && s.hover };
    case "click":
      // Pinned open: the second click closes it. Otherwise (closed, or open by hover or focus):
      // it stays open.
      return s.pinned ? { ...s, pinned: false, dismissed: true } : { ...s, pinned: true, dismissed: false };
    case "escape":
      return { ...s, pinned: false, dismissed: true };
  }
}

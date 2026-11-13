import type { Ref } from "react";

/** Sets a ref of either kind (callback or object) to a node. */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

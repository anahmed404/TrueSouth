import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/scene";

/**
 * The 3D scene behind Mission Control (work packages T1 and T2). three.js and React Three
 * Fiber load lazily, in their own chunk, so the start screen and the Academy do not pay for
 * them. Until the chunk arrives the scene slot shows plain space.
 */
const SceneRoot = lazy(() => import("./scene-root"));

export function SpaceScene(props: SceneProps) {
  return (
    <Suspense fallback={null}>
      <SceneRoot {...props} />
    </Suspense>
  );
}

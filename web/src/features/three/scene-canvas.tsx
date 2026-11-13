import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

type SceneCanvasProps = {
  children?: ReactNode;
};

const pixelRatio: [number, number] = [1, 2];

/**
 * Shared WebGL mount for the System view and the local terrain.
 * Plumbing only: no Moon, no terrain, no lights, no styling.
 *
 * Unmount releases the context. React Three Fiber's Canvas disposes the
 * renderer and loses the WebGL context when the root unmounts.
 */
export function SceneCanvas({ children }: SceneCanvasProps) {
  return (
    <Canvas
      dpr={pixelRatio}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 45, near: 0.01, far: 2_000, position: [0, 0, 5] }}
    >
      {children}
    </Canvas>
  );
}

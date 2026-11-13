import { memo, useCallback, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { Button } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import type { FreeSpace } from "./free-space";
import type { SceneProps, SceneStatus } from "../scene";
import { sceneDisplay, stillNote } from "./scene-status";
import { cameraView } from "./views";

type SceneSlotProps = Omit<SceneProps, "onStatus" | "ignoreSlow"> & {
  /**
   * The 3D scene (work package T1). Until it exists, a placeholder stands in. To plug the
   * scene in, pass it here from mission-screen.tsx; nothing else in the shell changes.
   */
  Scene?: ComponentType<SceneProps>;
};

/**
 * The slot the 3D scene fills: the whole window, behind the floating interface. It keeps the
 * scene's status, and when the scene reports "slow" or "no-webgl" it puts the still picture
 * in its place, with the note and "Try 3D anyway" (docs/features/system-view.md, "When 3D
 * does not run"). The rest of the interface does not depend on it.
 */
export const SceneSlot = memo(function SceneSlot({ Scene = ScenePlaceholder, ...props }: SceneSlotProps) {
  const [status, setStatus] = useState<SceneStatus | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ignoreSlow = attempt > 0;
  const display = sceneDisplay(status, ignoreSlow);

  const tryAnyway = useCallback(() => {
    setStatus(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="scene-slot" data-display={display}>
      {display === "still" ? (
        <StillPicture status={status ?? "slow"} freeSpace={props.freeSpace} onTryAnyway={tryAnyway} />
      ) : (
        <Scene key={attempt} {...props} ignoreSlow={ignoreSlow} onStatus={setStatus} />
      )}
    </div>
  );
});

/** Where a plate sits in the free space: centred across it, at `top` px from its top. */
function plateStyle(space: FreeSpace, top: number | "middle"): CSSProperties {
  return {
    left: space.x + space.width / 2,
    top: top === "middle" ? space.y + space.height / 2 : space.y + top,
    maxWidth: Math.max(0, Math.min(space.width - 16, 640)),
  };
}

/** Too little free space to place a line in, for example while a window is open. */
function tooSmall(space: FreeSpace): boolean {
  return space.width < 220 || space.height < 48;
}

type StillProps = { status: SceneStatus; freeSpace: FreeSpace; onTryAnyway: () => void };

/**
 * The still picture behind the interface, with its note. The picture itself is a plain
 * placeholder until the scene's image files exist (work package S16).
 */
function StillPicture({ status, freeSpace, onTryAnyway }: StillProps) {
  return (
    <>
      <div className="scene-still" role="img" aria-label="Still picture of the System view. The image is not made yet." />
      {tooSmall(freeSpace) ? null : (
        <div className="plate scene-plate scene-note" style={plateStyle(freeSpace, 12)} role="status">
          <p>
            {stillNote(status)} <Explain term="still_picture" label="Still picture" />
          </p>
          <Button onClick={onTryAnyway}>Try 3D anyway</Button>
        </div>
      )}
    </>
  );
}

/**
 * Stands in for the 3D scene until work package T1 lands. A plain near-black background
 * and one quiet line saying so, in the free space. It reports "no-webgl" when the browser
 * cannot start WebGL, so the still-picture path can be seen working today.
 *
 * In development, `sessionStorage["truesouth.scene.status"] = "slow"` (or "no-webgl")
 * makes it report that status, to check the still picture by eye.
 */
function ScenePlaceholder({ view, scenario, freeSpace, ignoreSlow, onStatus }: SceneProps) {
  useEffect(() => {
    onStatus(probeStatus(ignoreSlow));
  }, [onStatus, ignoreSlow]);

  if (tooSmall(freeSpace)) return null;
  return (
    <p className="plate scene-plate scene-placeholder" style={plateStyle(freeSpace, "middle")}>
      The 3D scene is not built yet. Here it will show the {cameraView(view).name} at{" "}
      <span className="tabular">{formatUtc(scenario.currentUtc)}</span>.
    </p>
  );
}

function probeStatus(ignoreSlow: boolean): SceneStatus {
  if (import.meta.env.DEV) {
    let forced: string | null = null;
    try {
      forced = window.sessionStorage.getItem("truesouth.scene.status");
    } catch {
      forced = null;
    }
    if (forced === "no-webgl") return "no-webgl";
    if (forced === "slow" && !ignoreSlow) return "slow";
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "no-webgl";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return "ready";
  } catch {
    return "no-webgl";
  }
}

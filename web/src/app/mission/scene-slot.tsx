import { memo, useCallback, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { Button } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import type { FreeSpace } from "./free-space";
import type { SceneProps, SceneReport, SceneStatus } from "../scene";
import { sceneMode, showStill, stillLabel, stillNote } from "./scene-status";
import { cameraView } from "./views";

type SceneSlotProps = Omit<SceneProps, "onStatus" | "ignoreSlow" | "mode"> & {
  /**
   * The 3D scene (work package T1). Until it exists, a placeholder stands in. To plug the
   * scene in, pass it here from mission-screen.tsx; nothing else in the shell changes.
   */
  Scene?: ComponentType<SceneProps>;
  /** Called after "Try 3D anyway", so the shell can announce it and place focus. */
  onTryAgain?: () => void;
};

/**
 * The slot the 3D scene fills: the whole window, behind the floating interface.
 *
 * It keeps the scene's status and tells the scene how to draw (`mode`). The scene stays
 * mounted in every state: when WebGL is missing or slow it is told "flat" and draws its 2D
 * parts, or nothing. For a view the scene has not said it draws flat, the slot puts the still
 * picture over it with the note and "Try 3D anyway" (docs/features/system-view.md, "When 3D
 * does not run"). The rest of the interface does not depend on it.
 */
export const SceneSlot = memo(function SceneSlot({ Scene = ScenePlaceholder, onTryAgain, ...props }: SceneSlotProps) {
  const [status, setStatus] = useState<SceneStatus | null>(null);
  const [report, setReport] = useState<SceneReport | null>(null);
  const [ignoreSlow, setIgnoreSlow] = useState(false);
  const mode = sceneMode(status, ignoreSlow);
  const still = showStill(mode, report, props.view);

  const onStatus = useCallback((next: SceneStatus, nextReport?: SceneReport) => {
    setStatus(next);
    setReport(nextReport ?? null);
  }, []);

  const tryAnyway = useCallback(() => {
    setIgnoreSlow(true);
    onTryAgain?.();
  }, [onTryAgain]);

  return (
    <div className="scene-slot" data-mode={mode} data-still={still}>
      <Scene {...props} mode={mode} ignoreSlow={ignoreSlow} onStatus={onStatus} />
      {still ? (
        <StillPicture status={status ?? "slow"} view={props.view} freeSpace={props.freeSpace} onTryAnyway={tryAnyway} />
      ) : null}
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

type StillProps = { status: SceneStatus; view: SceneProps["view"]; freeSpace: FreeSpace; onTryAnyway: () => void };

/**
 * The still picture over the scene, with its note. The picture itself is a plain placeholder
 * until the scene's image files exist (work package S16). "Try 3D anyway" is offered only
 * when 3D is slow: without WebGL, trying again cannot help.
 */
function StillPicture({ status, view, freeSpace, onTryAnyway }: StillProps) {
  return (
    <>
      <div className="scene-still" role="img" aria-label={stillLabel(view)} />
      {tooSmall(freeSpace) ? null : (
        <div className="plate scene-plate scene-note" style={plateStyle(freeSpace, 12)}>
          <p>
            {stillNote(status, view)} <Explain term="still_picture" label="Still picture" />
          </p>
          {status === "slow" ? <Button onClick={onTryAnyway}>Try 3D anyway</Button> : null}
        </div>
      )}
    </>
  );
}

/**
 * Stands in for the 3D scene until work package T1 lands. In 3D mode, a plain near-black
 * background and one quiet line saying so, in the free space; in flat mode, nothing (it has
 * no 2D parts, so it reports no flat views and the shell shows its still picture). It reports
 * "no-webgl" when the browser cannot start WebGL, so the still-picture path works today.
 *
 * In development, `sessionStorage["truesouth.scene.status"] = "slow"` (or "no-webgl")
 * makes it report that status, to check the still picture by eye.
 */
function ScenePlaceholder({ view, scenario, freeSpace, ignoreSlow, mode, onStatus }: SceneProps) {
  useEffect(() => {
    onStatus(probeStatus(ignoreSlow), { flatViews: [] });
  }, [onStatus, ignoreSlow]);

  if (mode === "flat" || tooSmall(freeSpace)) return null;
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

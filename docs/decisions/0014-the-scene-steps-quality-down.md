# 0014 · The scene steps its quality down instead of giving up

**Date:** 2026-11-14 · **Status:** accepted (team lead's request, 2026-11-13: "on some computers
the 3D view is very laggy; find optimizations without compromising quality")

## Context

The scene measured its first flight and, when the median frame was over 55 ms, told the
shell it was "slow", and the shell swapped in the still picture. On a weak machine that is
the whole 3D experience lost after 1.4 s, and the 55 ms was a guess. Measured on SwiftShader
(a software GPU) at 1440 × 900, the cost was not pixels but the Moon's 147,000 triangles:
about 200 ms a frame with a Moon some 200 pixels across.

## Decision

- The scene keeps four quality stages (`web/src/features/three/scene/perf.ts`). Stage 0 is
  the full picture, still and moving. Stages 1 to 3 draw fewer pixels while moving, and
  the last two lower the resting pixel ratio.
- Only flight frames judge the stage. A drag's frames follow the pointer, so a pause in a
  drag would look like a slow frame.
- The scene says "slow" only when the last stage is still slow (median over 55 ms).
- While moving, the Moon sphere has only the segments its on-screen size needs. At rest
  the full mesh comes back with one more frame.

## Consequences

- A fast machine draws exactly the old picture at rest (checked by a pixel diff) and the
  same frames while moving, except a Moon mesh that differs by under a quarter pixel.
- A slow machine keeps the 3D scene, slightly softer while moving, sharp at rest.
- A stage never steps back up within a visit. A machine that was slow once (for example
  while textures uploaded) stays on the lower stage until the page reloads.
- The still picture is still the answer for no WebGL at all.

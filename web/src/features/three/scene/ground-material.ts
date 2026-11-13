import * as THREE from "three";
import { MOON_RADIUS_M } from "../../../lib/geo";
import type { SiteFrame } from "./camera";
import type { GroundLod, GroundLodStep } from "./ground";
import { GROUND_QUALITY, SHADOW_STEPS, groundDefines, groundQualityFromQuery, sameQuality, type GroundLevel, type GroundQuality } from "./ground-quality";
import {
  CAP_HALF_WIDTH,
  CORE_HALF_WIDTH,
  GRAIN_FADE,
  PATCH_BLEND_KM,
  SUN_ANGULAR_RADIUS,
  earthLitFraction,
} from "./ground-relief";
import type { V3 } from "./vec";

/**
 * How the ground around the focused site is drawn (docs/features/local-terrain.md, "What
 * is drawn"): the patch and the apron share this one material. It is drawing only, like the
 * polar map's hillshade (science.md §2.4): nothing here decides lit or dark, link or no
 * link, or any number. Labels and plates come from the series.
 *
 * 1. Relief. Each pixel is lit with a surface normal: the patch's own mesh normal near the
 *    site, and farther out the polar cap's slope maps (160 m in the ±76 km core, 320 m
 *    elsewhere inside 80° S), read through science.md §2.3 at the pixel's true position.
 * 2. Shadows. A march from each pixel toward the light over the heights already loaded for
 *    drawing (the patch and the apron), with an edge as soft as the Sun's disc.
 * 3. Near-ground texture. Small craters, rocks and grain, made up in the shader, shown only
 *    where a pixel covers less than the 80 m data can show, and faded out before map scale.
 * 4. Tone. A lunar photometric function (Lommel–Seeliger and Lambert, mixed by phase angle,
 *    with an opposition surge), a grey albedo, and a faint fill from sunlit ground and
 *    earthshine so shadowed relief stays readable.
 *
 * The light's direction is an input (`light`), so a view with a fixed drawing light can use
 * the same material. Each effect has a quality level (ground-quality.ts).
 */

const LOGDEPTH_V = "#include <common>\n#include <logdepthbuf_pars_vertex>\n";
const LOGDEPTH_F = "#include <common>\n#include <logdepthbuf_pars_fragment>\n";

const f = (value: number, digits = 8) => value.toFixed(digits);

const vertexShader = `${LOGDEPTH_V}
attribute vec3 aM;
attribute vec3 aL;
varying vec3 vN; varying vec3 vM; varying vec3 vL;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vM = aM;
  vL = aL;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

const fragmentShader = `${LOGDEPTH_F}
uniform sampler2D uMap, uCapN, uCoreN, uHPatch, uHApron;
uniform float uLoaded, uCapLoaded, uFade, uNoLight, uGain, uEarthLight, uBounce;
// 0 turns the near-ground texture off without recompiling: while the camera moves on a weak
// GPU, and whenever the plate that discloses it cannot be shown.
uniform float uGrainOn;
uniform vec3 uLight, uEarth, uUp, uEast, uNorth, uCamL;
// Height grids: (half-width km, points a side, km a point, 1 when loaded).
uniform vec4 uPatch, uApron;
// Loop counts as uniforms: ANGLE's Direct3D compiler then keeps them as loops instead of
// unrolling them, which took minutes to compile. A loop with a uniform bound is valid GLSL
// ES 3.00 (WebGL 2), which this renderer always is: three.js r163+ supports only WebGL 2,
// and the scene's own probe (scene-root.tsx, probeWebgl) reports a WebGL 1-only browser as
// "no-webgl". Do not turn these back into constants.
uniform int uSteps, uNine;
varying vec3 vN; varying vec3 vM; varying vec3 vL;

const float HW = ${f(CAP_HALF_WIDTH)};
const float HWC = ${f(CORE_HALF_WIDTH)};
const float SUN_R = ${f(SUN_ANGULAR_RADIUS)};

float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.);
  int i = int(q.x + q.y * 4.);
  float b[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (b[i] + .5) / 16.;
}

// ── 1. Relief from the polar cap's slope maps (ground-relief.ts) ───────────
#if GROUND_RELIEF > 0
// A slope map texel to its gradient (∂z/∂x, ∂z/∂y): round(128 + 160 s).
vec2 slopeAt(sampler2D t, vec2 uv) { return (texture(t, uv).rg * 255. - 128.) / 160.; }

// The map normal at Moon-fixed m, in scene axes, and the weight of the map there.
vec3 mapNormal(vec3 m, out float capW) {
  float len = length(m);
  float den = len - m.z;
  // science.md §2.3 on the Moon-fixed vector: x = 2 m_y / (|m| − m_z), y = 2 m_x / (|m| − m_z).
  vec2 xy = 2. * vec2(m.y, m.x) / den;
  capW = uCapLoaded * step(m.z, 0.) * (1. - smoothstep(HW * .965, HW * .995, length(xy)));
  vec2 g = slopeAt(uCapN, xy / HW * .5 + .5);
  #if GROUND_RELIEF > 1
  float coreW = 1. - smoothstep(.92, 1., max(abs(xy.x), abs(xy.y)) / HWC);
  if (coreW > 0.) g = mix(g, slopeAt(uCoreN, xy / HWC * .5 + .5), coreW);
  #endif
  // Ground slope is the map slope times k = 2 / (1 + sin|φ|).
  g *= 2. * len / den;
  // The map's +x and +y on the sphere: sin λ r̂ + cos λ λ̂ and cos λ r̂ − sin λ λ̂, with r̂ away
  // from the pole and λ̂ toward increasing longitude (the projection is conformal).
  vec3 p = m / len;
  float rxy = max(length(p.xy), 1e-9);
  vec2 cs = p.xy / rxy; // (cos λ, sin λ)
  vec3 rh = vec3(-p.z * cs, rxy);   // away from the south pole: (cos θ cos λ, cos θ sin λ, sin θ), cos θ = −p_z
  vec3 lh = vec3(-cs.y, cs.x, 0.);
  vec3 ax = cs.y * rh + cs.x * lh;
  vec3 ay = cs.x * rh - cs.y * lh;
  vec3 nm = normalize(p - g.x * ax - g.y * ay);
  return vec3(nm.x, nm.z, -nm.y); // Moon-fixed to scene (science.md §14)
}
#endif

// ── 2. Shadows: a march over the drawn heights toward the light ─────────────
#if GROUND_SHADOW_STEPS > 0
float gridHeight(sampler2D t, vec4 g, vec2 q, float footKm) {
  vec2 uv = vec2(q.x + g.x, g.x - q.y) / (2. * g.x);
  uv = (uv * (g.y - 1.) + .5) / g.y;
  return textureLod(t, uv, max(log2(footKm / g.z), 0.)).r;
}
float heightAt(vec2 q, float footKm) {
  if (uPatch.w > .5 && max(abs(q.x), abs(q.y)) < uPatch.x) return gridHeight(uHPatch, uPatch, q, footKm);
  return gridHeight(uHApron, uApron, q, footKm);
}
// How much of the light's disc the drawing shows above the drawn terrain (0 to 1).
float drawnShadow(vec3 p, vec3 sL) {
  float hor = length(sL.xy);
  if (hor < 1e-5) return 1.;
  vec2 dir = sL.xy / hor;
  bool inPatch = uPatch.w > .5 && max(abs(p.x), abs(p.y)) < uPatch.x;
  float reach = uApron.w > .5 ? uApron.x : uPatch.x;
  float t = inPatch ? .04 : .6 * uApron.z;
  float grow = exp(log(2.9 * reach / t) / float(uSteps));
  float z0 = heightAt(p.xy, 0.) + .002;
  float best = -1e3;
  for (int i = 0; i < uSteps; i++) {
    vec2 q = p.xy + dir * t;
    if (max(abs(q.x), abs(q.y)) > reach) break;
    best = max(best, (heightAt(q, t * (grow - 1.) * .5) - z0) / t);
    t *= grow;
  }
  float sunEl = atan(sL.z, hor);
  float lit = smoothstep(-SUN_R, SUN_R, sunEl - atan(best));
  // Near the apron's outer edge the march sees too little terrain, and beyond it the globe
  // draws no shadows: fade the drawn shadow out there, so the two meet without a step.
  float outer = uApron.w > .5 ? smoothstep(uApron.x * .62, uApron.x * .9, max(abs(p.x), abs(p.y))) : 0.;
  return max(lit, outer);
}
#endif

// ── 3. Near-ground texture: illustrative, faded out before the data's scale ─
#if GROUND_GRAIN > 0
vec4 hash4(vec2 cell, float seed) {
  uvec3 v = uvec3(ivec3(int(cell.x), int(cell.y), int(seed)));
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec4(v, v.x ^ v.y) * (1. / 4294967295.);
}
float fade(float foot, float cell) {
  return 1. - smoothstep(${f(GRAIN_FADE.lo, 4)} * cell, ${f(GRAIN_FADE.hi, 4)} * cell, foot);
}
// Small craters in one size band: (∂h/∂E, ∂h/∂N, albedo change, light left by the
// crater's own rim). At a Sun a degree or two up, a real crater's floor is filled with the
// shadow of its Sun-side rim, which a bump alone cannot draw, so each bowl also tests its rim:
// the ray toward the light leaves the bowl at distance t, where the rim stands
// depth (1 − x²) + rim above this point. sd is the light's direction across the ground and
// tanEl its elevation over the ground under the crater.
vec4 craters(vec2 p, float S, float seed, float density, vec2 sd, float tanEl) {
  vec2 c = floor(p / S);
  vec4 acc = vec4(0., 0., 0., 1.);
  for (int k = 0; k < uNine; k++) {
    vec2 cell = c + vec2(float(k % 3 - 1), float(k / 3 - 1));
    vec4 r = hash4(cell, seed);
    if (r.w > density) continue;
    vec2 d = p - (cell + .15 + .7 * r.xy) * S;
    // Many small, few large: radius from 0.06 S to 0.36 S.
    float rad = S * (.06 + .3 * r.z * r.z * r.z);
    float rho = length(d);
    float x = rho / rad;
    if (x > 1.8 || rho < 1e-6) continue;
    // Most small lunar craters are worn: depth a tenth of the diameter or less; fresher ones deeper.
    // Four in five are worn: soft rims and shallow bowls.
    float fresh = pow(fract(r.z * 7.31 + r.w * 3.7), 4.);
    float depth = rad * mix(.05, .18, fresh);
    float e = x - 1.;
    float rimH = mix(.1, .22, fresh) * depth;
    float rim = rimH * exp(-e * e / .06);
    float dhdx = (x < 1. ? 2. * depth * x : 0.) - rim * 2. * e / .06;
    acc.xy += dhdx / rad * d / rho;
    // Fresh craters have slightly brighter walls; no halo outside the rim.
    acc.z += (x < 1. ? .03 * (1. - x * x) : 0.) * fresh;
    if (x < 1.) {
      float along = dot(d, sd);
      float t = -along + sqrt(max(along * along - rho * rho + rad * rad, 0.));
      float rise = depth * (1. - x * x) + rimH;
      acc.w = min(acc.w, smoothstep(-SUN_R, SUN_R, atan(tanEl) - atan(rise / max(t, 1e-4))));
    }
  }
  return acc;
}
// Rocks: low bumps a few centimetres to a few decimetres across.
vec3 rocks(vec2 p, float S, float seed, float density) {
  vec2 c = floor(p / S);
  vec3 acc = vec3(0.);
  for (int k = 0; k < uNine; k++) {
    vec2 cell = c + vec2(float(k % 3 - 1), float(k / 3 - 1));
    vec4 r = hash4(cell, seed);
    if (r.w > density) continue;
    vec2 d = p - (cell + .2 + .6 * r.xy) * S;
    float rad = S * (.04 + .2 * r.z * r.z * r.z);
    float x = length(d) / rad;
    if (x >= 1.) continue;
    float h = .6 * rad;
    acc.xy += -4. * h * (1. - x * x) / (rad * rad) * d;
    acc.z += .08 * (1. - x * x);
  }
  return acc;
}
float h1(vec2 i, float seed) { return hash4(i, seed).x; }
// Value noise with its gradient (value, ∂/∂x, ∂/∂y), quintic so the gradient has no creases
// at cell edges (a crease draws a grid).
vec3 noised(vec2 p, float seed) {
  vec2 i = floor(p), fr = fract(p);
  vec2 u = fr * fr * fr * (fr * (fr * 6. - 15.) + 10.);
  vec2 du = 30. * fr * fr * (fr * (fr - 2.) + 1.);
  float a = h1(i, seed), b = h1(i + vec2(1., 0.), seed), c = h1(i + vec2(0., 1.), seed), d = h1(i + vec2(1., 1.), seed);
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}
// One octave of grain: wavelength L metres, height amplitude A metres, turned by a fixed
// angle so octaves never line up.
vec3 grainOctave(vec2 p, float L, float A, float seed, mat2 turn) {
  vec3 n = noised(turn * p / L, seed);
  return vec3(transpose(turn) * n.yz * A / L, n.x - .5);
}
// The whole near-ground texture at ground point p (metres): (∂h/∂E, ∂h/∂N, albedo change,
// light left by small craters' rims).
vec4 grain(vec2 p, float foot, vec2 sd, float tanEl) {
  vec4 acc = vec4(0., 0., 0., 1.);
  vec4 cr;
  float w;
  mat2 t1 = mat2(.8, .6, -.6, .8), t2 = mat2(.28, .96, -.96, .28);
  #if GROUND_GRAIN > 1
  w = fade(foot, 14.); if (w > 0.) { cr = craters(p, 14., 11., .3, sd, tanEl); acc.xyz += w * cr.xyz; acc.w = min(acc.w, mix(1., cr.w, w)); }
  w = fade(foot, 3.5); if (w > 0.) { cr = craters(p, 3.5, 23., .4, sd, tanEl); acc.xyz += w * cr.xyz; acc.w = min(acc.w, mix(1., cr.w, w)); }
  w = fade(foot, .9); if (w > 0.) { cr = craters(p, .9, 37., .45, sd, tanEl); acc.xyz += w * cr.xyz; acc.w = min(acc.w, mix(1., cr.w, w)); }
  w = fade(foot, .5); if (w > 0.) acc.xyz += w * rocks(p, .5, 41., .25);
  w = fade(foot, .6); if (w > 0.) { vec3 g = grainOctave(p, .6, .005, 53., t1); acc.xyz += w * vec3(g.xy, g.z * .05); }
  w = fade(foot, .15); if (w > 0.) { vec3 g = grainOctave(p, .15, .0016, 59., t2); acc.xyz += w * vec3(g.xy, g.z * .04); }
  w = fade(foot, .04); if (w > 0.) { vec3 g = grainOctave(p, .04, .0006, 61., t1); acc.xy += w * g.xy; }
  #else
  w = fade(foot, 5.); if (w > 0.) { cr = craters(p, 5., 23., .4, sd, tanEl); acc.xyz += w * cr.xyz; acc.w = min(acc.w, mix(1., cr.w, w)); }
  w = fade(foot, 1.2); if (w > 0.) { cr = craters(p, 1.2, 37., .45, sd, tanEl); acc.xyz += w * cr.xyz; acc.w = min(acc.w, mix(1., cr.w, w)); }
  w = fade(foot, .4); if (w > 0.) { vec3 g = grainOctave(p, .4, .004, 53., t1); acc.xyz += w * vec3(g.xy, g.z * .05); }
  #endif
  return acc;
}
#endif

// ── 4. Lunar photometry: Lommel–Seeliger and Lambert mixed by phase (McEwen), with the
// opposition surge that makes the ground brighter looking down-Sun. ─────────────
float lunarLight(float mu0, float mu, float cosg) {
  if (mu0 <= 0.) return 0.;
  float g = degrees(acos(clamp(cosg, -1., 1.)));
  float L = clamp(1. - .019 * g + 2.42e-4 * g * g - 1.46e-6 * g * g * g, 0., 1.);
  float ls = 2. * mu0 / (mu0 + max(mu, .2));
  float surge = 1. + .5 / (1. + tan(radians(min(g, 170.)) * .5) / .05);
  return (L * ls + (1. - L) * mu0) * surge;
}

void main() {
  #include <logdepthbuf_fragment>
  if (uFade < 1. && bayer(gl_FragCoord.xy) > uFade) discard;
  vec3 E = uEast, N = uNorth, U = uUp;
  vec3 m = vM;

  // Albedo: the Moon's colour map at this place, as grey, its range narrowed so the
  // shading reads first. Neutral: no colour cast.
  vec3 mn = normalize(m);
  vec2 uv = vec2(atan(mn.y, mn.x) / (2. * PI) + .5, asin(clamp(mn.z, -1., 1.)) / PI + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  // No seam where the longitude wraps at 180°.
  dx.x -= floor(dx.x + .5);
  dy.x -= floor(dy.x + .5);
  vec3 c = textureGrad(uMap, uv, dx, dy).rgb;
  float alb = mix(.15, mix(.15, dot(c, vec3(.2126, .7152, .0722)), .55), uLoaded);

  // 1. The surface normal.
  vec3 n = normalize(vN);
  #if GROUND_RELIEF > 0
  float capW;
  vec3 nMap = mapNormal(m, capW);
  float edge = max(abs(vL.x), abs(vL.y));
  float meshW = uPatch.w > .5 ? 1. - smoothstep(uPatch.x - ${f(PATCH_BLEND_KM.start, 3)}, uPatch.x - ${f(PATCH_BLEND_KM.end, 3)}, edge) : 0.;
  n = normalize(mix(n, nMap, capW * (1. - meshW)));
  #endif

  // 3. The near-ground texture, as a bump on that normal.
  vec3 sL = vec3(dot(uLight, E), dot(uLight, N), dot(uLight, U));
  float shadow = 1.;
  #if GROUND_GRAIN > 0
  if (uGrainOn > .5) {
    vec2 pm = vL.xy * 1000.;
    float foot = max(length(dFdx(pm)), length(dFdy(pm)));
    float mu0 = dot(n, uLight);
    vec2 sd = length(sL.xy) > 1e-5 ? normalize(sL.xy) : vec2(0., 1.);
    vec4 gr = grain(pm, foot, sd, mu0 / sqrt(max(1. - mu0 * mu0, 1e-6)));
    n = normalize(n - gr.x * E - gr.y * N);
    alb *= 1. + gr.z;
    shadow = mix(1., gr.w, 1. - uNoLight);
  }
  #endif

  // 2. The light, and the drawn shadow.
  #if GROUND_SHADOW_STEPS > 0
  if (uSteps > 0 && uNoLight < .5 && shadow > 0. && dot(n, uLight) > 0. && (uPatch.w > .5 || uApron.w > .5)) shadow *= drawnShadow(vL, sL);
  #endif
  vec3 cv = uCamL - vL;
  vec3 v = normalize(cv.x * E + cv.y * N + cv.z * U);
  float direct = lunarLight(dot(n, uLight), dot(n, v), dot(uLight, v)) * shadow;
  direct = mix(direct, .5, uNoLight);

  // 4. Fill: light from sunlit ground around (while the Sun is near or above the level
  // horizon) and earthshine (while Earth is above it), so shadows are dark but not black.
  float sunNear = smoothstep(-.04, .02, sL.z) * (1. - uNoLight);
  float fill = uBounce * sunNear * (.55 + .45 * dot(n, U));
  fill += uEarthLight * max(dot(n, uEarth), 0.) * smoothstep(-.01, .02, dot(uEarth, U));
  fill += .003;

  float x = alb * (direct * uGain + fill);
  // The globe's soft roll-off, so sunlit slopes never clip to white.
  gl_FragColor = vec4(vec3(1. - exp(-x)), 1.);
  #include <colorspace_fragment>
}`;

export type GroundLight = {
  /** Unit direction toward the light, in scene axes. */
  light: { value: THREE.Vector3 };
  /** 1 when there is no light position: an even light and no shadows. */
  noLight: { value: number };
};

/** The images the ground reads, shared with the Moon's material. */
export type GroundMaps = {
  map: { value: THREE.Texture };
  loaded: { value: number };
  capSlope: { value: THREE.Texture };
  coreSlope: { value: THREE.Texture };
  capLoaded: { value: number };
};

type HeightGrid = { heights: Float32Array; columns: number; rows: number; halfKm: number };

/** Box-filtered mip levels of a height grid, each floor(size / 2) of the one before. */
export function heightMips(grid: Float32Array, columns: number, rows: number, levels: number): { data: Float32Array; width: number; height: number }[] {
  const out = [{ data: grid, width: columns, height: rows }];
  for (let level = 1; level < levels; level += 1) {
    const prev = out[level - 1]!;
    const width = Math.max(1, Math.floor(prev.width / 2));
    const height = Math.max(1, Math.floor(prev.height / 2));
    const data = new Float32Array(width * height);
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        // The parent texels under this one, by texture coordinate.
        const r0 = Math.floor((r / height) * prev.height);
        const r1 = Math.max(r0, Math.ceil(((r + 1) / height) * prev.height) - 1);
        const c0 = Math.floor((c / width) * prev.width);
        const c1 = Math.max(c0, Math.ceil(((c + 1) / width) * prev.width) - 1);
        let sum = 0;
        let count = 0;
        for (let y = r0; y <= r1; y += 1) {
          for (let x = c0; x <= c1; x += 1) {
            sum += prev.data[y * prev.width + x]!;
            count += 1;
          }
        }
        data[r * width + c] = sum / count;
      }
    }
    out.push({ data, width, height });
    if (width === 1 && height === 1) break;
  }
  return out;
}

function heightTexture(grid: HeightGrid, floatLinear: boolean): THREE.DataTexture {
  const levels = heightMips(grid.heights, grid.columns, grid.rows, 7);
  const type = floatLinear ? THREE.FloatType : THREE.HalfFloatType;
  const pack = (data: Float32Array) => (floatLinear ? data : Uint16Array.from(data, (v) => THREE.DataUtils.toHalfFloat(v)));
  const texture = new THREE.DataTexture(pack(levels[0]!.data), grid.columns, grid.rows, THREE.RedFormat, type);
  texture.mipmaps = levels.map((l) => ({ data: pack(l.data), width: l.width, height: l.height })) as unknown as THREE.DataTexture["mipmaps"];
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/** How long the camera must be still before the ground goes back to full detail. */
const SETTLE_MS = 150;

export type MotionDetail = { meshStep: GroundLodStep; shadows: GroundLevel; grain: GroundLevel };

const LEVEL_RANK: Record<GroundLevel, number> = { off: 0, reduced: 1, full: 2 };
const lower = (a: GroundLevel, b: GroundLevel): GroundLevel => (LEVEL_RANK[a] <= LEVEL_RANK[b] ? a : b);

/**
 * What the ground draws now: the quality's levels, lowered to `whileMoving` while the camera
 * moves, and with no drawn shadows and no texture while the disclosure cannot be shown.
 */
export function groundRuntime(
  quality: GroundQuality,
  moving: boolean,
  disclosed: boolean,
  whileMoving: MotionDetail,
): { steps: number; grain: boolean; meshStep: GroundLodStep } {
  const shadows = moving ? lower(quality.shadows, whileMoving.shadows) : quality.shadows;
  const grain = moving ? lower(quality.grain, whileMoving.grain) : quality.grain;
  return {
    steps: disclosed ? SHADOW_STEPS[shadows] : 0,
    grain: disclosed && grain !== "off",
    meshStep: moving ? whileMoving.meshStep : 1,
  };
}

/** How strong earthshine is drawn at full Earth, against the Sun's 1. Far above the real ratio, so night stays faintly readable. */
const EARTHSHINE = 0.12;

export class GroundLook {
  readonly material: THREE.ShaderMaterial;
  readonly uniforms;
  quality: GroundQuality;
  private readonly invalidate: () => void;
  private readonly blankHeight: THREE.DataTexture;
  private grids: { patch: HeightGrid | null; apron: HeightGrid | null } = { patch: null, apron: null };
  private built = false;
  private textures: THREE.DataTexture[] = [];
  private frame: SiteFrame | null = null;

  constructor(light: GroundLight, maps: GroundMaps, invalidate: () => void, quality?: GroundQuality) {
    this.invalidate = invalidate;
    this.blankHeight = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
    this.blankHeight.needsUpdate = true;
    this.quality =
      quality ?? (typeof location !== "undefined" ? groundQualityFromQuery(location.search) : null) ?? GROUND_QUALITY.full;
    this.uniforms = {
      uMap: maps.map,
      uLoaded: maps.loaded,
      uCapN: maps.capSlope,
      uCoreN: maps.coreSlope,
      uCapLoaded: maps.capLoaded,
      uLight: light.light,
      uNoLight: light.noLight,
      uHPatch: { value: this.blankHeight as THREE.Texture },
      uHApron: { value: this.blankHeight as THREE.Texture },
      uPatch: { value: new THREE.Vector4(10, 2, 1, 0) },
      uApron: { value: new THREE.Vector4(150, 2, 1, 0) },
      uGain: { value: 3.4 },
      uBounce: { value: 0.12 },
      uEarthLight: { value: 0 },
      uEarth: { value: new THREE.Vector3(0, 1, 0) },
      uFade: { value: 1 },
      uSteps: { value: SHADOW_STEPS[this.quality.shadows] },
      uGrainOn: { value: 1 },
      uNine: { value: 9 },
      uUp: { value: new THREE.Vector3(0, -1, 0) },
      uEast: { value: new THREE.Vector3(1, 0, 0) },
      uNorth: { value: new THREE.Vector3(0, 0, -1) },
      uCamL: { value: new THREE.Vector3(0, 0, 1) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      defines: groundDefines(this.quality),
    });
  }

  /**
   * Sets each effect's level. Changing a level recompiles the shader once. This is the call for
   * the scene's quality stages; motion and disclosure are applied on top of it.
   */
  setQuality(quality: GroundQuality): void {
    if (sameQuality(quality, this.quality)) return;
    this.quality = quality;
    this.material.defines = groundDefines(quality);
    this.material.needsUpdate = true;
    this.applyRuntime();
    this.invalidate();
  }

  /**
   * What the ground draws while the camera moves: a coarser mesh and lighter effects, back to
   * the quality's own at rest. The scene's quality stages may change it, for example
   * `{ meshStep: 4, shadows: "off", grain: "off" }` on their lowest stage.
   */
  whileMoving: MotionDetail = { meshStep: 2, shadows: "reduced", grain: "full" };

  /** Sets `whileMoving` and applies it at once. */
  setWhileMoving(detail: MotionDetail): void {
    this.whileMoving = detail;
    this.applyRuntime();
    this.invalidate();
  }

  /**
   * False while the plate that discloses the drawing cannot be shown (plates.ts,
   * `decorationDisclosure`): the ground then has no drawn shadows and no texture.
   */
  setDisclosed(shown: boolean): void {
    if (shown === this.disclosed) return;
    this.disclosed = shown;
    this.applyRuntime();
    this.invalidate();
  }

  get isMoving(): boolean {
    return this.moving;
  }

  private moving = false;
  private disclosed = true;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFrame = -1;
  private readonly lastCamera = new Float64Array(16).fill(Number.NaN);
  private readonly meshes = new Set<THREE.Mesh>();

  /** Uniforms and draw ranges from the quality, the motion and the disclosure; no recompiling. */
  private applyRuntime(): void {
    const r = groundRuntime(this.quality, this.moving, this.disclosed, this.whileMoving);
    this.uniforms.uSteps.value = r.steps;
    this.uniforms.uGrainOn.value = r.grain ? 1 : 0;
    for (const mesh of this.meshes) {
      const lod = mesh.geometry.userData.lod as GroundLod | undefined;
      const range = lod?.[r.meshStep] ?? lod?.[1];
      if (range) mesh.geometry.setDrawRange(range.start, range.count);
    }
  }

  /** Once a frame: is the camera where it was last frame? If not, draw lighter until it settles. */
  private watchCamera(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const frame = renderer.info.render.frame;
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    const m = camera.matrixWorld.elements;
    let moved = false;
    for (let i = 0; i < 16; i += 1) {
      if (m[i] !== this.lastCamera[i]) moved = true;
      this.lastCamera[i] = m[i]!;
    }
    if (!moved) return;
    if (!this.moving) {
      this.moving = true;
      this.applyRuntime();
    }
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    // At rest, one more frame at full quality: render on demand draws nothing more after it.
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.moving = false;
      this.applyRuntime();
      this.invalidate();
    }, SETTLE_MS);
  }

  /** The focused site's local frame, for the march, the texture and the camera's position. */
  setFrame(frame: SiteFrame): void {
    this.frame = frame;
    this.uniforms.uUp.value.set(...frame.up);
    this.uniforms.uEast.value.set(...frame.east);
    this.uniforms.uNorth.value.set(...frame.north);
  }

  /** The heights the shadows are marched over: exactly what is drawn (ground.ts). */
  setHeights(patch: HeightGrid | null, apron: HeightGrid | null): void {
    this.clearHeights();
    this.grids = { patch, apron };
  }

  clearHeights(): void {
    this.meshes.clear();
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
    this.grids = { patch: null, apron: null };
    this.built = false;
    this.uniforms.uHPatch.value = this.blankHeight;
    this.uniforms.uHApron.value = this.blankHeight;
    this.uniforms.uPatch.value.w = 0;
    this.uniforms.uApron.value.w = 0;
  }

  /** Earthshine for the hour: Earth's lit fraction seen from the Moon, from the two directions. */
  setBodies(sunDir: V3, earthDir: V3, bodies: boolean): void {
    this.uniforms.uEarth.value.set(...earthDir);
    this.uniforms.uEarthLight.value = bodies ? EARTHSHINE * earthLitFraction(sunDir, earthDir) : 0;
  }

  set fade(value: number) {
    this.uniforms.uFade.value = value;
  }

  /** Called by each ground mesh before it draws: the camera in the site's frame, and the height textures on first use. */
  attach(mesh: THREE.Object3D): void {
    mesh.onBeforeRender = this.beforeRender;
    if (mesh instanceof THREE.Mesh) {
      this.meshes.add(mesh);
      this.applyRuntime();
    }
  }

  /** One handler for every ground mesh, made once: nothing is allocated per draw. */
  private readonly beforeRender = (renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void => {
    if (!this.built) this.build(renderer);
    this.watchCamera(renderer, camera);
    const frame = this.frame;
    if (!frame) return;
    const km = MOON_RADIUS_M / 1_000;
    const dx = camera.position.x - frame.ground[0];
    const dy = camera.position.y - frame.ground[1];
    const dz = camera.position.z - frame.ground[2];
    const e = frame.east;
    const n = frame.north;
    const u = frame.up;
    this.uniforms.uCamL.value.set(
      (dx * e[0] + dy * e[1] + dz * e[2]) * km,
      (dx * n[0] + dy * n[1] + dz * n[2]) * km,
      (dx * u[0] + dy * u[1] + dz * u[2]) * km,
    );
  };

  private build(renderer: THREE.WebGLRenderer): void {
    this.built = true;
    const floatLinear = renderer.extensions.has("OES_texture_float_linear");
    const { patch, apron } = this.grids;
    if (patch) {
      const texture = heightTexture(patch, floatLinear);
      this.textures.push(texture);
      this.uniforms.uHPatch.value = texture;
      this.uniforms.uPatch.value.set(patch.halfKm, patch.columns, (2 * patch.halfKm) / (patch.columns - 1), 1);
    }
    if (apron) {
      const texture = heightTexture(apron, floatLinear);
      this.textures.push(texture);
      this.uniforms.uHApron.value = texture;
      this.uniforms.uApron.value.set(apron.halfKm, apron.columns, (2 * apron.halfKm) / (apron.columns - 1), 1);
    }
  }

  dispose(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    this.clearHeights();
    this.blankHeight.dispose();
    this.material.dispose();
  }
}

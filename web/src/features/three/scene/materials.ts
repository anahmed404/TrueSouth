import * as THREE from "three";
import { CAP_CORE_HALF_WIDTH_M, CAP_HALF_WIDTH_M, MOON_RADIUS_M } from "../../../lib/geo";

/**
 * The scene's shaders, adapted from the approved prototype
 * (design/variants/space-first/js/scene.js). Every one uses the logarithmic depth buffer, so
 * one scene in Moon radii can hold the Moon, Earth, the Sun and the ground at 2 m.
 *
 * Shading is decoration (AGENTS.md): no shader decides whether an hour is lit. The Sun's
 * direction is the sub-solar point from system.bin (science.md §14).
 */

const LOGDEPTH_V = "#include <common>\n#include <logdepthbuf_pars_vertex>\n";
const LOGDEPTH_F = "#include <common>\n#include <logdepthbuf_pars_fragment>\n";
const SRGB_TO_LINEAR = "vec3 s2l(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}";

const HW = (CAP_HALF_WIDTH_M / MOON_RADIUS_M).toFixed(8);
const HWC = (CAP_CORE_HALF_WIDTH_M / MOON_RADIUS_M).toFixed(8);

/** A 1 × 1 texture, for every slot until its image loads. */
export function solidTexture(r: number, g: number, b: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

// ── The Moon ────────────────────────────────────────────────────────────────

const moonVertex = `${LOGDEPTH_V}
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

/*
 * Colour: NASA's LROC map, equirectangular with 0° E at the centre (science.md §14 axes:
 * scene (x, y, z) is Moon-fixed (x, −z, y)). Relief along the day/night line: NASA's LOLA
 * height map, switched off inside the cap. Inside 80° S: TrueSouth's shaded relief and slope
 * maps, placed with the south polar stereographic projection of science.md §2.3,
 * ρ = 2R tan(45° + φ/2), x = ρ sin λ, y = ρ cos λ (here with R = 1; lib/geo/placement.ts
 * `capUv` is the same mapping, and its tests check Shackleton and 80° S).
 */
const moonFragment = `${LOGDEPTH_F}${SRGB_TO_LINEAR}
uniform sampler2D uMap, uMapE, uH, uCap, uCore, uCapN, uCoreN, uAvg;
uniform float uLoaded, uCapLoaded, uSplit, uDraw, uHideCos, uGain, uBump, uNoSun, uSlip, uAvgK;
uniform vec3 uSun, uHideDir, uWarm;
varying vec3 vP;
const float HW = ${HW};
const float HWC = ${HWC};
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vP);
  if (uHideCos < 1.0 && dot(p, uHideDir) > uHideCos) discard;
  vec3 m = vec3(p.x, -p.z, p.y);
  float lat = asin(clamp(m.z, -1., 1.));
  float lon = atan(m.y, m.x);
  vec2 uv = vec2(lon / (2. * PI) + .5, lat / PI + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  dx.x -= floor(dx.x + .5);
  dy.x -= floor(dy.x + .5);
  vec3 alb;
  if (uSplit > .5) {
    // Each half spans 0 to 1 on its own. Not fract(): at the 180° seam uv.x is exactly 1,
    // and fract() would wrap it to 0, the east half's 0° E column.
    vec2 u2 = vec2(uv.x < .5 ? uv.x * 2. : uv.x * 2. - 1., uv.y);
    vec2 k = vec2(2., 1.);
    alb = uv.x < .5 ? textureGrad(uMap, u2, dx * k, dy * k).rgb : textureGrad(uMapE, u2, dx * k, dy * k).rgb;
  } else {
    alb = textureGrad(uMap, uv, dx, dy).rgb;
  }
  alb = mix(vec3(.16), alb, uLoaded);

  float rho = 2. * tan(PI / 4. + lat / 2.);
  vec2 xy = rho * vec2(sin(lon), cos(lon));
  // The cap ends softly at 80° S, also in the Polar map's pose, so it reads as part of the Moon.
  float circ = 1. - smoothstep(HW * .965, HW * .995, rho);
  float capW = uCapLoaded * circ * step(lat, 0.);
  vec2 capUv = xy / HW * .5 + .5;
  vec2 coreUv = xy / HWC * .5 + .5;
  float hs = texture(uCap, capUv).r;
  float coreW = uCapLoaded * (1. - smoothstep(.92, 1., max(abs(xy.x), abs(xy.y)) / HWC));
  hs = mix(hs, texture(uCore, coreUv).r, coreW);
  hs = mix(.707, hs, capW);

  vec3 E = vec3(-sin(lon), 0., -cos(lon));
  vec3 N = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
  vec2 t = vec2(1. / 1440., 1. / 720.);
  float hE = textureGrad(uH, uv + vec2(t.x, 0.), dx, dy).r;
  float hW = textureGrad(uH, uv - vec2(t.x, 0.), dx, dy).r;
  float hN = texture(uH, uv + vec2(0., t.y)).r;
  float hS = texture(uH, uv - vec2(0., t.y)).r;
  float se = (hE - hW) * 19.6 / (2. * 7.58 * max(cos(lat), .15));
  float sn = (hN - hS) * 19.6 / (2. * 7.58);
  vec3 n = normalize(p - uBump * uLoaded * (1. - capW) * (se * E + sn * N));

  vec2 g = (texture(uCapN, capUv).rg - .5) * 255. / 160.;
  vec2 gc = (texture(uCoreN, coreUv).rg - .5) * 255. / 160.;
  g = mix(g, gc, coreW);
  vec3 X = normalize(vec3(0., 0., -1.) - p * (-p.z));
  vec3 Y = normalize(vec3(1., 0., 0.) - p * p.x);
  n = normalize(mix(n, normalize(p - g.x * X - g.y * Y), capW * uLoaded));

  float ndl = dot(n, uSun);
  float light = max(ndl, 0.) * smoothstep(-.06, .02, dot(p, uSun));
  // Without the Sun's position (system.bin not in), an even light: no made-up day/night line.
  light = mix(light, .5, uNoSun * (1. - uSlip));
  float detail = mix(1., hs / .707, capW * .2);
  // A soft roll-off: a face-on Moon never clips to white.
  vec3 real = vec3(1.) - exp(-(alb * detail * light * uGain + alb * .012));
  // The Slip Planner (slip.ts): uSun is then a fixed drawing light, at half strength, so the
  // ground never changes with the landing date. NASA's average sunlight can shade the cap
  // from dark grey (never lit) to Sun cream (always lit). Context only, never a result.
  real *= mix(1., .5, uSlip);
  if (uAvgK > 0.) {
    vec4 avg = texture(uAvg, capUv);
    float inMap = (1. - smoothstep(HW * .965, HW * .995, rho)) * step(lat, 0.) * avg.a;
    float rel = clamp(light * 1.25, 0., 1.);
    float lum = (.01 + .52 * avg.r) * (.5 + .5 * rel);
    vec3 tone = mix(vec3(lum * .8), uWarm * lum, .35 + .65 * avg.r);
    real = mix(real, tone, uAvgK * inMap);
  }
  vec3 drawn = s2l(vec3(hs));
  gl_FragColor = vec4(mix(real, drawn, uDraw * capW), 1.);
  #include <colorspace_fragment>
}`;

export type MoonUniforms = {
  uMap: { value: THREE.Texture };
  uMapE: { value: THREE.Texture };
  uH: { value: THREE.Texture };
  uCap: { value: THREE.Texture };
  uCore: { value: THREE.Texture };
  uCapN: { value: THREE.Texture };
  uCoreN: { value: THREE.Texture };
  uLoaded: { value: number };
  uCapLoaded: { value: number };
  uSplit: { value: number };
  uDraw: { value: number };
  uHideCos: { value: number };
  uGain: { value: number };
  uBump: { value: number };
  uNoSun: { value: number };
  uSlip: { value: number };
  uAvg: { value: THREE.Texture };
  uAvgK: { value: number };
  uWarm: { value: THREE.Color };
  uSun: { value: THREE.Vector3 };
  uHideDir: { value: THREE.Vector3 };
};

export function moonMaterial(blank: THREE.Texture, flat: THREE.Texture, flatSlope: THREE.Texture) {
  const uniforms: MoonUniforms = {
    uMap: { value: blank },
    uMapE: { value: blank },
    uH: { value: flat },
    uCap: { value: flat },
    uCore: { value: flat },
    uCapN: { value: flatSlope },
    uCoreN: { value: flatSlope },
    uLoaded: { value: 0 },
    uCapLoaded: { value: 0 },
    uSplit: { value: 0 },
    uDraw: { value: 0 },
    uHideCos: { value: 2 },
    uGain: { value: 2.6 },
    uBump: { value: 1.6 },
    uNoSun: { value: 1 },
    uSlip: { value: 0 },
    uAvg: { value: blank },
    uAvgK: { value: 0 },
    uWarm: { value: new THREE.Color(1, 0.886, 0.627) },
    uSun: { value: new THREE.Vector3(1, 0, 0) },
    uHideDir: { value: new THREE.Vector3(0, -1, 0) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: moonVertex, fragmentShader: moonFragment });
  return { material, uniforms };
}

// ── Earth ───────────────────────────────────────────────────────────────────

const earthVertex = `${LOGDEPTH_V}
varying vec3 vO; varying vec3 vN; varying vec3 vW;
void main() {
  vO = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

const earthFragment = `${LOGDEPTH_F}
uniform sampler2D uMap; uniform float uLoaded, uAlpha; uniform vec3 uSun, uRim;
varying vec3 vO; varying vec3 vN; varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vO);
  vec3 m = vec3(p.x, -p.z, p.y);
  vec2 uv = vec2(atan(m.y, m.x) / (2. * PI) + .5, asin(clamp(m.z, -1., 1.)) / PI + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  dx.x -= floor(dx.x + .5);
  dy.x -= floor(dy.x + .5);
  vec3 alb = mix(vec3(.08, .1, .13), textureGrad(uMap, uv, dx, dy).rgb, uLoaded);
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float ndl = dot(n, uSun);
  vec3 col = alb * smoothstep(-.08, .3, ndl) * 1.25 + alb * .006;
  float rim = pow(1. - max(dot(n, v), 0.), 3.) * smoothstep(-.15, .35, ndl);
  col += uRim * rim * .35;
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}`;

export function earthMaterial(blank: THREE.Texture, rim: THREE.Color) {
  const uniforms = {
    uMap: { value: blank as THREE.Texture },
    uLoaded: { value: 0 },
    uSun: { value: new THREE.Vector3(1, 0, 0) },
    uRim: { value: rim },
    uAlpha: { value: 1 },
  };
  // Transparent so Earth can fade out when it moves in front of the Moon (world.ts). Drawn
  // after the Moon with depth writes on; at full opacity it looks as an opaque Earth.
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: earthVertex, fragmentShader: earthFragment, transparent: true });
  return { material, uniforms };
}

// ── The Sun: a limb-darkened disc and a short warm edge that ends by 1.8 disc radii ──

const sunVertex = `${LOGDEPTH_V}
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

const sunFragment = `${LOGDEPTH_F}
uniform vec3 uCore, uWarm; uniform float uExt, uCorona, uFade;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  float d = length(vUv * 2. - 1.) * uExt;
  vec3 col; float a;
  if (d < 1.) {
    float mu = sqrt(1. - d * d);
    col = uCore * (.62 + .38 * mu);
    a = 1.;
  } else {
    float c = uCorona * .55 * exp(-(d - 1.) * 5.) * (1. - smoothstep(uExt * .7, uExt * .98, d));
    col = uWarm * c;
    a = c;
  }
  if (a < .002) discard;
  gl_FragColor = vec4(col * uFade, 1.);
  #include <colorspace_fragment>
}`;

export function sunMaterial(core: THREE.Color, warm: THREE.Color) {
  const uniforms = { uCore: { value: core }, uWarm: { value: warm }, uExt: { value: 1.8 }, uCorona: { value: 0.32 }, uFade: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: sunVertex,
    fragmentShader: sunFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { material, uniforms };
}

// ── The ground around the focused site: the patch and the apron ────────────

const groundVertex = `${LOGDEPTH_V}
attribute vec3 aM;
varying vec3 vN; varying vec3 vM;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vM = aM;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

const groundFragment = `${LOGDEPTH_F}
uniform sampler2D uMap; uniform float uLoaded, uGain, uFade, uNoSun;
uniform vec3 uSun, uUp;
varying vec3 vN; varying vec3 vM;
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.);
  int i = int(q.x + q.y * 4.);
  float b[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (b[i] + .5) / 16.;
}
void main() {
  #include <logdepthbuf_fragment>
  if (uFade < 1. && bayer(gl_FragCoord.xy) > uFade) discard;
  vec3 m = normalize(vM);
  float lat = asin(clamp(m.z, -1., 1.)), lon = atan(m.y, m.x);
  vec3 alb = mix(vec3(.16), texture(uMap, vec2(lon / (2. * PI) + .5, lat / PI + .5)).rgb, uLoaded);
  vec3 n = normalize(vN);
  float light = mix(max(dot(n, uSun), 0.), .5, uNoSun);
  float fill = .012 + .05 * pow(max(dot(n, uUp), 0.), 3.);
  // The globe's soft roll-off, so sunlit slopes never clip to white.
  vec3 real = vec3(1.) - exp(-(alb * light * uGain + alb * fill * 3.));
  gl_FragColor = vec4(real, 1.);
  #include <colorspace_fragment>
}`;

export function groundMaterial(
  map: { value: THREE.Texture },
  loaded: { value: number },
  sun: { value: THREE.Vector3 },
  noSun: { value: number },
) {
  const uniforms = {
    uMap: map,
    uLoaded: loaded,
    uSun: sun,
    uNoSun: noSun,
    uGain: { value: 2.6 },
    uFade: { value: 1 },
    uUp: { value: new THREE.Vector3(0, -1, 0) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: groundVertex, fragmentShader: groundFragment });
  return { material, uniforms };
}

// ── The lander: flat vertex colours, lit by the same Sun ────────────────────

const landerVertex = `${LOGDEPTH_V}
attribute vec3 color;
varying vec3 vN; varying vec3 vC;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vC = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

const landerFragment = `${LOGDEPTH_F}
uniform vec3 uSun, uUp; uniform float uNoSun;
varying vec3 vN; varying vec3 vC;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float light = mix(max(dot(n, uSun), 0.), .5, uNoSun);
  float fill = .05 + .07 * max(dot(n, uUp), 0.);
  gl_FragColor = vec4(vC * (light * 1.6 + fill), 1.);
  #include <colorspace_fragment>
}`;

export function landerMaterial(sun: { value: THREE.Vector3 }, up: { value: THREE.Vector3 }, noSun: { value: number }) {
  const uniforms = { uSun: sun, uUp: up, uNoSun: noSun };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: landerVertex,
    fragmentShader: landerFragment,
    side: THREE.DoubleSide,
  });
}

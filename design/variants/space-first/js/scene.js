/* The space scene: one three.js scene in Moon radii, fixed to the Moon (science.md §14).
   It draws the Moon, Earth and the Sun, the site pins' anchor points, the sight-lines, and the
   local ground around the focused site (science.md §13). Directions are true; distances of the
   Earth and Sun are squeezed in the System view. Shadows and shading are decoration. */
import * as THREE from 'three';
import { toScene, unit, basis, R_MOON_M, D2R } from './data.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const HW = 304000 / R_MOON_M, HWC = 76000 / R_MOON_M;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TUNE = { eD: 2.3, eR: .4, sD: 2.5, sR: .12, cy: .82, cm: 0, d: 11.5, um: .6, shift: .35 };
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const LOGDEPTH_V = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGDEPTH_F = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';
const SRGB = `vec3 s2l(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}`;

/* ── the Moon ── */
const moonVert = LOGDEPTH_V + `
varying vec3 vP;
void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const moonFrag = LOGDEPTH_F + SRGB + `
uniform sampler2D uMap, uMapE, uH, uCap, uCore, uCapN, uCoreN;
uniform float uLoaded, uCapLoaded, uSplit, uDraw, uHideCos, uGain, uBump;
uniform vec3 uSun, uHideDir;
varying vec3 vP;
const float HW = ${HW.toFixed(7)}; const float HWC = ${HWC.toFixed(7)};
void main(){
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vP);
  if (uHideCos < 1.0 && dot(p, uHideDir) > uHideCos) discard;
  vec3 m = vec3(p.x, -p.z, p.y);
  float lat = asin(clamp(m.z, -1., 1.)), lon = atan(m.y, m.x);
  vec2 uv = vec2(lon / (2. * PI) + .5, lat / PI + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv); dx.x -= floor(dx.x + .5); dy.x -= floor(dy.x + .5);
  vec3 alb;
  if (uSplit > .5) {
    vec2 u2 = vec2(fract(uv.x * 2.), uv.y);
    alb = uv.x < .5 ? textureGrad(uMap, u2, dx * vec2(2., 1.), dy * vec2(2., 1.)).rgb : textureGrad(uMapE, u2, dx * vec2(2., 1.), dy * vec2(2., 1.)).rgb;
  } else alb = textureGrad(uMap, uv, dx, dy).rgb;
  alb = mix(vec3(.16), alb, uLoaded);
  // polar cap: shaded relief in south polar stereographic (science.md §2.3), with a sharper core
  float rho = 2. * tan(PI / 4. + lat / 2.);
  vec2 xy = rho * vec2(sin(lon), cos(lon));
  float circ = 1. - smoothstep(HW * .965, HW * .995, rho);
  float sq = step(max(abs(xy.x), abs(xy.y)), HW);
  float capW = uCapLoaded * mix(circ, sq, uDraw) * step(lat, 0.);
  float hs = texture(uCap, xy / HW * .5 + .5).r;
  float coreW = uCapLoaded * (1. - smoothstep(.92, 1., max(abs(xy.x), abs(xy.y)) / HWC));
  hs = mix(hs, texture(uCore, xy / HWC * .5 + .5).r, coreW);
  hs = mix(.707, hs, capW);
  // relief along the day/night line from the global height map (slopes ×1.6)
  vec3 E = vec3(-sin(lon), 0., -cos(lon));
  vec3 N = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
  vec2 t = vec2(1. / 1440., 1. / 720.);
  float hE = textureGrad(uH, uv + vec2(t.x, 0.), dx, dy).r, hW = textureGrad(uH, uv - vec2(t.x, 0.), dx, dy).r;
  float hN = texture(uH, uv + vec2(0., t.y)).r, hS = texture(uH, uv - vec2(0., t.y)).r;
  float se = (hE - hW) * 19.6 / (2. * 7.58 * max(cos(lat), .15)), sn = (hN - hS) * 19.6 / (2. * 7.58);
  vec3 n = normalize(p - uBump * uLoaded * (1. - capW) * (se * E + sn * N));
  // inside the cap: true slopes from NASA's 80 m map, so the real Sun lights real relief
  vec2 g = (texture(uCapN, xy / HW * .5 + .5).rg - .5) * 255. / 160.;
  vec2 gc = (texture(uCoreN, xy / HWC * .5 + .5).rg - .5) * 255. / 160.;
  g = mix(g, gc, coreW);
  vec3 X = normalize(vec3(0., 0., -1.) - p * (-p.z)), Y = normalize(vec3(1., 0., 0.) - p * p.x);
  n = normalize(mix(n, normalize(p - g.x * X - g.y * Y), capW * uLoaded));
  float ndl = dot(n, uSun);
  float light = max(ndl, 0.) * smoothstep(-.06, .02, dot(p, uSun));
  float detail = mix(1., hs / .707, capW * .2);
  vec3 real = vec3(1.) - exp(-(alb * detail * light * uGain + alb * .012)); // soft roll-off: a face-on Moon never clips
  vec3 drawn = s2l(vec3(hs));
  gl_FragColor = vec4(mix(real, drawn, uDraw * capW), 1.);
  #include <colorspace_fragment>
}`;

/* ── the ground around the site ── */
const terrVert = LOGDEPTH_V + `
attribute float aZ; attribute vec3 aM; attribute float aLit;
varying vec3 vN; varying vec3 vM; varying float vZ; varying float vLit;
void main(){ vN = normalize(mat3(modelMatrix) * normal); vM = aM; vZ = aZ; vLit = aLit;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const terrFrag = LOGDEPTH_F + `
uniform sampler2D uMap; uniform float uLoaded, uGain, uMode, uFade, uZlo, uZhi;
uniform vec3 uSun, uUp, cGo, cCau, cNogo;
varying vec3 vN; varying vec3 vM; varying float vZ; varying float vLit;
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.); int i = int(q.x + q.y * 4.);
  float b[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (b[i] + .5) / 16.; }
void main(){
  #include <logdepthbuf_fragment>
  if (uFade < 1. && bayer(gl_FragCoord.xy) > uFade) discard;
  vec3 m = normalize(vM);
  float lat = asin(clamp(m.z, -1., 1.)), lon = atan(m.y, m.x);
  vec3 alb = mix(vec3(.16), texture(uMap, vec2(lon / (2. * PI) + .5, lat / PI + .5)).rgb, uLoaded);
  vec3 n = normalize(vN);
  float light = max(dot(n, uSun), 0.) * vLit;
  float fill = .012 + .05 * pow(max(dot(n, uUp), 0.), 3.);
  float slope = degrees(acos(clamp(dot(n, uUp), -1., 1.)));
  vec3 base = alb * 1.15;
  if (uMode > .5 && uMode < 1.5) { base = slope < 5. ? cGo : (slope < 10. ? cCau : cNogo); base *= .55; }
  if (uMode > 1.5) { float h = clamp((vZ - uZlo) / (uZhi - uZlo), 0., 1.); base = mix(vec3(.05,.05,.055), vec3(.62,.55,.42), h) * .9 + vec3(.04); }
  gl_FragColor = vec4(base * (light * uGain + fill * 3.), 1.);
  #include <colorspace_fragment>
}`;

/* ── Earth ── */
const earthVert = LOGDEPTH_V + `
varying vec3 vO; varying vec3 vN; varying vec3 vW;
void main(){ vO = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`;
const earthFrag = LOGDEPTH_F + `
uniform sampler2D uMap; uniform float uLoaded; uniform vec3 uSun, uRim;
varying vec3 vO; varying vec3 vN; varying vec3 vW;
void main(){
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vO); vec3 m = vec3(p.x, -p.z, p.y);
  vec2 uv = vec2(atan(m.y, m.x) / (2. * PI) + .5, asin(clamp(m.z, -1., 1.)) / PI + .5);
  vec2 dx = dFdx(uv), dy = dFdy(uv); dx.x -= floor(dx.x + .5); dy.x -= floor(dy.x + .5);
  vec3 alb = mix(vec3(.08,.1,.13), textureGrad(uMap, uv, dx, dy).rgb, uLoaded);
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  float ndl = dot(n, uSun);
  vec3 col = alb * smoothstep(-.08, .3, ndl) * 1.25 + alb * .006;
  float rim = pow(1. - max(dot(n, v), 0.), 3.) * smoothstep(-.15, .35, ndl);
  col += uRim * rim * .35;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

/* ── the Sun: a limb-darkened disc and a short, faint corona ── */
const sunVert = LOGDEPTH_V + `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const sunFrag = LOGDEPTH_F + `
uniform vec3 uCore, uWarm; uniform float uExt, uCorona;
varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  float d = length(vUv * 2. - 1.) * uExt;
  vec3 col; float a;
  if (d < 1.) { float mu = sqrt(1. - d * d); col = uCore * (.62 + .38 * mu); a = 1.; }
  else { float c = uCorona * .55 * exp(-(d - 1.) * 5.) * (1. - smoothstep(uExt * .7, uExt * .98, d)); col = uWarm * c; a = c; }
  if (a < .002) discard;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

export function createScene(canvas, opt = {}) {
  let gl2 = null;
  try { gl2 = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' }); } catch (e) { /* ignore */ }
  if (!gl2) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opt.maxDpr || 2));
  renderer.setClearColor(0x0b0b0c, 1);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1e-7, 4000);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const lin = hex => new THREE.Color(hex);  // THREE.Color converts sRGB hex to linear

  /* textures */
  const loader = new THREE.TextureLoader();
  const blank = new THREE.DataTexture(new Uint8Array([40, 40, 40, 255]), 1, 1); blank.needsUpdate = true;
  const flat = new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1); flat.needsUpdate = true;
  const flatN = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); flatN.needsUpdate = true;
  const tex = (url, color = true) => new Promise(res => loader.load(url, t => {
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, maxAniso);
    t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; res(t);
  }, undefined, () => res(null)));
  const capTex = t => { if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; } return t; };

  /* the Moon */
  const moonU = {
    uMap: { value: blank }, uMapE: { value: blank }, uH: { value: flat }, uCap: { value: flat }, uCore: { value: flat }, uCapN: { value: flatN }, uCoreN: { value: flatN },
    uLoaded: { value: 0 }, uCapLoaded: { value: 0 }, uSplit: { value: 0 }, uDraw: { value: 0 }, uHideCos: { value: 2 }, uGain: { value: 2.6 }, uBump: { value: 1.6 },
    uSun: { value: new THREE.Vector3(1, 0, 0) }, uHideDir: { value: new THREE.Vector3(0, -1, 0) },
  };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 384, 192), new THREE.ShaderMaterial({ uniforms: moonU, vertexShader: moonVert, fragmentShader: moonFrag }));
  scene.add(moon);

  /* Earth and the Sun */
  const earthU = { uMap: { value: blank }, uLoaded: { value: 0 }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uRim: { value: lin(css('--earth')) } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.ShaderMaterial({ uniforms: earthU, vertexShader: earthVert, fragmentShader: earthFrag }));
  scene.add(earth);
  const sunU = { uCore: { value: lin(css('--sun-core')).multiplyScalar(1.0) }, uWarm: { value: lin(css('--sun')) }, uExt: { value: 1.8 }, uCorona: { value: .32 } };
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: sunU, vertexShader: sunVert, fragmentShader: sunFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sun);

  /* axis, equator and the day/night line: faint guides */
  const guideMat = new THREE.LineBasicMaterial({ color: 0x8c8c93, transparent: true, opacity: .35 });
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.32, 0), new THREE.Vector3(0, 1.32, 0)]), guideMat);
  scene.add(axis);
  const ring = (r, n = 256) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } return new THREE.BufferGeometry().setFromPoints(pts); };
  const equator = new THREE.Line(ring(1.002), new THREE.LineBasicMaterial({ color: 0x8c8c93, transparent: true, opacity: .16 }));
  scene.add(equator);
  const term = new THREE.Line(ring(1.003), new THREE.LineDashedMaterial({ color: 0xb3b3b8, dashSize: .03, gapSize: .03, transparent: true, opacity: .45 }));
  term.computeLineDistances(); scene.add(term);

  /* sight-lines from the focused site: colour and dash come from the series */
  const mkLine = () => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: 0, depthTest: true })); l.frustumCulled = false; scene.add(l); return l; };
  const sight = { sun: mkLine(), earth: mkLine() };

  /* the local ground */
  const terrU = {
    uMap: moonU.uMap, uLoaded: moonU.uLoaded, uGain: { value: 6.5 }, uMode: { value: 0 }, uFade: { value: 1 }, uZlo: { value: 0 }, uZhi: { value: 1 },
    uSun: moonU.uSun, uUp: { value: new THREE.Vector3(0, -1, 0) },
    cGo: { value: lin(css('--status-go')) }, cCau: { value: lin(css('--status-caution')) }, cNogo: { value: lin(css('--status-nogo')) },
  };
  const terrMat = new THREE.ShaderMaterial({ uniforms: terrU, vertexShader: terrVert, fragmentShader: terrFrag });
  const ground = new THREE.Group(); ground.visible = false; scene.add(ground);
  const terrCache = new Map();
  let terr = null; // {site, patch, apron, z0}
  const outline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(css('--terrain-rim')), transparent: true, opacity: .6 }));
  ground.add(outline);

  async function loadTerrain(site) {
    if (!terrCache.has(site.id)) terrCache.set(site.id, fetch(`assets/terrain_${site.id}.bin`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null));
    return terrCache.get(site.id);
  }
  function buildGrid(site, raw, n, half, offsetEl, exag, z0, hole) {
    const R = R_MOON_M, B = basis(site.lat, site.lon), step = 2 * half / (n - 1);
    const pos = new Float32Array(n * n * 3), mpos = new Float32Array(n * n * 3), az = new Float32Array(n * n);
    const O = B.u.map(c => c * (R + z0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const k = i * n + j, E = -half + j * step, N = half - i * step;
      let z = raw[offsetEl + k] / 2 - 12000;
      if (hole) { const r = Math.max(Math.abs(E), Math.abs(N)) / half; z = z * (1 - smooth(.62, .98, r)); if (Math.max(Math.abs(E), Math.abs(N)) < 11500) z -= 30; }
      const zz = z0 + (z - z0) * exag;
      const s = Math.hypot(E, N), A = Math.atan2(E, N), g = s / R;
      const east = (R + zz) * Math.sin(g) * Math.sin(A), north = (R + zz) * Math.sin(g) * Math.cos(A), up = (R + zz) * Math.cos(g) - (R + z0);
      const w = [0, 1, 2].map(c => east * B.e[c] + north * B.n[c] + up * B.u[c]);
      const sc = toScene(w);
      pos[k * 3] = sc[0] / R; pos[k * 3 + 1] = sc[1] / R; pos[k * 3 + 2] = sc[2] / R;
      mpos[k * 3] = O[0] + w[0]; mpos[k * 3 + 1] = O[1] + w[1]; mpos[k * 3 + 2] = O[2] + w[2];
      az[k] = z;
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      if (hole) { const E0 = -half + j * step, E1 = E0 + step, N0 = half - i * step, N1 = N0 - step;
        if (Math.max(Math.abs(E0), Math.abs(E1)) < 9999 && Math.max(Math.abs(N0), Math.abs(N1)) < 9999) continue; }
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aM', new THREE.BufferAttribute(mpos, 3));
    g.setAttribute('aZ', new THREE.BufferAttribute(az, 1));
    g.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(n * n).fill(1), 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  async function setGround(site, exag = 1) {
    if (!site || site.tier === 'sphere') { if (terr) { ground.remove(terr.patch, terr.apron); terr.patch.geometry.dispose(); terr.apron.geometry.dispose(); } terr = null; ground.visible = false; invalidate(); return false; }
    const buf = await loadTerrain(site); if (!buf) return false;
    const raw = new Uint16Array(buf);
    const z0 = raw[128 * 257 + 128] / 2 - 12000;
    if (terr) { ground.remove(terr.patch, terr.apron); terr.patch.geometry.dispose(); terr.apron.geometry.dispose(); }
    const patch = new THREE.Mesh(buildGrid(site, raw, 257, 10000, 0, exag, z0, false), terrMat);
    const apron = new THREE.Mesh(buildGrid(site, raw, 161, 150000, 257 * 257, exag, z0, true), terrMat);
    patch.frustumCulled = apron.frustumCulled = false;
    ground.add(patch, apron);
    const O = toScene(unit(site.lat, site.lon)).map(c => c * (1 + z0 / R_MOON_M));
    ground.position.set(O[0], O[1], O[2]);
    // outline of the modelled 20 km square
    const pa = patch.geometry.attributes.position, n = 257, ring = [];
    for (let j = 0; j < n; j++) ring.push(j); for (let i = 1; i < n; i++) ring.push(i * n + n - 1);
    for (let j = n - 2; j >= 0; j--) ring.push((n - 1) * n + j); for (let i = n - 2; i > 0; i--) ring.push(i * n);
    const pts = ring.filter((_, q) => q % 2 === 0).map(k => new THREE.Vector3(pa.getX(k), pa.getY(k), pa.getZ(k)).multiplyScalar(1.0000005));
    outline.geometry.dispose(); outline.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    let lo = 1e9, hi = -1e9; const zs = patch.geometry.attributes.aZ.array; for (const z of zs) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
    terrU.uZlo.value = lo; terrU.uZhi.value = hi;
    terrU.uUp.value.set(...toScene(unit(site.lat, site.lon)));
    terr = { site, patch, apron, z0, exag, raw };
    lastShade = null; shade();
    invalidate();
    return true;
  }
  /* Terrain shadows: for each vertex, the highest horizon toward the Sun, marched over the
     80 m patch and the 1.9 km apron with the Moon's curvature. Decoration: the series decides. */
  let lastShade = null, shadeT = 0;
  function shade(force) {
    if (!terr || !st.site) return;
    const B = basis(st.site.lat, st.site.lon), d = st.sunDir, m = [d.x, -d.z, d.y];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const sa = Math.atan2(dot(m, B.e), dot(m, B.n)), se = Math.asin(clamp(dot(m, B.u), -1, 1)) / D2R;
    if (!force && lastShade && Math.abs(sa - lastShade.sa) < .02 && Math.abs(se - lastShade.se) < .15 && lastShade.exag === terr.exag) return;
    lastShade = { sa, se, exag: terr.exag };
    const { raw, z0, exag } = terr, R = R_MOON_M, sA = Math.sin(sa), cA = Math.cos(sa);
    const zP = i => z0 + (raw[i] / 2 - 12000 - z0) * exag, zA = i => z0 + (raw[66049 + i] / 2 - 12000 - z0) * exag;
    const sp = 20000 / 256, sa2 = 300000 / 160;
    function H(E, N) {
      if (Math.abs(E) < 9990 && Math.abs(N) < 9990) {
        const x = (E + 10000) / sp, y = (10000 - N) / sp, j = Math.floor(x), i = Math.floor(y), fx = x - j, fy = y - i, k = i * 257 + j;
        return (zP(k) * (1 - fx) + zP(k + 1) * fx) * (1 - fy) + (zP(k + 257) * (1 - fx) + zP(k + 258) * fx) * fy;
      }
      const x = (E + 150000) / sa2, y = (150000 - N) / sa2, j = Math.floor(x), i = Math.floor(y);
      if (j < 0 || i < 0 || j > 159 || i > 159) return null;
      const fx = x - j, fy = y - i, k = i * 161 + j;
      return (zA(k) * (1 - fx) + zA(k + 1) * fx) * (1 - fy) + (zA(k + 161) * (1 - fx) + zA(k + 162) * fx) * fy;
    }
    const half = .27;
    for (const [mesh, n, hf, first] of [[terr.patch, 257, 10000, 40], [terr.apron, 161, 150000, 900]]) {
      const lit = mesh.geometry.attributes.aLit, step = 2 * hf / (n - 1);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const E = -hf + j * step, N = hf - i * step, k = i * n + j;
        const z = n === 257 ? zP(k) : zA(k);
        let best = -1e9, dd = first;
        while (dd < 160000) {
          const h = H(E + dd * sA, N + dd * cA); if (h == null) break;
          const t = (h - z - dd * dd / (2 * R)) / dd; if (t > best) best = t;
          dd += dd < 4000 ? Math.max(first, 60) : dd * .045;
        }
        const hz = Math.atan(best) / D2R;
        lit.array[k] = clamp((se - hz + half) / (2 * half), 0, 1);
      }
      lit.needsUpdate = true;
    }
    invalidate();
  }
  function shadeSoon() { clearTimeout(shadeT); shadeT = setTimeout(() => shade(), 120); }

  /* state */
  const st = {
    sunDir: new THREE.Vector3(1, 0, 0), earthDir: new THREE.Vector3(1, 0, 0),
    site: null, siteP: new THREE.Vector3(), siteUp: new THREE.Vector3(0, -1, 0),
    trueScale: 0, mode: 'system', inset: { l: 0, r: 0, t: 0, b: 0 }, near: 0,
    sightOk: { sun: false, earth: true }, earthSpin: 0,
  };
  let W = 1, H = 1;

  function setBodies(sunM, earthM, hAbs) {
    st.sunDir.set(...toScene(sunM)).normalize();
    st.earthDir.set(...toScene(earthM)).normalize();
    moonU.uSun.value.copy(st.sunDir); earthU.uSun.value.copy(st.sunDir);
    if (terr) shadeSoon();
    st.earthSpin = (hAbs / 23.934) * Math.PI * 2;
    invalidate();
  }
  function setSite(site) {
    st.site = site;
    if (site) {
      const u = toScene(unit(site.lat, site.lon));
      st.siteUp.set(...u);
      st.siteP.set(...u).multiplyScalar(1 + (terr && terr.site === site ? terr.z0 : 0) / R_MOON_M);
    }
    invalidate();
  }
  function setSight(ok) { st.sightOk = ok; invalidate(); }

  /* place bodies, guides and lines for the current camera */
  function layout() {
    const alt = camera.position.length() - 1;
    st.near = smooth(.06, .012, alt);           // 1 when close to the ground
    const ts = st.trueScale;
    // System view: squeezed. Near the ground: true angular size, centred on the site.
    const eD = THREE.MathUtils.lerp(TUNE.eD, 221, ts), eR = THREE.MathUtils.lerp(TUNE.eR, 3.671, ts);
    const sD = THREE.MathUtils.lerp(TUNE.sD, 900, ts), sR = THREE.MathUtils.lerp(TUNE.sR, 900 * Math.tan(.2665 * D2R), ts);
    const nearC = st.site ? st.siteP : new THREE.Vector3();
    const eDn = 60, eRn = 60 * Math.tan(.95 * D2R), sDn = 300, sRn = 300 * Math.tan(.2665 * D2R);
    const k = st.near;
    const eC = new THREE.Vector3().copy(nearC).multiplyScalar(k);
    earth.position.copy(st.earthDir).multiplyScalar(THREE.MathUtils.lerp(eD, eDn, k)).add(eC);
    earth.scale.setScalar(THREE.MathUtils.lerp(eR, eRn, k));
    earth.rotation.set(0, st.earthSpin, 0);
    sun.position.copy(st.sunDir).multiplyScalar(THREE.MathUtils.lerp(sD, sDn, k)).add(eC);
    const sr = THREE.MathUtils.lerp(sR, sRn, k);
    sunU.uExt.value = THREE.MathUtils.lerp(1.8, 1.5, k);
    sun.scale.setScalar(sr * sunU.uExt.value);
    sun.quaternion.copy(camera.quaternion);
    // guides fade as the camera gets close to the ground
    const far = 1 - smooth(.5, .15, alt);
    guideMat.opacity = .35 * far; equator.material.opacity = .16 * far; term.material.opacity = .45 * far;
    axis.visible = equator.visible = term.visible = far > .01 && st.mode !== 'polar';
    term.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), st.sunDir);
    // sight-lines: true directions from the site
    const show = !!st.site && !st.noSight && st.mode !== 'polar' && st.mode !== 'eye';
    const len = THREE.MathUtils.lerp(1.15, 8000 / R_MOON_M, smooth(.4, .005, alt));
    const from = st.site ? st.siteP.clone().add(st.siteUp.clone().multiplyScalar(THREE.MathUtils.lerp(.004, 2 / R_MOON_M, st.near))) : new THREE.Vector3();
    for (const key of ['sun', 'earth']) {
      const l = sight[key], ok = st.sightOk[key], dir = key === 'sun' ? st.sunDir : st.earthDir;
      l.visible = show;
      const a = l.geometry.attributes.position;
      a.setXYZ(0, from.x, from.y, from.z);
      const to = from.clone().add(dir.clone().multiplyScalar(len)); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true;
      l.computeLineDistances();
      l.material.color.set(ok ? css('--status-go') : css('--status-nogo'));
      l.material.dashSize = ok ? 1e3 : len / 30; l.material.gapSize = ok ? 0 : len / 60;
      st[key + 'End'] = to;
    }
    st.sightFrom = from;
    // the ground: shown when close, dissolved in over a short range
    const gFade = st.site && terr && terr.site === st.site ? smooth(.03, .016, alt) : 0;
    ground.visible = gFade > 0.001;
    terrU.uFade.value = gFade;
    if (gFade > .999 && st.site) { moonU.uHideDir.value.copy(st.siteUp); moonU.uHideCos.value = Math.cos(140000 / R_MOON_M); }
    else moonU.uHideCos.value = 2;
  }

  /* the camera: a pose is a position, a look direction, an up vector and a field of view */
  const pose = () => ({ pos: camera.position.clone(), look: new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), up: camera.up.clone(), fov: camera.fov });
  function applyPose(p) {
    camera.position.copy(p.pos); camera.up.copy(p.up); camera.fov = p.fov;
    camera.lookAt(p.pos.clone().add(p.look)); updateProj();
  }
  function slerpV(a, b, t) {
    const d = clamp(a.dot(b), -1, 1), th = Math.acos(d);
    if (th < 1e-6) return a.clone();
    if (Math.PI - th < 1e-3) { // opposite: go round through a perpendicular
      const perp = new THREE.Vector3(0, 1, 0).cross(a); if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0).cross(a); perp.normalize();
      return t < .5 ? slerpV(a, perp, t * 2) : slerpV(perp, b, t * 2 - 1);
    }
    const s = Math.sin(th);
    return a.clone().multiplyScalar(Math.sin((1 - t) * th) / s).add(b.clone().multiplyScalar(Math.sin(t * th) / s));
  }
  function lerpPose(a, b, t) {
    const ra = a.pos.length(), rb = b.pos.length();
    const la = Math.log(Math.max(ra - 1, 1e-7)), lb = Math.log(Math.max(rb - 1, 1e-7));
    // altitude: log-lerp, with a gentle rise in the middle of a long flight so the globe stays in view
    const altLog = la + (lb - la) * t;
    const dir = slerpV(a.pos.clone().normalize(), b.pos.clone().normalize(), t);
    const pos = dir.multiplyScalar(1 + Math.exp(altLog));
    return { pos, look: slerpV(a.look.clone().normalize(), b.look.clone().normalize(), t).normalize(), up: slerpV(a.up.clone().normalize(), b.up.clone().normalize(), t).normalize(), fov: a.fov + (b.fov - a.fov) * t };
  }
  let tween = null;
  function flyTo(target, ms, onDone, onT) {
    const from = pose();
    if (ms <= 0) { applyPose(target); tween = null; onT && onT(1); onDone && onDone(); invalidate(); return; }
    tween = { from, to: target, t0: performance.now(), ms, onDone, onT };
    invalidate();
  }
  const stopTween = () => { if (tween) { tween = null; } };

  /* poses for each view */
  function frameOf(up) {
    const ref = Math.abs(up.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e = new THREE.Vector3().crossVectors(ref, up).normalize(), n = new THREE.Vector3().crossVectors(up, e).normalize();
    return { e, n, up };
  }
  function sitePoseLocal(az, el, dist, lookAtSite = true) {
    // az/el of the camera as seen from the site (degrees), dist in Moon radii
    const B = basis(st.site.lat, st.site.lon);
    const d = V(toScene([0, 1, 2].map(i => Math.cos(el * D2R) * (Math.cos(az * D2R) * B.n[i] + Math.sin(az * D2R) * B.e[i]) + Math.sin(el * D2R) * B.u[i])));
    const pos = st.siteP.clone().add(d.multiplyScalar(dist));
    const look = st.siteP.clone().sub(pos).normalize();
    return { pos, look, up: st.siteUp.clone(), fov: 40 };
  }
  function poses() {
    const S = st.sunDir.clone(), E = st.earthDir.clone();
    // System view home: from below the south pole, turned so that Earth and the Sun sit either side
    const mid = E.clone().add(S); mid.y = 0; if (mid.lengthSq() < 1e-6) mid.set(1, 0, 0); mid.normalize();
    const side = new THREE.Vector3(-mid.z, 0, mid.x);
    const camDir = new THREE.Vector3(0, -1, 0).multiplyScalar(TUNE.cy).add(mid.clone().multiplyScalar(-TUNE.cm)).normalize();
    const freeW = W - st.inset.l - st.inset.r, freeH = H - st.inset.t - st.inset.b;
    const homeDist = TUNE.d * (freeW < 600 ? 1.8 : clamp(450 / Math.max(1, freeH), .74, 1));
    const home = { pos: camDir.clone().multiplyScalar(homeDist).add(mid.clone().multiplyScalar(TUNE.shift)), look: camDir.clone().negate(), up: mid.clone().multiplyScalar(TUNE.um).add(new THREE.Vector3(0, 1, 0)).normalize(), fov: 30 };
    // make "up" perpendicular to the look direction
    home.up.sub(home.look.clone().multiplyScalar(home.up.dot(home.look))).normalize();
    void side;
    const polar = { pos: new THREE.Vector3(0, -2.0, 0), look: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(1, 0, 0), fov: 30 };
    const fromEarth = { pos: E.clone().multiplyScalar(6), look: E.clone().negate(), up: new THREE.Vector3(0, 1, 0), fov: 30 };
    const fromSun = { pos: S.clone().multiplyScalar(6), look: S.clone().negate(), up: new THREE.Vector3(0, 1, 0), fov: 30 };
    const out = { home, polar, fromEarth, fromSun };
    if (st.site) {
      const sa = azElOfScene(S), ea = azElOfScene(E);
      out.follow = { pos: st.siteUp.clone().multiplyScalar(4.2), look: st.siteUp.clone().negate(), up: frameOf(st.siteUp).n.clone(), fov: 30 };
      const mAz = Math.atan2(Math.sin(sa.az * D2R) + Math.sin(ea.az * D2R), Math.cos(sa.az * D2R) + Math.cos(ea.az * D2R)) / D2R;
      out.terrain = sitePoseLocal(mAz + 180 + 25, 22, 19000 / R_MOON_M);
      out.eye = eyePose(ea.az, 1.2, 26);
      out.siteSun = sa; out.siteEarth = ea;
    }
    return out;
  }
  function azElOfScene(d) {
    const B = basis(st.site.lat, st.site.lon), m = [d.x, -d.z, d.y];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return { az: ((Math.atan2(dot(m, B.e), dot(m, B.n)) / D2R) % 360 + 360) % 360, el: Math.asin(clamp(dot(m, B.u), -1, 1)) / D2R };
  }
  function eyePose(az, el, fov) {
    const B = basis(st.site.lat, st.site.lon);
    const h = (terr && terr.site === st.site ? 2 * (terr.exag || 1) + 2 : 2) / R_MOON_M;
    const pos = st.siteP.clone().add(st.siteUp.clone().multiplyScalar(h));
    const look = V(toScene([0, 1, 2].map(i => Math.cos(el * D2R) * (Math.cos(az * D2R) * B.n[i] + Math.sin(az * D2R) * B.e[i]) + Math.sin(el * D2R) * B.u[i])));
    return { pos, look, up: st.siteUp.clone(), fov };
  }

  /* orbit, zoom and look-around, by mode */
  const ctl = { dragging: false, x: 0, y: 0, eye: { az: 0, el: 1.2 } };
  function orbit(dx, dy) {
    stopTween();
    if (st.mode === 'system') {
      const p = camera.position.clone(), r = p.length();
      const yaw = -dx * .005, pitch = -dy * .005;
      p.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const right = new THREE.Vector3().crossVectors(camera.up, p).normalize();
      const p2 = p.clone().applyAxisAngle(right, pitch);
      if (Math.abs(p2.clone().normalize().y) < .985) p.copy(p2);
      camera.position.copy(p.setLength(r));
      // keep the user's roll: re-derive up from the view
      const look = p.clone().negate().normalize();
      const upHint = ctl.upHint || new THREE.Vector3(0, 1, 0);
      upHint.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const up = upHint.clone().sub(look.clone().multiplyScalar(upHint.dot(look))); if (up.lengthSq() < 1e-6) up.set(0, 0, 1); up.normalize();
      ctl.upHint = up.clone();
      camera.up.copy(up); camera.lookAt(0, 0, 0);
    } else if (st.mode === 'terrain') {
      const rel = camera.position.clone().sub(st.siteP), r = rel.length();
      const F = frameOf(st.siteUp);
      let el = Math.asin(clamp(rel.clone().normalize().dot(st.siteUp), -1, 1)) / D2R;
      let az = Math.atan2(rel.dot(F.e), rel.dot(F.n)) / D2R;
      az -= dx * .3; el = clamp(el + dy * .2, 6, 85);
      const d = F.n.clone().multiplyScalar(Math.cos(el * D2R) * Math.cos(az * D2R)).add(F.e.clone().multiplyScalar(Math.cos(el * D2R) * Math.sin(az * D2R))).add(st.siteUp.clone().multiplyScalar(Math.sin(el * D2R)));
      camera.position.copy(st.siteP).add(d.multiplyScalar(r)); camera.up.copy(st.siteUp); camera.lookAt(st.siteP);
    } else if (st.mode === 'eye') {
      const F = frameOf(st.siteUp), look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      let el = Math.asin(clamp(look.dot(st.siteUp), -1, 1)) / D2R, az = Math.atan2(look.dot(F.e), look.dot(F.n)) / D2R;
      const k = camera.fov / 60;
      az -= dx * .12 * k; el = clamp(el + dy * .08 * k, -20, 60);
      const d = F.n.clone().multiplyScalar(Math.cos(el * D2R) * Math.cos(az * D2R)).add(F.e.clone().multiplyScalar(Math.cos(el * D2R) * Math.sin(az * D2R))).add(st.siteUp.clone().multiplyScalar(Math.sin(el * D2R)));
      camera.up.copy(st.siteUp); camera.lookAt(camera.position.clone().add(d));
    }
    invalidate();
  }
  function zoom(f) {
    stopTween();
    if (st.mode === 'system') {
      const r = camera.position.length(), alt = r - 1;
      const maxAlt = st.trueScale > .5 ? 600 : 40;
      const na = clamp(alt * f, .035, maxAlt);
      camera.position.setLength(1 + na);
    } else if (st.mode === 'terrain') {
      const rel = camera.position.clone().sub(st.siteP), r = clamp(rel.length() * f, 1800 / R_MOON_M, 90000 / R_MOON_M);
      camera.position.copy(st.siteP).add(rel.setLength(r));
    } else if (st.mode === 'eye') {
      camera.fov = clamp(camera.fov * f, 8, 75); updateProj();
    }
    invalidate();
  }
  canvas.addEventListener('pointerdown', e => { if (st.mode === 'polar') return; ctl.dragging = true; ctl.x = e.clientX; ctl.y = e.clientY; canvas.setPointerCapture(e.pointerId); ctl.upHint = camera.up.clone(); stopTween(); opt.onInteract && opt.onInteract(); });
  canvas.addEventListener('pointermove', e => { if (!ctl.dragging) return; const dx = e.clientX - ctl.x, dy = e.clientY - ctl.y; ctl.x = e.clientX; ctl.y = e.clientY; orbit(dx, dy); });
  const endDrag = () => { ctl.dragging = false; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => { if (st.mode === 'polar') return; e.preventDefault(); opt.onInteract && opt.onInteract(); zoom(Math.exp(e.deltaY * .0012)); }, { passive: false });

  /* projection with the principal point moved to the centre of the free space between panels */
  function updateProj() {
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const cx = (st.inset.l + (W - st.inset.r)) / 2, cy = (st.inset.t + (H - st.inset.b)) / 2;
    const P = camera.projectionMatrix.elements;
    P[8] = -2 * (cx - W / 2) / W;   // move the principal point to the free space's centre
    P[9] = 2 * (cy - H / 2) / H;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  let insetTween = null;
  function setInsets(ins, ms = 0) {
    if (ms <= 0) { st.inset = { ...ins }; updateProj(); invalidate(); return; }
    insetTween = { from: { ...st.inset }, to: { ...ins }, t0: performance.now(), ms }; invalidate();
  }
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false); updateProj(); invalidate();
  }
  window.addEventListener('resize', resize);

  /* render on demand; pause when hidden */
  let needs = true, running = false, playing = false, frameCb = null, lastFrame = 0;
  const frameTimes = [];
  function invalidate() { needs = true; if (!running && !document.hidden) { running = true; requestAnimationFrame(loop); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
  function loop(now) {
    if (document.hidden) { running = false; return; }
    let active = false;
    if (tween) {
      const t = clamp((now - tween.t0) / tween.ms, 0, 1), e = easeInOut(t);
      applyPose(lerpPose(tween.from, tween.to, e));
      tween.onT && tween.onT(e);
      if (t >= 1) { const done = tween.onDone; tween = null; done && done(); } else active = true;
    }
    if (insetTween) {
      const t = clamp((now - insetTween.t0) / insetTween.ms, 0, 1), e = 1 - Math.pow(1 - t, 3);
      for (const k of ['l', 'r', 't', 'b']) st.inset[k] = insetTween.from[k] + (insetTween.to[k] - insetTween.from[k]) * e;
      updateProj(); if (t >= 1) insetTween = null; else active = true;
    }
    if (playing) active = true;
    if (opt.onTick) active = opt.onTick(now) || active;
    if (needs || active) {
      layout(); renderer.render(scene, camera); needs = false;
      if (lastFrame) { frameTimes.push(now - lastFrame); if (frameTimes.length > 240) frameTimes.shift(); }
      lastFrame = now;
      frameCb && frameCb();
    }
    if (active || needs || ctl.dragging) requestAnimationFrame(loop); else { running = false; lastFrame = 0; }
  }

  /* textures: 2K first, then 4K (or 8K) */
  let texState = { moon: '2k' };
  async function loadTextures(which = '4k') {
    const [m2, h, cap, core, e2, capN, coreN] = await Promise.all([tex('assets/moon_2k.webp'), tex('assets/moon_height_1440.png', false), tex('assets/hillshade_4k.webp', false).then(capTex), tex('assets/hillshade_core_2048.webp', false).then(capTex), tex('assets/earth_2k.jpg'), tex('assets/cap_slope.webp', false).then(capTex), tex('assets/cap_slope_core.webp', false).then(capTex)]);
    if (capN && coreN) { moonU.uCapN.value = capN; moonU.uCoreN.value = coreN; }
    if (m2) { moonU.uMap.value = m2; moonU.uLoaded.value = st.forceGrey ? 0 : 1; }
    if (h) moonU.uH.value = h;
    if (cap && core) { moonU.uCap.value = cap; moonU.uCore.value = core; moonU.uCapLoaded.value = st.forceGrey ? 0 : 1; }
    if (e2) { earthU.uMap.value = e2; earthU.uLoaded.value = st.forceGrey ? 0 : 1; }
    st.loaded = { m2, cap, e2 };
    invalidate();
    await setMoonRes(which);
  }
  const hiRes = {};
  async function setMoonRes(which) {
    if (which === '8k') {
      hiRes.w = hiRes.w || await tex('assets/moon_8k_w.webp'); hiRes.e = hiRes.e || await tex('assets/moon_8k_e.webp');
      for (const t of [hiRes.w, hiRes.e]) if (t) t.wrapS = THREE.ClampToEdgeWrapping;
      if (hiRes.w && hiRes.e) { moonU.uMap.value = hiRes.w; moonU.uMapE.value = hiRes.e; moonU.uSplit.value = 1; }
    } else {
      hiRes.m4 = hiRes.m4 || await tex('assets/moon_4k.webp');
      if (hiRes.m4) { moonU.uMap.value = hiRes.m4; moonU.uSplit.value = 0; }
    }
    terrU.uMap.value = moonU.uMap.value;
    texState.moon = which; invalidate();
  }
  function forceGrey(on) {
    st.forceGrey = on;
    moonU.uLoaded.value = on ? 0 : 1; moonU.uCapLoaded.value = on ? 0 : (st.loaded && st.loaded.cap ? 1 : 0);
    earthU.uLoaded.value = on ? 0 : 1; invalidate();
  }

  /* screen-space helpers for the overlays */
  const tmp = new THREE.Vector3();
  function project(v) {
    tmp.copy(v).project(camera);
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, front: tmp.z < 1 && tmp.z > -1 };
  }
  function facing(p) { // a surface point faces the camera
    const n = p.clone().normalize(); return n.dot(camera.position.clone().sub(p)) > 0;
  }
  function surfPoint(lat, lon, h = 0) { return V(toScene(unit(lat, lon))).multiplyScalar(1 + h / R_MOON_M); }

  /* luminance under each panel, for the see-through option */
  const probeRT = new THREE.WebGLRenderTarget(160, 100); probeRT.texture.colorSpace = THREE.SRGBColorSpace;
  const probeBuf = new Uint8Array(160 * 100 * 4);
  function probe(rects) {
    layout(); renderer.setRenderTarget(probeRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(probeRT, 0, 0, 160, 100, probeBuf);
    return rects.map(r => {
      let mx = 0;
      const x0 = Math.max(0, Math.floor(r.left / W * 160)), x1 = Math.min(159, Math.ceil(r.right / W * 160));
      const y0 = Math.max(0, Math.floor(r.top / H * 100)), y1 = Math.min(99, Math.ceil(r.bottom / H * 100));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = ((99 - y) * 160 + x) * 4, L = .2126 * probeBuf[k] + .7152 * probeBuf[k + 1] + .0722 * probeBuf[k + 2];
        if (L > mx) mx = L;
      }
      return mx;
    });
  }

  function bench(ms = 4000) {
    return new Promise(res => {
      const t0 = performance.now(); let n = 0; const ft = [];
      let last = t0;
      function f(now) {
        orbit(1.2, 0); n++; ft.push(now - last); last = now;
        if (now - t0 < ms) requestAnimationFrame(f);
        else { ft.sort((a, b) => a - b); res({ fps: +(n / ((now - t0) / 1000)).toFixed(1), p50: +ft[Math.floor(ft.length / 2)].toFixed(1), p95: +ft[Math.floor(ft.length * .95)].toFixed(1), frames: n }); }
      }
      requestAnimationFrame(f);
    });
  }
  const glInfo = () => { const g = renderer.getContext(), ext = g.getExtension('WEBGL_debug_renderer_info'); return ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); };

  resize();
  return {
    THREE, TUNE, renderer, scene, camera, st, moonU, terrU,
    setBodies, setSite, setSight, setGround, flyTo, stopTween, poses, applyPose, pose, setInsets, invalidate, project, facing, surfPoint,
    setMode(m) { st.mode = m; invalidate(); }, orbit, zoom, setTrueScale(v) { st.trueScale = v; invalidate(); },
    setDraw(v) { moonU.uDraw.value = v; invalidate(); }, setPlaying(p) { playing = p; invalidate(); },
    onFrame(cb) { frameCb = cb; }, loadTextures, setMoonRes, forceGrey, probe, bench, glInfo, frameTimes, resize,
    get tweening() { return !!tween; }, get size() { return { W, H }; }, eyePose, sitePoseLocal, azElOfScene,
    setColourMode(m) { terrU.uMode.value = m; invalidate(); },
    get terr() { return terr; },
  };
}

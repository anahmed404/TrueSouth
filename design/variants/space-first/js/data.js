/* Mock data for the space-first prototype.
   The Connecting Ridge series is the same invented series as every C2 page (see
   mission-shell/c2). Sun and Earth directions for the whole scene are taken from it, so
   every site sees one Sun and one Earth. Statuses, scores and metrics are invented. */

export const D2R = Math.PI / 180;
export const R_MOON_M = 1737400;
export const LANDING0 = Date.UTC(2028, 2, 1); // 2028-03-01 00:00 UTC
export const WINDOW_H = 240;                   // im2_athena, 10 d

/* Every site the prototype knows. `p` holds the mock series' knobs for each site:
   sky [turn, scale, shift] of the shared skyline, rot (Sun azimuth turn), se and ee
   (Sun and Earth elevation shifts), ph (the cheap score sweep). */
export const ALL_SITES = [
  { id: 'cr',  name: 'Connecting Ridge',  ab: 'CR',  lat: -89.4555, lon: 222.6192, tier: 'core80', slope: 3.1,
    p: { sky: [0, 1, 0], rot: 0, se: 0, ee: 0, ph: [3.1, 9.0, .15] } },
  { id: 'crb', name: 'Connecting Ridge, best-lit', short: 'Best-lit variant', ab: 'CR+', lat: -89.46019, lon: 222.46341, tier: 'core80', slope: 3.6,
    variantOf: 'cr', variantM: 149, terrain: 'cr',
    p: { sky: [0, 1, -.16], rot: 0, se: 0, ee: 0, ph: [3.1, 9.0, .3] } },
  { id: 'sr',  name: 'Shackleton rim',    ab: 'SR',  lat: -89.7742, lon: 203.4952, tier: 'core80', slope: 4.2, noPatch: true,
    p: { sky: [25, .85, -.05], rot: 6, se: .3, ee: -.1, ph: [6, 10, .3] } },
  { id: 'dgr1', name: 'de Gerlache rim',  ab: 'dGR', lat: -88.6952, lon: 291.7154, tier: 'core80', slope: 5.5, noPatch: true,
    p: { sky: [215, .95, .05], rot: -6, se: .08, ee: -.4, ph: [11, 14, .2] } },
  { id: 'mal', name: 'Malapert Massif',   ab: 'Mal', lat: -85.9948, lon: 359.7642, tier: 'core80', slope: 4.6,
    p: { sky: [70, .7, -.2], rot: -12, se: .42, ee: -.3, ph: [-4, 2, .55] } },
  { id: 'mou', name: 'Mons Mouton',       ab: 'Mou', lat: -85.4266, lon: 31.7428,  tier: 'core80', slope: 2.4,
    p: { sky: [140, .8, -.3], rot: 9, se: .95, ee: -.15, ph: [7, 4, .35] } },
  { id: 'dgr', name: 'de Gerlache Rim 2', ab: 'dG2', lat: -88.2300, lon: 295.3716, tier: 'core80', slope: 6.8,
    p: { sky: [200, .9, 0], rot: -5, se: .12, ee: -.45, ph: [12, 15, .25] } },
  { id: 'a11', name: 'Apollo 11',         ab: 'A11', lat: 0.67416,  lon: 23.47314, tier: 'sphere', slope: null,
    p: { ph: [0, 0, .9] } },
];
/* The scenario's selected sites. Up to 8. Mutated in place so every importer sees the change. */
export const SITE_SETS = {
  default: ['cr', 'mal', 'mou', 'dgr', 'a11'],
  eight: ['cr', 'crb', 'sr', 'dgr1', 'dgr', 'mal', 'mou', 'a11'],
  one: ['cr'],
};
export const SITES = [];
export function setScenario(ids) { SITES.length = 0; for (const id of ids) SITES.push(ALL_SITES.find(s => s.id === id)); }
setScenario(SITE_SETS.default);
export const siteById = id => ALL_SITES.find(s => s.id === id);

/* Named features (IAU positions, data/fixtures/features.json) */
export const FEATURES = [
  ['Shackleton', -89.67, 129.78, 20.92], ['de Gerlache', -88.48, 271.66, 32.71], ['Sverdrup', -88.32, 206.61, 32.83],
  ['Shoemaker', -88.14, 45.91, 51.82], ['Slater', -88.08, 111.29, 25.12], ['Haworth', -87.45, 354.83, 51.42],
  ['Faustini', -87.18, 84.31, 42.48], ['Mons Malapert', -85.98, 358.33, 67], ['Cabeus', -85.33, 317.87, 100.58],
  ['Nobile', -85.28, 53.27, 79.27], ['Amundsen', -84.44, 83.07, 103.39], ['Wiechert', -84.03, 164.7, 40.82],
  ['Scott', -82.35, 48.52, 107.82],
];

/* ── Vectors (section 2.1). Moon-fixed (x, y, z); the scene uses (x, z, −y) (section 14). ── */
export function unit(lat, lon) {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}
export function basis(lat, lon) {
  const p = lat * D2R, l = lon * D2R;
  return {
    e: [-Math.sin(l), Math.cos(l), 0],
    n: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
    u: unit(lat, lon),
  };
}
export const toScene = v => [v[0], v[2], -v[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function dirFromAzEl(lat, lon, az, el) {
  const B = basis(lat, lon), a = az * D2R, e = el * D2R, ce = Math.cos(e);
  return [0, 1, 2].map(i => ce * Math.cos(a) * B.n[i] + ce * Math.sin(a) * B.e[i] + Math.sin(e) * B.u[i]);
}
export function azElOf(lat, lon, d) {
  const B = basis(lat, lon);
  const el = Math.asin(Math.max(-1, Math.min(1, dot(d, B.u)))) / D2R;
  const az = ((Math.atan2(dot(d, B.e), dot(d, B.n)) / D2R) % 360 + 360) % 360;
  return { az, el };
}
/* South polar stereographic, section 2.3. Returns metres. */
export function polarXY(lat, lon) {
  const r = 2 * R_MOON_M * Math.tan((45 + lat / 2) * D2R);
  return [r * Math.sin(lon * D2R), r * Math.cos(lon * D2R)];
}
export function polarLatLon(x, y) {
  const r = Math.hypot(x, y);
  return [2 * Math.atan(r / (2 * R_MOON_M)) / D2R - 90, ((Math.atan2(x, y) / D2R) % 360 + 360) % 360];
}

/* ── The mock series ── */
const P = [[0,-0.40],[12,-0.12],[25,0.35],[34,0.12],[48,0.62],[58,0.92],[66,0.50],[80,-0.25],[95,-0.95],[108,-1.25],[120,-0.62],[128,0.18],[133,0.38],[137,0.55],[140,0.95],[142.5,1.32],[146,1.02],[152,0.48],[165,0.06],[180,-0.32],[195,0.18],[210,0.62],[222,0.92],[228,1.18],[231.2,1.47],[234,1.08],[240,0.70],[248,0.62],[256,0.86],[263.6,0.90],[265.9,1.30],[267.2,0.92],[274,0.70],[282,0.25],[292,-0.50],[305,-1.05],[318,-0.70],[332,-0.18],[345,0.10],[360,-0.40]];
function base(a) {
  a = ((a % 360) + 360) % 360;
  for (let i = 0; i < P.length - 1; i++) {
    const [a0, e0] = P[i], [a1, e1] = P[i + 1];
    if (a >= a0 && a <= a1) { const t = (a - a0) / (a1 - a0); return e0 + (e1 - e0) * (1 - Math.cos(Math.PI * t)) / 2; }
  }
  return P[0][1];
}
const crSkyExact = a => { const r = a * D2R; return base(a) + 0.045 * Math.sin(r * 37) + 0.03 * Math.sin(r * 91 + 1.3) + 0.02 * Math.sin(r * 173 + .4); };
/* The shared skyline as a table every 0.01° (error under 1e-6°). Every view reads the skyline
   through sky(), so the timeline, the panorama, the panel and the Slip Planner all agree. */
const LUT_N = 36000, LUT = new Float64Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) LUT[i] = crSkyExact(i / 100);
function crSky(a) {
  a = ((a % 360) + 360) % 360; const x = a * 100, i = Math.floor(x), f = x - i;
  return LUT[i] + (LUT[i + 1] - LUT[i]) * f;
}
export function sky(siteId, a) {
  if (siteId === 'a11') return 0;
  const [rot, k, b] = siteById(siteId).p.sky;
  return crSky(a + rot) * k + b;
}
export const SUN_R = 0.2665, EARTH_R = 0.95;
const CR = SITES[0];
/* h: hours from the landing date; off: landing date offset in days from 2028-03-01 */
function crAzEl(h, off) {
  const hh = h + 24 * off, w = 2 * Math.PI * off;
  return {
    sa: (((298 - 0.5083 * hh) % 360) + 360) % 360,
    se: 0.80 + 0.0046 * h - 0.0000025 * h * h + 0.35 * Math.sin(w / 29.53),
    ea: 133 + 8 * h / 240 + 0.6 * Math.sin(2 * Math.PI * h / 327) + 8 * Math.sin(w / 27.32),
    ee: 3.399 - 0.0068 * h + 1.2 * (Math.sin(w / 27.32 + 2.6) - Math.sin(2.6)),
  };
}
/* One Sun and one Earth direction for the whole Moon (Moon-fixed unit vectors). */
export function bodies(h, off) {
  const c = crAzEl(h, off);
  return { sun: dirFromAzEl(CR.lat, CR.lon, c.sa, c.se), earth: dirFromAzEl(CR.lat, CR.lon, c.ea, c.ee) };
}
const SKY_SLACK = 0.25; // the skyline moves by under 0.17° across a Sun-sized span of azimuth (slope ≤ 0.6, span ±0.27°)
function frac(siteId, az, el, rho) {
  const c0 = el - sky(siteId, az);
  if (c0 > rho + SKY_SLACK) return 1; // every chord is wholly above the skyline
  if (c0 < -rho - SKY_SLACK) return 0; // every chord is wholly below it
  let n = 0, d = 0;
  for (let i = 0; i < 33; i++) {
    const x = -rho + (i + 0.5) * 2 * rho / 33, c = Math.sqrt(rho * rho - x * x), A = az + x / Math.max(.05, Math.cos(el * D2R));
    n += Math.min(Math.max(el + c - sky(siteId, A), 0), 2 * c); d += 2 * c;
  }
  return n / d;
}
const cache = new Map();
let cacheOn = true;
export function setSeriesCache(on) { cacheOn = on; cache.clear(); }
export function series(siteId, h, off) {
  const s = siteById(siteId), key = (ALL_SITES.indexOf(s) * 1e4 + (h + 3000)) * 1e4 + (off + 5000);
  if (cacheOn) { const c = cache.get(key); if (c) return c; }
  let sa, se, ea, ee;
  if (siteId !== 'a11') {
    // polar sites share the approved series' shape; their own skyline makes the difference
    ({ sa, se, ea, ee } = crAzEl(h, off));
    const p = s.p; sa = ((sa + p.rot) % 360 + 360) % 360; ea += p.rot / 3;
    se += p.se; ee += p.ee;
  } else {
    const b = bodies(h, off), S = azElOf(s.lat, s.lon, b.sun), E = azElOf(s.lat, s.lon, b.earth);
    sa = S.az; se = S.el; ea = E.az; ee = E.el;
  }
  const sf = se > 2 ? 1 : se < -2 ? 0 : frac(siteId, sa, se, SUN_R);
  const ec = ee - sky(siteId, ea);
  const out = { h, sa, se, sf, sc: se - sky(siteId, sa), ea, ee, ec, link: ec >= 1 };
  if (cacheOn) { if (cache.size > 40000) cache.clear(); cache.set(key, out); }
  return out;
}

/* ── Status by landing date (the Slip Planner's mock sweep) ── */
const FIXED = { cr: { 0: 'nogo', 7: 'nogo', 14: 'nogo', 21: 'go' }, mal: { 0: 'go' }, mou: { 0: 'caution' }, dgr: { 0: 'caution' } };
export const TIME_GRID = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2031, 11, 31) };
export function dayOff(ms) { return Math.round((ms - LANDING0) / 864e5); }
export function status(siteId, off) {
  const ms = LANDING0 + off * 864e5;
  if (ms + WINDOW_H * 36e5 > TIME_GRID.end || ms < TIME_GRID.start) return { st: 'none', score: 0 };
  if (FIXED[siteId] && FIXED[siteId][off]) return { st: FIXED[siteId][off], score: SCORE0[siteId][off] ?? 72 };
  const [a, b, k] = siteById(siteId).p.ph;
  if (siteId === 'a11') { // the equator's rhythm: GO while the Sun is up for the whole window
    const ph = (((off + 4) % 29.53) + 29.53) % 29.53;
    return ph < 5 ? { st: 'go', score: 92 } : ph < 6.5 ? { st: 'caution', score: 60 } : { st: 'nogo', score: 34 };
  }
  const v = Math.cos(2 * Math.PI * (off + a) / 29.53) + .7 * Math.cos(2 * Math.PI * (off + b) / 27.32) + .3 * Math.cos(2 * Math.PI * off / 206) + k;
  const score = Math.round(Math.max(0, Math.min(99, 55 + v * 22)));
  return v > .9 ? { st: 'go', score } : v > .35 ? { st: 'caution', score } : { st: 'nogo', score };
}
const SCORE0 = { cr: { 0: 51, 7: 44, 14: 38, 21: 77 }, mal: { 0: 81 }, mou: { 0: 63 }, dgr: { 0: 58 }, a11: { 0: 100 } };

/* ── Focused-site detail. Connecting Ridge on 01 Mar is the approved shell; the rest is generated. ── */
function rnd(seed) { let t = seed + 0x6D2B79F5; return () => { t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function detail(siteId, off) {
  const s = siteById(siteId), sw = status(siteId, off);
  let st = sw.st, score = sw.score;
  if (st === 'none') return { st, score: 0, broken: null, passes: [], metrics: null };
  if (siteId === 'cr' && off === 0) return {
    st, score: 51, broken: { name: 'Longest blackout', value: 31, unit: 'h', limit: 12, text: 'Earth is out of contact for 31 hours in a row from 09 Mar 17:00 UTC.' },
    passes: [['Longest dark', '4 h', 'limit 6 h'], ['Slope', '3.1°', 'limit 10°'], ['Lit at landing, disc', '1.00', 'needs 0.5']],
    metrics: { lit: 97.1, sfm: 0.96, dark: 4, link: 87.1, blackout: 31, sunLand: 0.80, slope: 3.1, util: '1.00 · 0.32 · 0.00' },
  };
  const r = rnd(off * 131 + siteId.charCodeAt(0) * 7 + siteId.charCodeAt(1));
  let dark, blackout, m;
  {
    // every window metric comes from the same series the timeline draws
    let lit = 0, sfs = 0, link = 0, cd = 0, cb = 0; dark = 0; blackout = 0;
    for (let h = 0; h < WINDOW_H; h++) {
      const q = series(siteId, h, off); sfs += q.sf;
      if (q.sf >= .5) { lit++; cd = 0; } else { cd++; dark = Math.max(dark, cd); }
      if (q.link) { link++; cb = 0; } else { cb++; blackout = Math.max(blackout, cb); }
    }
    const q0 = series(siteId, 0, off);
    m = { lit: +(lit / WINDOW_H * 100).toFixed(1), sfm: +(sfs / WINDOW_H).toFixed(2), dark, link: +(link / WINDOW_H * 100).toFixed(1), blackout, sunLand: +q0.se.toFixed(2), slope: s.slope,
      sunLit0: q0.sf,
      util: [1, .2 + r() * .8, .1 + r() * .9].map(x => x.toFixed(2)).join(' · ') };
  }
  // a broken limit always wins; otherwise the sweep's GO or CAUTION stands
  if (dark > 6 || blackout > 12) st = 'nogo';
  else if (st === 'nogo') { st = 'caution'; score = Math.min(score, 66); }
  const passes = [];
  let broken = null;
  if (st === 'nogo' && dark > 6) broken = { name: 'Longest dark', value: dark, unit: 'h', limit: 6, text: `The Sun is blocked for ${dark} hours in a row.` };
  else if (st === 'nogo') broken = { name: 'Longest blackout', value: blackout, unit: 'h', limit: 12, text: `Earth is out of contact for ${blackout} hours in a row.` };
  if (!broken || broken.name !== 'Longest dark') passes.push(['Longest dark', `${dark} h`, 'limit 6 h']);
  if (!broken || broken.name !== 'Longest blackout') passes.push(['Longest blackout', `${blackout} h`, 'limit 12 h']);
  if (m.slope != null) passes.push(['Slope', `${m.slope}°`, 'limit 10°']);
  passes.push(['Lit at landing, disc', '1.00', 'needs 0.5']);
  return { st, score: st === 'nogo' ? score : score, broken, passes: passes.slice(0, 3), metrics: m };
}

/* ── Formatting ── */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const pad = n => String(n).padStart(2, '0');
export function fmtDay(ms) { const d = new Date(ms); return `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]}`; }
export function fmtDayY(ms) { const d = new Date(ms); return `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
export function fmtISO(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
export function fmtHour(ms) { const d = new Date(ms); return `${pad(d.getUTCHours())}:00`; }
export const MONTHS = MON;
export const minus = s => String(s).replace(/-/g, '−');
export const STATUS_WORD = { go: 'GO', caution: 'CAUTION', nogo: 'NO-GO', none: 'No data' };

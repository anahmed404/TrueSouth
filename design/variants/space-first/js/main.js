/* Space-first Mission Control: wiring. One clock (hour + landing offset) drives every view. */
import { SITES, siteById, series, bodies, detail, status, LANDING0, WINDOW_H, FEATURES, polarXY, polarLatLon, fmtISO, fmtDayY, fmtDay, STATUS_WORD, minus, R_MOON_M, unit, toScene } from './data.js';
import { createScene, easeInOut } from './scene.js';
import { createMap } from './polar.js';
import { readColors, C, drawTimeline, countdowns, dur, drawPanorama, drawHeat, compareTable, H0, H1, longest } from './charts.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const root = document.documentElement;
readColors();
const phone = matchMedia('(max-width:700px)');
const sysReduce = matchMedia('(prefers-reduced-motion: reduce)');

const S = {
  view: 'system', win: null, focus: 'cr', off: 0, hour: 63, playing: false, speed: 1,
  col: { l: false, r: false, t: false }, opt: { surface: 'solid', pole: 'flight', tex: '4k', motion: 'full', state: 'live' },
  preset: 'home', trueScale: false, colour: 0, exag: 1, centre: 'earth', overlay: 'none', opacity: .7, names: true, chart: true, slipSpan: 548, slipFrom: null,
};
try { const c = JSON.parse(localStorage.getItem('ts-space-col') || 'null'); if (c) S.col = c; } catch (e) { /* storage blocked */ }
const reduced = () => S.opt.motion === 'reduce' || sysReduce.matches;
const absMs = () => LANDING0 + S.off * 864e5 + S.hour * 36e5;
const lampHTML = st => `<span class="lamp ${st}"><svg><use href="#g-${st === 'none' ? 'none' : st}"/></svg></span>`;
const statusHTML = st => `<span class="status ${st}">${lampHTML(st)}${STATUS_WORD[st]}</span>`;

/* ── layout: where the free space for the scene is ── */
function insets() {
  const W = innerWidth, H = innerHeight, gap = phone.matches ? 8 : 16;
  if (phone.matches) return { l: 0, r: 0, t: 8 + 44 + 8 + 52 + 8 + 66, b: 74 + 8 + 104 + 72 + 60, W, H };
  const l = gap + (S.col.l ? 48 : 256) + gap, r = gap + (S.col.r ? 48 : 328) + gap;
  const tlH = S.col.t ? 52 : 196, tlB = 20 + gap + tlH;
  return { l, r, t: 12 + 44 + gap + 44 + 8 + 30, b: tlB + gap + 48, W, H, tlB };
}
function applyLayout(animate = true) {
  const i = insets(), gap = phone.matches ? 8 : 16;
  root.style.setProperty('--col-l', i.l + 'px'); root.style.setProperty('--col-r', i.r + 'px');
  root.style.setProperty('--tl-b', (i.tlB || 0) + 'px');
  root.style.setProperty('--side-b', ((i.tlB || 0) + gap) + 'px');
  $('#rail').classList.toggle('collapsed', S.col.l && !phone.matches);
  $('#focus').classList.toggle('collapsed', S.col.r && !phone.matches);
  $('#strip').classList.toggle('collapsed', S.col.t && !phone.matches);
  $('#tgl-l').setAttribute('aria-expanded', !S.col.l); $('#tgl-r').setAttribute('aria-expanded', !S.col.r); $('#tgl-t').setAttribute('aria-expanded', !S.col.t);
  $('#tgl-t').innerHTML = `<svg class="i"><use href="#i-${S.col.t ? 'up' : 'down'}"/></svg>`;
  $('#tgl-t').setAttribute('aria-label', S.col.t ? 'Open the timeline' : 'Fold the timeline');
  const ins = sceneInsets(i);
  scene && scene.setInsets(ins, animate && !reduced() ? 200 : 0);
  map && map.setInsets(ins);
  try { localStorage.setItem('ts-space-col', JSON.stringify(S.col)); } catch (e) { /* storage blocked */ }
  setTimeout(() => { renderTimeline(); if (scene && S.view === 'system' && S.preset === 'home' && !S.trueScale && !scene.tweening) scene.flyTo(scene.poses().home, reduced() ? 0 : 450, buildOverlay); }, animate ? 210 : 0);
  schedProbe();
}

function sceneInsets(i = insets()) {
  const ins = { l: i.l, r: i.r, t: i.t, b: i.b };
  const pc = document.querySelector('.pcard');
  if (S.view === 'eye' && pc && pc.offsetParent) ins.b = i.H - pc.getBoundingClientRect().top + 8;
  return ins;
}
/* ── the scene ── */
const stage = $('#stage');
let scene = null, map = null;
try {
  scene = createScene($('#gl'), { onInteract: () => { S.preset = null; renderControls(); }, onTick });
} catch (e) { console.warn('WebGL failed', e); scene = null; }
if (!scene) showStill('This device could not start 3D, so this is a still picture of the System view.');
if (!scene) setTimeout(() => map.load(), 1500);
map = createMap($('#map'), {
  colors: { space: '#0b0b0c', sun: [255, 226, 160], earth: [108, 196, 255] }, features: FEATURES,
  pins: () => SITES.filter(p => p.tier !== 'sphere').map(p => polarXY(p.lat, p.lon)),
  onDraw: () => { if (S.view === 'polar') drawOverlay(); },
  onHover: m => { if (S.view !== 'polar') return; const [la, lo] = polarLatLon(m.x, m.y); const v = S.overlay !== 'none' ? map.lookup(S.overlay, m.x, m.y) : null;
    const t = $('#hover-read'); if (t) t.textContent = `${minus(la.toFixed(4))}°, ${lo.toFixed(4)}° E${v != null ? ` · ${S.overlay === 'sun' ? 'average sunlight' : 'Earth visible'} ${Math.round(v * 100)} %` : ''}`; },
  onClick: (m, e) => openPop(m, e),
});

function updateBodies() {
  if (!scene) return;
  const b = bodies(S.hour, S.off);
  scene.setBodies(b.sun, b.earth, S.hour + 24 * S.off);
  const s = series(S.focus, S.hour, S.off);
  scene.setSight({ sun: s.sf >= .5, earth: s.link });
}

/* ── views ── */
const SENT = {
  system: () => 'A 3D model of the Moon, Earth and Sun at the current time, showing where your site is, where daylight falls and which way Earth lies.',
  polar: () => 'A flat map of the Moon\'s south pole seen from straight above, where you choose sites and see how much a small move changes them.',
  terrain: s => s.tier === 'sphere' ? `No terrain data for ${s.name}. It is far from the pole, so TrueSouth treats the ground there as a smooth sphere.` : `The ground for 10 km on every side of ${s.name}, set in the land around it and lit by the Sun as it is at the current time.`,
  eye: s => s.tier === 'sphere' ? `No terrain data for ${s.name}, so its horizon is flat: the Moon there is a smooth sphere.` : `What you would see standing at ${s.name} and turning in a full circle: the horizon, with the Sun and Earth at their real height above it.`,
};
function go(view, opts = {}) {
  const prev = S.view; S.view = view;
  $$('.vt[data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view === view));
  renderSentence(); renderControls(); renderPcard();
  $('#mapctl').hidden = view !== 'polar'; $('#scalebar').hidden = view !== 'polar';
  closePop();
  const site = siteById(S.focus), sphere = site.tier === 'sphere';
  if (!scene) { buildOverlay(); return; }
  const P = scene.poses();
  let target, ms;
  if (view === 'system') { target = S.trueScale ? truePose() : (S.preset && S.preset !== 'home' ? P[S.preset] : P.home) || P.home; ms = 1300; }
  else if (view === 'polar') { target = P.polar; ms = 1300; }
  else if (view === 'terrain') { target = sphere ? P.follow : P.terrain; ms = 1500; }
  else if (view === 'eye') { target = sphere ? P.follow : scene.eyePose(centreAz(), 2.2, 26); ms = 1300; }
  if (opts.instant) ms = 0;
  const modeFor = v => (v === 'terrain' || v === 'eye') && sphere ? 'system' : v;
  const toMap = view === 'polar', fromMap = prev === 'polar' && view !== 'polar';
  scene.setMode(view === 'polar' ? 'polar' : 'system');
  buildOverlay();
  const done = () => { scene.setMode(modeFor(view)); buildOverlay(); if (toMap) showMap(); schedProbe(); };
  if (fromMap) {
    // leave the flat map: put the globe exactly under it, then move
    const pz = poleFromMap(); scene.applyPose(pz); scene.setDraw(1); stage.dataset.layer = 'gl';
    if (S.opt.pole === 'fade' || reduced()) { scene.setDraw(0); scene.flyTo(target, 0, done); return; }
    scene.flyTo(target, ms, done, t => scene.setDraw(1 - smooth01(0, .45, t)));
    return;
  }
  if (toMap && (S.opt.pole === 'fade' || reduced() || ms === 0)) {
    // cross-fade: the map fades in over the globe, then the camera is set under it
    $('#map').style.transitionDuration = reduced() ? '120ms' : '400ms';
    showMap(); scene.flyTo(target, 0, () => { scene.setDraw(1); done(); }); return;
  }
  if (reduced() && ms > 0) { dip(() => scene.flyTo(target, 0, done)); return; }
  scene.flyTo(target, ms, done, toMap ? (t => scene.setDraw(smooth01(.55, 1, t))) : (prev === 'polar' ? null : (t => scene.setDraw(0))));
}
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function dip(fn) { const d = $('#dip'); d.classList.add('on'); setTimeout(() => { fn(); requestAnimationFrame(() => d.classList.remove('on')); }, 130); }
function showMap() {
  map.load().then(() => map.draw());
  // match the flat map to what the globe shows at the pole pose
  const { W, H } = scene ? scene.size : { W: innerWidth, H: innerHeight };
  if (scene) {
    const cam = scene.camera, alt = -cam.position.y - 1;
    const k = (H / 2) / Math.tan(cam.fov * Math.PI / 360);
    map.setView(-cam.position.z * R_MOON_M, cam.position.x * R_MOON_M, k / (alt * R_MOON_M));
  } else map.fit();
  stage.dataset.layer = 'map';
  setTimeout(() => { $('#map').style.transitionDuration = ''; }, 450);
  drawOverlay();
}
function poleFromMap() {
  const { H } = scene.size, cam = scene.camera, k = (H / 2) / Math.tan(30 * Math.PI / 360);
  const alt = k / (map.v.s * R_MOON_M);
  const T = scene.THREE;
  return { pos: new T.Vector3(map.v.cy / R_MOON_M, -(1 + alt), -map.v.cx / R_MOON_M), look: new T.Vector3(0, 1, 0), up: new T.Vector3(1, 0, 0), fov: 30 };
  void cam;
}
function truePose() {
  const T = scene.THREE, E = scene.st.earthDir.clone(), mid = E.clone().multiplyScalar(110);
  const perp = new T.Vector3(0, 1, 0).cross(E).normalize().add(new T.Vector3(0, -.35, 0)).normalize();
  const pos = mid.clone().add(perp.multiplyScalar(430));
  return { pos, look: mid.clone().sub(pos).normalize(), up: new T.Vector3(0, 1, 0), fov: 30 };
}
function centreAz() { const s = series(S.focus, S.hour, S.off); return S.centre === 'sun' ? s.sa : S.centre === 'north' ? 0 : s.ea; }

/* ── the view's sentence and controls ── */
function renderSentence() { $('#what').textContent = SENT[S.view](siteById(S.focus)); }
function segHTML(name, items, cur) { return `<span class="mseg" data-seg="${name}" role="group">${items.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join('')}</span>`; }
function renderControls() {
  const el = $('#vctl'), site = siteById(S.focus), sphere = site.tier === 'sphere';
  let h = '';
  if (S.view === 'system') {
    h += S.trueScale ? '<span class="honest">True scale: Earth is 384,400 km away.</span>' : '<span class="honest">Distances not to scale. Every direction is true.</span>';
    h += segHTML('preset', [['home', 'South pole'], ['fromEarth', 'From Earth'], ['fromSun', 'From the Sun'], ['follow', 'Follow site']], S.preset);
    h += `<button class="toggle" data-act="true" aria-pressed="${S.trueScale}"><i></i>True scale</button>`;
  } else if (S.view === 'polar') {
    h += '<span class="lbl">Overlay</span>' + segHTML('overlay', [['none', 'None'], ['sun', 'Average sunlight'], ['earth', 'Earth visibility']], S.overlay);
    if (S.overlay !== 'none') h += `<input type="range" min="0.2" max="1" step="0.05" value="${S.opacity}" aria-label="Overlay opacity" data-act="opacity">`;
    h += `<button class="toggle" data-act="names" aria-pressed="${S.names}"><i></i>Feature names</button>`;
    h += `<span class="lbl" id="hover-read" style="min-width:16ch">Point at the map for latitude and longitude</span>`;
  } else if (S.view === 'terrain') {
    if (sphere) h += `<button class="btn" data-act="tosystem">Show ${site.name} in the System view</button>`;
    else {
      h += '<span class="lbl">Colour</span>' + segHTML('colour', [[0, 'Regolith'], [1, 'Slope'], [2, 'Height']], S.colour);
      h += '<span class="lbl">Heights</span>' + segHTML('exag', [[1, '×1'], [2, '×2'], [5, '×5']], S.exag);
      h += `<span>${S.exag === 1 ? 'true to scale' : 'shadows not to scale'}</span>`;
      h += `<button class="btn" data-act="toeye"><svg class="i"><use href="#i-eye"/></svg>Lander's eye</button>`;
    }
  } else if (S.view === 'eye') {
    if (sphere) h += `<button class="btn" data-act="tosystem">Show ${site.name} in the System view</button>`;
    else if (!S.chart) h += eyeCtl();
  }
  el.innerHTML = h;
}
$('#bot-c').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const seg = b.closest('[data-seg]');
  if (seg) {
    const v = b.dataset.v, k = seg.dataset.seg;
    if (k === 'preset') { S.preset = v; S.trueScale = false; scene && scene.setTrueScale(0); go('system'); }
    if (k === 'overlay') { S.overlay = v; map.setOverlay(v); renderControls(); }
    if (k === 'colour') { S.colour = +v; scene && scene.setColourMode(+v); renderControls(); }
    if (k === 'exag') { S.exag = +v; renderControls(); if (scene) scene.setGround(siteById(S.focus), S.exag).then(buildOverlay); }
    if (k === 'centre') { S.centre = v; renderControls(); renderPcard(); scene && scene.flyTo(scene.eyePose(centreAz(), 2.2, scene.camera.fov), reduced() ? 0 : 700); }
    return;
  }
  const a = b.dataset.act;
  if (a === 'true') { S.trueScale = !S.trueScale; renderControls(); animTrueScale(); }
  if (a === 'names') { S.names = !S.names; map.setNames(S.names); renderControls(); }
  if (a === 'toeye') go('eye');
  if (a === 'tosystem') { S.preset = 'follow'; go('system'); }
  if (a === 'chart') { S.chart = !S.chart; renderControls(); renderPcard(); (document.querySelector('[data-act="chart"]') || {}).focus?.(); }
});
$('#bot-c').addEventListener('input', e => { if (e.target.dataset.act === 'opacity') { S.opacity = +e.target.value; map.setOpacity(S.opacity); } });
function animTrueScale() {
  if (!scene) return;
  const from = scene.st.trueScale, to = S.trueScale ? 1 : 0, t0 = performance.now(), ms = reduced() ? 0 : 1300;
  const target = S.trueScale ? truePose() : scene.poses().home;
  scene.flyTo(target, ms, buildOverlay, e => scene.setTrueScale(from + (to - from) * e));
  if (!ms) scene.setTrueScale(to);
  void t0;
}

const eyeCtl = () => '<span class="lbl">Centre on</span>' + segHTML('centre', [['earth', 'Earth'], ['sun', 'Sun'], ['north', 'North']], S.centre) +
  `<button class="toggle" data-act="chart" aria-pressed="${S.chart}"><i></i>Horizon chart, heights ×12</button>`;
/* ── Lander's eye chart card ── */
function renderPcard() {
  const slot = $('#pcard-slot'), site = siteById(S.focus);
  if (S.view !== 'eye' || !S.chart || site.tier === 'sphere') { slot.innerHTML = ''; scene && scene.setInsets(sceneInsets(), 0); return; }
  const s = series(S.focus, S.hour, S.off);
  slot.innerHTML = `<div class="panel pcard"><div class="vctl pc-ctl">${eyeCtl()}</div><svg class="pano" role="img" aria-label="Horizon chart for ${site.name}, heights stretched 12 times"></svg>
    <div class="why" id="why"></div>
    <div class="legend"><span><i class="sw"></i>Sun's path, one dot a day</span><span><i class="sw e"></i>Earth's path</span><span>A disc's faded part is below the skyline</span></div></div>`;
  drawPanorama(slot.querySelector('svg'), { site: S.focus, hour: S.hour, off: S.off, centre: S.centre });
  requestAnimationFrame(() => scene && scene.setInsets(sceneInsets(), 0));
  const why = slot.querySelector('#why');
  if (s.sf < .5) why.innerHTML = `<svg class="i" viewBox="0 0 24 24" style="flex:none;align-self:center"><use href="#i-sun"/></svg><span><b>Why is it dark?</b> Sun is ${s.se.toFixed(2)}° up. The skyline in that direction rises to ${(s.se - s.sc).toFixed(2)}°${S.focus === 'cr' ? ', 12.4 km away, near de Gerlache' : ''}. Blocked by terrain.</span>`;
  else why.innerHTML = `<svg class="i" viewBox="0 0 24 24" style="flex:none;align-self:center"><use href="#i-sun"/></svg><span><b>Lit.</b> ${Math.round(s.sf * 100)} % of the Sun's disc is above the skyline.</span>`;
  schedProbe();
}

/* ── panels ── */
function renderRail() {
  $('#rail-sub').textContent = `Status if landing ${fmtISO(LANDING0 + S.off * 864e5).slice(0, 16)} UTC`;
  $('#sites').innerHTML = SITES.map(s => {
    const d = detail(s.id, S.off), fact = d.broken ? `${d.broken.name === 'Longest blackout' ? 'Blackout' : 'Dark'} ${d.broken.value} h` : `Score ${d.score}`;
    return `<li><button class="site" data-site="${s.id}" aria-current="${s.id === S.focus}"><span class="nm">${s.name}</span><span class="ln">${statusHTML(d.st)}${fact}</span>${s.tier === 'sphere' ? '<span class="ln lbl">Terrain not modelled</span>' : ''}</button></li>`;
  }).join('');
  $('#rail-mini').innerHTML = SITES.map(s => `<button data-site="${s.id}" aria-current="${s.id === S.focus}" aria-label="${s.name}, ${STATUS_WORD[detail(s.id, S.off).st]}" title="${s.name}">${lampHTML(detail(s.id, S.off).st)}</button>`).join('') +
    '<button aria-label="Add site" title="Add site"><svg class="i"><use href="#i-plus"/></svg></button>';
}
function renderFocus() {
  const s = siteById(S.focus), d = detail(S.focus, S.off), sphere = s.tier === 'sphere';
  $('#f-h').innerHTML = `<h2>${s.name}</h2><p class="coords">${minus(s.lat.toFixed(4))}°, ${s.lon.toFixed(4)}° E · ${sphere ? 'sphere, no terrain' : s.tier + ' terrain'}</p><p class="sum" style="display:none">${statusHTML(d.st)}<span>${d.broken ? `${d.broken.name} ${d.broken.value} h, limit ${d.broken.limit} h` : 'Score ' + d.score}</span></p>`;
  const verdict = d.st === 'nogo' ? `One rule is broken, so this landing date fails. Score <s>${d.score}</s> is not used.` : d.st === 'caution' ? `Every rule passes, but the score is ${d.score}, under the 70 needed for GO.` : `Every rule passes. Score ${d.score}.`;
  let h = `<div class="verdict" role="status">${statusHTML(d.st)}<p>${verdict}</p></div>`;
  if (d.broken) { const b = d.broken, pct = Math.min(100, b.value / Math.max(b.value, b.limit) * 100), lim = b.limit / Math.max(b.value, b.limit) * 100;
    h += `<section><h3 class="h3">Broken rule</h3><div class="broken"><div class="row"><span class="t">${lampHTML('nogo')}${b.name}</span><span class="m">${b.value}<span class="unit">h</span></span></div>
      <p class="l">Limit ${b.limit} h <span class="tag asm">assumed</span>. ${b.text}</p><div class="meter" aria-hidden="true"><i style="width:${pct}%"></i><u style="left:${lim}%"></u></div>
      <div class="meter-k"><span>0 h</span><span style="position:relative;left:${lim - 50}%">limit ${b.limit} h</span><span>${b.value} h</span></div></div></section>`; }
  h += `<section><h3 class="h3">Rules that pass</h3><ul class="passes">${d.passes.map(p => `<li><svg viewBox="0 0 24 24"><use href="#g-go"/></svg><span>${p[0]} <b>${p[1]}</b>, ${p[2]}</span><span class="tag asm">assumed</span></li>`).join('')}
    ${sphere ? '<li class="na"><svg viewBox="0 0 24 24"><use href="#g-none"/></svg><span>Slope not assessed: terrain not modelled</span><span></span></li>' : ''}</ul></section>`;
  const m = d.metrics;
  h += `<details class="dis"><summary><svg class="i chev" viewBox="0 0 16 16"><use href="#i-chev"/></svg>Mission window metrics<small>8 values, 240 h</small></summary><dl>
    <dt>Lit</dt><dd>${m.lit} %</dd><dt>Mean Sun disc fraction</dt><dd>${m.sfm.toFixed(2)}</dd><dt>Longest dark stretch</dt><dd>${m.dark} h</dd><dt>Earth link</dt><dd>${m.link} %</dd>
    <dt>Longest blackout</dt><dd ${d.broken && d.broken.name === 'Longest blackout' ? 'style="color:var(--status-nogo)"' : ''}>${m.blackout} h</dd><dt>Sun at landing</dt><dd>${m.sunLand.toFixed(2)}°</dd>
    <dt>Slope, 100 m baseline</dt><dd>${m.slope == null ? 'not assessed' : m.slope + '°'}</dd><dt>Utilities: slope, power, comms</dt><dd>${m.util}</dd></dl></details>`;
  h += `<nav class="links" aria-label="Open this site elsewhere"><a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener">Open in Quickmap ↗</a><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">Open in Moon Trek ↗</a></nav>`;
  $('#f-body').innerHTML = h;
  const vl = d.broken ? `<b>${s.name}</b> · ${STATUS_WORD[d.st]} · ${d.broken.name} ${d.broken.value} h, limit ${d.broken.limit} h` : `<b>${s.name}</b> · ${STATUS_WORD[d.st]} · score ${d.score}`;
  $('#focus-mini').innerHTML = `${lampHTML(d.st)}<span class="vline">${vl}</span>`;
}
function renderTimeline() {
  const svg = $('#tl');
  const r = drawTimeline(svg, { site: S.focus, hour: S.hour, off: S.off, compact: phone.matches });
  svg._map = r; svg.setAttribute('aria-valuenow', S.hour); svg.setAttribute('aria-valuetext', fmtISO(absMs()) + ' UTC');
  const a = LANDING0 + S.off * 864e5;
  $('#tl-win').innerHTML = `Mission window ${fmtDay(a)} 00:00 → ${fmtDay(a + WINDOW_H * 36e5)} 00:00 UTC, 10 d <span class="tag src">sourced</span>`;
  const c = countdowns(S.focus, S.hour, S.off), s = c.s, warn = !c.lit && c.hs != null && c.hs < 6;
  { const c0 = countdowns(S.focus, S.hour, S.off), nd = new Date(absMs()), plain = h => h == null ? 'over 30 d' : (h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h`);
    $('#tl-now').innerHTML = `<b>${fmtDay(absMs())} ${String(nd.getUTCHours()).padStart(2, '0')}:00 UTC</b><span>Sun ${c0.lit ? 'sets' : 'rises'} in ${plain(c0.hs)} · Earth ${c0.s.link ? 'sets' : 'rises'} in ${plain(c0.he)}</span>`; }
  $('#cards').innerHTML = `<div class="cd ${warn ? 'warn' : ''}"><div class="hd"><svg class="i" viewBox="0 0 24 24"><use href="#i-sun"/></svg>Sun<span class="state">${c.lit ? 'Lit' : 'Dark'}</span></div>
    <div class="ev">${c.lit ? 'Sunset in' : 'Sunrise in'}</div><div class="cnt">${dur(c.hs)}</div>
    <div class="flag">${warn ? lampHTML('caution') + 'Under 6 h' : ''}</div><div class="vals"><span>Elevation<b>${s.se.toFixed(2)}°</b></span><span>Disc fraction<b>${s.sf.toFixed(2)}</b></span></div></div>
    <div class="cd"><div class="hd"><svg class="i" viewBox="0 0 24 24"><use href="#i-earth"/></svg>Earth<span class="state">${s.link ? 'Link' : 'Blackout'}</span></div>
    <div class="ev">${s.link ? 'Earthset in' : 'Earthrise in'}</div><div class="cnt">${dur(c.he)}</div><div class="flag"></div>
    <div class="vals"><span>Elevation<b>${s.ee.toFixed(2)}°</b></span><span>Clearance<b>${s.ec.toFixed(2)}°</b></span></div></div>`;
}
function renderAll() { renderRail(); renderFocus(); renderTimeline(); renderSentence(); renderControls(); renderPcard(); if (S.win) renderWin(); }

/* ── time ── */
function setHour(h) {
  S.hour = Math.max(H0, Math.min(H1 - 1, Math.round(h)));
  updateBodies(); renderTimeline(); if (S.view === 'eye') renderPcard();
  if (scene) scene.invalidate(); else buildOverlay();
}
let playAcc = 0, lastT = 0;
function onTick(now) {
  if (!S.playing) { lastT = 0; return false; }
  if (lastT) { playAcc += (now - lastT) / 1000 * S.speed; if (playAcc >= 1) { const n = Math.floor(playAcc); playAcc -= n; let h = S.hour + n; if (h >= H1 - 1) h = H0; setHour(h); } }
  lastT = now; return true;
}
const SPEEDS = [[1, '1 h per second'], [6, '6 h per second'], [24, '1 d per second']];
$('#play').addEventListener('click', () => {
  S.playing = !S.playing; $('#play').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
  $('#play-g').innerHTML = S.playing ? '<path d="M2 1h2.2v8H2zM5.8 1H8v8H5.8z"/>' : '<path d="M2 1l7 4-7 4z"/>';
  if (scene) scene.setPlaying(S.playing); else if (S.playing) stillPlay();
});
function stillPlay() { if (!S.playing) return; setHour(S.hour + 1 >= H1 - 1 ? H0 : S.hour + 1); setTimeout(stillPlay, 1000 / S.speed); }
$('#speed').addEventListener('click', () => { const i = (SPEEDS.findIndex(s => s[0] === S.speed) + 1) % SPEEDS.length; S.speed = SPEEDS[i][0]; $('#speed').textContent = SPEEDS[i][1]; });
{ // scrubbing
  const svg = $('#tl'); let drag = false;
  const at = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * svg.viewBox.baseVal.width / r.width; return svg._map.hourAt(x); };
  svg.addEventListener('pointerdown', e => { drag = true; svg.setPointerCapture(e.pointerId); setHour(at(e)); });
  svg.addEventListener('pointermove', e => { if (drag) setHour(at(e)); });
  svg.addEventListener('pointerup', () => { drag = false; schedProbe(); });
  svg.addEventListener('keydown', e => { const k = { ArrowLeft: -1, ArrowRight: 1, PageDown: -24, PageUp: 24 }[e.key]; if (k) { e.preventDefault(); setHour(S.hour + k * (e.shiftKey ? 24 : 1)); }
    if (e.key === 'Home') setHour(0); if (e.key === 'End') setHour(WINDOW_H - 1); });
}

/* ── landing date ── */
function setOff(off) {
  S.off = off; updateBodies(); renderAll();
  $('#landing').innerHTML = `<span class="d-long">${fmtISO(LANDING0 + off * 864e5)} <small>UTC</small></span><span class="d-short">${fmtDayY(LANDING0 + off * 864e5)}</span>`;
  if (scene) scene.invalidate();
}
$$('[data-slip]').forEach(b => b.addEventListener('click', () => { if (!S.slipFrom) S.slipFrom = { off: S.off }; setOff(S.off + +b.dataset.slip); }));

/* ── focus ── */
async function setFocus(id) {
  if (!id || id === S.focus && scene && scene.terr && scene.terr.site.id === id) { if (id === S.focus) return; }
  S.focus = id; const site = siteById(id);
  renderAll();
  if (scene) {
    scene.setSite(site); updateBodies();
    await scene.setGround(site, S.exag);
    scene.setSite(site);
    if (S.view !== 'system' && S.view !== 'polar') go(S.view);
    else if (S.view === 'system' && S.preset === 'follow') go('system');
    else buildOverlay();
  } else buildOverlay();
  if (S.view === 'polar') drawOverlay();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-site]'); if (b && !b.closest('.cmp')) setFocus(b.dataset.site); });

/* ── collapsing ── */
$('#tgl-l').addEventListener('click', () => { S.col.l = !S.col.l; applyLayout(); });
$('#tgl-r').addEventListener('click', () => { if (phone.matches) { $('#focus').classList.toggle('expanded'); return; } S.col.r = !S.col.r; applyLayout(); });
$('#tgl-t').addEventListener('click', () => { S.col.t = !S.col.t; applyLayout(); });

/* ── floating windows ── */
let lastOpener = null;
function openWin(k) {
  if (S.win === k) { closeWin(); return; }
  if (S.win) closeWin(false);
  S.win = k; const w = $('#win-' + k); lastOpener = document.querySelector(`.vt[data-win="${k}"]`);
  w.hidden = false; w.classList.remove('opening'); void w.offsetWidth; if (!reduced()) w.classList.add('opening');
  $$('.vt[data-win]').forEach(b => b.setAttribute('aria-expanded', b.dataset.win === k));
  renderWin(); w.querySelector('[data-close]').focus();
}
function closeWin(refocus = true) {
  if (!S.win) return; $('#win-' + S.win).hidden = true; S.win = null; S.slipFrom = null;
  $$('.vt[data-win]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (refocus && lastOpener) lastOpener.focus();
}
$$('.vt[data-win]').forEach(b => b.addEventListener('click', () => openWin(b.dataset.win)));
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeWin()));
$$('.vt[data-view]').forEach(b => b.addEventListener('click', () => { if (S.win) closeWin(false); go(b.dataset.view); }));
$('.vt[data-view="polar"]').addEventListener('pointerenter', () => map.load());
let slipCentre = null;
function renderWin() {
  if (S.win === 'slip') {
    const host = $('#heat'); if (slipCentre == null) slipCentre = S.off;
    drawHeat(host, { off: S.off, focus: S.focus, span: S.slipSpan, onPick: p => { if (p.pan != null) { slipCentre = p.pan; return; } if (!S.slipFrom) S.slipFrom = { off: S.off, st: detail(S.focus, S.off).st }; setFocus(p.site).then(() => setOff(p.off)); }, onHover: hoverCell });
    $('#slip-legend').innerHTML = `<span>${lampHTML('go')}GO, full bar, brighter for a higher score</span><span>${lampHTML('caution')}CAUTION, half bar</span><span>${lampHTML('nogo')}NO-GO, hatched</span><span><i class="sw" style="border-top:2px dotted var(--ink-3)"></i>No data: the window runs past 2031</span>`;
    const s = siteById(S.focus);
    if (S.slipFrom && S.slipFrom.off !== S.off) {
      const a = detail(S.focus, S.slipFrom.off), b = detail(S.focus, S.off), dd = S.off - S.slipFrom.off;
      $('#slipcard').innerHTML = `<span><b>${s.name}</b> slipped ${dd > 0 ? '+' : '−'}${Math.abs(dd)} d: ${fmtDay(LANDING0 + S.slipFrom.off * 864e5)} → ${fmtDay(LANDING0 + S.off * 864e5)}</span>${statusHTML(a.st)}<span aria-hidden="true">→</span>${statusHTML(b.st)}` + (b.broken ? `<span>${b.broken.name} ${b.broken.value} h, limit ${b.broken.limit} h</span>` : `<span>score ${b.score}</span>`);
    } else $('#slipcard').innerHTML = `<svg class="i"><use href="#i-chev"/></svg><span>Press <b>Slip +7 d</b> or <b>+14 d</b> above, or click a square. A before and after for ${s.name} appears here.</span>`;
    $$('#slip-zoom button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.z === S.slipSpan));
  } else if (S.win === 'compare') {
    $('#cmp-sum').textContent = compareTable($('#cmp'), { off: S.off, focus: S.focus, onFocus: id => setFocus(id) });
  }
}
$('#slip-zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.slipSpan = +b.dataset.z; renderWin(); });
let tipEl = null;
function hoverCell(a) {
  if (tipEl) { tipEl.remove(); tipEl = null; }
  if (!a) return;
  const d = detail(a.site.id, a.dd), host = $('#heat');
  tipEl = document.createElement('div'); tipEl.className = 'tip';
  tipEl.innerHTML = `<h4>${a.site.name} · ${fmtDayY(LANDING0 + a.dd * 864e5)} 00:00 UTC</h4><div style="margin-top:4px">${statusHTML(d.st)}</div>
    <dl>${d.broken ? `<dt>${d.broken.name}</dt><dd style="color:var(--status-nogo)">${d.broken.value} h / ${d.broken.limit} h</dd>` : ''}<dt>Longest dark</dt><dd>${d.metrics.dark} h / 6 h</dd><dt>Score</dt><dd>${d.st === 'nogo' ? `<s>${d.score}</s>` : d.score}</dd></dl>
    <p class="lbl" style="margin-top:6px;font-size:12px">Click to land on this date</p>`;
  host.appendChild(tipEl);
  const x = Math.min(a.px + 14, host.clientWidth - 290), y = Math.min(a.py + 14, host.clientHeight - 150);
  tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
}

/* ── overlays over the scene: pins, labels, sight-line words ── */
const ov = $('#ov');
let ovItems = [];
function el(html, cls) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ov.appendChild(d); return d; }
function buildOverlay() {
  ov.textContent = ''; ovItems = [];
  if (stage.classList.contains('fallback')) return;
  const site = siteById(S.focus), s = series(S.focus, S.hour, S.off), v = S.view;
  if (v === 'polar') { drawOverlay(); return; }
  if (!scene) return;
  const sphereClose = (v === 'terrain' || v === 'eye') && site.tier === 'sphere';
  const close = (v === 'terrain' || v === 'eye') && !sphereClose;
  // pins
  for (const p of SITES) {
    if (close && p.id !== S.focus) continue;
    const d = detail(p.id, S.off), foc = p.id === S.focus;
    const b = document.createElement('button');
    b.className = 'pin' + (foc ? ' on' : ''); b.dataset.site = p.id; b.tabIndex = -1; b.setAttribute('aria-label', `${p.name}, ${STATUS_WORD[d.st]}`);
    b.innerHTML = `${lampHTML(d.st)}<span class="pl plate"><b>${p.name}</b>${foc && close ? '<small>The lander, 2 m above the ground</small>' : ''}<small class="near-n" hidden></small></span>`;
    ov.appendChild(b);
    const z = scene.terr && scene.terr.site.id === p.id ? scene.terr.z0 : 0;
    ovItems.push({ el: b, kind: 'pin', id: p.id, pos: scene.surfPoint(p.lat, p.lon, z + 2) });
  }
  if (S.focus && !(v === 'system' && S.trueScale) && v !== 'eye') {
    ovItems.push({ el: el(`<span class="status ${s.sf >= .5 ? 'go' : 'nogo'}">${lampHTML(s.sf >= .5 ? 'go' : 'nogo')}To the Sun: ${s.sf >= .5 ? 'lit' : 'dark'}</span>`, 'slab plate'), kind: 'sightSun' });
    ovItems.push({ el: el(`<span class="status ${s.link ? 'go' : 'nogo'}">${lampHTML(s.link ? 'go' : 'nogo')}To Earth: ${s.link ? 'link' : 'blackout'}</span>`, 'slab plate'), kind: 'sightEarth' });
  }
  if (v === 'system' || sphereClose) {
    ovItems.push({ el: el('<span class="plate" style="color:var(--earth)">Earth</span>', 'slab'), kind: 'earth' });
    ovItems.push({ el: el('<span class="plate" style="color:var(--sun)">Sun</span>', 'slab'), kind: 'sun' });
    ovItems.push({ el: el('<span class="plate" style="display:inline-flex;align-items:center;gap:6px"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-sun"/></svg><span style="color:var(--sun)">Sun, off screen</span><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><use href="#i-arrow"/></svg></span>', 'edge-arrow'), kind: 'sunEdge' });
    if (S.trueScale) ovItems.push({ el: el('<span class="plate">Moon</span>', 'slab'), kind: 'moon' });
  }
  if (v === 'eye' && close) {
    ovItems.push({ el: el(`<span class="plate"><span style="color:var(--earth);font-weight:500">Earth</span><small>${s.ee.toFixed(2)}° up · ${s.link ? 'in view' : 'blocked'}</small></span>`, 'slab'), kind: 'bodyEye', idx: 1 });
    ovItems.push({ el: el(`<span class="plate"><span style="color:var(--sun);font-weight:500">Sun</span><small>${s.se.toFixed(2)}° up · ${s.sf >= .5 ? 'in view' : 'behind the ridge'}</small></span>`, 'slab'), kind: 'bodyEye', idx: 2 });
  }
  if (close && v !== 'eye' && S.focus === 'cr' && s.sf < .5) {
    const T = scene.THREE, B = scene.sitePoseLocal(265.98, 1.30, 12400 / R_MOON_M).pos;
    ovItems.push({ el: el('', 'ring'), kind: 'pt', pos: B });
    ovItems.push({ el: el('<span class="plate"><b style="font-weight:500">Blocker, 12.4 km away</b><small>1.30° up, the same point as the horizon chart</small></span>', 'slab'), kind: 'pt', pos: B, dy: -30 });
    void T;
  }
  if (close) {
    const seriesLabel = s.sf >= .5 ? `The series says: lit. ${Math.round(s.sf * 100)} % of the Sun's disc is above the skyline.` : `The series says: dark. Sun disc fraction ${s.sf.toFixed(2)} above the skyline.`;
    ovItems.push({ el: el(`<span class="plate">${seriesLabel}<small>Shading and shadows here are drawn for understanding only. The series decides lit or dark.</small></span>`, 'slab'), kind: 'badge' });
  }
  updateOverlay();
}
function updateOverlay() {
  if (!scene || S.view === 'polar' || stage.classList.contains('fallback')) return;
  const P = scene.project, st = scene.st, { W, H } = scene.size;
  const ins = insets();
  const placed = [], boxes = [];
  for (const it of ovItems) {
    let p = null, show = true;
    if (it.kind === 'pin') { p = P(it.pos); show = p.front && scene.facing(it.pos); }
    else if (it.kind === 'sightSun' && st.sunEnd) { const a = st.sightFrom.clone().lerp(st.sunEnd, .78); p = P(a); show = p.front; }
    else if (it.kind === 'sightEarth' && st.earthEnd) { const a = st.sightFrom.clone().lerp(st.earthEnd, .78); p = P(a); show = p.front; }
    else if (it.kind === 'earth') { const T = scene.THREE; const e = P(new T.Vector3().setFromMatrixPosition(scene.scene.children[1].matrixWorld)); p = { x: e.x, y: e.y + 14 + scene.scene.children[1].scale.x / Math.max(.01, scene.camera.position.distanceTo(scene.scene.children[1].position)) * (H / 2) / Math.tan(scene.camera.fov * Math.PI / 360), front: e.front }; show = e.front; }
    else if (it.kind === 'sun' || it.kind === 'sunEdge') {
      const T = scene.THREE, sp = new T.Vector3().setFromMatrixPosition(scene.scene.children[2].matrixWorld), e = P(sp);
      const inside = e.front && e.x > ins.l && e.x < W - ins.r && e.y > ins.t - 30 && e.y < H - ins.b + 40;
      if (it.kind === 'sun') { p = { x: e.x, y: e.y + 34 }; show = inside; }
      else {
        show = !inside && !S.trueScale;
        let dx = e.x - (ins.l + W - ins.r) / 2, dy = e.y - (ins.t + H - ins.b) / 2; if (!e.front) { dx = -dx; dy = -dy; }
        const hw = (W - ins.l - ins.r) / 2 - 100, hh = (H - ins.t - ins.b) / 2 - 56, k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
        p = { x: (ins.l + W - ins.r) / 2 + dx * k, y: (ins.t + H - ins.b) / 2 + dy * k };
        it.el.querySelector('.chev').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
    }
    else if (it.kind === 'bodyEye') { const o = scene.scene.children[it.idx], e = P(new scene.THREE.Vector3().setFromMatrixPosition(o.matrixWorld)); const rpx = (it.idx === 1 ? 1 : 3) * o.scale.x / o.position.distanceTo(scene.camera.position) * (H / 2) / Math.tan(scene.camera.fov * Math.PI / 360); p = { x: e.x + rpx + 14 + it.el.offsetWidth / 2, y: e.y }; show = e.front; }
    else if (it.kind === 'moon') { p = P(new scene.THREE.Vector3()); p.y += 18; }
    else if (it.kind === 'pt') { p = P(it.pos); show = p.front; if (it.dy) p.y += it.dy; }
    else if (it.kind === 'badge') { p = { x: (ins.l + W - ins.r) / 2, y: H - ins.b - 22 }; }
    if (!p || !show || isNaN(p.x)) { it.el.style.visibility = 'hidden'; continue; }
    if (it.el.classList.contains('slab') && it.kind !== 'badge') { // keep words inside the free space
      const hw = it.el.offsetWidth / 2 + 8, hh = it.el.offsetHeight / 2 + 8;
      p = { x: Math.min(W - ins.r - hw, Math.max(ins.l + hw, p.x)), y: Math.min(H - ins.b - hh, Math.max(ins.t + hh + 40, p.y)) };
      for (let k = 0; k < 4; k++) { const hit = boxes.find(b => Math.abs(b.x - p.x) < b.hw + hw - 12 && Math.abs(b.y - p.y) < b.hh + hh - 12); if (!hit) break; p.y = hit.y + (p.y >= hit.y ? 1 : -1) * (hit.hh + hh - 10); }
      boxes.push({ x: p.x, y: p.y, hw, hh });
    }
    it.el.style.visibility = 'visible';
    it.el.style.left = p.x.toFixed(1) + 'px'; it.el.style.top = p.y.toFixed(1) + 'px';
    if (it.kind === 'pin') { placed.push({ x: p.x, y: p.y, it }); continue; }
  }
  settlePins(placed);
}
const camAlt = () => scene ? scene.camera.position.length() - 1 : 9;
/* pins closer than 18 px fold into the focused pin, which says how many are hidden */
function settlePins(placed) {
  const foc = placed.find(q => q.it.id === S.focus);
  let hidden = 0;
  for (const q of placed) {
    if (q === foc) continue;
    const crowd = foc && Math.hypot(q.x - foc.x, q.y - foc.y) < 18;
    q.it.el.style.visibility = crowd ? 'hidden' : 'visible'; if (crowd) hidden++;
  }
  for (const q of placed) if (q !== foc) q.it.el.classList.toggle('named', q.it.el.style.visibility !== 'hidden' && !placed.some(o => o !== q && o.it.el.style.visibility !== 'hidden' && Math.hypot(o.x - q.x, o.y - q.y) < 70));
  if (foc) { const n = foc.it.el.querySelector('.near-n'); if (n) { n.hidden = !hidden; n.textContent = hidden ? `and ${hidden} more site${hidden > 1 ? 's' : ''} here` : ''; } }
}

/* map overlay: pins, popover, nudge */
let nudge = null;
function drawOverlay() {
  if (S.view !== 'polar') return;
  if (!ov._map) { ov.textContent = ''; ov._map = true; }
  ov.querySelectorAll('.pin,.mslab').forEach(n => n.remove());
  for (const p of SITES) {
    if (p.tier === 'sphere') continue;
    const d = detail(p.id, S.off), foc = p.id === S.focus;
    let [x, y] = polarXY(p.lat, p.lon); if (nudge && foc) { x = nudge.x; y = nudge.y; }
    const q = map.toScr(x, y);
    const b = document.createElement('button');
    b.className = 'pin named' + (foc ? ' on' : ''); b.dataset.site = p.id; b.tabIndex = -1;
    b.setAttribute('aria-label', `${p.name}, ${STATUS_WORD[d.st]}${foc ? '. Drag to nudge' : ''}`);
    b.innerHTML = `${lampHTML(d.st)}<span class="pl plate"><b>${p.name}</b> <span class="status ${d.st}" style="font-weight:500">${STATUS_WORD[d.st]}</span></span>`;
    b.style.left = q.x + 'px'; b.style.top = q.y + 'px';
    ov.appendChild(b);
    if (foc) attachNudge(b, p);
  }
  // labels that would overlap: try the other side, else keep the lamp only
  const pinsEl = [...ov.querySelectorAll('.pin')];
  const rs = pinsEl.map(b => { const r = b.querySelector('.lamp').getBoundingClientRect(); return { left: r.left - 3, right: r.right + 3, top: r.top - 3, bottom: r.bottom + 3, own: b }; });
  pinsEl.forEach(b => {
    const pl = b.querySelector('.pl'), hit = r => rs.some(q => q.own !== b && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
    let r = pl.getBoundingClientRect();
    if (hit(r)) { b.style.flexDirection = 'row-reverse'; b.style.transform = `translate(calc(-100% + ${b.classList.contains('on') ? 11 : 8}px), -50%)`; r = pl.getBoundingClientRect(); }
    if (hit(r)) { pl.style.display = 'none'; b.title = pl.textContent; } else rs.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, own: b });
  });
  // scale bar: 50 km, or 10 km when zoomed in
  const km = map.v.s * 50000 > 220 ? 10 : map.v.s * 50000 < 40 ? 100 : 50;
  $('#scale-i').style.width = (km * 1000 * map.v.s).toFixed(0) + 'px'; $('#scale-t').textContent = `${km} km · north is outward from the pole`;
  if (nudge) {
    const p = siteById(S.focus), [x0, y0] = polarXY(p.lat, p.lon), q = map.toScr(nudge.x, nudge.y);
    const a = map.lookup('sun', x0, y0), b = map.lookup('sun', nudge.x, nudge.y), dkm = Math.hypot(nudge.x - x0, nudge.y - y0) / 1000;
    const ea = map.lookup('earth', x0, y0), eb = map.lookup('earth', nudge.x, nudge.y);
    const word = (u, w) => w > u + .005 ? 'higher' : w < u - .005 ? 'lower' : 'the same';
    const m = document.createElement('div'); m.className = 'slab mslab plate'; m.style.left = q.x + 'px'; m.style.top = (q.y - 54) + 'px';
    m.innerHTML = `Average sunlight ${Math.round(a * 100)} % → ${Math.round(b * 100)} %, ${word(a, b)}<small>Earth visible ${Math.round(ea * 100)} % → ${Math.round(eb * 100)} % · moved ${dkm.toFixed(1)} km · NASA's average maps</small>`;
    ov.appendChild(m);
  }
}
function attachNudge(b, p) {
  b.addEventListener('pointerdown', e => {
    e.stopPropagation(); b.setPointerCapture(e.pointerId);
    const [x0, y0] = polarXY(p.lat, p.lon); let moved = 0;
    const mv = ev => { moved++; const r = $('#map').getBoundingClientRect(); const m = map.toMap(ev.clientX - r.left, ev.clientY - r.top);
      const dx = m.x - x0, dy = m.y - y0, d = Math.hypot(dx, dy), lim = 6000; nudge = d > lim ? { x: x0 + dx / d * lim, y: y0 + dy / d * lim } : { x: m.x, y: m.y }; drawOverlay(); };
    const up = () => { b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); if (!moved) { nudge = null; drawOverlay(); } };
    b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up);
  });
}
let popEl = null;
function openPop(m, e) {
  closePop();
  const [la, lo] = polarLatLon(m.x, m.y), sun = map.lookup('sun', m.x, m.y), ea = map.lookup('earth', m.x, m.y);
  popEl = document.createElement('div'); popEl.className = 'panel pop'; popEl.setAttribute('role', 'dialog'); popEl.setAttribute('aria-label', 'New site here');
  popEl.innerHTML = `<h3>New site here?</h3><p>${minus(la.toFixed(4))}°, ${lo.toFixed(4)}° E</p><p>Average sunlight ${sun == null ? 'no data' : Math.round(sun * 100) + ' %'} · Earth visible ${ea == null ? 'no data' : Math.round(ea * 100) + ' %'}</p><p>From NASA's average maps, 18.6 years.</p>
    <div class="acts"><button class="btn" style="color:var(--ink)" data-pop="create"><svg class="i"><use href="#i-plus"/></svg>Create a site here</button><button class="btn" data-pop="cancel">Cancel</button></div>`;
  $('#ui').appendChild(popEl);
  const x = Math.min(e.clientX + 12, innerWidth - 260), y = Math.min(e.clientY + 12, innerHeight - 200);
  popEl.style.left = x + 'px'; popEl.style.top = y + 'px';
  popEl.addEventListener('click', ev => { const k = ev.target.closest('[data-pop]'); if (k) closePop(); });
  popEl.querySelector('[data-pop="create"]').focus();
}
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
$('#mapctl').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (b) { map.zoom(+b.dataset.z); if (+b.dataset.z === 0) nudge = null; drawOverlay(); } });

/* ── see-through panels: raise each panel's opacity until its faintest text passes AA ── */
let probeT = 0;
function schedProbe() { clearTimeout(probeT); if (S.opt.surface !== 'see') return; probeT = setTimeout(runProbe, 160); }
function runProbe() {
  const panels = $$('.ui .panel').filter(p => p.offsetParent && !p.classList.contains('win') && !p.classList.contains('dopt') && !p.classList.contains('pop'));
  const rects = panels.map(p => p.getBoundingClientRect());
  let lum;
  if (S.view === 'polar') {
    const c = document.createElement('canvas'); c.width = 160; c.height = 100; const g = c.getContext('2d'); g.drawImage($('#map'), 0, 0, 160, 100);
    const d = g.getImageData(0, 0, 160, 100).data, W = innerWidth, H = innerHeight;
    lum = rects.map(r => { let mx = 0; for (let y = Math.max(0, Math.floor(r.top / H * 100)); y <= Math.min(99, Math.ceil(r.bottom / H * 100)); y++) for (let x = Math.max(0, Math.floor(r.left / W * 160)); x <= Math.min(159, Math.ceil(r.right / W * 160)); x++) { const k = (y * 160 + x) * 4; mx = Math.max(mx, .2126 * d[k] + .7152 * d[k + 1] + .0722 * d[k + 2]); } return mx; });
  } else if (scene) lum = scene.probe(rects); else return;
  // Ink 3 (#8c8c93) needs the blended background at or below grey 34 (sRGB) for 4.5:1.
  panels.forEach((p, i) => { const B = lum[i] + 12; const a = B <= 34 ? .8 : Math.max(.8, Math.min(1, (B - 34) / (B - 20))); p.style.setProperty('--a', a.toFixed(3)); p.dataset.probe = Math.round(lum[i]); });
}

/* ── design options (prototype only) ── */
$('#dopt-b').addEventListener('click', () => { const d = $('#dopt'), open = d.hidden; d.hidden = !open; $('#dopt-b').setAttribute('aria-expanded', open); if (open) d.querySelector('button').focus(); });
$('#dopt').addEventListener('click', e => {
  const b = e.target.closest('button'), g = b && b.closest('[data-opt]'); if (!g) return;
  const k = g.dataset.opt, v = b.dataset.v; S.opt[k] = v;
  g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  if (k === 'surface') { document.body.classList.toggle('seethrough', v === 'see'); if (v === 'see') schedProbe(); else $$('.panel').forEach(p => p.style.removeProperty('--a')); }
  if (k === 'motion') document.body.classList.toggle('reduce', v === 'reduce');
  if (k === 'tex' && scene) scene.setMoonRes(v);
  if (k === 'state') {
    if (v === 'still') showStill('Still picture: this is what a phone or a slow laptop sees when 3D is off.', true);
    else hideStill();
    if (scene) scene.forceGrey(v === 'loading');
    $('#loading').classList.toggle('on', v === 'loading');
  }
});

/* ── the still picture, for when WebGL is missing or slow ── */
function showStill(msg, demo) {
  stage.classList.add('fallback');
  let n = $('#still-note');
  if (!n) { n = document.createElement('div'); n.id = 'still-note'; n.className = 'note'; n.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--bar-top) + var(--app-h) + 142px);max-width:min(640px,calc(100vw - 32px));pointer-events:auto;text-align:center'; $('#ui').appendChild(n); }
  n.innerHTML = `${msg} The panels, timeline and windows still work. <span class="lbl">Picture taken at 03 Mar 15:00 UTC.</span>${scene && !demo ? ' <button class="btn" id="try3d" style="margin-left:6px">Try 3D anyway</button>' : ''}`;
  const t = $('#try3d'); if (t) t.addEventListener('click', hideStill);
  ov.textContent = '';
}
function hideStill() { stage.classList.remove('fallback'); const n = $('#still-note'); if (n) n.remove(); buildOverlay(); scene && scene.invalidate(); }

/* ── keys ── */
document.addEventListener('keydown', e => {
  if (e.target instanceof Element && e.target.matches('input,textarea')) return;
  if (e.key === 'Escape') { if (popEl) { closePop(); return; } if (!$('#dopt').hidden) { $('#dopt').hidden = true; $('#dopt-b').setAttribute('aria-expanded', 'false'); $('#dopt-b').focus(); return; } if (S.win) { closeWin(); return; } }
  if (e.key === '[') { S.col.l = !S.col.l; applyLayout(); }
  if (e.key === ']') { S.col.r = !S.col.r; applyLayout(); }
  if (S.win === 'slip' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement.closest('#win-slip')) { e.preventDefault(); if (!S.slipFrom) S.slipFrom = { off: S.off }; setOff(S.off + (e.key === 'ArrowRight' ? 1 : -1)); }
});

/* ── keyboard on the 3D scene ── */
$('#gl').addEventListener('keydown', e => {
  if (!scene) return;
  const k = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[e.key];
  if (k) { e.preventDefault(); S.preset = null; renderControls(); scene.orbit(k[0], k[1]); }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); scene.zoom(.85); }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); scene.zoom(1 / .85); }
});
/* ── phone sheet ── */
$('#sites-btn').addEventListener('click', () => { const r = $('#rail'), open = !r.classList.contains('sheet-open'); r.classList.toggle('sheet-open', open); $('#sites-btn').setAttribute('aria-expanded', open); $('#focus').classList.remove('expanded'); });
document.addEventListener('click', e => { if (phone.matches && e.target.closest('#rail .site')) { $('#rail').classList.remove('sheet-open'); $('#sites-btn').setAttribute('aria-expanded', 'false'); } });
$('#focus').addEventListener('click', e => { if (phone.matches && e.target.closest('.f-h')) $('#focus').classList.toggle('expanded'); });

/* ── start ── */
const loadingEl = document.createElement('div'); loadingEl.id = 'loading'; loadingEl.className = 'loading note'; loadingEl.textContent = 'Loading NASA\'s Moon and Earth maps…'; $('#ui').appendChild(loadingEl);
applyLayout(false);
renderAll();
if (scene) {
  scene.onFrame(() => { updateOverlay(); schedProbe(); });
  scene.setSite(siteById(S.focus)); updateBodies();
  const params = new URLSearchParams(location.search);
  const groundReady = scene.setGround(siteById(S.focus), 1).then(() => scene.setSite(siteById(S.focus)));
  // intro: the camera eases in from further out; its frame times decide whether 3D is fast enough
  const P = scene.poses(), start = { ...P.home, pos: P.home.pos.clone().multiplyScalar(1.5) };
  const startView = params.get('view');
  loadingEl.classList.add('on');
  scene.loadTextures(params.get('tex') === '8k' ? '8k' : '4k').then(() => { loadingEl.classList.remove('on'); setTimeout(() => map.load(), 1500); });
  if (startView && startView !== 'system') { scene.applyPose(P.home); groundReady.then(() => go(startView, { instant: true })); }
  else if (reduced() || params.has('still') || params.has('clean')) { scene.applyPose(P.home); buildOverlay(); }
  else { scene.applyPose(start); scene.flyTo(P.home, 1400, () => {
    const ft = scene.frameTimes.slice(-40).sort((a, b) => a - b), med = ft[Math.floor(ft.length / 2)] || 0;
    if (med > 55 && !params.has('force3d')) showStill('3D is slow on this device, so this is a still picture of the System view.');
  }); buildOverlay(); }
  if (params.has('still')) showStill('Still picture: this is what a phone or a slow laptop sees when 3D is off.', true);
  if (params.get('surface') === 'see') $('[data-opt="surface"] [data-v="see"]').click();
  if (params.has('collapsed')) { S.col = { l: true, r: true, t: true }; applyLayout(false); }
  if (params.get('win')) openWin(params.get('win'));
  if (params.has('clean')) { $('#ui').style.display = 'none'; ov.style.display = 'none'; scene.flyTo(scene.poses().home, 0); scene.st.noSight = true; }
}
window.__ts = { S, scene, map, go, setHour, setFocus, setOff, openWin, runProbe };
phone.addEventListener('change', () => { applyLayout(false); renderAll(); });
window.addEventListener('resize', () => { applyLayout(false); if (S.win) renderWin(); });

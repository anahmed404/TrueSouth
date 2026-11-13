/* The flat Polar map: NASA's 80 m terrain as shaded relief (lit from the top-left, a drawing),
   with NASA's average sunlight and Earth visibility as optional overlays. Map coordinates are
   south polar stereographic metres (science.md §2.3), +x right, +y up. */
import { polarXY, polarLatLon, D2R, R_MOON_M } from './data.js';

const HALF = 304000, CORE = 76000;
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export function createMap(canvas, opt) {
  const g = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1;
  const v = { cx: 0, cy: 0, s: 1 / 600, rot: 0 };   // centre (m) and scale (px per m)
  const S = { overlay: 'none', opacity: .7, names: true, inset: { l: 0, r: 0, t: 0, b: 0 } };
  const img = {};
  let ready = false;
  const tinted = {};
  const look = {};

  let loading = null;
  function load() { return loading || (loading = loadNow()); }
  async function loadNow() {
    const [hs, core, sun, ear] = await Promise.all(['assets/hillshade_4k.webp', 'assets/hillshade_core_2048.webp', 'assets/sunlight_2k.webp', 'assets/earthvis_2k.webp'].map(loadImg));
    Object.assign(img, { hs, core });
    for (const [k, im, col] of [['sun', sun, opt.colors.sun], ['earth', ear, opt.colors.earth]]) {
      if (!im) continue;
      const c = document.createElement('canvas'); c.width = c.height = 2048;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 2048, 2048);
      const d = x.getImageData(0, 0, 2048, 2048); look[k] = new Uint8Array(2048 * 2048);
      const [r, gg, b] = col;
      for (let i = 0, j = 0; i < d.data.length; i += 4, j++) { const a = d.data[i]; look[k][j] = a; d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = a; }
      x.putImageData(d, 0, 0); tinted[k] = c;
    }
    ready = true; draw();
  }
  /* overlay value under a map point, 0..1, or null */
  function lookup(k, x, y) {
    if (!look[k]) return null;
    const c = Math.floor((x + HALF) / (2 * HALF) * 2048), r = Math.floor((HALF - y) / (2 * HALF) * 2048);
    if (c < 0 || r < 0 || c > 2047 || r > 2047) return null;
    return look[k][r * 2048 + c] / 255;
  }
  const centre = () => ({ x: (S.inset.l + W - S.inset.r) / 2, y: (S.inset.t + H - S.inset.b) / 2 });
  const toScr = (x, y) => { const c = centre(); return { x: c.x + (x - v.cx) * v.s, y: c.y - (y - v.cy) * v.s }; };
  const toMap = (px, py) => { const c = centre(); return { x: v.cx + (px - c.x) / v.s, y: v.cy - (py - c.y) / v.s }; };

  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; draw(); }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = opt.colors.space; g.fillRect(0, 0, W, H);
    if (!ready || !img.hs) { opt.onDraw && opt.onDraw(); return; }
    const a = toScr(-HALF, HALF), size = 2 * HALF * v.s;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img.hs, a.x, a.y, size, size);
    if (img.core && v.s * 2 * HALF > 4096 * .9) { const b = toScr(-CORE, CORE); g.drawImage(img.core, b.x, b.y, 2 * CORE * v.s, 2 * CORE * v.s); }
    if (S.dim) { g.fillStyle = `rgba(11,11,12,${S.dim})`; g.fillRect(a.x, a.y, size, size); } // the Slip Planner's flat fallback: dark ground, bright where the Sun often is
    if (S.overlay !== 'none' && tinted[S.overlay]) { g.globalAlpha = S.opacity; g.drawImage(tinted[S.overlay], a.x, a.y, size, size); g.globalAlpha = 1; }
    // latitude circles every degree, longitude lines every 30°
    const p0 = toScr(0, 0);
    g.lineWidth = 1; g.strokeStyle = 'rgba(11,11,12,.55)';
    for (let lat = -89; lat >= -80; lat--) { const r = Math.hypot(...polarXY(lat, 0)) * v.s; g.beginPath(); g.arc(p0.x, p0.y, r, 0, Math.PI * 2); g.stroke(); }
    for (let lon = 0; lon < 360; lon += 30) { const q = polarXY(-80, lon), e = toScr(q[0], q[1]); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(e.x, e.y); g.stroke(); }
    // labels for latitude circles along lon 0 (upwards)
    g.font = '400 11px Jost, Futura, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let lat = -88; lat >= -80; lat -= 2) { const q = polarXY(lat, 0), e = toScr(q[0], q[1]); if (e.y < 30 || e.y > H - 30) continue; plateText(e.x + 4, e.y - 8, `${lat}°`.replace('-', '−'), false); }
    // named features (IAU positions), sized by zoom
    if (S.names) {
      g.font = 'italic 400 12px Jost, Futura, sans-serif'; g.textAlign = 'center';
      for (const [n, la, lo, dkm] of opt.features) {
        if (dkm * 1000 * v.s < 46) continue;
        const q = polarXY(la, lo), e = toScr(q[0], q[1]);
        if (e.x < 0 || e.y < 0 || e.x > W || e.y > H) continue;
        if ((opt.pins ? opt.pins() : []).some(q => { const o = toScr(q[0], q[1]); const dx = e.x - o.x; return dx > -90 && dx < 280 && Math.abs(o.y - e.y) < 24; })) continue;
        plateText(e.x, e.y, n, true);
      }
    }
    opt.onDraw && opt.onDraw();
  }
  function plateText(x, y, t, italic) {
    const w = g.measureText(t).width;
    g.fillStyle = 'rgba(20,20,21,.78)';
    const x0 = g.textAlign === 'center' ? x - w / 2 - 5 : x - 5;
    g.beginPath(); g.roundRect(x0, y - 9, w + 10, 18, 5); g.fill();
    g.fillStyle = italic ? '#b3b3b8' : '#b3b3b8'; g.fillText(t, x, y + .5);
  }

  /* pan and zoom */
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); });
  canvas.addEventListener('pointermove', e => {
    const m = toMap(e.offsetX, e.offsetY); opt.onHover && opt.onHover(m, e);
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    v.cx -= dx / v.s; v.cy += dy / v.s; clampView(); draw();
  });
  canvas.addEventListener('pointerup', e => { canvas.classList.remove('dragging'); if (drag && drag.moved < 4) opt.onClick && opt.onClick(toMap(e.offsetX, e.offsetY), e); drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), e.offsetX, e.offsetY); }, { passive: false });
  function zoomAt(f, px, py) {
    const before = toMap(px, py);
    v.s = Math.min(Math.max(v.s * f, minScale()), 1 / 20);
    const after = toMap(px, py); v.cx += before.x - after.x; v.cy += before.y - after.y; clampView(); draw();
  }
  const minScale = () => Math.min(W - S.inset.l - S.inset.r, H - S.inset.t - S.inset.b) / (2 * HALF) * .9;
  function clampView() { const m = HALF * .95; v.cx = Math.max(-m, Math.min(m, v.cx)); v.cy = Math.max(-m, Math.min(m, v.cy)); }
  function zoom(dir) { const c = centre(); if (dir === 0) { fit(); return; } zoomAt(dir > 0 ? 1.6 : 1 / 1.6, c.x, c.y); }
  function fit() { v.cx = 0; v.cy = 0; v.s = minScale() / .9 * .92; draw(); }

  window.addEventListener('resize', resize);
  resize();
  return {
    load,
    draw, resize, toScr, toMap, lookup, zoom, fit, v, S,
    setInsets(ins) { S.inset = { ...ins }; draw(); },
    setView(cx, cy, s) { v.cx = cx; v.cy = cy; v.s = s; draw(); },
    setOverlay(k) { S.overlay = k; draw(); }, setDim(d) { S.dim = d; draw(); }, setOpacity(o) { S.opacity = o; draw(); }, setNames(b) { S.names = b; draw(); },
    get ready() { return ready; }, metresPerDeg: R_MOON_M * D2R, polarLatLon,
  };
}

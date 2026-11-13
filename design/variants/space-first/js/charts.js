/* Charts drawn in SVG from the mock series: the timeline, the Lander's eye panorama,
   the Slip Planner heatmap and the Compare table. Restaged from the approved C2 pages. */
import { series, sky, SUN_R, EARTH_R, LANDING0, WINDOW_H, SITES, status, detail, fmtDay, fmtDayY, MONTHS, pad, STATUS_WORD, TIME_GRID, siteById } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
export function E(tag, a, p) { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const C = {};
export function readColors() {
  Object.assign(C, { ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), line: css('--line'), lineS: css('--line-strong'), sun: css('--sun'), sunCore: css('--sun-core'), earth: css('--earth'), earthCore: css('--earth-core'),
    go: css('--status-go'), cau: css('--status-caution'), nogo: css('--status-nogo'), bg: css('--bg'), plot: css('--plot'), terrain: css('--terrain'), rim: css('--terrain-rim'), grid: css('--grid'), accent: css('--accent'), raised: css('--raised'), hover: css('--hover'), surface: css('--surface') });
}
const wrap = d => ((d + 180) % 360 + 360) % 360 - 180;
export const H0 = -72, H1 = 312;

/* longest run of hours inside the window where pred holds */
export function longest(siteId, off, pred) {
  let best = [0, 0, 0], cur = 0, start = 0;
  for (let h = 0; h < WINDOW_H; h++) {
    if (pred(series(siteId, h, off))) { if (!cur) start = h; cur++; if (cur > best[1]) best = [start, cur, h + 1]; } else cur = 0;
  }
  return best; // [start, length, end]
}

/* ── Timeline ── */
export function drawTimeline(svg, { site, hour, off, compact }) {
  svg.textContent = '';
  const Wt = Math.max(320, svg.clientWidth || 996), Ht = compact ? 44 : 140;
  svg.setAttribute('viewBox', `0 0 ${Wt} ${Ht}`);
  const x0 = compact ? 4 : 52, w = Wt - x0 - 4, k = w / (H1 - H0), X = h => x0 + (h - H0) * k;
  const ax = 14, sy = compact ? 4 : 26, bh = compact ? 16 : 26, ey = compact ? 24 : 60, dy = 104, ly = 126;
  const S = []; for (let h = H0; h < H1; h++) S.push(series(site, h, off));
  const g = E('g', {}, svg);
  if (!compact) { E('text', { x: 0, y: sy + 17, 'font-size': 13, fill: C.ink }, g).textContent = 'Sun'; E('text', { x: 0, y: ey + 17, 'font-size': 13, fill: C.ink }, g).textContent = 'Earth'; }
  [sy, ey].forEach((y, i) => { E('rect', { x: x0, y, width: w, height: bh, rx: compact ? 4 : 6, fill: C.plot, stroke: C.line }, g);
    const c = E('clipPath', { id: 'tlc' + i + (compact ? 'c' : '') }, svg); E('rect', { x: x0, y, width: w, height: bh, rx: 6 }, c); });
  let sd = '', sc = '', ed = '', ec = '';
  S.forEach(s => { const x = X(s.h), ww = k + .15, inW = s.h >= 0 && s.h < WINDOW_H;
    if (s.sf >= .5) { const hh = bh * Math.min(1, s.sf), r = `M${x.toFixed(2)},${(sy + bh - hh).toFixed(2)}h${ww.toFixed(2)}v${hh.toFixed(2)}h${-ww.toFixed(2)}Z`; inW ? sd += r : sc += r; }
    if (s.link) { const r = `M${x.toFixed(2)},${ey}h${ww.toFixed(2)}v${bh}h${-ww.toFixed(2)}Z`; inW ? ed += r : ec += r; } });
  const cs = compact ? 'c' : '';
  E('path', { d: sc, fill: C.sun, 'fill-opacity': .2, 'clip-path': `url(#tlc0${cs})` }, g); E('path', { d: sd, fill: C.sun, 'clip-path': `url(#tlc0${cs})` }, g);
  E('path', { d: ec, fill: C.earth, 'fill-opacity': .2, 'clip-path': `url(#tlc1${cs})` }, g); E('path', { d: ed, fill: C.earth, 'clip-path': `url(#tlc1${cs})` }, g);
  for (let d = -3; d <= 13; d++) {
    const x = X(d * 24), inW = d >= 0 && d < 10;
    if (d > -3 && d < 13) E('line', { x1: x, x2: x, y1: sy, y2: ey + bh, stroke: C.bg, 'stroke-opacity': .6 }, g);
    if (compact || d >= 13) continue;
    const t = E('text', { x: X(d * 24 + 12), y: ax, 'text-anchor': 'middle', 'font-size': 11, fill: inW ? C.ink2 : C.ink3 }, g);
    t.textContent = inW ? (d === 0 ? 'Day 1' : String(d + 1)) : (d < 0 ? '−' + (-d) + ' d' : '+' + (d - 9) + ' d'); if (!inW) t.setAttribute('fill-opacity', .7);
    const tt = E('text', { x: X(d * 24 + 12), y: dy, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink3 }, g); tt.textContent = fmtDay(LANDING0 + (off + d) * 864e5); if (!inW) tt.setAttribute('fill-opacity', .7);
  }
  if (!compact) {
    E('text', { x: 0, y: dy, 'font-size': 11, fill: C.ink3 }, g).textContent = 'UTC';
    [0, WINDOW_H].forEach(h => E('line', { x1: X(h), x2: X(h), y1: ax + 4, y2: ey + bh + 4, stroke: C.ink2, 'stroke-opacity': .7 }, g));
    const dk = longest(site, off, s => s.sf < .5), bk = longest(site, off, s => !s.link);
    const lab = (r, y, lim, name, broken) => {
      if (!r[1]) { E('text', { x: X(name === 'dark' ? 60 : 180), y: ly, 'text-anchor': 'middle', 'font-size': 11.5, fill: C.ink2 }, g).textContent = `No ${name.toLowerCase()} in the window, passes`; return; }
      E('rect', { x: X(r[0]) - 2, y: y - 3, width: X(r[2]) - X(r[0]) + 4, height: bh + 6, rx: 5, fill: 'none', stroke: broken ? C.nogo : C.ink2, 'stroke-width': broken ? 2 : 1.3, 'stroke-dasharray': broken ? null : '3 2' }, g);
      const t = E('text', { x: X((r[0] + r[2]) / 2) + (broken ? 8 : 0), y: ly, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': broken ? 500 : 400, fill: broken ? C.nogo : C.ink2 }, g);
      t.textContent = `Longest ${name} ${r[1]} h, limit ${lim} h${broken ? '' : ', passes'}`;
      if (broken) { const b = t.getBBox(), lx = b.x - 10, lyc = b.y + b.height / 2; E('circle', { cx: lx, cy: lyc, r: 6, fill: C.nogo }, g);
        E('path', { d: `M${lx - 2.4} ${lyc - 2.4}l4.8 4.8M${lx + 2.4} ${lyc - 2.4}l-4.8 4.8`, stroke: '#0b0b0c', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g); }
    };
    lab(dk, sy, 6, 'dark', dk[1] > 6); lab(bk, ey, 12, 'blackout', bk[1] > 12);
  }
  // scrubber
  const x = X(hour + .5);
  E('line', { x1: x, x2: x, y1: compact ? 0 : ax + 5, y2: ey + bh + (compact ? 4 : 5), stroke: C.accent, 'stroke-width': 2 }, g);
  E('circle', { cx: x, cy: compact ? ey + bh + 1 : ey + bh + 7, r: compact ? 4 : 5, fill: C.accent, stroke: C.surface, 'stroke-width': 2 }, g);
  if (!compact) {
    const day = Math.floor(hour / 24), t = E('text', { x, y: ax, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 500, fill: '#141414' }, g);
    const ms = LANDING0 + off * 864e5 + hour * 36e5, d = new Date(ms);
    t.textContent = `${day >= 0 && hour < WINDOW_H ? 'Day ' + (day + 1) + ' · ' : ''}${fmtDay(ms)} ${pad(d.getUTCHours())}:00 UTC`;
    const b = t.getBBox(); let tx = 0; if (b.x < x0) tx = x0 - b.x; if (b.x + b.width > Wt) tx = Wt - b.x - b.width; if (tx) t.setAttribute('x', x + tx);
    const bb = t.getBBox(); g.insertBefore(E('rect', { x: bb.x - 8, y: bb.y - 2, width: bb.width + 16, height: bb.height + 4, rx: (bb.height + 4) / 2, fill: C.accent }), t);
  }
  return { X, hourAt: px => Math.round((px - x0) / k + H0 - .5) };
}

/* ── Countdown cards ── */
export function countdowns(site, hour, off) {
  const s = series(site, hour, off), lit = s.sf >= .5;
  let hs = null; for (let h = hour + 1; h < hour + 24 * 30; h++) { if ((series(site, h, off).sf >= .5) !== lit) { hs = h - hour; break; } }
  let he = null; for (let h = hour + 1; h < hour + 24 * 30; h++) { if (series(site, h, off).link !== s.link) { he = h - hour; break; } }
  return { s, lit, hs, he };
}
export function dur(h) {
  if (h == null) return '<span>over 30</span><small>d</small>';
  const d = Math.floor(h / 24), r = h % 24;
  return d ? `${d}<small>d</small>${r}<small>h</small>` : `${r}<small>h</small>00<small>m</small>`;
}

/* ── Lander's eye panorama (approved C2, heights ×12) ── */
export function drawPanorama(svg, { site, hour, off, centre }) {
  svg.textContent = '';
  const s = series(site, hour, off);
  const az0 = centre === 'sun' ? s.sa : centre === 'north' ? 0 : s.ea;
  const W = 792, x0 = 40, pw = 740, lo = -2, hi = 5, top = 10, px = pw / 360, py = px * 12, bottom = top + (hi - lo) * py, Ht = bottom + 30;
  svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
  const cx = x0 + pw / 2, X = a => cx + wrap(a - az0) * px, Y = e => top + (hi - e) * py, xl = x0, xr = x0 + pw;
  const defs = E('defs', {}, svg);
  for (let e = -2; e <= 4; e += 2) { if (e === 0) continue; E('line', { x1: xl, x2: xr, y1: Y(e), y2: Y(e), stroke: C.grid }, svg);
    E('text', { x: xl - 8, y: Y(e) + 4, 'text-anchor': 'end', 'font-size': 11, fill: C.ink3 }, svg).textContent = (e > 0 ? '+' : '−') + Math.abs(e) + '°'; }
  for (let a = 0; a < 360; a += 30) E('line', { x1: X(a), x2: X(a), y1: top, y2: bottom, stroke: C.grid }, svg);
  let d = ''; for (let i = 0; i <= 1440; i++) { const a = az0 - 180 + i * .25; d += (i ? 'L' : 'M') + (xl + i * .25 * px).toFixed(1) + ',' + Y(sky(site, a)).toFixed(1); }
  E('clipPath', { id: 'skyclip' }, defs).appendChild(E('path', { d: d + `L${xr},0L${xl},0Z` }));
  const sp = [], ep = []; for (let h = 0; h <= WINDOW_H; h++) { const q = series(site, h, off); sp.push([X(q.sa), Y(q.se)]); ep.push([X(q.ea), Y(q.ee)]); }
  const poly = pts => { let o = '', prev = null; pts.forEach(p => { o += (!prev || Math.abs(p[0] - prev[0]) > 200 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); prev = p; }); return o; };
  E('path', { d: poly(sp), fill: 'none', stroke: C.sun, 'stroke-width': 1.5, 'stroke-dasharray': '2 4', 'stroke-linecap': 'round', opacity: .85 }, svg);
  E('path', { d: poly(ep), fill: 'none', stroke: C.earth, 'stroke-width': 1.5, opacity: .9 }, svg);
  for (let k2 = 0; k2 <= 10; k2++) E('circle', { cx: sp[k2 * 24][0], cy: sp[k2 * 24][1], r: 2.2, fill: C.sun }, svg);
  E('path', { d: d + `L${xr},${bottom}L${xl},${bottom}Z`, fill: C.terrain }, svg);
  E('path', { d, fill: 'none', stroke: C.rim, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, svg);
  E('line', { x1: xl, x2: xr, y1: Y(0), y2: Y(0), stroke: C.ink2, 'stroke-opacity': .55, 'stroke-dasharray': '1 3' }, svg);
  E('text', { x: xl - 8, y: Y(0) + 4, 'text-anchor': 'end', 'font-size': 11, fill: C.ink2 }, svg).textContent = '0°';
  const cy = bottom + 1, names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  E('line', { x1: xl, x2: xr, y1: cy, y2: cy, stroke: C.ink3, 'stroke-opacity': .5 }, svg);
  for (let a = 0; a < 360; a += 10) { const x = X(a), big = a % 90 === 0, mid = a % 30 === 0; if (x < xl || x > xr) continue;
    E('line', { x1: x, x2: x, y1: cy, y2: cy + (big ? 7 : mid ? 5 : 3), stroke: C.ink3, 'stroke-opacity': big ? 1 : .6 }, svg);
    if (big) E('text', { x, y: cy + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: C.ink }, svg).textContent = names[a];
    else if (mid) E('text', { x, y: cy + 20, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink3 }, svg).textContent = a + '°'; }
  function disc(a, e, R, core) { const x = X(a), y = Y(e), rx = Math.max(R * px, 1.2), ry = R * py;
    E('ellipse', { cx: x, cy: y, rx, ry, fill: core, 'fill-opacity': .3 }, svg); E('ellipse', { cx: x, cy: y, rx, ry, fill: core, 'clip-path': 'url(#skyclip)' }, svg); return [x, y, rx, ry]; }
  const [sx, sy] = disc(s.sa, s.se, SUN_R, C.sunCore), [ex, ey, , ery] = disc(s.ea, s.ee, EARTH_R, C.earthCore);
  const lab = (x, y, t1, t2, anchor, col) => { const g = E('g', {}, svg);
    const a = E('text', { x, y, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 500, fill: col }, g); a.textContent = t1;
    const b = E('text', { x, y: y + 15, 'text-anchor': anchor, 'font-size': 11.5, fill: C.ink2 }, g); b.textContent = t2;
    const bb = g.getBBox(); g.insertBefore(E('rect', { x: bb.x - 5, y: bb.y - 3, width: bb.width + 10, height: bb.height + 6, rx: 5, fill: C.plot, 'fill-opacity': .88 }), a); };
  const lit = s.sf >= .5;
  if (sx > xl && sx < xr) lab(sx + (sx > cx ? -14 : 14), Math.max(top + 14, sy - 50), lit ? 'Sun, in view' : 'Sun, behind the ridge', `${s.se.toFixed(2)}° up · disc fraction ${s.sf.toFixed(2)}`, sx > cx ? 'end' : 'start', C.sun);
  if (ex > xl && ex < xr) lab(ex + (ex > cx ? -14 : 14), Math.max(top + 14, ey - ery - 26), s.link ? 'Earth, in view' : 'Earth, blocked', `${s.ee.toFixed(2)}° up · clearance ${(s.ec).toFixed(2)}°`, ex > cx ? 'end' : 'start', C.earth);
  return s;
}

/* ── Slip Planner heatmap ── */
export function drawHeat(host, { off, focus, span, onPick, onHover }) {
  host.textContent = '';
  const Wh = host.clientWidth, Hh = host.clientHeight;
  const svg = E('svg', { viewBox: `0 0 ${Wh} ${Hh}`, role: 'img', 'aria-label': 'Heatmap of statuses by site and landing date' }, host);
  const left = 150, right = 110, ovH = 38, top = ovH + 34, rows = SITES.length, rowH = Math.min(46, (Hh - top - 34) / rows), gw = Wh - left - right;
  const d0 = off - Math.round(span * .18), n = span, cw = gw / n, X = d => left + (d - d0) * cw;
  // overview: six years, grey density = how many sites are viable that day
  const g0 = Date.UTC(2026, 0, 1), gDays = Math.round((TIME_GRID.end - g0) / 864e5), ow = gw, ox = left, ok = ow / gDays, base0 = Math.round((g0 - LANDING0) / 864e5);
  E('text', { x: 12, y: 24, 'font-size': 12, fill: C.ink3 }, svg).textContent = '2026 → 2031';
  let od = '';
  for (let i = 0; i < gDays; i += 3) { let v = 0; for (const s of SITES) { const q = status(s.id, base0 + i).st; if (q === 'go' || q === 'caution') v++; } const h = v / SITES.length * 22; od += `M${(ox + i * ok).toFixed(1)},${(30 - h).toFixed(1)}h${(ok * 3).toFixed(2)}v${h.toFixed(1)}h${(-ok * 3).toFixed(2)}Z`; }
  E('path', { d: od, fill: C.ink3, 'fill-opacity': .55 }, svg);
  for (let y = 2026; y <= 2031; y++) { const x = ox + Math.round((Date.UTC(y, 0, 1) - g0) / 864e5) * ok; E('text', { x: x + 4, y: 44, 'font-size': 11, fill: C.ink3 }, svg).textContent = y; E('line', { x1: x, x2: x, y1: 6, y2: 34, stroke: C.line }, svg); }
  const wx = ox + (d0 - base0) * ok;
  const winR = E('rect', { x: wx, y: 4, width: Math.max(4, n * ok), height: 30, rx: 5, fill: 'none', stroke: C.accent, 'stroke-width': 1.5 }, svg);
  void winR;
  const ovHit = E('rect', { x: ox, y: 0, width: ow, height: 40, fill: 'transparent', style: 'cursor:pointer' }, svg);
  ovHit.addEventListener('click', e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * Wh / r.width; onPick && onPick({ pan: Math.round((x - ox) / ok + base0 + n * .32) }); });
  // month labels
  for (let dd = d0; dd < d0 + n; dd++) { const dt = new Date(LANDING0 + dd * 864e5); if (dt.getUTCDate() === 1 && (span < 800 || dt.getUTCMonth() % 3 === 0)) {
    const x = X(dd); E('line', { x1: x, x2: x, y1: top - 8, y2: top + rows * rowH, stroke: C.line }, svg);
    E('text', { x: x + 3, y: top - 12, 'font-size': 11, fill: C.ink3 }, svg).textContent = MONTHS[dt.getUTCMonth()] + (dt.getUTCMonth() === 0 ? ' ' + dt.getUTCFullYear() : ''); } }
  // hatch pattern for NO-GO; dotted for no data
  const defs = E('defs', {}, svg);
  const pat = E('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  E('rect', { width: 5, height: 5, fill: C.nogo, 'fill-opacity': .16 }, pat); E('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: C.nogo, 'stroke-width': 1.6, 'stroke-opacity': .75 }, pat);
  SITES.forEach((s, i) => {
    const y = top + i * rowH + 4, h = rowH - 8, foc = s.id === focus;
    if (foc) E('rect', { x: 6, y: y - 4, width: Wh - 12, height: rowH, rx: 8, fill: C.hover }, svg);
    E('text', { x: 14, y: y + h / 2 + (s.tier === 'sphere' ? -2 : 4), 'font-size': 13, 'font-weight': foc ? 600 : 500, fill: C.ink }, svg).textContent = s.name;
    if (s.tier === 'sphere') E('text', { x: 14, y: y + h / 2 + 12, 'font-size': 11, fill: C.ink3 }, svg).textContent = 'Terrain not modelled';
    let run = null, viable = 0, total = 0, next = null;
    const flush = (endD) => { if (!run) return; const x = X(run.d), w = X(endD) - x - (cw > 3 ? .8 : 0);
      if (run.st === 'go') E('rect', { x, y, width: w, height: h, fill: C.go, 'fill-opacity': run.sc > 85 ? 1 : run.sc > 75 ? .8 : .62 }, svg);
      else if (run.st === 'caution') E('rect', { x, y: y + h / 2, width: w, height: h / 2, fill: C.cau }, svg);
      else if (run.st === 'nogo') E('rect', { x, y, width: w, height: h, fill: 'url(#hatch)' }, svg);
      else E('line', { x1: x, x2: x + w, y1: y + h / 2, y2: y + h / 2, stroke: C.ink3, 'stroke-dasharray': '1 3' }, svg);
      run = null; };
    for (let dd = d0; dd < d0 + n; dd++) { const q = status(s.id, dd), sc = q.score > 85 ? 2 : q.score > 75 ? 1 : 0;
      if (q.st !== 'none') { total++; if (q.st !== 'nogo') { viable++; if (next == null && dd >= off) next = dd; } }
      if (!run || run.st !== q.st || (q.st === 'go' && run.k !== sc)) { flush(dd); run = { d: dd, st: q.st, sc: q.score, k: sc }; } }
    flush(d0 + n);
    E('text', { x: Wh - right + 12, y: y + h / 2 - 2, 'font-size': 13, 'font-weight': 500, fill: C.ink }, svg).textContent = `${Math.round(viable / Math.max(1, total) * 100)} % viable`;
    E('text', { x: Wh - right + 12, y: y + h / 2 + 13, 'font-size': 11, fill: C.ink3 }, svg).textContent = next == null ? 'none in view' : next === off ? 'viable on landing' : 'next ' + fmtDay(LANDING0 + next * 864e5);
  });
  // landing marker
  const mx = X(off) + cw / 2;
  E('line', { x1: mx, x2: mx, y1: top - 6, y2: top + rows * rowH, stroke: C.accent, 'stroke-width': 2 }, svg);
  const t = E('text', { x: mx, y: top + rows * rowH + 18, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 500, fill: '#141414' }, svg); t.textContent = 'Landing ' + fmtDayY(LANDING0 + off * 864e5);
  const b = t.getBBox(); svg.insertBefore(E('rect', { x: b.x - 8, y: b.y - 2, width: b.width + 16, height: b.height + 4, rx: (b.height + 4) / 2, fill: C.accent }), t);
  // hit area
  const hit = E('rect', { x: left, y: top, width: gw, height: rows * rowH, fill: 'transparent', style: 'cursor:pointer' }, svg);
  const at = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * Wh / r.width, y = (e.clientY - r.top) * Hh / r.height;
    const dd = Math.floor((x - left) / cw) + d0, i = Math.floor((y - top) / rowH); return { dd, site: SITES[Math.max(0, Math.min(rows - 1, i))], px: e.clientX - host.getBoundingClientRect().left, py: e.clientY - host.getBoundingClientRect().top }; };
  hit.addEventListener('mousemove', e => onHover && onHover(at(e)));
  hit.addEventListener('mouseleave', () => onHover && onHover(null));
  hit.addEventListener('click', e => { const a = at(e); onPick && onPick({ off: a.dd, site: a.site.id }); });
}

/* ── Compare ── */
export function compareTable(table, { off, focus, onFocus }) {
  const cols = SITES.slice(0, 4).map(s => ({ s, d: detail(s.id, off) }));
  const best = (vals, low) => { const v = vals.filter(x => x != null); const b = low ? Math.min(...v) : Math.max(...v); return vals.map(x => x === b); };
  const rows = [
    ['Status', c => `<span class="status ${c.d.st}"><span class="lamp"><svg><use href="#g-${c.d.st}"/></svg></span>${STATUS_WORD[c.d.st]}</span> <span class="lim">score ${c.d.st === 'nogo' ? `<s>${c.d.score}</s> not used` : c.d.score}</span>`],
    ['Broken rule', c => c.d.broken ? `<span class="v bad">${c.d.broken.name} ${c.d.broken.value} h</span> <span class="lim">limit ${c.d.broken.limit} h</span>` : '<span class="lim">None</span>'],
    ['Sunlight', c => c.d.metrics.lit, true, false, 'sun', v => `${v} %`],
    ['Longest dark stretch', c => c.d.metrics.dark, false, true, null, v => `${v} h`, 'limit 6 h'],
    ['Earth link', c => c.d.metrics.link, true, false, 'earth', v => `${v} %`],
    ['Longest blackout', c => c.d.metrics.blackout, false, true, null, v => `${v} h`, 'limit 12 h'],
    ['Sun at landing', c => c.d.metrics.sunLand, true, false, null, v => `${v.toFixed(2)}°`],
    ['Slope, 100 m baseline', c => c.d.metrics.slope, false, true, null, v => v == null ? '—' : `${v}°`, 'limit 10°'],
  ];
  const spread = vals => { const v = vals.filter(x => x != null); return v.length ? (Math.max(...v) - Math.min(...v)) / (Math.max(...v.map(Math.abs)) || 1) : 0; };
  let decide = 'Longest blackout', maxS = -1;
  rows.forEach(r => { if (r.length < 4) return; const s = spread(cols.map(c => r[1](c))); const lim = r[6]; if (lim && s > maxS && cols.some(c => c.d.broken && c.d.broken.name === r[0].replace(' stretch', ''))) { maxS = s; decide = r[0]; } });
  let h = '<colgroup><col class="rowh">' + cols.map(() => '<col>').join('') + '</colgroup><thead><tr><th scope="col"><span class="vh">Row</span></th>' + cols.map(c => `<th scope="col"><button data-site="${c.s.id}" aria-label="Focus ${c.s.name}">${c.s.name}</button><small>${c.s.tier === 'sphere' ? 'Terrain not modelled' : c.s.lat.toFixed(2).replace('-', '−') + '°, ' + c.s.lon.toFixed(2) + '° E'}</small></th>`).join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    if (r.length < 4) { h += `<tr><th scope="row">${r[0]}</th>${cols.map(c => `<td>${r[1](c)}</td>`).join('')}</tr>`; continue; }
    const [name, get, higher, low, bar, fmt, lim] = r, vals = cols.map(get), isB = best(vals, low), mx = Math.max(...vals.filter(v => v != null), 1);
    h += `<tr class="${name === decide ? 'decides' : ''}"><th scope="row">${name}${lim ? `<br><span class="lim">${lim}</span>` : ''}${name === decide ? '<br><span class="lim">decides between them</span>' : ''}</th>` + cols.map((c, i) => {
      const v = vals[i], bad = c.d.broken && name.startsWith(c.d.broken.name);
      return `<td><span class="v ${bad ? 'bad' : ''}">${fmt(v)}</span>${isB[i] && v != null ? '<span class="best">best</span>' : ''}${bar && v != null ? `<div class="bar ${bar}"><i style="width:${v / 100 * 100}%"></i></div>` : (!bar && v != null && lim ? `<div class="bar"><i style="width:${Math.min(100, v / (mx || 1) * 100)}%"></i></div>` : '')}</td>`;
    }).join('') + '</tr>';
    void higher;
  }
  table.innerHTML = h + '</tbody>';
  table.querySelectorAll('thead button').forEach(b => b.addEventListener('click', () => onFocus(b.dataset.site)));
  const go = cols.filter(c => c.d.st === 'go'), ng = cols.filter(c => c.d.st === 'nogo');
  const date = fmtDayY(LANDING0 + off * 864e5);
  let sum = `For IM-2 Athena landing ${date}, `;
  sum += go.length === 0 ? 'no site is GO. ' : go.length === 1 ? `${go[0].s.name} is the only GO site. ` : `${go.map(c => c.s.name).join(' and ').replace(/ and (?=.* and )/g, ', ')} are GO. `;
  if (ng.length) sum += ng.map(c => `${c.s.name} fails on a ${c.d.broken.value}-hour ${c.d.broken.name === 'Longest blackout' ? 'blackout' : 'dark stretch'}`).join('; ') + '.';
  return sum;
}
export { siteById };

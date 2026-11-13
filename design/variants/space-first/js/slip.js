/* The Slip Planner on the Moon: the six-year verdict store, the landing-date panel (one strip
   per selected site, an "Any site" line, the landing-date slider) and the spots on the ground.
   Every status here, on a spot, a strip, a hover or the focused-site panel, comes from one
   function, detail() in data.js. The store only remembers what it returned. */
import { SITES, detail, LANDING0, WINDOW_H, TIME_GRID, STATUS_WORD, fmtDay, fmtDayY, MONTHS, polarXY } from './data.js';

export const G0 = Math.round((TIME_GRID.start - LANDING0) / 864e5);  // first landing offset on the time grid
export const GN = Math.round((TIME_GRID.end - TIME_GRID.start) / 864e5); // days on the grid
const CODE = ['none', 'go', 'caution', 'nogo'], RANK = { go: 3, caution: 2, nogo: 1, none: 0 };
const offMs = off => LANDING0 + off * 864e5;
const brokenOf = (k, v) => k ? { name: k === 1 ? 'Longest dark' : 'Longest blackout', value: v, limit: k === 1 ? 6 : 12 } : null;
const shortWhy = b => b ? `${b.name === 'Longest dark' ? 'dark' : 'blackout'} ${b.value} h` : null;

/* ── the store ── */
const store = new Map();
function rec(id) {
  let r = store.get(id);
  if (!r) { r = { st: new Int8Array(GN).fill(-1), sc: new Uint8Array(GN), bk: new Uint8Array(GN), bv: new Uint16Array(GN), n: 0 }; store.set(id, r); }
  return r;
}
function put(r, i, d) {
  if (r.st[i] < 0) r.n++;
  r.st[i] = CODE.indexOf(d.st); r.sc[i] = d.score;
  r.bk[i] = d.broken ? (d.broken.name === 'Longest dark' ? 1 : 2) : 0; r.bv[i] = d.broken ? d.broken.value : 0;
}
/* The verdict for a site and landing offset: from the sweep, or computed now by the same function. */
export function vAt(id, off) {
  const i = off - G0;
  if (i < 0 || i >= GN) return { st: 'none', score: 0, broken: null };
  const r = rec(id);
  if (r.st[i] < 0) put(r, i, detail(id, off));
  return { st: CODE[r.st[i]], score: r.sc[i], broken: brokenOf(r.bk[i], r.bv[i]) };
}
const known = (id, off) => { const i = off - G0; return i >= 0 && i < GN && rec(id).st[i] >= 0; };
/* best of the selected sites on one date: rank by status, then by score */
export function bestAt(off, sites = SITES) {
  let best = null;
  for (const s of sites) { const v = vAt(s.id, off); if (v.st === 'none') continue;
    if (!best || RANK[v.st] > RANK[best.v.st] || (RANK[v.st] === RANK[best.v.st] && v.score > best.v.score)) best = { s, v }; }
  return best;
}

let worker = null, onData = () => {}, progress = { done: 0, total: 0 };
export function sweepProgress() { return progress; }
export function pendingDays(id) { const r = rec(id), out = []; for (let i = 0; i < GN; i++) if (r.st[i] < 0) out.push(G0 + i); return out; }
export function startSweep(from, to, cb) {
  onData = cb || onData;
  const todo = SITES.filter(s => rec(s.id).n < GN).map(s => s.id);
  progress = { done: SITES.reduce((a, s) => a + rec(s.id).n, 0), total: SITES.length * GN };
  if (!todo.length) { onData(true); return; }
  const msg = { sites: todo, first: G0, last: G0 + GN - 1, from: Math.max(G0, from), to: Math.min(G0 + GN - 1, to) };
  try {
    if (!worker) {
      worker = new Worker(new URL('./sweep.js', import.meta.url), { type: 'module' });
      worker.onmessage = e => {
        const m = e.data;
        if (m.done) { onData(true); return; }
        const r = rec(m.site);
        for (let k = 0; k < m.st.length; k++) { const i = m.off0 + k - G0; if (r.st[i] < 0) { r.n++; progress.done++; } r.st[i] = m.st[k]; r.sc[i] = m.sc[k]; r.bk[i] = m.bk[k]; r.bv[i] = m.bv[k]; }
        onData(false);
      };
      worker.onerror = () => { worker = null; mainThreadSweep(msg); };
    }
    worker.postMessage(msg);
  } catch (e) { mainThreadSweep(msg); }
}
/* no module workers: the same sweep in small slices on the main thread */
let mtJob = 0;
function mainThreadSweep({ sites, first, last, from, to }) {
  const id = ++mtJob, q = [];
  for (const [a, b] of [[from, to], [to + 1, last], [first, from - 1]]) for (let o = a; o <= b; o++) for (const s of sites) q.push([s, o]);
  const step = () => {
    if (id !== mtJob) return;
    const t0 = performance.now();
    while (q.length && performance.now() - t0 < 10) { const [s, o] = q.shift(); if (!known(s, o)) { vAt(s, o); progress.done++; } }
    onData(!q.length); if (q.length) setTimeout(step, 0);
  };
  step();
}

/* ── the landing-date panel ── */
export function createDates(host, ctx) {
  const { S, setOff, setFocus, lampHTML, statusHTML } = ctx;
  let rowsKey = '', els = null, probe = null, drag = null, tip = null;
  const span = () => S.dateSpan, last = G0 + GN - 1;
  function clampD0(d0) { return Math.max(G0, Math.min(G0 + GN - span(), d0)); }
  function follow(force) {
    const n = span();
    if (n >= GN) { S.dateD0 = G0; return; }
    if (force || S.dateD0 == null || S.off < S.dateD0 + n * .04 || S.off > S.dateD0 + n * .86) S.dateD0 = clampD0(S.off - Math.round(n * .25));
  }

  function skeleton() {
    const phone = matchMedia('(max-width:700px)').matches; // touch: the whole strip area is the target, so strips leave the tab order
    const rows = [{ any: true }, ...SITES];
    host.innerHTML = `
      <div class="tl-h">
        <h2>Landing dates</h2><span class="tl-win" id="dt-win"></span>
        <span class="dt-key" aria-hidden="true"><span><i class="k-go"></i>GO</span><span><i class="k-cau"></i>CAUTION</span><span><i class="k-nogo"></i>NO-GO</span></span>
        <div class="dt-bar" id="dt-prog" role="progressbar" aria-label="Working out six years of landing dates" aria-valuemin="0" aria-valuemax="100"><i></i></div>
        <div class="ctl">
          <span class="mseg" id="dt-zoom" role="group" aria-label="Show">${[[91, '3 months'], [548, '18 months'], [GN, '6 years']].map(([v, t]) => `<button data-z="${v}" aria-pressed="${v === span()}">${t}</button>`).join('')}</span>
          <button class="tgl" id="tgl-d" aria-label="Fold the landing dates" aria-expanded="${!S.col.d}"><svg class="i"><use href="#i-${S.col.d ? 'up' : 'down'}"/></svg></button>
        </div>
      </div>
      <div class="dt-grid" id="dt-grid" style="grid-template-rows:22px ${SITES.length > 1 ? '16px 2px' : '0 0'} repeat(${SITES.length}, var(--dt-h)) 18px">
        <div class="dt-pillrow" aria-hidden="true"></div>
        <div class="dt-over" style="grid-row:1 / ${SITES.length + 5}">
          <div class="dt-win" aria-hidden="true"></div>
          <div class="dt-was" aria-hidden="true"><span></span></div>
          <div class="dt-probe" aria-hidden="true"></div>
          <div class="dt-knob" tabindex="0" role="slider" aria-label="Landing date" aria-valuemin="${G0}" aria-valuemax="${last}"><span class="pill"></span><i></i></div>
        </div>
        ${rows.map((r, i) => r.any
          ? `<div class="dt-lab any" style="grid-row:2"><span class="lampslot"></span><span class="nm">Any site</span></div>
             <div class="dt-s any" style="grid-row:2" tabindex="${phone ? -1 : 0}" role="slider" aria-valuemin="${G0}" aria-valuemax="${last}" aria-label="Any site: the best status among your sites, by landing date. Arrow keys move along the strip, Enter lands on that date." data-row="any"><svg preserveAspectRatio="none"></svg></div>
             <div class="dt-next any" style="grid-row:2"></div>`
          : `<button class="dt-lab${r.variantOf ? ' var' : ''}" style="grid-row:${i + 3}" data-site="${r.id}" tabindex="-1" title="Focus ${r.name}${r.variantOf ? ', chosen by TrueSouth' : ''}"><span class="lampslot"></span><span class="nm">${r.variantOf ? 'Best-lit' : r.short || r.name}</span>${r.variantOf ? '<span class="tag var">chosen by TrueSouth</span>' : ''}</button>
             <div class="dt-s" style="grid-row:${i + 3}" tabindex="${phone ? -1 : 0}" role="slider" aria-valuemin="${G0}" aria-valuemax="${last}" aria-label="${r.name}: status by landing date. Arrow keys move along the strip, Enter lands on that date." data-row="${r.id}"><svg preserveAspectRatio="none"></svg></div>
             <div class="dt-next" style="grid-row:${i + 3}" data-row="${r.id}"></div>`).join('')}
        <div class="dt-axis" style="grid-row:${SITES.length + 4}"><svg></svg></div>
      </div>`;
    els = {
      grid: host.querySelector('#dt-grid'), over: host.querySelector('.dt-over'), knob: host.querySelector('.dt-knob'), pill: host.querySelector('.dt-knob .pill'),
      win: host.querySelector('.dt-win'), was: host.querySelector('.dt-was'), probe: host.querySelector('.dt-probe'), axis: host.querySelector('.dt-axis svg'),
      strips: [...host.querySelectorAll('.dt-s')], labs: [...host.querySelectorAll('.dt-lab')], nexts: [...host.querySelectorAll('.dt-next')], prog: host.querySelector('#dt-prog'),
    };
    wire();
  }

  /* one strip: runs of one status; GO full height, CAUTION half, NO-GO a low line, so status is not colour alone */
  function stripSVG(svg, getCode, getScore, d0, n) {
    const H = 12, parts = [];
    let run = null;
    const flush = end => {
      if (!run) return;
      const x = run.d - d0, w = end - run.d;
      if (run.c === 1) parts.push(`<rect x="${x}" y="0" width="${w}" height="${H}" fill="var(--status-go)"/>`);
      else if (run.c === 2) parts.push(`<rect x="${x}" y="${H / 2}" width="${w}" height="${H / 2}" fill="var(--status-caution)"/>`);
      else if (run.c === 3) parts.push(`<rect x="${x}" y="${H - 2.4}" width="${w}" height="2.4" fill="var(--status-nogo)" fill-opacity=".8"/>`);
      else if (run.c === 0) parts.push(`<rect x="${x}" y="${H / 2 - .5}" width="${w}" height="1" fill="var(--ink-4)"/>`);
      else parts.push(`<rect x="${x}" y="0" width="${w}" height="${H}" fill="var(--hover)" class="pending"/>`);
      run = null;
    };
    for (let d = d0; d < d0 + n; d++) { const c = getCode(d); if (!run || run.c !== c) { flush(d); run = { d, c }; } }
    flush(d0 + n);
    svg.setAttribute('viewBox', `0 0 ${n} ${H}`);
    svg.innerHTML = `<rect x="0" y="0" width="${n}" height="${H}" fill="var(--plot)"/>` + parts.join('');
    void getScore;
  }
  const codeOf = id => d => { const i = d - G0; if (i < 0 || i >= GN) return 0; return rec(id).st[i]; };
  const anyCode = d => { // the best status among the selected sites; pending while unknown and not yet GO
    const i = d - G0; if (i < 0 || i >= GN) return 0;
    let best = 0, pend = false;
    for (const s of SITES) { const c = rec(s.id).st[i]; if (c < 0) { pend = true; continue; } const rk = c === 1 ? 3 : c === 2 ? 2 : c === 3 ? 1 : 0; if (rk > best) best = rk; }
    if (pend && best < 3) return -1;
    return best === 3 ? 1 : best === 2 ? 2 : best === 1 ? 3 : 0;
  };
  function nextGo(getCode) {
    for (let d = S.off; d <= last; d++) { const c = getCode(d); if (c < 0) return ''; if (c === 1) return d === S.off ? 'GO on this date' : `next GO ${fmtDay(offMs(d))}${new Date(offMs(d)).getUTCFullYear() !== new Date(offMs(S.off)).getUTCFullYear() ? ' ' + new Date(offMs(d)).getUTCFullYear() : ''}`; }
    return 'no GO before 2032';
  }

  function render() {
    const key = SITES.map(s => s.id).join(',') + '|' + span() + '|' + S.col.d + '|' + innerWidth;
    if (key !== rowsKey || !els) { rowsKey = key; skeleton(); }
    host.classList.toggle('collapsed', !!S.col.d);
    follow(false);
    const d0 = S.dateD0, n = span();
    const a = offMs(S.off);
    host.querySelector('#dt-win').textContent = `Mission window ${fmtDay(a)} → ${fmtDay(a + WINDOW_H * 36e5)}, 00:00 UTC`;
    // strips and the "next GO" column
    stripSVG(els.strips[0].querySelector('svg'), anyCode, null, d0, n);
    SITES.forEach((s, k) => stripSVG(els.strips[k + 1].querySelector('svg'), codeOf(s.id), null, d0, n));
    els.nexts[0].textContent = nextGo(anyCode);
    SITES.forEach((s, k) => { els.nexts[k + 1].textContent = nextGo(codeOf(s.id)); });
    // the lamps at the row starts: the status on the landing date
    const b = bestAt(S.off);
    els.labs[0].querySelector('.lampslot').innerHTML = lampHTML(b ? b.v.st : 'none');
    SITES.forEach((s, k) => { const v = vAt(s.id, S.off); const lab = els.labs[k + 1]; lab.querySelector('.lampslot').innerHTML = lampHTML(v.st); lab.setAttribute('aria-current', s.id === S.focus); lab.title = `${s.name}: ${STATUS_WORD[v.st]} on ${fmtDayY(a)}`; });
    els.strips.forEach((el, k) => el.classList.toggle('foc', k > 0 && SITES[k - 1].id === S.focus));
    axis(d0, n);
    place();
    const p = sweepProgress();
    const pc = p.total ? Math.floor(p.done / p.total * 100) : 0;
    els.prog.hidden = !!p.total && p.done >= p.total; els.prog.setAttribute('aria-valuenow', pc); els.prog.querySelector('i').style.width = pc + '%';
  }
  function place() {
    const d0 = S.dateD0, n = span(), X = d => (d - d0) / n * 100;
    const inView = S.off >= d0 && S.off < d0 + n;
    els.knob.style.left = `${Math.max(0, Math.min(100, X(S.off + .5)))}%`;
    els.knob.classList.toggle('edge-l', S.off < d0); els.knob.classList.toggle('edge-r', S.off >= d0 + n);
    els.pill.textContent = `${S.off < d0 ? '← ' : ''}Landing ${fmtDayY(offMs(S.off))}${S.off >= d0 + n ? ' →' : ''}`;
    els.win.hidden = !inView;
    els.win.style.left = `${X(S.off)}%`; els.win.style.width = `${Math.max(.35, Math.min(X(S.off + WINDOW_H / 24), 100) - X(S.off))}%`;
    // keep the pill inside the strip column
    requestAnimationFrame(() => { const ow = els.over.clientWidth, pw = els.pill.offsetWidth, x = els.knob.offsetLeft; let dx = 0; if (x - pw / 2 < 0) dx = pw / 2 - x; if (x + pw / 2 > ow) dx = ow - x - pw / 2; els.pill.style.transform = `translateX(calc(-50% + ${dx}px))`; });
    const v = SITES.map(s => vAt(s.id, S.off)), go = v.filter(q => q.st === 'go').length;
    els.knob.setAttribute('aria-valuenow', S.off);
    els.knob.setAttribute('aria-valuetext', `Landing ${fmtDayY(offMs(S.off))}. ${go} of ${SITES.length} site${SITES.length > 1 ? 's' : ''} GO.`);
    // the date before the slip, as a ghost line
    const from = S.slipFrom && S.slipFrom.off !== S.off ? S.slipFrom.off : null;
    els.was.hidden = from == null || from < d0 || from >= d0 + n;
    if (from != null) { els.was.style.left = `${X(from + .5)}%`; els.was.querySelector('span').textContent = `was ${fmtDay(offMs(from))}`; }
    if (probe) { els.probe.hidden = false; els.probe.style.left = `${X(probe.off)}%`; els.probe.style.width = `${Math.max(.3, 100 / n)}%`; const r = els.strips[probe.row].getBoundingClientRect(), o = els.over.getBoundingClientRect(); els.probe.style.top = (r.top - o.top - 2) + 'px'; els.probe.style.height = (r.height + 4) + 'px'; }
    else els.probe.hidden = true;
  }
  function axis(d0, n) {
    const W = els.axis.clientWidth || 800, parts = [];
    els.axis.setAttribute('viewBox', `0 0 ${W} 18`);
    const X = d => (d - d0) / n * W, pxm = W / (n / 30.44);
    const step = [1, 2, 3, 6, 12].find(k => pxm * k >= (n >= GN ? 40 : 46)) || 12;
    let first = true;
    for (let d = d0; d < d0 + n; d++) {
      const dt = new Date(offMs(d)); if (dt.getUTCDate() !== 1) continue;
      const m = dt.getUTCMonth(), y = dt.getUTCFullYear(), lab = m % step === 0;
      if (n >= GN && m % 3) continue;
      parts.push(`<line x1="${X(d)}" x2="${X(d)}" y1="0" y2="${m === 0 ? 6 : 3}" stroke="var(--ink-3)" stroke-opacity="${m === 0 ? 1 : .55}"/>`);
      if (!lab || X(d) > W - 22) continue;
      const t = m === 0 || n >= GN ? String(y) : first && pxm * step >= 64 ? `${MONTHS[m]} ${y}` : MONTHS[m];
      if (n >= GN && m !== 0) continue;
      parts.push(`<text x="${X(d) + 3}" y="16" font-size="11" fill="var(--ink-3)">${t}</text>`); first = false;
    }
    els.axis.innerHTML = parts.join('');
  }

  /* ── reading a strip ── */
  function rowAt(y) { for (let k = 0; k < els.strips.length; k++) { const r = els.strips[k].getBoundingClientRect(); if (y >= r.top - 4 && y <= r.bottom + 4) return k; } return -1; }
  function dayAt(x) { const r = els.over.getBoundingClientRect(); return Math.floor(S.dateD0 + (x - r.left) / r.width * span()); }
  function tipHTML(row, off) {
    const when = `${fmtDayY(offMs(off))} 00:00 UTC`;
    if (off < G0 || off > last) return `<h4>${when}</h4><p>Outside the time grid.</p>`;
    if (row === 0) {
      const b = bestAt(off), goN = SITES.filter(s => vAt(s.id, off).st === 'go').length;
      if (!b) return `<h4>Any site · ${when}</h4><p>No data: the window runs past the end of 2031.</p>`;
      return `<h4>Any site · ${when}</h4><div class="t-st">${statusHTML(b.v.st)}</div><p>${b.v.st === 'go' ? `${goN} of ${SITES.length} GO. Best: ${b.s.name}, score ${b.v.score}.` : b.v.st === 'caution' ? `No site is GO. Best: ${b.s.name}, CAUTION, score ${b.v.score}.` : `Every site is NO-GO on this date.`}</p><p class="lbl">Click to land on this date</p>`;
    }
    const s = SITES[row - 1], d = detail(s.id, off), nm = s.variantOf ? `${s.name} <span class="tag var">chosen by TrueSouth</span>` : s.name;
    if (d.st === 'none') return `<h4>${s.name} · ${when}</h4><div class="t-st">${statusHTML('none')}</div><p>The mission window runs past the end of 2031.</p>`;
    const why = d.broken ? `${d.broken.name} ${d.broken.value} h, limit ${d.broken.limit} h. Score <s>${d.score}</s> not used.` : d.st === 'caution' ? `Every rule passes. Score ${d.score}, under the 70 needed for GO.` : `Every rule passes. Score ${d.score}.`;
    return `<h4>${nm} · ${when}</h4><div class="t-st">${statusHTML(d.st)}</div><p>${why}</p><p class="lbl">${row - 1 >= 0 ? 'Click to land on this date' : ''}</p>`;
  }
  function showTip(row, off, x, y) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip dt-tip'; tip.setAttribute('role', 'tooltip'); host.appendChild(tip); }
    tip.innerHTML = tipHTML(row, off);
    const hr = host.getBoundingClientRect();
    const tx = Math.max(8, Math.min(hr.width - 288, x - hr.left - 140));
    tip.style.left = tx + 'px'; tip.style.top = ''; tip.style.bottom = (hr.bottom - y + 14) + 'px';
  }
  function hideTip() { if (tip) { tip.remove(); tip = null; } }
  function announce(row, off) {
    const el = els.strips[row], t = document.createElement('div'); t.innerHTML = tipHTML(row, off);
    el.setAttribute('aria-valuenow', off); el.setAttribute('aria-valuetext', t.textContent.replace('Click to land on this date', '').trim());
  }

  function land(off, row) {
    off = Math.max(G0, Math.min(last, off));
    if (!S.slipFrom) S.slipFrom = { off: S.off };
    if (row > 0 && SITES[row - 1].id !== S.focus) setFocus(SITES[row - 1].id, { keepCamera: true });
    setOff(off);
  }
  function wire() {
    host.querySelector('#dt-zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.dateSpan = +b.dataset.z; follow(true); render(); host.querySelector(`#dt-zoom [data-z="${b.dataset.z}"]`).focus(); });
    host.querySelector('#tgl-d').addEventListener('click', () => { S.col.d = !S.col.d; ctx.relayout(); host.querySelector('#tgl-d').focus(); });
    // pointer: drag anywhere on the strips to move the landing date; a click also focuses that row's site
    els.over.addEventListener('pointerdown', e => {
      if (e.target.closest('.dt-knob') && e.target.closest('.pill') && (els.knob.classList.contains('edge-l') || els.knob.classList.contains('edge-r'))) { follow(true); render(); return; }
      drag = { x: e.clientX, row: rowAt(e.clientY), moved: 0, startOff: S.off }; els.over.setPointerCapture(e.pointerId); hideTip();
      if (!S.slipFrom) S.slipFrom = { off: S.off };
      const d = dayAt(e.clientX); if (d !== S.off) setOff(Math.max(G0, Math.min(last, d)));
    });
    els.over.addEventListener('pointermove', e => {
      if (drag) { drag.moved += Math.abs(e.clientX - drag.x); drag.x = e.clientX; const d = Math.max(G0, Math.min(last, dayAt(e.clientX))); if (d !== S.off) setOff(d); return; }
      const row = rowAt(e.clientY); if (row < 0) { hideTip(); return; }
      showTip(row, dayAt(e.clientX), e.clientX, els.strips[row].getBoundingClientRect().top);
    });
    els.over.addEventListener('pointerup', () => { if (drag && drag.moved < 4 && drag.row > 0) setFocus(SITES[drag.row - 1].id, { keepCamera: true }); drag = null; });
    els.over.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
    els.over.addEventListener('wheel', e => { if (span() >= GN) return; e.preventDefault(); S.dateD0 = clampD0(S.dateD0 + Math.sign(e.deltaY || e.deltaX) * Math.round(span() * .08)); render(); }, { passive: false });
    // keyboard: the slider moves a day, a week with Shift
    els.knob.addEventListener('keydown', e => {
      const k = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageDown: -30, PageUp: 30 }[e.key];
      let d = null;
      if (k) d = S.off + k * (e.shiftKey && Math.abs(k) === 1 ? 7 : 1);
      if (e.key === 'Home') d = G0; if (e.key === 'End') d = last - WINDOW_H / 24;
      if (d == null) return;
      e.preventDefault(); if (!S.slipFrom) S.slipFrom = { off: S.off }; setOff(Math.max(G0, Math.min(last, d)));
    });
    // keyboard on a strip: arrows move a reading point along it; Enter lands there
    els.strips.forEach((el, row) => {
      el.addEventListener('focus', () => { probe = { row, off: S.off }; place(); announce(row, probe.off); const r = el.getBoundingClientRect(), o = els.over.getBoundingClientRect(); showTip(row, probe.off, o.left + (probe.off - S.dateD0 + .5) / span() * o.width, r.top); });
      el.addEventListener('blur', () => { probe = null; place(); hideTip(); });
      el.addEventListener('keydown', e => {
        if (!probe) return;
        const k = { ArrowLeft: -1, ArrowRight: 1, PageDown: -30, PageUp: 30 }[e.key];
        if (k) { e.preventDefault(); probe.off = Math.max(G0, Math.min(last, probe.off + k * (e.shiftKey && Math.abs(k) === 1 ? 7 : 1)));
          if (probe.off < S.dateD0 || probe.off >= S.dateD0 + span()) { S.dateD0 = clampD0(probe.off - Math.round(span() * .5)); render(); }
          place(); announce(row, probe.off); const r = el.getBoundingClientRect(), o = els.over.getBoundingClientRect(); showTip(row, probe.off, o.left + (probe.off - S.dateD0 + .5) / span() * o.width, r.top); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const off = probe.off; land(off, row); requestAnimationFrame(() => { const t = els.strips[row]; if (t) { t.focus(); } }); }
        if (e.key === 'Escape') { el.blur(); }
      });
    });
  }
  return { render, place, follow, get els() { return els; }, hideTip };
}

export { shortWhy, RANK, offMs };
export function polarOf(s) { return polarXY(s.lat, s.lon); }

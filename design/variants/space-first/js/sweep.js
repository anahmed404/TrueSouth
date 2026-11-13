/* The Slip Planner's six-year sweep, off the main thread. It runs the same detail() that
   the focused-site panel, the hover readout and the spots use, so they cannot disagree.
   Message in: { sites: [id], first: off, last: off, from: off, to: off } (from..to first).
   Messages out: { site, off0, st, sc, bk, bv } chunks, then { done: true }. */
import { detail, setSeriesCache } from './data.js';

setSeriesCache(false); // a sweep never revisits an hour, so the cache only costs time
const ST = { none: 0, go: 1, caution: 2, nogo: 3 };
let job = 0;

self.onmessage = e => {
  const id = ++job, { sites, first, last, from, to } = e.data;
  // the visible range first, then the rest outwards
  const ranges = [[Math.max(first, from), Math.min(last, to)], [Math.min(last, to) + 1, last], [first, Math.max(first, from) - 1]];
  const queue = [];
  for (const [a, b] of ranges) for (let o = a; o <= b; o += 60) for (const s of sites) queue.push([s, o, Math.min(b, o + 59)]);
  const step = () => {
    if (id !== job) return; // a newer job replaced this one
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 40) {
      const [s, a, b] = queue.shift(), n = b - a + 1;
      const st = new Int8Array(n), sc = new Uint8Array(n), bk = new Uint8Array(n), bv = new Uint16Array(n);
      for (let i = 0; i < n; i++) {
        const d = detail(s, a + i);
        st[i] = ST[d.st]; sc[i] = d.score;
        if (d.broken) { bk[i] = d.broken.name === 'Longest dark' ? 1 : 2; bv[i] = d.broken.value; }
      }
      self.postMessage({ site: s, off0: a, st, sc, bk, bv }, [st.buffer, sc.buffer, bk.buffer, bv.buffer]);
    }
    if (queue.length) setTimeout(step, 0); else self.postMessage({ done: true });
  };
  step();
};

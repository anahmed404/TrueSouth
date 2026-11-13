// Builds web/public/stars.bin, the System view's star background, from the Yale Bright Star
// Catalogue, 5th revised edition (Hoffleit and Warren 1991; CDS catalogue V/50), in the copy
// HEASARC serves as its "bsc5p" table. NASA HEASARC marks the table public
// (`table_security = public`); the catalogue is a NASA/ADC product with no use restriction.
//
// How to run it again (the download is not committed):
//   1. Download https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_bsc5p.tdat.gz
//      (on the lead developer's machine, fetch it with Python and `truststore`, not with
//      certificate checks turned off).
//   2. node web/dev/build-stars.mjs path/to/heasarc_bsc5p.tdat.gz
//
// The file: the 8-byte magic "TSSTARS1", a little-endian uint32 star count, then 8 bytes a
// star, brightest first: x, y, z (int16, a unit vector times 32767, in scene axes), the V
// magnitude (uint8, (V + 2) × 20) and B−V (int8, B−V × 50).
//
// Orientation. The scene is Moon-fixed (docs/science.md §14: scene (x, y, z) is Moon-fixed
// (x, −z, y)), and the stars are fixed in the sky (J2000, ICRF). Turning one into the other
// for a date is ephemeris work, which the frontend does not do. So the stars are placed by
// one fixed rotation: the IAU 2015 model of the Moon's orientation (Archinal et al. 2018) at
// J2000 (pole at right ascension 269.9949°, declination 66.5392°; prime meridian at
// W = 38.3213°), without its periodic terms. The Moon's pole therefore points where it truly
// points, and the Moon's equator lies near the ecliptic among the right stars, but the sky is
// turned about the pole as it was on 2000-01-01, not as it is at the scrubber's time. The
// stars are decoration and never decide or imply a result.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const MAG_LIMIT = 6.5;
const input = process.argv[2];
if (!input) {
  console.error("usage: node web/dev/build-stars.mjs path/to/heasarc_bsc5p.tdat.gz");
  process.exit(1);
}

const raw = gunzipSync(readFileSync(input)).toString("latin1");
const lines = raw.split(/\r?\n/);
const header = lines.find((line) => line.startsWith("line[1] = "));
if (!header) throw new Error("no line[1] header in the tdat file");
const fields = header.slice("line[1] = ".length).trim().split(/\s+/);
const col = (name) => {
  const i = fields.indexOf(name);
  if (i < 0) throw new Error(`no ${name} field`);
  return i;
};
const RA = col("ra");
const DEC = col("dec");
const VMAG = col("vmag");
const BV = col("bv_color");

const start = lines.indexOf("<DATA>");
const stars = [];
for (const line of lines.slice(start + 1)) {
  if (line.startsWith("<END>") || !line.includes("|")) continue;
  const cells = line.split("|");
  const ra = Number.parseFloat(cells[RA]);
  const dec = Number.parseFloat(cells[DEC]);
  const vmag = Number.parseFloat(cells[VMAG]);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(vmag) || vmag > MAG_LIMIT) continue;
  const bvRaw = Number.parseFloat(cells[BV]);
  stars.push({ ra, dec, vmag, bv: Number.isFinite(bvRaw) ? bvRaw : 0.6 });
}
stars.sort((a, b) => a.vmag - b.vmag);

const rad = Math.PI / 180;
/** ICRF unit vector from right ascension and declination in degrees. */
function icrf(raDeg, decDeg) {
  const a = raDeg * rad;
  const d = decDeg * rad;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}
// ICRF → Moon-fixed: Rz(W) · Rx(90° − δ0) · Rz(90° + α0) (the IAU convention).
const alpha0 = 269.9949;
const delta0 = 66.5392;
const W = 38.3213;
const rz = (deg, [x, y, z]) => {
  const c = Math.cos(deg * rad);
  const s = Math.sin(deg * rad);
  return [c * x + s * y, -s * x + c * y, z];
};
const rx = (deg, [x, y, z]) => {
  const c = Math.cos(deg * rad);
  const s = Math.sin(deg * rad);
  return [x, c * y + s * z, -s * y + c * z];
};
const moonFixed = (v) => rz(W, rx(90 - delta0, rz(90 + alpha0, v)));

const out = Buffer.alloc(12 + stars.length * 8);
out.write("TSSTARS1", 0, "latin1");
out.writeUInt32LE(stars.length, 8);
stars.forEach((star, i) => {
  const [mx, my, mz] = moonFixed(icrf(star.ra, star.dec));
  // Moon-fixed (x, y, z) is scene (x, z, −y) (docs/science.md §14).
  const scene = [mx, mz, -my];
  const o = 12 + i * 8;
  for (let k = 0; k < 3; k += 1) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, scene[k])) * 32767), o + k * 2);
  out.writeUInt8(Math.round(Math.max(0, Math.min(255, (star.vmag + 2) * 20))), o + 6);
  out.writeInt8(Math.round(Math.max(-127, Math.min(127, star.bv * 50))), o + 7);
});

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../public/stars.bin");
writeFileSync(target, out);
console.log(`wrote ${stars.length} stars to magnitude ${MAG_LIMIT}, ${out.length} bytes, to ${target}`);

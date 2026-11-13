/**
 * Temporary Int16 series decoder for the G10 test.
 * The shared decoder in `web/src/data/` replaces this once it lands.
 * Binary layout: docs/data-contracts.md, little-endian, column after column.
 * value = raw * scale + offset, in float64, matching `series.py`.
 */

import { readFileSync } from "node:fs";

export type SeriesColumnEncoding = {
  name: string;
  scale: number;
  offset: number;
};

export type DecodedSeries = {
  sun_az: Float64Array;
  sun_el: Float64Array;
  sun_frac: Float64Array;
  sun_clear: Float64Array;
  earth_az: Float64Array;
  earth_el: Float64Array;
  earth_frac: Float64Array;
  earth_clear: Float64Array;
};

export function decodeSeriesFile(binPath: string, columns: SeriesColumnEncoding[]): DecodedSeries {
  const bin = readFileSync(binPath);
  const decoded = decodeSeriesBuffer(bin, columns);
  return {
    sun_az: column(decoded, "sun_az"),
    sun_el: column(decoded, "sun_el"),
    sun_frac: column(decoded, "sun_frac"),
    sun_clear: column(decoded, "sun_clear"),
    earth_az: column(decoded, "earth_az"),
    earth_el: column(decoded, "earth_el"),
    earth_frac: column(decoded, "earth_frac"),
    earth_clear: column(decoded, "earth_clear"),
  };
}

export function decodeSeriesBuffer(
  bin: Buffer,
  columns: SeriesColumnEncoding[],
): Record<string, Float64Array> {
  const width = columns.length;
  if (width === 0 || bin.length % (width * 2) !== 0) {
    throw new Error("wrong series byte length");
  }
  const count = bin.length / (width * 2);
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const decoded: Record<string, Float64Array> = {};
  for (let columnIndex = 0; columnIndex < width; columnIndex++) {
    const columnEncoding = columns[columnIndex];
    if (!columnEncoding) throw new Error("missing series column encoding");
    const values = new Float64Array(count);
    const base = columnIndex * count;
    for (let i = 0; i < count; i++) {
      const raw = view.getInt16((base + i) * 2, true);
      values[i] = raw * columnEncoding.scale + columnEncoding.offset;
    }
    decoded[columnEncoding.name] = values;
  }
  return decoded;
}

function column(decoded: Record<string, Float64Array>, name: string): Float64Array {
  const values = decoded[name];
  if (!values) throw new Error(`series is missing ${name}`);
  return values;
}

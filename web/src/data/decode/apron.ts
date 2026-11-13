import { assertByteLength, assertCount } from "./bytes.ts";

/** Decode a finite apron value as raw / scale - offset. 65535 is no height. */
export const APRON_OFFSET_M = 12000;
export const APRON_SCALE = 2;
export const APRON_MISSING = 65535;

export type DecodedApron = {
  /** Row-major heights in metres. Index = row * columns + column. Row 0 is north, column 0 is west. */
  heights: Float64Array;
  rows: number;
  columns: number;
};

export function decodeApron(buffer: ArrayBuffer, rows: number, columns: number, fileName: string): DecodedApron {
  assertCount(fileName, rows);
  assertCount(fileName, columns);
  const count = rows * columns;
  assertByteLength(fileName, buffer.byteLength, count * 2);
  const view = new DataView(buffer);
  const heights = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const raw = view.getUint16(index * 2, true);
    heights[index] = raw === APRON_MISSING ? Number.NaN : raw / APRON_SCALE - APRON_OFFSET_M;
  }
  return { heights, rows, columns };
}

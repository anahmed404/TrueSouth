import { assertByteLength, assertCount, readFloat32Arrays } from "./bytes.ts";
import {
  LOOKUP_NO_DATA,
  SKYLINE_ARRAYS,
  SYSTEM_ARRAYS,
  TERRAIN_ARRAYS,
  type DecodedSkyline,
  type DecodedSystem,
  type DecodedTerrain,
} from "./layouts.ts";

export function decodeSkyline(buffer: ArrayBuffer, bins: number, fileName: string): DecodedSkyline {
  return readFloat32Arrays(buffer, SKYLINE_ARRAYS, bins, fileName);
}

/** File order is row-major: index = row * columns + column. Row 0 is north, column 0 is west. */
export function decodeTerrainGrid(
  buffer: ArrayBuffer,
  rows: number,
  columns: number,
  fileName: string,
): DecodedTerrain {
  assertCount(fileName, rows);
  assertCount(fileName, columns);
  return readFloat32Arrays(buffer, TERRAIN_ARRAYS, rows * columns, fileName);
}

export function decodeTerrain(buffer: ArrayBuffer, size: number, fileName: string): DecodedTerrain {
  return decodeTerrainGrid(buffer, size, size, fileName);
}

export function decodeSystem(buffer: ArrayBuffer, count: number, fileName: string): DecodedSystem {
  return readFloat32Arrays(buffer, SYSTEM_ARRAYS, count, fileName);
}

export function decodeLookup(buffer: ArrayBuffer, size: number, fileName: string): Uint8Array {
  assertCount(fileName, size);
  const expected = size * size;
  assertByteLength(fileName, buffer.byteLength, expected);
  const view = new DataView(buffer);
  const values = new Uint8Array(expected);
  for (let index = 0; index < expected; index += 1) {
    values[index] = view.getUint8(index);
  }
  return values;
}

/** v/255, or null when v is the no-data byte. */
export function lookupFraction(raw: number): number | null {
  if (raw === LOOKUP_NO_DATA) return null;
  return raw / 255;
}

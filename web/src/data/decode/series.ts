import { assertByteLength, assertCount, readInt16Le } from "./bytes.ts";
import {
  SERIES_COLUMNS,
  type DecodedSeries,
  type SeriesColumnName,
  type SeriesColumnSpec,
} from "./layouts.ts";

/**
 * One Float64Array per column. Python decodes with float64
 * (`raw.astype(float64) * scale + offset` in `series.py`). A Float32Array
 * would round angles near 180° by about 1e-5°, which is coarser than the
 * 1e-9 match browser scoring has to keep with Python.
 */
export function decodeSeries(
  buffer: ArrayBuffer,
  columns: readonly SeriesColumnSpec[],
  count: number,
  fileName: string,
): DecodedSeries {
  assertCount(fileName, count);
  if (columns.length !== SERIES_COLUMNS.length) {
    throw new Error(`${fileName} has ${columns.length} columns; expected ${SERIES_COLUMNS.length}`);
  }
  assertByteLength(fileName, buffer.byteLength, columns.length * count * 2);
  const view = new DataView(buffer);
  const decoded = {} as DecodedSeries;
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const expected = SERIES_COLUMNS[columnIndex];
    if (!column || !expected) {
      throw new Error(`${fileName} is missing column ${columnIndex}`);
    }
    if (column.name !== expected.name) {
      throw new Error(
        `${fileName} column ${columnIndex} is ${column.name}; expected ${expected.name}`,
      );
    }
    const values = new Float64Array(count);
    const origin = columnIndex * count;
    for (let index = 0; index < count; index += 1) {
      const raw = readInt16Le(view, (origin + index) * 2);
      values[index] = raw * column.scale + column.offset;
    }
    decoded[column.name] = values;
  }
  return decoded;
}

export function seriesColumnNames(): readonly SeriesColumnName[] {
  return SERIES_COLUMNS.map((column) => column.name);
}

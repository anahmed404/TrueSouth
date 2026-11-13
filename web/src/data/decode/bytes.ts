/** DataView little-endian flag. Multi-byte files never follow the CPU byte order. */
const LITTLE_ENDIAN = true;

export function assertByteLength(fileName: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`${fileName} has ${actual} bytes; expected ${expected} bytes`);
  }
}

export function assertCount(fileName: string, count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`${fileName} count must be a non-negative integer`);
  }
}

export function readInt16Le(view: DataView, byteOffset: number): number {
  return view.getInt16(byteOffset, LITTLE_ENDIAN);
}

export function readFloat32Le(view: DataView, byteOffset: number): number {
  return view.getFloat32(byteOffset, LITTLE_ENDIAN);
}

export function readFloat32Arrays<const Names extends readonly string[]>(
  buffer: ArrayBuffer,
  names: Names,
  length: number,
  fileName: string,
): { [K in Names[number]]: Float32Array } {
  assertCount(fileName, length);
  const bytesPerValue = 4;
  assertByteLength(fileName, buffer.byteLength, names.length * length * bytesPerValue);
  const view = new DataView(buffer);
  const decoded = {} as { [K in Names[number]]: Float32Array };
  for (let arrayIndex = 0; arrayIndex < names.length; arrayIndex += 1) {
    const name = names[arrayIndex];
    if (name === undefined) {
      throw new Error(`${fileName} is missing array ${arrayIndex}`);
    }
    const values = new Float32Array(length);
    const origin = arrayIndex * length * bytesPerValue;
    for (let index = 0; index < length; index += 1) {
      values[index] = readFloat32Le(view, origin + index * bytesPerValue);
    }
    decoded[name as Names[number]] = values;
  }
  return decoded;
}

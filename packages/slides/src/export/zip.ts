/**
 * A deterministic, uncompressed (stored) ZIP writer for export packages.
 * Entries keep their order, use UTF-8 names and a fixed 1980-01-01 timestamp,
 * so the same input always produces the same bytes. ZIP64 is not supported.
 */
export interface ZipEntry {
  path: string;
  data: Uint8Array | string;
}

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;

let crcTable: Uint32Array | undefined;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

/** CRC-32 (IEEE 802.3), as ZIP requires. */
export function crc32(data: Uint8Array): number {
  const lookup = table();
  let crc = 0xffffffff;
  for (const byte of data) crc = (lookup[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function assertPath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..') ||
    [...path].some((character) => (character.codePointAt(0) ?? 0) < 0x20)
  ) {
    throw new TypeError(`Unsafe ZIP entry path: ${JSON.stringify(path)}`);
  }
}

export function writeZip(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length > MAX_ENTRIES) throw new RangeError('Too many ZIP entries.');
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const prepared = entries.map((entry) => {
    assertPath(entry.path);
    if (seen.has(entry.path)) throw new TypeError(`Duplicate ZIP entry: ${entry.path}`);
    seen.add(entry.path);
    const name = encoder.encode(entry.path);
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    if (data.length > MAX_SIZE) throw new RangeError(`ZIP entry is too large: ${entry.path}`);
    return { name, data, crc: crc32(data) };
  });

  const localSize = prepared.reduce(
    (sum, entry) => sum + 30 + entry.name.length + entry.data.length,
    0
  );
  const centralSize = prepared.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  if (localSize + centralSize > MAX_SIZE) throw new RangeError('ZIP archive is too large.');
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const offsets: number[] = [];

  for (const entry of prepared) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, UTF8_FLAG, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, DOS_TIME, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    view.setUint16(offset + 28, 0, true);
    bytes.set(entry.name, offset + 30);
    bytes.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralStart = offset;
  prepared.forEach((entry, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, UTF8_FLAG, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, DOS_TIME, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, offsets[index] as number, true);
    bytes.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);
  return bytes;
}

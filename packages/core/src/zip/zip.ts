/**
 * A deterministic ZIP writer for export packages (ADR-016). Entries keep
 * their order, use UTF-8 names and a fixed 1980-01-01 timestamp, so the
 * same input always produces the same bytes. `writeZip` stores entries
 * (synchronous, no compression); `writeZipAsync` deflates them through the
 * platform `CompressionStream` when it exists and keeps an entry stored when
 * deflate is missing or would not make it smaller. ZIP64 is not supported.
 */
export interface ZipEntry {
  path: string;
  data: Uint8Array | string;
  /** `writeZipAsync` only: `false` keeps this entry stored (an already compressed image). */
  compress?: boolean;
}

export interface ZipOptions {
  /** Deflate entries when the platform can (default true). */
  compress?: boolean;
}

export type CompressionFormatName = 'deflate' | 'deflate-raw';

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;
const STORED = 0;
const DEFLATED = 8;

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

/** CRC-32 (IEEE 802.3), as ZIP and PNG use. */
export function crc32(data: Uint8Array): number {
  const lookup = table();
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = (lookup[(crc ^ (data[index] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Refuse empty, absolute, backslashed, dot-segment and control-character paths (no traversal on extract). */
export function assertZipPath(path: string): void {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..') ||
    [...path].some((character) => (character.codePointAt(0) ?? 0) < 0x20)
  ) {
    throw new TypeError(`Unsafe ZIP entry path: ${JSON.stringify(path)}`);
  }
}

interface Prepared {
  name: Uint8Array;
  data: Uint8Array;
  size: number;
  crc: number;
  method: number;
}

function prepare(entries: readonly ZipEntry[]): { prepared: Prepared[]; raw: Uint8Array[] } {
  if (entries.length > MAX_ENTRIES) throw new RangeError('Too many ZIP entries.');
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const raw: Uint8Array[] = [];
  const prepared = entries.map((entry) => {
    assertZipPath(entry.path);
    if (seen.has(entry.path)) throw new TypeError(`Duplicate ZIP entry: ${entry.path}`);
    seen.add(entry.path);
    const name = encoder.encode(entry.path);
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    if (data.length > MAX_SIZE) throw new RangeError(`ZIP entry is too large: ${entry.path}`);
    raw.push(data);
    return { name, data, size: data.length, crc: crc32(data), method: STORED };
  });
  return { prepared, raw };
}

function assemble(prepared: readonly Prepared[]): Uint8Array {
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
    view.setUint16(offset + 8, entry.method, true);
    view.setUint16(offset + 10, DOS_TIME, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.size, true);
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
    view.setUint16(offset + 10, entry.method, true);
    view.setUint16(offset + 12, DOS_TIME, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.size, true);
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

/** A stored (uncompressed) ZIP, synchronously. */
export function writeZip(entries: readonly ZipEntry[]): Uint8Array {
  return assemble(prepare(entries).prepared);
}

interface StreamPair {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}
type StreamConstructor = new (format: CompressionFormatName) => StreamPair;

/** True when the platform has `CompressionStream` with raw deflate. */
export function canCompress(format: CompressionFormatName = 'deflate-raw'): boolean {
  const Ctor = (globalThis as { CompressionStream?: StreamConstructor }).CompressionStream;
  if (typeof Ctor !== 'function') return false;
  try {
    new Ctor(format);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress bytes with the platform `CompressionStream` (`deflate` is the
 * zlib wrapper PDF's FlateDecode reads; `deflate-raw` is what ZIP stores),
 * or `null` when the platform has no such stream.
 */
export async function compressBytes(
  data: Uint8Array,
  format: CompressionFormatName
): Promise<Uint8Array | null> {
  const Ctor = (globalThis as { CompressionStream?: StreamConstructor }).CompressionStream;
  if (typeof Ctor !== 'function') return null;
  let stream: StreamPair;
  try {
    stream = new Ctor(format);
  } catch {
    return null;
  }
  const writer = stream.writable.getWriter();
  // Write and close without awaiting: the readable side drains the stream.
  writer.write(data).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** A ZIP whose entries are deflated where the platform can and where it makes them smaller. */
export async function writeZipAsync(
  entries: readonly ZipEntry[],
  options: ZipOptions = {}
): Promise<Uint8Array> {
  const { prepared, raw } = prepare(entries);
  if (options.compress !== false && canCompress('deflate-raw')) {
    for (let index = 0; index < prepared.length; index += 1) {
      if (entries[index]?.compress === false) continue;
      const entry = prepared[index] as Prepared;
      const packed = await compressBytes(raw[index] as Uint8Array, 'deflate-raw');
      if (packed && packed.length < entry.data.length) {
        entry.data = packed;
        entry.method = DEFLATED;
      }
    }
  }
  return assemble(prepared);
}

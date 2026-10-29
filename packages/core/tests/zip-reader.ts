/// <reference types="node" />
/**
 * A test-only ZIP reader: walks the central directory, checks every local
 * header against it, inflates deflated entries with node:zlib and verifies
 * each CRC-32. It reads what `@texuli/core/zip` writes (no ZIP64, no data
 * descriptors) and throws on anything else.
 */
import { inflateRawSync } from 'node:zlib';
import { crc32 } from '../src/zip/index.ts';

export interface ReadEntry {
  path: string;
  method: number;
  data: Uint8Array;
}

export function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('no end of central directory');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (offset + size !== end) throw new Error('central directory does not end at the record');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const out: ReadEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('bad central header');
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const packed = view.getUint32(offset + 20, true);
    const unpacked = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`bad local header: ${path}`);
    if (view.getUint16(local + 8, true) !== method) throw new Error(`method mismatch: ${path}`);
    if (view.getUint32(local + 14, true) !== crc) throw new Error(`crc mismatch: ${path}`);
    const localName = view.getUint16(local + 26, true);
    const extra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + extra;
    const raw = bytes.subarray(start, start + packed);
    const data = method === 0 ? raw : method === 8 ? new Uint8Array(inflateRawSync(raw)) : null;
    if (!data) throw new Error(`unknown method ${method}: ${path}`);
    if (data.length !== unpacked) throw new Error(`size mismatch: ${path}`);
    if (crc32(data) !== crc) throw new Error(`crc does not match the data: ${path}`);
    out.push({ path, method, data });
    offset += 46 + nameLength;
  }
  return out;
}

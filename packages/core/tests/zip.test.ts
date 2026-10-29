// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { writeZip as slidesWriteZip } from '../../slides/src/export/zip.ts';
import {
  assertZipPath,
  canCompress,
  compressBytes,
  crc32,
  writeZip,
  writeZipAsync,
} from '../src/zip/index.ts';
import { readZip } from './zip-reader.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ENTRIES = [
  { path: '[Content_Types].xml', data: '<Types/>'.repeat(50) },
  { path: 'word/document.xml', data: 'Ünïcödé text, repeated. '.repeat(200) },
  { path: 'word/media/image1.png', data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
];

describe('core/zip', () => {
  const original = globalThis.CompressionStream;
  afterEach(() => {
    globalThis.CompressionStream = original;
  });

  it('computes the IEEE CRC-32', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes a stored archive that reads back, byte-identical to the slides writer', () => {
    const bytes = writeZip(ENTRIES);
    const read = readZip(bytes);
    expect(read.map((entry) => [entry.path, entry.method])).toEqual(
      ENTRIES.map((entry) => [entry.path, 0])
    );
    expect(decoder.decode(read[1]?.data)).toBe(ENTRIES[1]?.data);
    expect(bytes).toEqual(slidesWriteZip(ENTRIES));
    expect(writeZip(ENTRIES)).toEqual(bytes);
  });

  it('deflates through CompressionStream, deterministically, and keeps incompressible entries stored', async () => {
    expect(canCompress()).toBe(true);
    const bytes = await writeZipAsync(ENTRIES);
    const again = await writeZipAsync(ENTRIES);
    expect(bytes).toEqual(again);
    expect(bytes.length).toBeLessThan(writeZip(ENTRIES).length / 3);
    const read = readZip(bytes);
    expect(read.map((entry) => entry.method)).toEqual([8, 8, 0]);
    expect(read.map((entry) => decoder.decode(entry.data))).toEqual(
      ENTRIES.map((entry) =>
        typeof entry.data === 'string' ? entry.data : decoder.decode(entry.data)
      )
    );
    const kept = readZip(
      await writeZipAsync([{ path: 'a.txt', data: 'a'.repeat(500), compress: false }])
    );
    expect(kept[0]?.method).toBe(0);
    expect(readZip(await writeZipAsync(ENTRIES, { compress: false }))).toHaveLength(3);
  });

  it('falls back to a stored archive without CompressionStream', async () => {
    // @ts-expect-error: simulate a platform without compression streams.
    globalThis.CompressionStream = undefined;
    expect(canCompress()).toBe(false);
    expect(await compressBytes(encoder.encode('x'), 'deflate')).toBeNull();
    expect(await writeZipAsync(ENTRIES)).toEqual(writeZip(ENTRIES));
    globalThis.CompressionStream = class {
      constructor() {
        throw new TypeError('unsupported format');
      }
    } as unknown as typeof CompressionStream;
    expect(canCompress('deflate-raw')).toBe(false);
    expect(await writeZipAsync(ENTRIES)).toEqual(writeZip(ENTRIES));
  });

  it('refuses traversal, absolute, control-character and duplicate paths', () => {
    for (const path of [
      '',
      '/etc/passwd',
      '../x',
      'a/../b',
      'a//b',
      './a',
      'a\\b',
      'a\u0000b',
      'a/',
    ]) {
      expect(() => assertZipPath(path), JSON.stringify(path)).toThrow(TypeError);
      expect(() => writeZip([{ path, data: 'x' }])).toThrow(TypeError);
    }
    expect(() =>
      writeZip([
        { path: 'a.txt', data: '1' },
        { path: 'a.txt', data: '2' },
      ])
    ).toThrow(/Duplicate/);
    expect(() =>
      writeZip(Array.from({ length: 0x10000 }, (_, i) => ({ path: `f${i}`, data: '' })))
    ).toThrow(RangeError);
  });
});

/// <reference types="node" />
/**
 * Test-only readers for the static outputs: a strict XML well-formedness
 * check, a structural PDF parser (header, xref, trailer, objects, streams,
 * page count), and builders for tiny PNG, JPEG and TrueType files.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { crc32 } from '../../core/src/zip/index.ts';

export { readZip } from '../../core/tests/zip-reader.ts';

const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
const ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;

/** `null` when `xml` is well-formed (one root, balanced tags, quoted unique attributes, valid entities), else the problem. */
export function xmlProblem(xml: string): string | null {
  let i = 0;
  if (xml.startsWith('<?xml')) {
    const end = xml.indexOf('?>');
    if (end < 0) return 'unterminated declaration';
    i = end + 2;
  }
  const stack: string[] = [];
  let roots = 0;
  const readName = () => {
    NAME.lastIndex = i;
    const match = NAME.exec(xml);
    if (!match) return null;
    i = NAME.lastIndex;
    return match[0];
  };
  const skip = () => {
    while (i < xml.length && /\s/.test(xml[i] as string)) i += 1;
  };
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const text = xml.slice(i, lt < 0 ? xml.length : lt);
    if (stack.length === 0 && text.trim()) return `text outside the root: ${text.slice(0, 20)}`;
    if (ENTITY.test(text)) return `bad entity in text near ${text.slice(0, 30)}`;
    // biome-ignore lint/suspicious/noControlCharactersInRegex: checking the controls is the point.
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return 'control character in text';
    if (lt < 0) break;
    i = lt;
    if (xml.startsWith('</', i)) {
      i += 2;
      const name = readName();
      if (!name || stack.pop() !== name) return `mismatched end tag ${name}`;
      skip();
      if (xml[i] !== '>') return 'unterminated end tag';
      i += 1;
      continue;
    }
    i += 1;
    const name = readName();
    if (!name) return `bad element name at ${i}`;
    if (stack.length === 0) {
      roots += 1;
      if (roots > 1) return 'more than one root';
    }
    const seen = new Set<string>();
    for (;;) {
      const before = i;
      skip();
      if (xml.startsWith('/>', i)) {
        i += 2;
        break;
      }
      if (xml[i] === '>') {
        i += 1;
        stack.push(name);
        break;
      }
      if (i === before) return `no space before an attribute of ${name}`;
      const attribute = readName();
      if (!attribute) return `bad attribute in ${name}`;
      if (seen.has(attribute)) return `duplicate attribute ${attribute}`;
      seen.add(attribute);
      if (xml[i] !== '=') return `attribute ${attribute} without a value`;
      i += 1;
      const quote = xml[i];
      if (quote !== '"' && quote !== "'") return `unquoted attribute ${attribute}`;
      const end = xml.indexOf(quote, i + 1);
      if (end < 0) return 'unterminated attribute';
      const value = xml.slice(i + 1, end);
      if (value.includes('<') || ENTITY.test(value)) return `bad attribute value ${attribute}`;
      i = end + 1;
    }
  }
  if (stack.length > 0) return `unclosed ${stack.join(' > ')}`;
  return roots === 1 ? null : 'no root element';
}

export interface PdfObject {
  id: number;
  dict: string;
  /** The decoded stream, when the object has one. */
  stream?: Uint8Array;
}

export interface ParsedPdf {
  version: string;
  objects: Map<number, PdfObject>;
  root: PdfObject;
  pageCount: number;
  pages: PdfObject[];
  /** Every content stream, decoded, as Latin-1 text. */
  contents: string[];
  /** Every annotation URI. */
  uris: string[];
  raw: string;
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

export function hexText(hex: string): string {
  return Buffer.from(hex.replace(/\s+/g, ''), 'hex').toString('latin1');
}

/** Parse a PDF structurally: every xref offset points at its object, stream lengths hold, pages are counted from the tree. */
export function parsePdf(bytes: Uint8Array): ParsedPdf {
  const raw = latin1(bytes);
  const version = /^%PDF-(\d\.\d)\n/.exec(raw)?.[1];
  if (!version) throw new Error('no PDF header');
  if (!raw.endsWith('%%EOF\n')) throw new Error('no %%EOF');
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(raw)?.[1] ?? Number.NaN);
  if (!raw.startsWith('xref\n', startxref))
    throw new Error('startxref does not point at the xref table');
  const header = /^xref\n0 (\d+)\n/.exec(raw.slice(startxref));
  if (!header) throw new Error('bad xref header');
  const size = Number(header[1]);
  let at = startxref + header[0].length;
  const offsets: number[] = [];
  for (let id = 0; id < size; id += 1) {
    const entry = raw.slice(at, at + 20);
    if (!/^\d{10} \d{5} [nf] \n$/.test(entry))
      throw new Error(`bad xref entry ${id}: ${JSON.stringify(entry)}`);
    offsets.push(Number(entry.slice(0, 10)));
    at += 20;
  }
  const trailer = /^trailer\n<<(.*?)>>\n/s.exec(raw.slice(at));
  if (!trailer) throw new Error('no trailer');
  if (Number(/\/Size (\d+)/.exec(trailer[1] as string)?.[1]) !== size)
    throw new Error('trailer /Size mismatch');
  const rootId = Number(/\/Root (\d+) 0 R/.exec(trailer[1] as string)?.[1]);
  const objects = new Map<number, PdfObject>();
  for (let id = 1; id < size; id += 1) {
    const offset = offsets[id] as number;
    const head = `${id} 0 obj\n`;
    if (!raw.startsWith(head, offset)) throw new Error(`xref offset of ${id} does not point at it`);
    const bodyStart = offset + head.length;
    const streamAt = raw.indexOf('stream\n', bodyStart);
    const endAt = raw.indexOf('\nendobj\n', bodyStart);
    if (endAt < 0) throw new Error(`object ${id} has no endobj`);
    if (streamAt >= 0 && streamAt < endAt) {
      const dict = raw.slice(bodyStart, streamAt).trim();
      const length = Number(/\/Length (\d+)/.exec(dict)?.[1]);
      const dataStart = streamAt + 'stream\n'.length;
      if (!raw.startsWith('\nendstream\nendobj\n', dataStart + length)) {
        throw new Error(`stream length of ${id} is wrong`);
      }
      let stream: Uint8Array = bytes.subarray(dataStart, dataStart + length);
      if (/\/Filter \/FlateDecode/.test(dict) && !/\/DecodeParms|\/Subtype \/Image/.test(dict)) {
        stream = new Uint8Array(inflateSync(stream));
      }
      objects.set(id, { id, dict, stream });
      // Skip past binary data before searching for the next object.
    } else {
      objects.set(id, { id, dict: raw.slice(bodyStart, endAt).trim() });
    }
  }
  const root = objects.get(rootId);
  if (!root || !/\/Type \/Catalog/.test(root.dict)) throw new Error('no catalog');
  const pagesId = Number(/\/Pages (\d+) 0 R/.exec(root.dict)?.[1]);
  const pagesNode = objects.get(pagesId);
  if (!pagesNode) throw new Error('no page tree');
  const kids = [
    ...(/\/Kids \[([^\]]*)\]/.exec(pagesNode.dict)?.[1] ?? '').matchAll(/(\d+) 0 R/g),
  ].map((m) => Number(m[1]));
  const pageCount = Number(/\/Count (\d+)/.exec(pagesNode.dict)?.[1]);
  if (kids.length !== pageCount) throw new Error('/Count does not match /Kids');
  const pages = kids.map((id) => {
    const page = objects.get(id);
    if (!page || !/\/Type \/Page\b/.test(page.dict)) throw new Error(`kid ${id} is not a page`);
    return page;
  });
  const contents = pages.map((page) => {
    const id = Number(/\/Contents (\d+) 0 R/.exec(page.dict)?.[1]);
    const stream = objects.get(id)?.stream;
    if (!stream) throw new Error(`page ${page.id} has no content stream`);
    return latin1(stream);
  });
  const uris = [...objects.values()]
    .filter((object) => /\/Subtype \/Link/.test(object.dict))
    .map((object) => hexText(/\/URI <([0-9a-f]*)>/.exec(object.dict)?.[1] ?? ''));
  return { version, objects, root, pageCount, pages, contents, uris, raw };
}

/** The text a content stream shows in a standard font (WinAnsi hex strings), joined. */
export function shownText(content: string): string {
  return [...content.matchAll(/\/F\d [\d.]+ Tf <([0-9a-f]*)> Tj/g)]
    .map((m) => hexText(m[1] as string))
    .join('');
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A tiny PNG: `channels` 1 (gray), 3 (RGB) or 4 (RGBA), 8-bit, filter 0 rows. */
export function makePng(width: number, height: number, channels: 1 | 3 | 4): Uint8Array {
  const colorType = channels === 1 ? 0 : channels === 3 ? 2 : 6;
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = colorType;
  const rows = new Uint8Array(height * (1 + width * channels));
  for (let y = 0; y < height; y += 1) {
    rows[y * (1 + width * channels)] = y % 2 === 0 ? 0 : 2;
    for (let x = 0; x < width * channels; x += 1)
      rows[y * (1 + width * channels) + 1 + x] = (x * 37 + y * 11) & 0xff;
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(rows))),
    chunk('IEND', new Uint8Array()),
  ];
  return new Uint8Array(Buffer.concat(parts));
}

/** JPEG markers with a baseline SOF0 frame (enough for passthrough; not a decodable picture). */
export function makeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xd9,
  ]);
}

/** A minimal TrueType font mapping each code point in `map` to glyph 1, 2, … (format 4 cmap, empty outlines). */
export function makeTrueType(map: readonly number[]): Uint8Array {
  const glyphs = map.length + 1;
  const head = new Uint8Array(54);
  const hv = new DataView(head.buffer);
  hv.setUint32(0, 0x00010000);
  hv.setUint32(12, 0x5f0f3cf5);
  hv.setUint16(18, 1000);
  hv.setInt16(36, 0);
  hv.setInt16(38, -200);
  hv.setInt16(40, 1000);
  hv.setInt16(42, 800);
  const hhea = new Uint8Array(36);
  const hh = new DataView(hhea.buffer);
  hh.setUint32(0, 0x00010000);
  hh.setInt16(4, 800);
  hh.setInt16(6, -200);
  hh.setUint16(34, glyphs);
  const maxp = new Uint8Array(6);
  new DataView(maxp.buffer).setUint32(0, 0x00005000);
  new DataView(maxp.buffer).setUint16(4, glyphs);
  const hmtx = new Uint8Array(glyphs * 4);
  for (let g = 0; g < glyphs; g += 1)
    new DataView(hmtx.buffer).setUint16(g * 4, g === 0 ? 500 : 1000);
  // cmap format 4: one segment per code point, plus the 0xFFFF terminator.
  const sorted = [...map]
    .map((point, index) => ({ point, glyph: index + 1 }))
    .sort((a, b) => a.point - b.point);
  const segCount = sorted.length + 1;
  const length = 16 + segCount * 8;
  const sub = new Uint8Array(length);
  const sv = new DataView(sub.buffer);
  sv.setUint16(0, 4);
  sv.setUint16(2, length);
  sv.setUint16(6, segCount * 2);
  sorted.forEach(({ point, glyph }, i) => {
    sv.setUint16(14 + i * 2, point);
    sv.setUint16(16 + segCount * 2 + i * 2, point);
    sv.setInt16(16 + segCount * 4 + i * 2, (glyph - point) & 0xffff);
  });
  sv.setUint16(14 + sorted.length * 2, 0xffff);
  sv.setUint16(16 + segCount * 2 + sorted.length * 2, 0xffff);
  sv.setInt16(16 + segCount * 4 + sorted.length * 2, 1);
  const cmap = new Uint8Array(12 + length);
  const cv = new DataView(cmap.buffer);
  cv.setUint16(2, 1);
  cv.setUint16(4, 3);
  cv.setUint16(6, 1);
  cv.setUint32(8, 12);
  cmap.set(sub, 12);
  const loca = new Uint8Array((glyphs + 1) * 2);
  const glyf = new Uint8Array(4);
  const tables: [string, Uint8Array][] = [
    ['cmap', cmap],
    ['glyf', glyf],
    ['head', head],
    ['hhea', hhea],
    ['hmtx', hmtx],
    ['loca', loca],
    ['maxp', maxp],
  ];
  const directory = 12 + tables.length * 16;
  const pad = (n: number) => (n + 3) & ~3;
  let total = directory;
  for (const [, data] of tables) total += pad(data.length);
  const out = new Uint8Array(total);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, 0x00010000);
  ov.setUint16(4, tables.length);
  let offset = directory;
  tables.forEach(([tag, data], i) => {
    for (let k = 0; k < 4; k += 1) out[12 + i * 16 + k] = tag.charCodeAt(k);
    ov.setUint32(12 + i * 16 + 8, offset);
    ov.setUint32(12 + i * 16 + 12, data.length);
    out.set(data, offset);
    offset += pad(data.length);
  });
  return out;
}

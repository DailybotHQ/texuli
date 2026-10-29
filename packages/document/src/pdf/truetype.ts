/**
 * A bounded reader for a host-supplied TrueType font (ADR-016): the tables
 * the PDF writer needs to embed the font whole as a CID font (`head`,
 * `hhea`, `maxp`, `hmtx`, `cmap` format 4 or 12, and `OS/2` when present).
 * Every offset is checked against the file; CFF-flavored OpenType and font
 * collections are refused. Glyph lookups binary-search the cmap, so a
 * hostile font costs at most a pass over its tables.
 */

export interface TrueTypeFont {
  bytes: Uint8Array;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: [number, number, number, number];
  numGlyphs: number;
  /** The glyph id for a code point (0, `.notdef`, when the font has none). */
  glyph(codePoint: number): number;
  /** Advance width of a glyph in thousandths of the font size. */
  advance(glyph: number): number;
}

/** The largest font file the writer embeds (16 MiB). */
export const MAX_FONT_BYTES = 16 * 1024 * 1024;

type Segment = { start: number; end: number; delta: number; rangeOffset: number; at: number };
type Group = { start: number; end: number; glyph: number };

/** Parse a TrueType font, or `null` when it is not one this writer can embed. */
export function parseTrueType(bytes: Uint8Array): TrueTypeFont | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MAX_FONT_BYTES)
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = bytes.length;
  const ok = (offset: number, length: number) =>
    offset >= 0 && length >= 0 && offset + length <= size;
  const version = view.getUint32(0);
  // 0x00010000 or 'true': TrueType outlines. 'OTTO' (CFF) and 'ttcf' (collections) are refused.
  if (version !== 0x00010000 && version !== 0x74727565) return null;
  const count = view.getUint16(4);
  if (!ok(12, count * 16)) return null;
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(
      bytes[at] as number,
      bytes[at + 1] as number,
      bytes[at + 2] as number,
      bytes[at + 3] as number
    );
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    if (!ok(offset, length)) return null;
    tables.set(tag, { offset, length });
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const maxp = tables.get('maxp');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');
  if (
    !head ||
    head.length < 54 ||
    !hhea ||
    hhea.length < 36 ||
    !maxp ||
    maxp.length < 6 ||
    !hmtx ||
    !cmap
  ) {
    return null;
  }
  if (!tables.has('glyf') || !tables.has('loca')) return null;
  const unitsPerEm = view.getUint16(head.offset + 18);
  if (unitsPerEm < 16 || unitsPerEm > 16_384) return null;
  const bbox: [number, number, number, number] = [
    view.getInt16(head.offset + 36),
    view.getInt16(head.offset + 38),
    view.getInt16(head.offset + 40),
    view.getInt16(head.offset + 42),
  ];
  const ascent = view.getInt16(hhea.offset + 4);
  const descent = view.getInt16(hhea.offset + 6);
  const metrics = view.getUint16(hhea.offset + 34);
  const numGlyphs = view.getUint16(maxp.offset + 4);
  if (metrics === 0 || metrics > numGlyphs || hmtx.length < metrics * 4) return null;
  const os2 = tables.get('OS/2');
  const capHeight =
    os2 && os2.length >= 90 && view.getUint16(os2.offset) >= 2
      ? view.getInt16(os2.offset + 88)
      : ascent;

  // Pick a Unicode subtable: (3,10) or (0,4+) format 12 first, then (3,1) or (0,x) format 4.
  if (cmap.length < 4) return null;
  const subtables = view.getUint16(cmap.offset + 2);
  if (!ok(cmap.offset + 4, subtables * 8)) return null;
  let format4 = -1;
  let format12 = -1;
  for (let i = 0; i < subtables; i += 1) {
    const at = cmap.offset + 4 + i * 8;
    const platform = view.getUint16(at);
    const encoding = view.getUint16(at + 2);
    const offset = cmap.offset + view.getUint32(at + 4);
    if (!ok(offset, 4)) continue;
    const format = view.getUint16(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12 && format12 < 0) format12 = offset;
    if (format === 4 && format4 < 0) format4 = offset;
  }

  let lookup: ((codePoint: number) => number) | null = null;
  if (format12 >= 0 && ok(format12, 16)) {
    const groupsCount = view.getUint32(format12 + 12);
    if (ok(format12 + 16, groupsCount * 12)) {
      const groups: Group[] = [];
      for (let i = 0; i < groupsCount; i += 1) {
        const at = format12 + 16 + i * 12;
        groups.push({
          start: view.getUint32(at),
          end: view.getUint32(at + 4),
          glyph: view.getUint32(at + 8),
        });
      }
      lookup = (codePoint) => {
        let low = 0;
        let high = groups.length - 1;
        while (low <= high) {
          const middle = (low + high) >> 1;
          const group = groups[middle] as Group;
          if (codePoint < group.start) high = middle - 1;
          else if (codePoint > group.end) low = middle + 1;
          else return group.glyph + (codePoint - group.start);
        }
        return 0;
      };
    }
  }
  if (!lookup && format4 >= 0 && ok(format4, 14)) {
    const length = view.getUint16(format4 + 2);
    const segX2 = view.getUint16(format4 + 6);
    const segCount = segX2 / 2;
    if (ok(format4, length) && segX2 % 2 === 0 && 16 + segX2 * 4 <= length) {
      const ends = format4 + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const offsets = deltas + segX2;
      const segments: Segment[] = [];
      for (let i = 0; i < segCount; i += 1) {
        segments.push({
          end: view.getUint16(ends + i * 2),
          start: view.getUint16(starts + i * 2),
          delta: view.getInt16(deltas + i * 2),
          rangeOffset: view.getUint16(offsets + i * 2),
          at: offsets + i * 2,
        });
      }
      const limit = format4 + length;
      lookup = (codePoint) => {
        if (codePoint > 0xffff) return 0;
        let low = 0;
        let high = segments.length - 1;
        while (low <= high) {
          const middle = (low + high) >> 1;
          const segment = segments[middle] as Segment;
          if (codePoint > segment.end) low = middle + 1;
          else if (codePoint < segment.start) high = middle - 1;
          else {
            if (segment.rangeOffset === 0) return (codePoint + segment.delta) & 0xffff;
            const at = segment.at + segment.rangeOffset + (codePoint - segment.start) * 2;
            if (at + 2 > limit) return 0;
            const glyph = view.getUint16(at);
            return glyph === 0 ? 0 : (glyph + segment.delta) & 0xffff;
          }
        }
        return 0;
      };
    }
  }
  if (!lookup) return null;
  const find = lookup;
  const scale = 1000 / unitsPerEm;
  return {
    bytes,
    unitsPerEm,
    ascent: Math.round(ascent * scale),
    descent: Math.round(descent * scale),
    capHeight: Math.round(capHeight * scale),
    bbox: bbox.map((value) => Math.round(value * scale)) as [number, number, number, number],
    numGlyphs,
    glyph(codePoint) {
      const glyph = find(codePoint);
      return glyph < numGlyphs ? glyph : 0;
    },
    advance(glyph) {
      const index = Math.min(Math.max(0, glyph), metrics - 1);
      return Math.round(view.getUint16(hmtx.offset + index * 4) * scale);
    },
  };
}

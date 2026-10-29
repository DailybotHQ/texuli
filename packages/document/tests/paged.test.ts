// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDocument, paragraphBlock } from '../src/model/index.ts';
import type { DocumentBlock, TexuliDocument } from '../src/model/types.ts';
import {
  type BlockMeasurer,
  DEFAULT_FOOTER,
  documentPageSettings,
  layoutDocument,
  MM,
  type PagedUnit,
  pagedUnits,
  pageGeometry,
  paginate,
  resolveBandText,
  type UnitMeasure,
} from '../src/paged/index.ts';
import { validateDocument } from '../src/schema/index.ts';
import { everyBlock, rng, time } from './fixtures.ts';

const unit = (index: number, extra: Partial<PagedUnit> = {}): PagedUnit => ({
  id: `b${index}`,
  index,
  type: 'paragraph',
  breakBefore: false,
  keepWithNext: false,
  splittable: true,
  ...extra,
});
/** A block of `count` lines of `height` each. */
const lines = (count: number, height = 10): UnitMeasure => ({
  height: count * height,
  lines: Array.from({ length: count }, (_, i) => (i + 1) * height),
});
const shape = (pages: ReturnType<typeof paginate>['pages']) =>
  pages.map((page) => page.slices.map((slice) => `${slice.id}:${slice.from}-${slice.to}`));

describe('paged: geometry', () => {
  it('resolves presets, orientation, custom sizes and margins to points', () => {
    const a4 = pageGeometry({ size: 'a4', orientation: 'portrait' });
    expect(a4.width).toBeCloseTo(595.28, 1);
    expect(a4.height).toBeCloseTo(841.89, 1);
    expect(a4.margins.top).toBeCloseTo(72, 5);
    expect(a4.contentWidth).toBeCloseTo(595.28 - 144, 1);
    const letter = pageGeometry({ size: 'letter', orientation: 'landscape' });
    expect([letter.width, letter.height].map(Math.round)).toEqual([792, 612]);
    expect(letter.orientation).toBe('landscape');
    const legal = pageGeometry({ size: 'legal', orientation: 'portrait' });
    expect(Math.round(legal.height)).toBe(1008);
    const custom = pageGeometry({
      size: 'custom',
      orientation: 'portrait',
      width: 100,
      height: 150,
      margins: { top: 10, bottom: 10, inlineStart: 5, inlineEnd: 5 },
    });
    expect(custom.widthMm).toBe(100);
    expect(custom.contentWidth).toBeCloseTo(90 * MM, 5);
    expect(custom.contentHeight).toBeCloseTo(130 * MM, 5);
    // Total: unknown sizes fall back to A4; margins never leave less than 10 mm.
    const odd = pageGeometry({
      size: 'tabloid' as never,
      orientation: 'portrait',
      margins: { top: 100, bottom: 100, inlineStart: 100, inlineEnd: Number.NaN },
    });
    expect(odd.size).toBe('a4');
    expect(odd.contentHeight).toBeCloseTo(97 * MM, 5);
    expect(odd.contentWidth).toBeGreaterThanOrEqual(10 * MM - 1e-6);
    expect(pageGeometry(null).size).toBe('a4');
  });

  it('merges overrides over the document settings', () => {
    const doc = {
      page: { size: 'custom' as const, orientation: 'portrait' as const, width: 90, height: 90 },
    };
    expect(documentPageSettings(doc, { size: 'letter' })).toEqual({
      size: 'letter',
      orientation: 'portrait',
    });
    expect(documentPageSettings({}, { orientation: 'landscape' })).toEqual({
      size: 'a4',
      orientation: 'landscape',
    });
  });
});

describe('paged: pagination', () => {
  it('fills pages in order with a gap between blocks, never at the top of a page', () => {
    const units = [0, 1, 2, 3].map((i) => unit(i, { splittable: false }));
    const { pages } = paginate(units, [lines(4), lines(4), lines(4), lines(4)], {
      contentHeight: 100,
      gap: 10,
    });
    expect(shape(pages)).toEqual([
      ['b0:0-40', 'b1:0-40'],
      ['b2:0-40', 'b3:0-40'],
    ]);
    expect(pages[0]?.slices.map((slice) => slice.top)).toEqual([0, 50]);
    expect(pages[1]?.slices[0]?.top).toBe(0);
    expect(pages.map((page) => page.number)).toEqual([1, 2]);
  });

  it('starts a new page at an explicit break and keeps headings with what follows', () => {
    const doc = createDocument({
      meta: { title: 'Breaks' },
      blocks: [paragraphBlock('a', 'A'), paragraphBlock('b', 'B'), paragraphBlock('c', 'C')],
    });
    doc.page = { size: 'a4', orientation: 'portrait', breaks: ['b', 'missing', 'a'] };
    const units = pagedUnits(doc);
    // The first block never breaks; unknown ids are ignored.
    expect(units.map((u) => u.breakBefore)).toEqual([false, true, false]);
    expect(
      shape(paginate(units, [lines(1), lines(1), lines(1)], { contentHeight: 100 }).pages)
    ).toEqual([['a:0-10'], ['b:0-10', 'c:0-10']]);
    // A heading at the bottom of a page moves to the next page with its paragraph.
    const heading = [
      unit(0, { splittable: false }),
      unit(1, { type: 'heading', keepWithNext: true, splittable: false }),
      unit(2),
    ];
    const { pages } = paginate(heading, [lines(8), lines(1), lines(5)], { contentHeight: 100 });
    expect(shape(pages)).toEqual([['b0:0-80'], ['b1:0-10', 'b2:0-50']]);
  });

  it('splits text at line boundaries with orphan and widow control', () => {
    // 6 lines fit after the first block; the paragraph has 7, so 2 must carry over.
    const units = [unit(0, { splittable: false }), unit(1)];
    const two = paginate(units, [lines(4), lines(7)], { contentHeight: 100 });
    expect(shape(two.pages)).toEqual([['b0:0-40', 'b1:0-50'], ['b1:50-70']]);
    expect(two.pages[0]?.slices[1]).toMatchObject({
      continues: true,
      continued: false,
      clipped: false,
    });
    expect(two.pages[1]?.slices[0]).toMatchObject({ continued: true, continues: false });
    // Only one line fits at the bottom: below the orphan minimum, so the paragraph moves whole.
    const moved = paginate(units, [lines(9), lines(4)], { contentHeight: 100 });
    expect(shape(moved.pages)).toEqual([['b0:0-90'], ['b1:0-40']]);
    // Three widows requested: the split moves up one line.
    const widows = paginate(units, [lines(4), lines(7)], { contentHeight: 100, widows: 3 });
    expect(shape(widows.pages)).toEqual([['b0:0-40', 'b1:0-40'], ['b1:40-70']]);
    // A paragraph longer than a page splits across several.
    const long = paginate([unit(0)], [lines(25)], { contentHeight: 100 });
    expect(shape(long.pages)).toEqual([['b0:0-100'], ['b0:100-200'], ['b0:200-250']]);
  });

  it('clips a block taller than a page that cannot split at lines', () => {
    const { pages } = paginate(
      [unit(0), unit(1, { splittable: false })],
      [lines(2), { height: 250 }],
      {
        contentHeight: 100,
      }
    );
    expect(shape(pages)).toEqual([['b0:0-20'], ['b1:0-100'], ['b1:100-200'], ['b1:200-250']]);
    expect(pages.slice(1).every((page) => page.slices[0]?.clipped)).toBe(true);
    // An empty document still has one page.
    expect(paginate([], [], { contentHeight: 100 }).pages).toEqual([{ number: 1, slices: [] }]);
  });

  it('stays finite and bounded on hostile measures', () => {
    const units = Array.from({ length: 6 }, (_, i) => unit(i));
    const hostile: UnitMeasure[] = [
      { height: Number.NaN },
      { height: -50, lines: [10, 5, Number.POSITIVE_INFINITY] },
      { height: 1e12 },
      { height: 30, lines: [Number.NaN, 40, 20, 20, 10, -1] },
      { height: Number.POSITIVE_INFINITY },
      undefined as unknown as UnitMeasure,
    ];
    const result = paginate(units, hostile, { contentHeight: Number.NaN, maxPages: 50 });
    expect(result.truncated).toBe(true);
    expect(result.pages.length).toBe(50);
    for (const page of result.pages) {
      for (const slice of page.slices) {
        expect(Number.isFinite(slice.from) && Number.isFinite(slice.to)).toBe(true);
        expect(slice.to).toBeGreaterThanOrEqual(slice.from);
      }
    }
  });

  it('is linear: a hundred times the lines takes far less than a hundred squared times as long', () => {
    const run = (blocks: number, perBlock: number) => {
      const units = Array.from({ length: blocks }, (_, i) => unit(i));
      const measures = units.map(() => lines(perBlock, 7));
      return time(() => paginate(units, measures, { contentHeight: 700, maxPages: 100_000 }));
    };
    run(20, 50);
    const small = run(20, 50);
    const large = run(2_000, 500);
    expect(large).toBeLessThan(2_000);
    expect(large).toBeLessThan(Math.max(100, small * 5_000));
  });
});

describe('paged: headers, footers and the document layout', () => {
  it('resolves band fields in one pass and keeps other text', () => {
    const fields = { page: 3, pages: 12, title: 'Report {page}' };
    expect(resolveBandText('{page} / {pages}', fields)).toBe('3 / 12');
    expect(resolveBandText('{title} — {pagex} {Page} {{page}}', fields)).toBe(
      'Report {page} — {pagex} {Page} {3}'
    );
    expect(resolveBandText(undefined, fields)).toBe('');
  });

  it('lays a document out with an injected measurer, page numbers and header', () => {
    const doc = everyBlock();
    doc.page = {
      size: 'a5',
      orientation: 'portrait',
      header: { start: '{title}', end: 'Draft' },
      breaks: ['co1'],
    };
    const seen: [string, number][] = [];
    const measure: BlockMeasurer = (block: DocumentBlock, info, width) => {
      seen.push([block.id, Math.round(width)]);
      return info.splittable ? lines(3, 20) : { height: 40 };
    };
    const layout = layoutDocument(doc, measure, { gap: 6 });
    expect(seen.length).toBe(doc.blocks.length);
    expect(seen[0]?.[1]).toBe(Math.round(layout.geometry.contentWidth));
    expect(layout.geometry.size).toBe('a5');
    const firstOfBreak = layout.pages.find((page) =>
      page.slices.some((slice) => slice.id === 'co1')
    );
    expect(firstOfBreak?.slices[0]?.id).toBe('co1');
    const total = layout.pages.length;
    expect(layout.pages[0]?.footer).toEqual({ start: '', center: `1 / ${total}`, end: '' });
    expect(layout.pages[0]?.header).toEqual({ start: 'Field notes', center: '', end: 'Draft' });
    // Scale: the paged view measures in CSS pixels.
    const px = layoutDocument(doc, measure, { scale: 96 / 72, pageNumbers: false });
    expect(px.pages[0]?.footer).toBeNull();
    expect(seen.at(-1)?.[1]).toBe(Math.round(px.geometry.contentWidth * (96 / 72)));
    expect(DEFAULT_FOOTER.center).toBe('{page} / {pages}');
  });

  it('validates page settings: custom sizes, bands and breaks', () => {
    const base = (page: unknown): TexuliDocument =>
      ({
        ...createDocument({ meta: { title: 'x' }, blocks: [paragraphBlock('a', 'A')] }),
        page,
      }) as TexuliDocument;
    const ok = (page: unknown) => validateDocument(base(page)).ok;
    expect(ok({ size: 'custom', orientation: 'portrait', width: 120, height: 200 })).toBe(true);
    expect(ok({ size: 'custom', orientation: 'portrait', width: 120 })).toBe(false);
    expect(ok({ size: 'a4', orientation: 'portrait', width: 120, height: 200 })).toBe(false);
    expect(ok({ size: 'custom', orientation: 'portrait', width: 10, height: 200 })).toBe(false);
    expect(
      ok({
        size: 'a4',
        orientation: 'portrait',
        header: { start: '{title}', end: '{page}' },
        breaks: ['a'],
      })
    ).toBe(true);
    expect(ok({ size: 'a4', orientation: 'portrait', header: { start: 'two\nlines' } })).toBe(
      false
    );
    expect(ok({ size: 'a4', orientation: 'portrait', footer: { middle: 'x' } })).toBe(false);
    expect(ok({ size: 'a4', orientation: 'portrait', breaks: ['not an id!'] })).toBe(false);
    expect(
      ok({
        size: 'a4',
        orientation: 'portrait',
        breaks: Array.from({ length: 2_001 }, (_, i) => `b${i}`),
      })
    ).toBe(false);
    const random = rng(7);
    for (let i = 0; i < 200; i += 1) {
      const page = {
        size: 'custom',
        orientation: 'portrait',
        width: random() * 1_200,
        height: random() * 1_200,
      };
      const valid =
        page.width >= 50 && page.width <= 1_000 && page.height >= 50 && page.height <= 1_000;
      expect(ok(page)).toBe(valid);
    }
  });
});

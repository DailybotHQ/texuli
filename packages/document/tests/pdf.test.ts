// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDocument, paragraphBlock } from '../src/model/index.ts';
import type { DocumentBlock, TexuliDocument } from '../src/model/types.ts';
import { PDF_MIME, parseTrueType, writePdf } from '../src/pdf/index.ts';
import { everyBlock } from './fixtures.ts';
import { makeJpeg, makePng, makeTrueType, parsePdf, shownText } from './output-helpers.ts';

const long = (count: number): TexuliDocument =>
  createDocument({
    meta: { title: 'Long read', locale: 'en' },
    blocks: Array.from({ length: count }, (_, i) =>
      paragraphBlock(
        `p${i}`,
        `Paragraph ${i}: ${'Small pieces, infinite possibilities. '.repeat(6)}`
      )
    ),
  });

describe('pdf: structure', () => {
  it('writes a parseable PDF whose page tree matches the paged layout', async () => {
    const result = await writePdf(everyBlock());
    expect(PDF_MIME).toBe('application/pdf');
    const pdf = parsePdf(result.bytes);
    expect(pdf.version).toBe('1.7');
    expect(pdf.pageCount).toBe(result.pageCount);
    expect(result.pageCount).toBe(result.layout.pages.length);
    const text = pdf.contents.map(shownText).join('\n');
    expect(text).toContain('Field notes');
    expect(text).toContain('Read the');
    expect(text).toContain('const x = 1;');
    expect(text).toContain('[x]');
    expect(text).toContain('Heads up');
    expect(text).toContain('[Sheet: Budget]');
    expect(text).not.toContain('Shorter?');
    // A4 media box, standard fonts with WinAnsi, the link annotation, page numbers.
    expect(pdf.pages[0]?.dict).toContain('/MediaBox [0 0 595.276 841.89]');
    expect(pdf.raw).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(pdf.uris).toEqual(['https://example.com/guide']);
    expect(shownText(pdf.contents[0] as string)).toContain(`1 / ${result.pageCount}`);
    expect(pdf.raw).toMatch(/\/Title <FEFF[0-9A-F]+>/);
  });

  it('is deterministic and compresses its content streams', async () => {
    const a = await writePdf(long(40));
    const b = await writePdf(long(40));
    expect(a.bytes).toEqual(b.bytes);
    const stored = await writePdf(long(40), { compress: false });
    expect(stored.bytes.length).toBeGreaterThan(a.bytes.length * 2);
    expect(parsePdf(stored.bytes).contents).toEqual(parsePdf(a.bytes).contents);
  });

  it('paginates long documents with page numbers, explicit breaks and page sizes', async () => {
    const doc = long(60);
    doc.page = {
      size: 'letter',
      orientation: 'landscape',
      header: { end: '{title}' },
      footer: { start: 'Page {page} of {pages}' },
      breaks: ['p3'],
    };
    const result = await writePdf(doc);
    const pdf = parsePdf(result.bytes);
    expect(result.pageCount).toBeGreaterThan(4);
    expect(pdf.pageCount).toBe(result.pageCount);
    expect(pdf.pages[0]?.dict).toContain('/MediaBox [0 0 792 612]');
    // The break puts p3 at the top of page 2.
    expect(shownText(pdf.contents[1] as string).startsWith('Paragraph 3:')).toBe(true);
    pdf.contents.forEach((content, index) => {
      const shown = shownText(content);
      expect(shown).toContain(`Page ${index + 1} of ${result.pageCount}`);
      expect(shown).toContain('Long read');
    });
    // Every paragraph lands on a page exactly once, unless it was split.
    const all = pdf.contents.map(shownText).join('');
    for (let i = 0; i < 60; i += 1) expect(all).toContain(`Paragraph ${i}:`);
  });

  it('embeds JPEG and PNG images (with alpha as a soft mask) and falls back to alt text', async () => {
    const images: Record<string, Uint8Array> = {
      'https://example.com/a.jpg': makeJpeg(640, 480),
      'https://example.com/b.png': makePng(8, 4, 3),
      'https://example.com/c.png': makePng(6, 6, 4),
      'https://example.com/d.gif': new TextEncoder().encode('GIF89a'),
    };
    const blocks: DocumentBlock[] = Object.keys(images).map((ref, i) => ({
      id: `m${i}`,
      type: 'media',
      ref,
      alt: `Image ${i}`,
    }));
    const result = await writePdf(createDocument({ meta: { title: 'Images' }, blocks }), {
      resolveImage: (ref) => images[ref],
    });
    const pdf = parsePdf(result.bytes);
    const xobjects = [...pdf.objects.values()].filter((o) => o.dict.includes('/Subtype /Image'));
    expect(
      xobjects.some((o) => /\/Width 640 \/Height 480 .*\/Filter \/DCTDecode/.test(o.dict))
    ).toBe(true);
    expect(
      xobjects.some((o) =>
        /\/Predictor 15 \/Colors 3 \/BitsPerComponent 8 \/Columns 8/.test(o.dict)
      )
    ).toBe(true);
    const masked = xobjects.find((o) => o.dict.includes('/SMask'));
    expect(masked?.dict).toContain('/Width 6 /Height 6');
    expect(pdf.contents.join('\n')).toMatch(/\/Im1 Do/);
    expect(shownText(pdf.contents.join('\n'))).toContain('[Image: Image 3]');
    expect(result.diagnostics.map((d) => `${d.id}:${d.code}`)).toEqual(['m3:image-unsupported']);
  });

  it('embeds a host TrueType font whole, with a ToUnicode map, for text outside WinAnsi', async () => {
    const font = makeTrueType([0x4f60, 0x597d]);
    expect(parseTrueType(font)?.glyph(0x597d)).toBe(2);
    const doc = createDocument({
      meta: { title: 'Hello' },
      blocks: [paragraphBlock('p', 'Hi 你好 ok')],
    });
    const result = await writePdf(doc, { font });
    const pdf = parsePdf(result.bytes);
    expect(pdf.raw).toContain('/Subtype /Type0 /BaseFont /TexuliEmbedded /Encoding /Identity-H');
    expect(pdf.raw).toContain('/CIDToGIDMap /Identity');
    expect(pdf.raw).toContain(`/Length1 ${font.length}`);
    expect(pdf.contents[0]).toContain('/T1 11 Tf <00010002> Tj');
    const cmap = [...pdf.objects.values()].find(
      (o) => o.stream && new TextDecoder().decode(o.stream).includes('beginbfchar')
    );
    expect(new TextDecoder().decode(cmap?.stream)).toContain('<0001> <4f60>');
    expect(result.diagnostics).toEqual([]);
    // Without a font the characters print as "?" with one diagnostic.
    const plain = await writePdf(doc);
    expect(shownText(parsePdf(plain.bytes).contents[0] as string)).toContain('Hi ?? ok');
    expect(plain.diagnostics.map((d) => d.code)).toEqual(['glyph-missing']);
  });
});

describe('pdf: hostile input', () => {
  it('cannot inject PDF syntax through text, titles, links or fonts', async () => {
    const hostile =
      ') Tj /JS (app.alert(1)) >> /OpenAction << /S /JavaScript /JS (x) >> \\ ( \u0000';
    const doc = createDocument({
      meta: { title: hostile, authors: [hostile], locale: 'en' },
      blocks: [
        {
          id: 'h',
          type: 'heading',
          level: 1,
          content: [{ type: 'text', text: hostile, marks: [] }],
        },
        {
          id: 'p',
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'run',
              marks: [{ type: 'link', href: 'javascript:app.alert(1)' }],
            },
            { type: 'text', text: 'file', marks: [{ type: 'link', href: 'file:///etc/passwd' }] },
            {
              type: 'text',
              text: 'ok',
              marks: [{ type: 'link', href: 'https://example.com/a)b>c' }],
            },
          ],
        },
        { id: 'c', type: 'code', text: hostile },
      ],
    });
    doc.page = { size: 'a4', orientation: 'portrait', footer: { center: hostile } };
    const result = await writePdf(doc, { font: new TextEncoder().encode('OTTO not a font') });
    const pdf = parsePdf(result.bytes);
    expect(pdf.raw).not.toMatch(
      /\/JS\b|\/JavaScript|\/OpenAction|\/Launch|\/EmbeddedFile|\/AcroForm/
    );
    expect(pdf.uris).toEqual(['https://example.com/a)b%3Ec']);
    expect(result.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['font-unsupported', 'link-refused'])
    );
    // The hostile text is shown as text.
    expect(shownText(pdf.contents.join(''))).toContain(') Tj /JS (app.alert(1))');
  });

  it('refuses malformed fonts and images without throwing', async () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array(64),
      makeTrueType([0x41]).slice(0, 40),
      new TextEncoder().encode('ttcf'),
    ]) {
      expect(parseTrueType(bytes)).toBeNull();
    }
    // A cmap whose segment points far outside the file maps to .notdef.
    const font = makeTrueType([0x4e00]);
    expect(parseTrueType(font)?.glyph(0x10ffff)).toBe(0);
    const broken = makePng(4, 4, 4);
    broken.fill(0, 41, 60); // corrupt the image data
    const doc = createDocument({
      meta: { title: 'x' },
      blocks: [{ id: 'm', type: 'media', ref: 'https://example.com/x.png', alt: 'Broken' }],
    });
    const result = await writePdf(doc, { resolveImage: () => broken });
    expect(parsePdf(result.bytes).pageCount).toBe(1);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['image-unsupported']);
  });

  it('writes a document at the block cap in bounded time', async () => {
    const start = performance.now();
    const result = await writePdf(long(2_000), { compress: false });
    const elapsed = performance.now() - start;
    expect(result.pageCount).toBeGreaterThan(100);
    expect(parsePdf(result.bytes).pageCount).toBe(result.pageCount);
    expect(elapsed).toBeLessThan(6_000);
  });
});

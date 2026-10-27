// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDeckPptx,
  crc32,
  DECK_PRINT_PAGE_SIZES,
  deckExportFilename,
  el,
  escapeXmlAttribute,
  escapeXmlText,
  exportDeckPptx,
  PPTX_MIME_TYPE,
  planDeckPrint,
  requestDeckPdf,
  sanitizeXmlChars,
  serializeXml,
  writeDeckPptx,
  writeZip,
  type XmlElement,
} from '../src/export/index.ts';
import { parseDeck } from '../src/model/index.ts';
import { scenario } from './scenario.ts';

describe('print plan and PDF seam', () => {
  function makeDeck(aspect = '16:9') {
    const parsed = parseDeck({
      meta: { title: 'Quarterly update', aspect },
      slides: [
        { id: 'opening', title: 'Opening', notes: 'Welcome.', blocks: [] },
        { id: 'numbers', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  it('deck print plan: pages, notes appendix and handout, stylesheet page sync and safe filenames', () => {
    // prints one page per slide by default with a page size from the aspect
    {
      const deck = makeDeck('4:3');
      const before = JSON.stringify(deck);
      const plan = planDeckPrint(deck);
      expect(plan.filename).toBe('Quarterly update.pdf');
      expect(plan.notes).toBe('none');
      expect(plan.pageSize).toEqual(DECK_PRINT_PAGE_SIZES['4:3']);
      expect(plan.pageSize.pageName).toBe('tx-deck-4-3');
      expect(plan.pages).toEqual([
        { kind: 'slide', index: 0, slideId: 'opening', label: 'Opening' },
        { kind: 'slide', index: 1, slideId: 'numbers', label: 'Slide 2' },
      ]);
      expect(JSON.stringify(deck)).toBe(before);
    }
    // adds a notes appendix after the slides, or prints a notes-only handout
    {
      const appendix = planDeckPrint(makeDeck(), { notes: 'appendix' });
      expect(appendix.pages.map((page) => `${page.kind}:${page.slideId}`)).toEqual([
        'slide:opening',
        'slide:numbers',
        'notes:opening',
        'notes:numbers',
      ]);
      expect(appendix.pages[2]).toMatchObject({ kind: 'notes', notes: 'Welcome.' });
      expect(appendix.pages[3]).toMatchObject({ kind: 'notes', notes: null });

      const handout = planDeckPrint(makeDeck(), { notes: 'handout' });
      expect(handout.pages.every((page) => page.kind === 'notes')).toBe(true);
      expect(() => planDeckPrint(makeDeck(), { notes: 'everything' as unknown as 'none' })).toThrow(
        TypeError
      );
    }
    // keeps the stylesheet named pages in sync with the page size table
    {
      const css = readFileSync('packages/slides/src/styles.css', 'utf8');
      for (const size of Object.values(DECK_PRINT_PAGE_SIZES)) {
        expect(css).toContain(
          `@page ${size.pageName} {\n  size: ${size.inlineSize} ${size.blockSize};\n  margin: 0;`
        );
        expect(css).toContain(
          `.tx-deck-print__slide[data-aspect="${size.aspect}"] {\n    page: ${size.pageName};`
        );
      }
      expect(css).toMatch(/@media print \{[\s\S]*\.tx-deck-stage__toolbar/);
    }
    expect(deckExportFilename('Q3 / Q4: plan?')).toBe('Q3 - Q4- plan.pdf');
    expect(deckExportFilename('../../etc/passwd')).toBe('etc-passwd.pdf');
    expect(deckExportFilename('Report.pdf')).toBe('Report.pdf');
    expect(deckExportFilename('')).toBe('presentation.pdf');
    expect(deckExportFilename(42)).toBe('presentation.pdf');
    expect(deckExportFilename('x'.repeat(200)).length).toBe(84);
    expect(deckExportFilename('Deck', 'png')).toBe('Deck.png');
    expect(deckExportFilename('Deck', '../sh')).toBe('Deck.pdf');
  });

  it('PDF request seam: browser print, a clear failure, and a checked host exporter blob', async () => {
    await scenario('uses browser print when no exporter is supplied', async () => {
      const print = vi.fn();
      const result = await requestDeckPdf(planDeckPrint(makeDeck()), { print });
      expect(print).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ method: 'browser-print', filename: 'Quarterly update.pdf' });
    });
    await scenario('fails clearly without print or exporter', async () => {
      const original = globalThis.print;
      // @ts-expect-error simulate a host without window.print
      delete globalThis.print;
      try {
        await expect(requestDeckPdf(planDeckPrint(makeDeck()))).rejects.toThrow(
          /supply a PDF exporter/
        );
      } finally {
        if (original) globalThis.print = original;
      }
    });
    await scenario(
      'passes the plan to a host exporter and checks the returned PDF blob',
      async () => {
        const plan = planDeckPrint(makeDeck(), { notes: 'appendix' });
        const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
        const exporter = vi.fn(async () => pdf);
        const print = vi.fn();
        const result = await requestDeckPdf(plan, { exporter, print });
        expect(exporter).toHaveBeenCalledWith(plan);
        expect(print).not.toHaveBeenCalled();
        expect(result).toEqual({ method: 'exporter', filename: plan.filename, blob: pdf });

        for (const bad of [
          new Blob(['<html>'], { type: 'text/html' }),
          new Blob([], { type: 'application/pdf' }),
          'not a blob' as unknown as Blob,
        ]) {
          await expect(requestDeckPdf(plan, { exporter: async () => bad })).rejects.toThrow(
            /application\/pdf/
          );
        }
      }
    );
  });
});

describe('PPTX export', () => {
  const HOSTILE = '</a:t><script>alert("x")</script>&amp; \u0007bell \'q\'';

  function makeDeck(overrides: Record<string, unknown> = {}) {
    const parsed = parseDeck({
      meta: { title: 'Quarterly / update', aspect: '16:9', locale: 'en-GB' },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          notes: 'Welcome everyone.\nIntroduce the team.',
          blocks: [
            { type: 'heading', level: 2, text: 'Three priorities' },
            { type: 'list', items: [{ text: 'Ship' }, { text: 'Measure' }] },
            { type: 'code', lang: 'ts', code: 'const n = 1;' },
          ],
        },
        {
          id: 'visuals',
          title: HOSTILE.replace('\u0007', ''),
          blocks: [
            { type: 'text', markdown: HOSTILE.replace('\u0007', '') },
            {
              type: 'image',
              src: 'assets/chart.png',
              alt: 'A chart photo',
              width: 640,
              height: 360,
            },
            {
              type: 'columns',
              columns: [[{ type: 'text', markdown: 'Left' }], [{ type: 'divider' }]],
            },
            { type: 'stat', items: [{ label: 'Active', value: '12' }] },
          ],
        },
      ],
      ...overrides,
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  /** Read stored entries back from a ZIP (local headers only; enough for our writer). */
  function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder();
    const entries = new Map<string, Uint8Array>();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      expect(view.getUint16(offset + 8, true)).toBe(0);
      const crc = view.getUint32(offset + 14, true);
      const size = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
      const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
      expect(crc32(data)).toBe(crc);
      entries.set(name, data);
      offset += 30 + nameLength + size;
    }
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(entries.size);
    return entries;
  }

  function parseXml(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    return doc;
  }

  it('XML writer escapes text and attributes and refuses unsafe names, even on hand-built nodes', () => {
    // escapes text and attributes and strips characters XML cannot carry
    {
      expect(escapeXmlText('a < b && c > d')).toBe('a &lt; b &amp;&amp; c &gt; d');
      expect(escapeXmlAttribute('"\'\t\n')).toBe('&quot;&apos;&#9;&#10;');
      expect(sanitizeXmlChars('ok\u0000\u0007￾\uD800!\t\n')).toBe('ok!\t\n');
      const xml = serializeXml(el('root', { title: HOSTILE }, HOSTILE, el('child'), null, false));
      expect(xml).not.toContain('<script');
      expect(xml).not.toContain('</a:t>');
      expect(xml).toContain('<child/>');
      const doc = parseXml(xml);
      expect(doc.documentElement.getAttribute('title')).toBe(HOSTILE.replace('\u0007', ''));
      expect(doc.documentElement.textContent).toBe(HOSTILE.replace('\u0007', ''));
    }
    // rejects unsafe element and attribute names, even on hand-built nodes
    {
      for (const name of ['a b', 'x"y', '<p', '1a', 'a:b:c', '']) {
        expect(() => el(name)).toThrow(TypeError);
        expect(() => el('ok', { [name]: 'v' })).toThrow(TypeError);
      }
      expect(() => el('ok', { n: Number.NaN })).toThrow(TypeError);
      const forged: XmlElement = {
        kind: 'element',
        name: 'p><script>x</script><p',
        attributes: [],
        children: [],
      };
      expect(() => serializeXml(forged)).toThrow(TypeError);
      const forgedAttr: XmlElement = {
        kind: 'element',
        name: 'p',
        attributes: [['onload="x" a', 'v']],
        children: [],
      };
      expect(() => serializeXml(forgedAttr)).toThrow(TypeError);
    }
  });

  it('ZIP writer: CRC-32, deterministic stored entries and refused paths', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    // writes stored entries that read back byte for byte, deterministically
    {
      const entries = [
        { path: 'a.txt', data: 'hello' },
        { path: 'dir/ünïcode.xml', data: new Uint8Array([1, 2, 3]) },
      ];
      const bytes = writeZip(entries);
      expect([...bytes]).toEqual([...writeZip(entries)]);
      const read = readZip(bytes);
      expect(new TextDecoder().decode(read.get('a.txt'))).toBe('hello');
      expect([...(read.get('dir/ünïcode.xml') ?? [])]).toEqual([1, 2, 3]);
    }
    for (const path of ['', '/abs', '../up', 'a/../b', 'a\\b', 'a//b', './a', 'a\u0000b']) {
      expect(() => writeZip([{ path, data: 'x' }])).toThrow(TypeError);
    }
    expect(() =>
      writeZip([
        { path: 'a', data: '1' },
        { path: 'a', data: '2' },
      ])
    ).toThrow(/Duplicate/);
  });

  it('PPTX export: resolvable parts, escaped text and notes, aspect sizing and a deterministic blob', async () => {
    await scenario(
      'builds well-formed parts whose content types and relationships all resolve',
      async () => {
        const pkg = buildDeckPptx(makeDeck());
        const paths = new Set(pkg.parts.map((part) => part.path));
        expect(pkg.parts[0]?.path).toBe('[Content_Types].xml');
        for (const required of [
          '_rels/.rels',
          'docProps/core.xml',
          'ppt/presentation.xml',
          'ppt/slideMasters/slideMaster1.xml',
          'ppt/slideLayouts/slideLayout1.xml',
          'ppt/theme/theme1.xml',
          'ppt/slides/slide1.xml',
          'ppt/slides/slide2.xml',
          'ppt/notesSlides/notesSlide1.xml',
          'ppt/notesMasters/notesMaster1.xml',
        ]) {
          expect(paths.has(required)).toBe(true);
        }
        expect(paths.has('ppt/notesSlides/notesSlide2.xml')).toBe(false);

        const docs = new Map(pkg.parts.map((part) => [part.path, parseXml(part.xml)]));
        const types = docs.get('[Content_Types].xml');
        const overrides = new Set(
          [...(types?.getElementsByTagName('Override') ?? [])].map((node) =>
            node.getAttribute('PartName')
          )
        );
        for (const part of pkg.parts) {
          if (part.path.endsWith('.rels') || part.path === '[Content_Types].xml') continue;
          expect(overrides.has(`/${part.path}`)).toBe(true);
        }
        for (const name of overrides) expect(paths.has(String(name).slice(1))).toBe(true);

        for (const [path, doc] of docs) {
          if (!path.endsWith('.rels')) continue;
          // `dir/_rels/name.rels` describes `dir/name`; targets resolve from `dir/`.
          const baseDir = path.replace(/_rels\/[^/]*\.rels$/, '');
          for (const rel of doc.getElementsByTagName('Relationship')) {
            const target = new URL(rel.getAttribute('Target') ?? '', `file:///${baseDir}`).pathname;
            expect(paths.has(target.slice(1)), `${path} -> ${target}`).toBe(true);
          }
        }
      }
    );
    await scenario(
      'writes slide text, titles and notes as escaped text and reports omitted blocks',
      async () => {
        const deck = makeDeck();
        const before = JSON.stringify(deck);
        const pkg = buildDeckPptx(deck);
        const xml = (path: string) => pkg.parts.find((part) => part.path === path)?.xml ?? '';

        const opening = parseXml(xml('ppt/slides/slide1.xml'));
        const texts = [...opening.getElementsByTagName('a:t')].map((node) => node.textContent);
        expect(texts).toEqual(['Opening', 'Three priorities', 'Ship', 'Measure', 'const n = 1;']);
        expect(opening.getElementsByTagName('a:buChar')).toHaveLength(2);
        expect(xml('ppt/slides/slide1.xml')).toContain('lang="en-GB"');

        const visuals = xml('ppt/slides/slide2.xml');
        expect(visuals).not.toContain('<script');
        expect(visuals.split('<a:t>').length).toBe(visuals.split('</a:t>').length);
        expect(visuals).not.toContain('A chart photo');
        const visualTexts = [...parseXml(visuals).getElementsByTagName('a:t')].map(
          (node) => node.textContent
        );
        expect(visualTexts[0]).toBe(HOSTILE.replace('\u0007', ''));
        expect(visualTexts).toContain('Left');
        expect(pkg.omitted).toEqual([
          { slideId: 'visuals', blockType: 'image', path: '$[1]' },
          { slideId: 'visuals', blockType: 'stat', path: '$[3]' },
        ]);

        const notes = [
          ...parseXml(xml('ppt/notesSlides/notesSlide1.xml')).getElementsByTagName('a:t'),
        ].map((node) => node.textContent);
        expect(notes).toEqual(['Welcome everyone.', 'Introduce the team.']);
        expect(
          parseXml(xml('docProps/core.xml')).getElementsByTagName('dc:title')[0]?.textContent
        ).toBe('Quarterly / update');
        expect(JSON.stringify(deck)).toBe(before);
      }
    );
    await scenario('sizes slides from the aspect and can leave notes out', async () => {
      const square = buildDeckPptx(makeDeck({ meta: { title: 'Square', aspect: '1:1' } }), {
        notes: false,
      });
      const presentation = parseXml(
        square.parts.find((part) => part.path === 'ppt/presentation.xml')?.xml ?? ''
      );
      const size = presentation.getElementsByTagName('p:sldSz')[0];
      expect(size?.getAttribute('cx')).toBe('6858000');
      expect(size?.getAttribute('cy')).toBe('6858000');
      expect(presentation.getElementsByTagName('p:notesMasterIdLst')).toHaveLength(0);
      expect(square.parts.some((part) => part.path.includes('notes'))).toBe(false);
    });
    await scenario('zips a deterministic package and exposes it as a PPTX blob', async () => {
      const deck = makeDeck();
      const first = writeDeckPptx(deck);
      expect(first.filename).toBe('Quarterly - update.pptx');
      expect([...first.bytes]).toEqual([...writeDeckPptx(deck).bytes]);
      const entries = readZip(first.bytes);
      expect([...entries.keys()][0]).toBe('[Content_Types].xml');
      expect(entries.size).toBe(buildDeckPptx(deck).parts.length);

      const exported = exportDeckPptx(deck);
      expect(exported.blob.type).toBe(PPTX_MIME_TYPE);
      expect(exported.blob.size).toBe(first.bytes.length);
      expect(exported.omitted).toHaveLength(2);
    });
  });
});

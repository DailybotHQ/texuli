// @vitest-environment happy-dom
/**
 * Export for deck model v2: the print plan (visible slides at the canvas
 * size, notes, the `?print=1&notes=1` flags) and the owned PPTX writer
 * (structure, layouts and placeholders, tables, pictures from host bytes,
 * chart snapshots, theme, notes, determinism, hostile input, every layout
 * and aspect). The PPTX bytes are unzipped and every part is parsed.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { parseDeckRoute } from '@texuli/deck/engine';
import {
  DECK_CANVAS,
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUT_IDS,
  DECK_LAYOUTS,
  type Deck,
  parseDeck,
} from '@texuli/deck/model';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDeckPptx,
  DECK_EXPORT_CANVAS,
  DECK_PRINT_CANVAS_PAGE_SIZES,
  type DeckPptxImageAsset,
  type DeckPptxV2Omission,
  deckPrintSearch,
  deckSlideLabel,
  exportDeckPptx,
  loadDeckPptxWriter,
  PPTX_CANVAS_SLIDE_SIZES,
  PPTX_MIME_TYPE,
  parseDeckPrintFlags,
  planDeckPrint,
  writeDeckPptx,
} from '../src/export/index.ts';
import { sniffImageSize } from '../src/export/pptx-v2.ts';
import { crc32 } from '../src/export/zip.ts';

// ---------------------------------------------------------------------------
// Test helpers: a real PNG encoder, a stored-ZIP reader, a relationship check

/** A solid-color RGB PNG (real IHDR, IDAT and IEND chunks). */
function png(width: number, height: number, [r, g, b]: [number, number, number]): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw.set([r, g, b], y * (1 + width * 3) + 1 + x * 3);
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Read a stored (uncompressed) ZIP in entry order, checking CRCs and the central directory. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, Uint8Array>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(at + 8, true), 'stored entries only').toBe(0);
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const data = bytes.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
    expect(crc32(data), name).toBe(crc);
    out.set(name, data);
    at += 30 + nameLength + extra + size;
  }
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 10, true)).toBe(out.size);
  return out;
}

/** Problems with the package relationships: missing targets, duplicate ids, dangling `r:` references. */
function relationshipsResolve(zip: Map<string, Uint8Array>): string[] {
  const problems: string[] = [];
  const text = (name: string) => new TextDecoder().decode(zip.get(name));
  for (const name of zip.keys()) {
    if (!name.endsWith('.rels')) continue;
    // `dir/_rels/part.rels` describes `dir/part`; targets resolve from `dir/`.
    const dir = name.replace(/_rels\/[^/]+$/, '');
    const source = `${dir}${name
      .split('/')
      .at(-1)
      ?.replace(/\.rels$/, '')}`;
    const ids = new Set<string>();
    for (const match of text(name).matchAll(
      /<Relationship Id="([^"]+)" Type="[^"]+" Target="([^"]+)"\/>/g
    )) {
      const [, id, target] = match as unknown as [string, string, string];
      if (ids.has(id)) problems.push(`${name}: duplicate ${id}`);
      ids.add(id);
      const segments: string[] = [];
      for (const segment of `${dir}${target}`.split('/')) {
        if (segment === '..') segments.pop();
        else if (segment && segment !== '.') segments.push(segment);
      }
      if (!zip.has(segments.join('/'))) problems.push(`${name}: ${id} → ${target} is missing`);
    }
    if (name !== '_rels/.rels' && zip.has(source)) {
      for (const match of text(source).matchAll(/r:(?:id|embed)="([^"]+)"/g)) {
        if (!ids.has(match[1] as string))
          problems.push(`${source}: ${match[1]} has no relationship`);
      }
    }
  }
  return problems;
}

function deckFrom(input: unknown): Deck {
  const parsed = parseDeck(input);
  if (!parsed.ok || !parsed.deck) {
    throw new Error(parsed.issues.map((issue) => `${issue.jsonPath}: ${issue.message}`).join('\n'));
  }
  return parsed.deck;
}

const THEME = {
  kind: 'embedded',
  theme: {
    id: 'harbor',
    name: 'Harbor',
    fontFamily: '"Example Serif", Georgia, serif',
    fontFamilyHeading: 'system-ui, "Example Sans", sans-serif',
    light: {
      primary: '#2456a6',
      background: '#ffffff',
      foreground: { default: '#1f2328' },
      surface: '#f2f4f7',
    },
    dark: { primary: '#8ab4f8', background: '#0b0d10', foreground: '#f5f7fa' },
  },
} as const;

function harborDeck(aspect: '16:9' | '4:3' | '9:16' | '1:1' = '16:9'): Deck {
  return deckFrom({
    formatVersion: 2,
    meta: { title: 'Harborline plan', locale: 'en-GB' },
    style: { aspect, theme: THEME },
    slides: [
      {
        id: 'cover',
        layout: 'title-hero',
        notes: 'Start here.\nThen pause.',
        steps: ['Reveal title'],
        props: { title: 'A calm release', subtitle: 'A fictional example', step: 1 },
      },
      {
        id: 'comparison',
        layout: 'comparison-table',
        props: {
          title: 'Options',
          columns: ['Weekly', 'Daily'],
          rows: [
            { label: 'Lead time', values: ['Five days', 'Same day'] },
            { label: 'Rollback', values: [false, true] },
            { label: 'Best for', values: ['Large batches', null] },
          ],
        },
      },
      {
        id: 'picture',
        layout: 'image-left',
        background: 'gradient-brand',
        props: {
          title: 'The harbor',
          image: {
            src: 'https://example.com/harbor.png',
            alt: 'A quiet harbor',
            width: 640,
            height: 480,
          },
          body: 'Boats return at dusk.',
        },
      },
      {
        id: 'trend',
        layout: 'chart',
        props: {
          title: 'Trend',
          spec: { kind: 'bar', title: 'Release count', description: 'Releases per month' },
        },
      },
      { id: 'hidden', layout: 'section-divider', hidden: true, props: { title: 'Hidden part' } },
    ],
  });
}

describe('v2 print plan', () => {
  it('prints visible slides at the canvas size, with notes and the engine route flags', () => {
    const deck = harborDeck();
    const plan = planDeckPrint(deck, { notes: 'appendix' });
    expect(plan.pages.map((page) => `${page.kind}:${page.slideId}`)).toEqual([
      'slide:cover',
      'slide:comparison',
      'slide:picture',
      'slide:trend',
      'notes:cover',
      'notes:comparison',
      'notes:picture',
      'notes:trend',
    ]);
    expect(plan.pages[0]).toEqual({
      kind: 'slide',
      index: 0,
      slideId: 'cover',
      label: 'A calm release',
    });
    expect(plan.pages[4]).toMatchObject({ kind: 'notes', notes: 'Start here.\nThen pause.' });
    expect(
      planDeckPrint(deck, { notes: 'handout' }).pages.every((page) => page.kind === 'notes')
    ).toBe(true);
    expect(planDeckPrint(deck).pages).toHaveLength(4);
    expect(plan.filename).toBe('Harborline plan.pdf');

    for (const aspect of ['16:9', '4:3', '9:16', '1:1'] as const) {
      const size = planDeckPrint(harborDeck(aspect)).pageSize;
      const canvas = DECK_CANVAS[aspect];
      expect(size).toEqual(DECK_PRINT_CANVAS_PAGE_SIZES[aspect]);
      expect(size).toMatchObject({
        aspect,
        inlineSize: `${canvas.width}px`,
        blockSize: `${canvas.height}px`,
      });
      expect(DECK_EXPORT_CANVAS[aspect]).toEqual(canvas);
      expect(PPTX_CANVAS_SLIDE_SIZES[aspect]).toEqual({
        cx: canvas.width * 9525,
        cy: canvas.height * 9525,
      });
    }

    for (const search of [
      '?print=1&notes=1',
      '?print=1',
      'notes=1',
      '?print=yes&notes=true',
      '',
      '?print=0',
    ]) {
      const route = parseDeckRoute('', search).flags;
      expect(parseDeckPrintFlags(search)).toEqual({
        print: route.print,
        notes: route.notes ? 'appendix' : 'none',
      });
    }
    expect(parseDeckPrintFlags(deckPrintSearch({ notes: true }))).toEqual({
      print: true,
      notes: 'appendix',
    });
    expect(parseDeckPrintFlags(deckPrintSearch())).toEqual({ print: true, notes: 'none' });
    expect(() => planDeckPrint(deck, { notes: 'all' as never })).toThrow(TypeError);
  });

  it('labels each layout from its own title prop, narrowed by layout', () => {
    const labels = DECK_CATALOG_LAYOUT_IDS.map((id) => {
      const slide = {
        id: 's',
        layout: id,
        props: DECK_LAYOUTS[id].sample,
      } as Deck['slides'][number];
      return [id, deckSlideLabel(slide)];
    });
    for (const [id, label] of labels) {
      const sample = DECK_LAYOUTS[id as (typeof DECK_CATALOG_LAYOUT_IDS)[number]].sample as {
        title?: string;
      };
      expect(label, String(id)).toBe(
        ['image-full-bleed', 'quote', 'big-stat'].includes(String(id)) ? undefined : sample.title
      );
    }
    expect(deckSlideLabel({ id: 'f', layout: 'free', title: 'Free', blocks: [] })).toBe('Free');
    expect(deckSlideLabel({ id: 'f', layout: 'free', blocks: [] })).toBeUndefined();
  });
});

describe('v2 PPTX structure', () => {
  const picture = png(64, 48, [36, 86, 166]);
  const snapshot = png(320, 180, [20, 120, 60]);

  async function written() {
    const loadImage = vi.fn(async () => ({ bytes: picture, mimeType: 'image/png' as const }));
    const snapshotChart = vi.fn(() => ({ bytes: snapshot, mimeType: 'image/png' as const }));
    const result = await writeDeckPptx(harborDeck(), { loadImage, snapshotChart });
    return { result, loadImage, snapshotChart, zip: readZip(result.bytes) };
  }

  it('writes a complete package: content types, relationships, presentation, master and 21 layouts', async () => {
    const { result, zip } = await written();
    expect(result.filename).toBe('Harborline plan.pptx');
    const names = [...zip.keys()];
    expect(names[0]).toBe('[Content_Types].xml');
    for (const required of [
      '_rels/.rels',
      'docProps/core.xml',
      'docProps/app.xml',
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      'ppt/presProps.xml',
      'ppt/viewProps.xml',
      'ppt/tableStyles.xml',
      'ppt/theme/theme1.xml',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/notesMasters/notesMaster1.xml',
    ]) {
      expect(names, required).toContain(required);
    }
    const xml = (name: string) => {
      const doc = new DOMParser().parseFromString(
        new TextDecoder().decode(zip.get(name)),
        'application/xml'
      );
      expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0);
      return doc;
    };
    for (const name of names) if (name.endsWith('.xml') || name.endsWith('.rels')) xml(name);

    // Every part has a content type (Override, or Default by extension) and nothing extra is declared.
    const types = xml('[Content_Types].xml');
    const overrides = new Map(
      [...types.getElementsByTagName('Override')].map((node) => [
        node.getAttribute('PartName'),
        node.getAttribute('ContentType'),
      ])
    );
    const defaults = new Map(
      [...types.getElementsByTagName('Default')].map((node) => [
        node.getAttribute('Extension'),
        node.getAttribute('ContentType'),
      ])
    );
    expect(defaults.get('png')).toBe('image/png');
    for (const name of names) {
      if (name === '[Content_Types].xml') continue;
      const declared = overrides.get(`/${name}`) ?? defaults.get(name.split('.').at(-1) ?? '');
      expect(declared, name).toBeTruthy();
    }
    for (const part of overrides.keys()) expect(names).toContain(part?.slice(1));
    expect(overrides.get('/ppt/presentation.xml')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
    );
    expect(relationshipsResolve(zip)).toEqual([]);

    // Presentation: every slide in order (the hidden one flagged, not dropped), canvas size.
    const presentation = xml('ppt/presentation.xml');
    expect(presentation.getElementsByTagName('p:sldId')).toHaveLength(5);
    expect(presentation.getElementsByTagName('p:sldSz')[0]?.getAttribute('cx')).toBe('12192000');
    expect(presentation.getElementsByTagName('p:sldSz')[0]?.getAttribute('cy')).toBe('6858000');
    expect(xml('ppt/slides/slide5.xml').documentElement.getAttribute('show')).toBe('0');
    expect(xml('ppt/slides/slide1.xml').documentElement.getAttribute('show')).toBeNull();

    // One layout per deck layout, each named, listed by the master, with a title placeholder.
    const master = xml('ppt/slideMasters/slideMaster1.xml');
    expect(master.getElementsByTagName('p:sldLayoutId')).toHaveLength(DECK_LAYOUT_IDS.length);
    expect(master.getElementsByTagName('p:txStyles')).toHaveLength(1);
    DECK_LAYOUT_IDS.forEach((id, index) => {
      const layout = xml(`ppt/slideLayouts/slideLayout${index + 1}.xml`);
      expect(layout.getElementsByTagName('p:cSld')[0]?.getAttribute('name')).toBe(
        DECK_LAYOUTS[id].label
      );
      const types = [...layout.getElementsByTagName('p:ph')].map((node) =>
        node.getAttribute('type')
      );
      expect(
        types.some((type) => type === 'title' || type === 'ctrTitle'),
        id
      ).toBe(true);
    });
    const layoutOf = (slide: number) =>
      new TextDecoder()
        .decode(zip.get(`ppt/slides/_rels/slide${slide}.xml.rels`))
        .match(/slideLayout(\d+)\.xml/)?.[1];
    expect(layoutOf(1)).toBe(String(DECK_LAYOUT_IDS.indexOf('title-hero') + 1));
    expect(layoutOf(2)).toBe(String(DECK_LAYOUT_IDS.indexOf('comparison-table') + 1));
    expect(layoutOf(4)).toBe(String(DECK_LAYOUT_IDS.indexOf('chart') + 1));

    // Outline view: each slide's title is in its title placeholder.
    const titleOf = (slide: number) => {
      const doc = xml(`ppt/slides/slide${slide}.xml`);
      const ph = [...doc.getElementsByTagName('p:ph')].find((node) =>
        ['title', 'ctrTitle'].includes(node.getAttribute('type') ?? '')
      );
      let shape: Element | null | undefined = ph;
      while (shape && shape.tagName !== 'p:sp') shape = shape.parentElement;
      return shape?.getElementsByTagName('a:t')[0]?.textContent;
    };
    expect([1, 2, 3, 4, 5].map(titleOf)).toEqual([
      'A calm release',
      'Options',
      'The harbor',
      'Trend',
      'Hidden part',
    ]);
  });

  it('writes native tables, pictures from host bytes, chart snapshots, theme, backgrounds and notes', async () => {
    const { result, zip, loadImage, snapshotChart } = await written();
    const decode = (name: string) => new TextDecoder().decode(zip.get(name));
    expect(loadImage).toHaveBeenCalledWith('https://example.com/harbor.png', {
      slideId: 'picture',
      path: '$.props.image.src',
      kind: 'image',
    });
    expect(snapshotChart).toHaveBeenCalledWith(
      { kind: 'bar', title: 'Release count', description: 'Releases per month', type: 'chart' },
      expect.objectContaining({ slideId: 'trend', path: '$.props.spec' })
    );
    expect(result.omitted).toEqual([]);

    const table = new DOMParser().parseFromString(
      decode('ppt/slides/slide2.xml'),
      'application/xml'
    );
    const grid = table.getElementsByTagName('a:tbl')[0];
    expect(grid).toBeDefined();
    expect(grid?.getElementsByTagName('a:gridCol')).toHaveLength(3);
    const rows = [...(grid?.getElementsByTagName('a:tr') ?? [])].map((row) =>
      [...row.getElementsByTagName('a:tc')].map((cell) => cell.textContent)
    );
    expect(rows).toEqual([
      ['', 'Weekly', 'Daily'],
      ['Lead time', 'Five days', 'Same day'],
      ['Rollback', '—', '✓'],
      ['Best for', 'Large batches', ''],
    ]);
    expect(
      table.getElementsByTagName('p:graphicFrame')[0]?.getElementsByTagName('p:nvPr')
    ).toHaveLength(1);

    // The picture: an embedded part with the exact bytes, linked through the slide relationships.
    const pictureSlide = decode('ppt/slides/slide3.xml');
    expect(pictureSlide).toMatch(/<p:pic>.*descr="A quiet harbor".*r:embed="rId2"/s);
    expect(pictureSlide).toContain('<p:ph type="pic" idx="10"/>');
    expect(decode('ppt/slides/_rels/slide3.xml.rels')).toContain('Target="../media/image1.png"');
    expect([...(zip.get('ppt/media/image1.png') ?? [])]).toEqual([...picture]);
    expect(crc32(zip.get('ppt/media/image2.png') ?? new Uint8Array())).toBe(crc32(snapshot));
    expect(decode('ppt/slides/slide4.xml')).toContain('descr="Releases per month"');
    expect(pictureSlide).not.toContain('example.com');

    // Theme colors and fonts from the embedded theme (first concrete family, no generics).
    const theme = decode('ppt/theme/theme1.xml');
    expect(theme).toContain('<a:accent1><a:srgbClr val="2456A6"/></a:accent1>');
    expect(theme).toContain('<a:dk1><a:srgbClr val="1F2328"/></a:dk1>');
    expect(theme).toContain('<a:majorFont><a:latin typeface="Example Sans"/>');
    expect(theme).toContain('<a:minorFont><a:latin typeface="Example Serif"/>');

    // Backgrounds: a solid default and the gradient preset, both computed from the palette.
    expect(decode('ppt/slides/slide1.xml')).toContain(
      '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/>'
    );
    expect(pictureSlide).toMatch(
      /<p:bg><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0">/
    );

    // Notes: one notes slide per noted slide, both ways related, lines kept.
    const notes = decode('ppt/notesSlides/notesSlide1.xml');
    expect(notes).toContain('<p:ph type="sldImg"/>');
    expect(notes).toContain('<a:t>Start here.</a:t>');
    expect(notes).toContain('<a:t>Then pause.</a:t>');
    expect(decode('ppt/slides/_rels/slide1.xml.rels')).toContain('notesSlide1.xml');
    expect(zip.has('ppt/notesSlides/notesSlide2.xml')).toBe(false);
    expect(decode('ppt/slides/slide1.xml')).toContain('lang="en-GB"');
  });

  it('reports what it cannot map, with the slide id, path and reason, also on the notes page', async () => {
    const pkg = await buildDeckPptx(harborDeck(), {});
    expect(pkg.omitted).toEqual<DeckPptxV2Omission[]>([
      {
        slideId: 'picture',
        kind: 'image',
        path: '$.props.image.src',
        reason: 'Images need the host loadImage callback.',
      },
      {
        slideId: 'trend',
        kind: 'chart',
        path: '$.props.spec',
        reason:
          'Charts export as pictures through the host snapshotChart callback, which was not provided.',
      },
    ]);
    const notes =
      pkg.parts.find((part) => part.path === 'ppt/notesSlides/notesSlide4.xml')?.xml ?? '';
    expect(notes).toContain('Not in this PPTX export:');
    expect(notes).toContain('($.props.spec)');
    // The chart's title and description stay on the slide when no snapshot exists.
    expect(pkg.parts.find((part) => part.path === 'ppt/slides/slide4.xml')?.xml).toContain(
      'Releases per month'
    );

    const quiet = await buildDeckPptx(harborDeck(), { notes: false, hidden: 'skip' });
    expect(quiet.parts.some((part) => part.path.includes('notes'))).toBe(false);
    expect(
      quiet.parts.find((part) => part.path === 'ppt/presentation.xml')?.xml.match(/<p:sldId /g)
    ).toHaveLength(4);
    expect(quiet.omitted).toHaveLength(2);
  });

  it('is deterministic: the same deck and host answers give the same bytes', async () => {
    const options = {
      loadImage: async () => ({ bytes: png(8, 8, [1, 2, 3]), mimeType: 'image/png' as const }),
      snapshotChart: () => ({ bytes: png(8, 8, [4, 5, 6]), mimeType: 'image/png' as const }),
    };
    const first = await writeDeckPptx(harborDeck(), options);
    const second = await writeDeckPptx(harborDeck(), options);
    expect(first.bytes.length).toBeGreaterThan(10_000);
    expect(crc32(first.bytes)).toBe(crc32(second.bytes));
    expect([...first.bytes]).toEqual([...second.bytes]);
    const exported = await exportDeckPptx(harborDeck(), options);
    expect(exported.blob.type).toBe(PPTX_MIME_TYPE);
    expect(new Uint8Array(await exported.blob.arrayBuffer())).toEqual(first.bytes);
    expect(await loadDeckPptxWriter()).toBe(await loadDeckPptxWriter());
  });
});

describe('v2 PPTX hostile input and coverage', () => {
  it('escapes XML injection, drops control characters and survives huge text', async () => {
    const hostile = '</a:t><script>alert(1)</script>&amp;"\'<!--';
    const deck = deckFrom({
      formatVersion: 2,
      meta: { title: hostile },
      slides: [
        {
          id: 'a',
          layout: 'two-column-split',
          title: hostile,
          notes: `${'n'.repeat(5_990)}`,
          props: { left: { body: hostile }, right: { heading: hostile, body: 'x'.repeat(600) } },
        },
        {
          id: 'b',
          layout: 'code-with-callout',
          props: {
            code: { lang: 'ts', source: `${'const a = 1;\n'.repeat(600)}` },
            bullets: [hostile],
          },
        },
      ],
    });
    // Control characters cannot pass the model; a hand-built deck still must not break the XML.
    const tampered = structuredClone(deck);
    (tampered.slides[0] as { notes?: string }).notes = 'bell\u0007 nul\u0000 esc\u001b ok￿';
    const pkg = await buildDeckPptx(tampered, {});
    const all = pkg.parts.map((part) => part.xml).join('\n');
    expect(all).not.toContain('<script>');
    expect(all).toContain('&lt;/a:t&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;amp;');
    const forbidden = new Set([0x00, 0x07, 0x1b, 0xffff]);
    expect([...all].filter((character) => forbidden.has(character.codePointAt(0) ?? -1))).toEqual(
      []
    );
    for (const part of pkg.parts) {
      const doc = new DOMParser().parseFromString(part.xml, 'application/xml');
      expect(doc.getElementsByTagName('parsererror'), part.path).toHaveLength(0);
    }
    expect(
      pkg.parts.find((part) => part.path === 'ppt/slides/slide2.xml')?.xml.match(/const a = 1;/g)
    ).toHaveLength(600);
    expect(pkg.filename).not.toMatch(/[<>/\\:"]/);
  });

  it('checks host bytes: wrong type, empty, oversized or failing callbacks are omitted, never embedded', async () => {
    const deck = deckFrom({
      formatVersion: 2,
      meta: { title: 'Media checks' },
      slides: ['one', 'two', 'three', 'four', 'five'].map((id) => ({
        id,
        layout: 'image-centered',
        props: { title: id, image: { src: `https://example.com/${id}.png`, alt: id } },
      })),
    });
    const answers: Record<string, () => unknown> = {
      one: () => ({ bytes: new Uint8Array([0x3c, 0x73, 0x76, 0x67]), mimeType: 'image/png' }),
      two: () => ({ bytes: new Uint8Array(), mimeType: 'image/png' }),
      three: () => ({ bytes: png(4, 4, [0, 0, 0]), mimeType: 'image/svg+xml' }),
      four: () => {
        throw new Error('network down');
      },
      five: () => ({ bytes: png(4, 4, [9, 9, 9]), mimeType: 'image/png' }),
    };
    const pkg = await buildDeckPptx(deck, {
      loadImage: (src) => answers[src.slice(20, -4)]?.() as DeckPptxImageAsset,
    });
    expect(pkg.omitted.map((item) => [item.slideId, item.reason])).toEqual([
      ['one', 'The image bytes are not a valid image/png file.'],
      ['two', 'The host returned no image bytes.'],
      ['three', 'Only PNG, JPEG, GIF and BMP images can be embedded.'],
      ['four', 'The host image callback failed.'],
    ]);
    expect(pkg.media.map((entry) => entry.path)).toEqual(['ppt/media/image1.png']);
    expect(pkg.parts.map((part) => part.xml).join('')).not.toContain('network down');
  });

  it('reads intrinsic sizes and keeps pictures in proportion', async () => {
    expect(sniffImageSize(png(300, 100, [0, 0, 0]), 'image/png')).toEqual({
      width: 300,
      height: 100,
    });
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00]);
    expect(sniffImageSize(gif, 'image/gif')).toEqual({ width: 32, height: 16 });
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x48,
      0x00, 0x60, 0x03,
    ]);
    expect(sniffImageSize(jpeg, 'image/jpeg')).toEqual({ width: 96, height: 72 });
    const deck = deckFrom({
      formatVersion: 2,
      meta: { title: 'Fit' },
      slides: [
        {
          id: 'contain',
          layout: 'image-centered',
          props: { image: { src: 'a.png', alt: 'wide' } },
        },
        {
          id: 'cover',
          layout: 'image-full-bleed',
          props: { image: { src: 'a.png', alt: 'wide' }, caption: 'Dusk' },
        },
      ],
    });
    const pkg = await buildDeckPptx(deck, {
      loadImage: () => ({ bytes: png(400, 100, [1, 1, 1]), mimeType: 'image/png' }),
    });
    expect(pkg.media).toHaveLength(1);
    const contain = pkg.parts.find((part) => part.path === 'ppt/slides/slide1.xml')?.xml ?? '';
    const ext = /<p:pic>.*?<a:ext cx="(\d+)" cy="(\d+)"/s.exec(contain);
    expect(Number(ext?.[1]) / Number(ext?.[2])).toBeCloseTo(4, 2);
    expect(pkg.parts.find((part) => part.path === 'ppt/slides/slide2.xml')?.xml).toMatch(
      /<a:srcRect l="27778" t="0" r="27778" b="0"\/>/
    );
  });

  it('exports every layout, free blocks, components and custom slides on every aspect', async () => {
    const slides = [
      ...DECK_CATALOG_LAYOUT_IDS.map((id) => ({
        id: `l-${id}`,
        layout: id,
        notes: `${id} notes`,
        props: DECK_LAYOUTS[id].sample,
      })),
      {
        id: 'free',
        layout: 'free',
        title: 'Free blocks',
        blocks: [
          { type: 'heading', level: 2, text: 'Heading' },
          { type: 'text', markdown: 'Some **bold** text', step: 1 },
          { type: 'list', items: [{ text: 'One' }, { text: 'Two' }] },
          {
            type: 'table',
            columns: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            rows: [{ a: 'x', b: 2 }],
          },
          {
            type: 'image',
            src: 'https://example.com/i.png',
            alt: 'An image',
            width: 10,
            height: 10,
          },
          { type: 'chart', kind: 'line', title: 'Line', description: 'A line', series: [] },
          { type: 'component', component: 'data-table', props: {} },
          { type: 'code', code: 'let x = 1;' },
          { type: 'quote', quote: 'Q', cite: 'C' },
          { type: 'columns', columns: [{ blocks: [{ type: 'text', markdown: 'In a column' }] }] },
        ],
      },
      {
        id: 'component',
        layout: 'component',
        title: 'A component',
        component: { component: 'data-table', props: {} },
      },
      { id: 'custom', layout: 'custom', title: 'Custom', props: { component: 'host-thing' } },
      {
        id: 'pattern',
        layout: 'free',
        background: 'pattern-grid',
        blocks: [{ type: 'text', markdown: 'Grid' }],
      },
    ];
    for (const aspect of ['16:9', '4:3', '9:16', '1:1'] as const) {
      const deck = deckFrom({
        formatVersion: 2,
        meta: { title: `All ${aspect}` },
        style: { aspect },
        slides,
      });
      const written = await writeDeckPptx(deck, {
        loadImage: () => ({ bytes: png(16, 9, [200, 100, 50]), mimeType: 'image/png' }),
        snapshotChart: () => ({ bytes: png(16, 9, [50, 100, 200]), mimeType: 'image/png' }),
      });
      const zip = readZip(written.bytes);
      expect(relationshipsResolve(zip), aspect).toEqual([]);
      for (const [name, data] of zip) {
        if (!name.endsWith('.xml')) continue;
        const doc = new DOMParser().parseFromString(
          new TextDecoder().decode(data),
          'application/xml'
        );
        expect(doc.getElementsByTagName('parsererror'), `${aspect} ${name}`).toHaveLength(0);
      }
      const size = new TextDecoder()
        .decode(zip.get('ppt/presentation.xml'))
        .match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
      expect([Number(size?.[1]), Number(size?.[2])]).toEqual([
        PPTX_CANVAS_SLIDE_SIZES[aspect].cx,
        PPTX_CANVAS_SLIDE_SIZES[aspect].cy,
      ]);
      expect(
        [...zip.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      ).toHaveLength(slides.length);
      // Only the interactive, host-painted, video and link content is reported.
      expect(new Set(written.omitted.map((item) => item.kind))).toEqual(
        new Set(['component', 'custom', 'video', 'link'])
      );
      // Every shape stays on the slide.
      const { cx, cy } = PPTX_CANVAS_SLIDE_SIZES[aspect];
      for (const [name, data] of zip) {
        if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
        for (const match of new TextDecoder()
          .decode(data)
          .matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
          const [x, y, w, h] = match.slice(1).map(Number) as [number, number, number, number];
          expect(x + w, `${aspect} ${name}`).toBeLessThanOrEqual(cx + 1);
          expect(y + h, `${aspect} ${name}`).toBeLessThanOrEqual(cy + 1);
        }
      }
    }
  });
});

/**
 * The starter decks of `@texuli/deck` export cleanly. With
 * `TEXULI_PPTX_OUT=<dir>` this also writes them for the manual open check
 * (`.dwp/plans/PLAN_008_slides_complete_library/analysis_results/pptx-manual.md`):
 * `<deck>.pptx` with placeholder rasters for every image and chart, and
 * `<deck>.text-only.pptx` without host callbacks (what the website button
 * writes), each with its omissions as `<file>.omitted.json`.
 */
describe('v2 PPTX starter decks', () => {
  // Vitest runs from the repository root (happy-dom gives this module an http: URL).
  const decksDir = `${resolve(process.cwd(), 'packages/deck/decks')}/`;
  const names = readdirSync(decksDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  it('exports every starter deck with resolvable parts, and writes them on request', async () => {
    expect(names).toContain('texuli-create-anything.json');
    expect(names).toContain('everything.json');
    const out = process.env.TEXULI_PPTX_OUT;
    if (out) mkdirSync(out, { recursive: true });
    for (const name of names) {
      const deck = deckFrom(JSON.parse(readFileSync(`${decksDir}${name}`, 'utf8')));
      const placeholder = (width: number, height: number, color: [number, number, number]) => ({
        bytes: png(Math.max(1, Math.min(width, 640)), Math.max(1, Math.min(height, 640)), color),
        mimeType: 'image/png' as const,
      });
      const full = await writeDeckPptx(deck, {
        loadImage: (_src, context) =>
          placeholder(
            context.kind === 'avatar' ? 96 : 640,
            context.kind === 'avatar' ? 96 : 480,
            [96, 128, 176]
          ),
        snapshotChart: (_chart, context) =>
          placeholder(context.width, context.height, [40, 120, 90]),
      });
      const textOnly = await writeDeckPptx(deck);
      for (const [suffix, written] of [
        ['', full],
        ['.text-only', textOnly],
      ] as const) {
        const zip = readZip(written.bytes);
        expect(relationshipsResolve(zip), name).toEqual([]);
        for (const [part, data] of zip) {
          if (!part.endsWith('.xml') && !part.endsWith('.rels')) continue;
          const doc = new DOMParser().parseFromString(
            new TextDecoder().decode(data),
            'application/xml'
          );
          expect(doc.getElementsByTagName('parsererror'), `${name} ${part}`).toHaveLength(0);
        }
        if (out) {
          const base = `${out}/${name.replace(/\.json$/, '')}${suffix}`;
          writeFileSync(`${base}.pptx`, written.bytes);
          writeFileSync(`${base}.omitted.json`, `${JSON.stringify(written.omitted, null, 2)}\n`);
        }
      }
      // With host callbacks only interactive, video and link content is left out.
      expect(
        full.omitted.every((item) => ['component', 'custom', 'video', 'link'].includes(item.kind)),
        name
      ).toBe(true);
    }
  });
});

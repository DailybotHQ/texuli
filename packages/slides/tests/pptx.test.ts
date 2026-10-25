// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  buildDeckPptx,
  crc32,
  el,
  escapeXmlAttribute,
  escapeXmlText,
  exportDeckPptx,
  PPTX_MIME_TYPE,
  sanitizeXmlChars,
  serializeXml,
  writeDeckPptx,
  writeZip,
  type XmlElement,
} from '../src/export/index.ts';
import { parseDeck } from '../src/model/index.ts';

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
          { type: 'image', src: 'assets/chart.png', alt: 'A chart photo', width: 640, height: 360 },
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

describe('XML writer', () => {
  it('escapes text and attributes and strips characters XML cannot carry', () => {
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
  });

  it('rejects unsafe element and attribute names, even on hand-built nodes', () => {
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
  });
});

describe('ZIP writer', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes stored entries that read back byte for byte, deterministically', () => {
    const entries = [
      { path: 'a.txt', data: 'hello' },
      { path: 'dir/ünïcode.xml', data: new Uint8Array([1, 2, 3]) },
    ];
    const bytes = writeZip(entries);
    expect([...bytes]).toEqual([...writeZip(entries)]);
    const read = readZip(bytes);
    expect(new TextDecoder().decode(read.get('a.txt'))).toBe('hello');
    expect([...(read.get('dir/ünïcode.xml') ?? [])]).toEqual([1, 2, 3]);
  });

  it('refuses unsafe or duplicate entry paths', () => {
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
});

describe('PPTX export', () => {
  it('builds well-formed parts whose content types and relationships all resolve', () => {
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
  });

  it('writes slide text, titles and notes as escaped text and reports omitted blocks', () => {
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
  });

  it('sizes slides from the aspect and can leave notes out', () => {
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

  it('zips a deterministic package and exposes it as a PPTX blob', async () => {
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

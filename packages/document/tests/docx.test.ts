// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DOCX_MIME, probeImage, writeDocx } from '../src/docx/index.ts';
import { createDocument, paragraphBlock } from '../src/model/index.ts';
import type { DocumentBlock, TexuliDocument } from '../src/model/types.ts';
import { everyBlock } from './fixtures.ts';
import { makeJpeg, makePng, readZip, xmlProblem } from './output-helpers.ts';

const decoder = new TextDecoder();

async function unpack(doc: TexuliDocument, options: Parameters<typeof writeDocx>[1] = {}) {
  const result = await writeDocx(doc, options);
  const entries = readZip(result.bytes);
  const files = new Map(entries.map((entry) => [entry.path, entry.data]));
  const text = (path: string) => {
    const data = files.get(path);
    if (!data) throw new Error(`missing ${path}`);
    return decoder.decode(data);
  };
  return { result, entries, files, text };
}

/** Every XML part is well-formed, every content type and relationship target exists. */
function checkPackage(files: Map<string, Uint8Array>) {
  for (const [path, data] of files) {
    if (path.endsWith('.xml') || path.endsWith('.rels')) {
      expect(xmlProblem(decoder.decode(data)), path).toBeNull();
    }
  }
  const types = decoder.decode(files.get('[Content_Types].xml'));
  for (const match of types.matchAll(/PartName="\/([^"]+)"/g)) {
    expect(files.has(match[1] as string), match[1]).toBe(true);
  }
  for (const path of files.keys()) {
    if (!path.endsWith('.xml') || path === '[Content_Types].xml') continue;
    expect(types.includes(`PartName="/${path}"`), `content type of ${path}`).toBe(true);
  }
  for (const [relsPath, base] of [
    ['_rels/.rels', ''],
    ['word/_rels/document.xml.rels', 'word/'],
  ] as const) {
    const rels = decoder.decode(files.get(relsPath));
    for (const match of rels.matchAll(/<Relationship ([^>]*)\/>/g)) {
      const attrs = match[1] as string;
      const target = /Target="([^"]*)"/.exec(attrs)?.[1] as string;
      if (/TargetMode="External"/.test(attrs)) {
        expect(target, 'external targets are https or mailto').toMatch(/^(https:\/\/|mailto:)/);
      } else expect(files.has(`${base}${target}`), `${relsPath} → ${target}`).toBe(true);
    }
  }
}

describe('docx: package structure', () => {
  it('writes a well-formed package with content types, relationships and every part', async () => {
    const { result, files, text } = await unpack(everyBlock());
    expect(DOCX_MIME).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect([...files.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'docProps/core.xml',
        'word/document.xml',
        'word/styles.xml',
        'word/numbering.xml',
        'word/_rels/document.xml.rels',
        'word/footer1.xml',
      ])
    );
    checkPackage(files);
    const body = text('word/document.xml');
    // Headings, marks, a hyperlink through an external relationship.
    expect(body).toContain('<w:pStyle w:val="Heading1"/>');
    expect(body).toMatch(/<w:hyperlink r:id="rId\d+" w:history="1">.*guide/);
    expect(text('word/_rels/document.xml.rels')).toContain(
      'Target="https://example.com/guide" TargetMode="External"'
    );
    expect(body).toMatch(/<w:b\/><w:i\/>.*ship/);
    // Lists through numbering, todo marks, quote indent, callout shading, code style.
    expect(body).toContain('<w:numId w:val="1"/>');
    expect(body).toContain('☑ ');
    expect(body).toContain('<w:shd w:val="clear" w:color="auto" w:fill="E8F1FD"/>');
    expect(body).toContain('<w:pStyle w:val="Code"/>');
    expect(body).toContain('const x = 1;</w:t><w:br/>');
    // Page size and margins in twips (A4, 20 mm top, 18 mm sides).
    expect(body).toMatch(/<w:pgSz w:w="11906" w:h="16838"\/>/);
    expect(body).toMatch(/<w:pgMar w:top="1134" w:right="1020" w:bottom="1134" w:left="1020"/);
    // Footer page numbers are fields Word fills in.
    expect(text('word/footer1.xml')).toContain('w:instr=" PAGE "');
    expect(text('word/footer1.xml')).toContain('w:instr=" NUMPAGES "');
    // Annotations are dropped; embeds and blocks fall back to text with diagnostics.
    expect(body).not.toContain('Shorter?');
    expect(body).toContain('[Sheet: Budget]');
    expect(body).toContain('Uptime · 99.9%');
    expect(result.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['image-unresolved', 'block-as-text', 'embed-as-text'])
    );
    expect(text('docProps/core.xml')).toContain('<dc:title>Field notes</dc:title>');
  });

  it('round-trips through unzip byte for byte, deterministically, compressed or stored', async () => {
    const doc = everyBlock();
    const a = await writeDocx(doc);
    const b = await writeDocx(doc);
    expect(a.bytes).toEqual(b.bytes);
    const stored = await writeDocx(doc, { compress: false });
    expect(stored.bytes.length).toBeGreaterThan(a.bytes.length * 2);
    const left = readZip(a.bytes);
    const right = readZip(stored.bytes);
    expect(left.map((e) => [e.path, decoder.decode(e.data)])).toEqual(
      right.map((e) => [e.path, decoder.decode(e.data)])
    );
    expect(left.some((entry) => entry.method === 8)).toBe(true);
    expect(right.every((entry) => entry.method === 0)).toBe(true);
  });

  it('writes tables, columns, page breaks, headers, landscape pages and images', async () => {
    const png = makePng(400, 200, 3);
    const jpeg = makeJpeg(1600, 900);
    const blocks: DocumentBlock[] = [
      paragraphBlock('intro', 'Intro'),
      {
        id: 'tbl',
        type: 'block',
        family: 'data',
        block: 'table',
        props: {
          caption: 'Fictional scores',
          columns: [
            { id: 'team', label: 'Team' },
            { id: 'score', label: 'Score' },
          ],
          rows: [
            { team: 'Design', score: 92 },
            { team: 'Build', score: null },
          ],
        },
      },
      {
        id: 'cols',
        type: 'columns',
        columns: [
          { id: 'c1', type: 'column', width: 8, blocks: [paragraphBlock('c1p', 'Left')] },
          { id: 'c2', type: 'column', width: 4, blocks: [paragraphBlock('c2p', 'Right')] },
        ],
      },
      { id: 'img', type: 'media', ref: 'https://example.com/chart.png', alt: 'A "chart" <alt>' },
      { id: 'photo', type: 'media', ref: 'https://example.com/photo.jpg', alt: 'Photo' },
      { id: 'gone', type: 'media', ref: 'https://example.com/missing.png', alt: 'Missing' },
      paragraphBlock('after', 'After the break'),
    ];
    const doc = createDocument({ meta: { title: 'Layout', dir: 'rtl' }, blocks });
    doc.page = {
      size: 'letter',
      orientation: 'landscape',
      header: { start: '{title}', end: 'Page {page} of {pages}' },
      footer: { center: 'Confidential' },
      breaks: ['after'],
    };
    const images: Record<string, Uint8Array> = {
      'https://example.com/chart.png': png,
      'https://example.com/photo.jpg': jpeg,
    };
    const { files, text, result } = await unpack(doc, {
      resolveImage: (ref) => images[ref] ?? null,
    });
    checkPackage(files);
    const body = text('word/document.xml');
    expect(body).toContain('<w:tblStyle w:val="TableGrid"/>');
    expect(body).toContain('<w:tblHeader/>');
    expect(body).toMatch(/Fictional scores/);
    expect(body).toMatch(/<w:gridCol w:w="\d+"\/><w:gridCol w:w="\d+"\/>/);
    expect(body).toContain('<w:pageBreakBefore/>');
    expect(body.indexOf('<w:pageBreakBefore/>')).toBeLessThan(body.indexOf('After the break'));
    expect(body).toContain('<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>');
    expect(body).toContain('<w:bidi/>');
    expect(text('word/header1.xml')).toContain('Layout');
    expect(text('word/header1.xml')).toContain('w:instr=" PAGE "');
    expect(text('word/footer1.xml')).toContain('Confidential');
    expect(files.get('word/media/image1.png')).toEqual(png);
    expect(files.get('word/media/image2.jpeg')).toEqual(jpeg);
    expect(body).toContain('descr="A &quot;chart&quot; &lt;alt&gt;"');
    // 400 px at 96 dpi = 300 pt = 3,810,000 EMU, under the content width.
    expect(body).toContain('<wp:extent cx="3810000" cy="1905000"/>');
    expect(body).toContain('[Image: Missing]');
    expect(result.diagnostics.filter((d) => d.id === 'gone').map((d) => d.code)).toEqual([
      'image-unresolved',
    ]);
    expect(probeImage(png)).toMatchObject({ format: 'png', width: 400, height: 200 });
    expect(probeImage(jpeg)).toMatchObject({
      format: 'jpeg',
      width: 1600,
      height: 900,
      components: 3,
    });
    expect(probeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xda]))).toBeNull();
  });
});

describe('docx: hostile input', () => {
  it('escapes hostile text, refuses hostile links and never resolves unsafe image refs', async () => {
    const hostile = '<w:p><script>alert(1)</script>]]>&amp; "\' \u0000\u0007￾';
    const doc = createDocument({
      meta: { title: hostile, authors: ['"><x'] },
      blocks: [
        {
          id: 'h',
          type: 'heading',
          level: 2,
          content: [{ type: 'text', text: hostile, marks: [] }],
        },
        {
          id: 'p',
          type: 'paragraph',
          content: [
            { type: 'text', text: 'click', marks: [{ type: 'link', href: 'javascript:alert(1)' }] },
            { type: 'text', text: 'relative', marks: [{ type: 'link', href: '/admin' }] },
            {
              type: 'text',
              text: 'ok',
              marks: [{ type: 'link', href: 'https://example.com/?q="<>' }],
            },
          ],
        },
        { id: 'c', type: 'code', text: hostile },
        { id: 'm', type: 'media', ref: 'javascript:alert(1)', alt: hostile },
        { id: 'pl', type: 'page-link', ref: 'pages/x', title: hostile },
      ],
    });
    doc.page = { size: 'a4', orientation: 'portrait', header: { center: hostile } };
    let resolved = 0;
    const { files, text, result } = await unpack(doc, {
      resolveImage: () => {
        resolved += 1;
        return makePng(1, 1, 3);
      },
      pageHref: () => 'javascript:alert(1)',
    });
    checkPackage(files);
    expect(resolved).toBe(0);
    const all = [...files.values()].map((data) => decoder.decode(data)).join('\n');
    expect(all).not.toContain('<script>');
    expect(all).not.toContain('javascript:');
    expect(all).not.toContain('/admin');
    expect(text('word/_rels/document.xml.rels')).toContain(
      'Target="https://example.com/?q=&quot;&lt;&gt;"'
    );
    // The script link, the relative link and the page link.
    expect(result.diagnostics.filter((d) => d.code === 'link-refused')).toHaveLength(3);
  });

  it('writes a document at the block cap in bounded time', async () => {
    const blocks = Array.from({ length: 2_000 }, (_, i) =>
      paragraphBlock(`p${i}`, `Paragraph ${i} `.repeat(8))
    );
    const doc = createDocument({ meta: { title: 'Large' }, blocks });
    const start = performance.now();
    const result = await writeDocx(doc, { compress: false });
    const elapsed = performance.now() - start;
    expect(result.bytes.length).toBeGreaterThan(300_000);
    expect(elapsed).toBeLessThan(3_000);
  });
});

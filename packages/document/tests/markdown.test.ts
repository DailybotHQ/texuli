// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { documentFromMarkdown, documentToMarkdown } from '../src/markdown/index.ts';
import { walkDocument } from '../src/model/index.ts';
import type { TexuliDocument } from '../src/model/types.ts';
import { validateDocument } from '../src/schema/index.ts';
import { everyBlock, time } from './fixtures.ts';

/** The document with ids removed, for comparing structure. */
function shape(doc: TexuliDocument): unknown {
  return JSON.parse(JSON.stringify(doc.blocks, (key, value) => (key === 'id' ? undefined : value)));
}

function read(source: string, trust?: 'developer' | 'untrusted'): TexuliDocument {
  const result = documentFromMarkdown(source, { trust });
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true);
  return (result as { document: TexuliDocument }).document;
}

const SAMPLES = [
  '# Launch plan\n\nShip the **new** editor with *care* and `code`.',
  'A [guide](https://example.com/guide) and ~~old~~ text.\\\nNext line.',
  '- one\n- two\n  - nested\n- three',
  '1. first\n2. second',
  '- [x] done\n- [ ] todo',
  '> quoted\n>\n> - in a list',
  '```ts\nconst x = 1;\n```',
  '---',
  '![A cover](https://example.com/cover.png)',
  '## Heading two\n\n### Three\n\n#### Four',
];

describe('markdown', () => {
  it('reads Markdown into valid documents with persisted ids, and round-trips through Markdown', () => {
    for (const source of SAMPLES) {
      const doc = read(source);
      expect(validateDocument(doc).ok, source).toBe(true);
      const ids: string[] = [];
      walkDocument(doc, ({ node }) => void ids.push(node.id));
      expect(new Set(ids).size, source).toBe(ids.length);
      // Markdown → document → Markdown → document is stable.
      const written = documentToMarkdown(doc);
      const again = read(written);
      expect(shape(again), source).toEqual(shape(doc));
      expect(documentToMarkdown(again), source).toBe(written);
    }
    expect(read('# Launch plan\n\nBody').meta.title).toBe('Launch plan');
  });

  it('writes core blocks losslessly and degrades document-only blocks', () => {
    const doc = everyBlock();
    const markdown = documentToMarkdown(doc, { title: true });
    expect(markdown.startsWith('# Field notes\n\n# Field notes')).toBe(true);
    expect(markdown).toContain('[guide](https://example.com/guide)');
    expect(markdown).toContain('> **Heads up**');
    expect(markdown).toContain('Details\n\nHidden text');
    expect(markdown).toContain('Roadmap');
    expect(markdown).toContain('Status');
    // A wrapped block with no Markdown spelling is written as its text (G112).
    expect(markdown).toContain('Uptime · 99.9%');
    expect(documentToMarkdown(doc, { embeds: 'drop' })).not.toContain('Roadmap');
    expect(documentToMarkdown(doc, { blocks: 'drop' })).not.toContain('Uptime');
    const core = everyBlock();
    core.blocks = core.blocks.filter((block) =>
      ['heading', 'paragraph', 'code', 'list', 'quote', 'divider', 'media'].includes(block.type)
    );
    core.annotations = undefined;
    expect(shape(read(documentToMarkdown(core)))).toEqual(shape(core));
  });

  it('writes wrapped data tables as GFM tables and other wrapped blocks as text (G112)', () => {
    const table = (props: Record<string, unknown>, id = 't'): TexuliDocument =>
      ({
        meta: { title: '' },
        blocks: [{ id, type: 'block', family: 'data', block: 'table', props }],
      }) as TexuliDocument;
    // The reported repro: it returned ''.
    expect(
      documentToMarkdown(
        table({ caption: 'C', columns: [{ id: 'a', label: 'A' }], rows: [{ a: '1' }] })
      )
    ).toBe('*C*\n\n| A |\n| --- |\n| 1 |');
    expect(
      documentToMarkdown(
        table({
          columns: [
            { id: 'a', label: 'Name' },
            { id: 'b', label: 'Count' },
          ],
          rows: [{ a: 'x', b: 2 }, { a: 'y' }, 'skipped', { b: true }],
        })
      )
    ).toBe('| Name | Count |\n| --- | --- |\n| x | 2 |\n| y |  |\n|  | true |');

    // Hostile cells: pipes, line breaks, backticks, HTML, emphasis and links stay literal.
    const hostile = documentToMarkdown(
      table({
        caption: 'a | b\n<script>',
        columns: [{ id: 'a', label: 'H|1' }],
        rows: [
          { a: 'x | y' },
          { a: 'line\nbreak\r\nand\u2028more' },
          { a: '`code` *em* _u_ [l](javascript:alert(1)) <img src=x onerror=alert(1)> &amp; \\' },
        ],
      })
    );
    const lines = hostile.split('\n');
    expect(lines[0]).toBe('*a | b \\<script>*');
    expect(lines.slice(2)).toEqual([
      '| H\\|1 |',
      '| --- |',
      '| x \\| y |',
      '| line break and more |',
      '| \\`code\\` \\*em\\* \\_u\\_ \\[l\\](javascript:alert(1)) \\<img src=x onerror=alert(1)\\> \\&amp; \\\\ |',
    ]);
    // Every table line has exactly the column's unescaped pipes.
    for (const line of lines.slice(2))
      expect(line.replace(/\\./g, '').split('|').length - 1).toBe(2);
    expect(hostile).not.toMatch(/(?<!\\)<(script|img)/);

    // Very long tables stay bounded (16 columns, 500 rows) and linear.
    const columns = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, label: `C${i}` }));
    const rows = Array.from({ length: 5_000 }, (_, r) =>
      Object.fromEntries(columns.map((column) => [column.id, `${'|'.repeat(20)}${r}`]))
    );
    const elapsed = time(() => {
      const big = documentToMarkdown(table({ columns, rows }));
      const bigLines = big.split('\n');
      expect(bigLines).toHaveLength(502);
      expect((bigLines[0] ?? '').replace(/\\./g, '').split('|').length - 1).toBe(17);
    });
    expect(elapsed).toBeLessThan(2_000);

    // A table props shape that does not hold a table is written as its text.
    expect(documentToMarkdown(table({ caption: 'Only a caption', columns: [] }))).toBe(
      'Only a caption'
    );
  });

  it('places wrapped tables inside quotes, callouts, lists and columns, and reads the rest back', () => {
    const cells = { columns: [{ id: 'a', label: 'A' }], rows: [{ a: '1' }] };
    const doc = {
      meta: { title: '' },
      blocks: [
        { id: 'p', type: 'paragraph', content: [{ type: 'text', text: 'Before', marks: [] }] },
        {
          id: 'q',
          type: 'quote',
          blocks: [{ id: 'qt', type: 'block', family: 'data', block: 'table', props: cells }],
        },
        {
          id: 'l',
          type: 'list',
          kind: 'bullet',
          items: [
            {
              id: 'i',
              blocks: [
                {
                  id: 'ip',
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item', marks: [] }],
                },
                { id: 'it', type: 'block', family: 'data', block: 'table', props: cells },
              ],
            },
          ],
        },
        {
          id: 'w',
          type: 'block',
          family: 'interactive',
          block: 'form',
          props: { title: 'Signup', description: 'Join the list' },
        },
        { id: 'x', type: 'block', family: 'diagram', block: 'mermaid', props: { code: 'graph' } },
      ],
    } as unknown as TexuliDocument;
    const markdown = documentToMarkdown(doc);
    expect(markdown).toBe(
      [
        'Before',
        '> | A |\n> | --- |\n> | 1 |',
        '- Item\n\n    | A |\n    | --- |\n    | 1 |',
        'Signup · Join the list',
        '\\[mermaid\\]',
      ].join('\n\n')
    );
    // The Markdown subset has no table or wrapped block: they read back as text.
    const back = read(markdown);
    expect(back.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'quote',
      'list',
      'paragraph',
      'paragraph',
    ]);
    expect(JSON.stringify(back.blocks[4])).toContain('[mermaid]');
    // A placeholder-like text in the document is never replaced.
    const sneaky = {
      meta: { title: '' },
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          content: [{ type: 'text', text: '\u0000txtable0\u0000 txtable0', marks: [] }],
        },
        { id: 't', type: 'block', family: 'data', block: 'table', props: cells },
      ],
    } as unknown as TexuliDocument;
    expect(documentToMarkdown(sneaky).split('\n\n')[0]).not.toContain('| A |');
  });

  it('applies the URL policy at the tier and never emits HTML', () => {
    const doc = read(
      '[x](javascript:alert(1)) <script>alert(1)</script>\n\n![a](http://example.com/a.png)'
    );
    const markdown = documentToMarkdown(doc);
    expect(JSON.stringify(doc)).not.toContain('javascript:');
    expect(doc.blocks.some((block) => block.type === 'media')).toBe(false);
    // Raw tags stay literal text, written back escaped.
    expect(markdown).toContain('\\<script>');
    expect(markdown).not.toMatch(/(?<!\\)<script>/);
    const developer = read('![a](http://example.com/a.png)', 'developer');
    expect(developer.blocks[0]?.type).toBe('media');
  });

  it('reads hostile Markdown in linear time', () => {
    const hostile = [
      '*'.repeat(50_000),
      '['.repeat(50_000),
      '> '.repeat(20_000),
      '- '.repeat(20_000),
      '`'.repeat(50_000),
      `${'a'.repeat(10)}${'_a'.repeat(25_000)}`,
      '# '.repeat(30_000),
      '![]('.repeat(20_000),
      `${'\n'.repeat(40_000)}x`,
      '\u202e'.repeat(40_000),
    ];
    for (const source of hostile) {
      const small = time(() => documentFromMarkdown(source.slice(0, source.length / 4)));
      const elapsed = time(() => {
        const result = documentFromMarkdown(source);
        expect(result.ok, source.slice(0, 10)).toBe(true);
      });
      // Four times the input stays far from quadratic (16×); generous for a loaded host.
      expect(elapsed, source.slice(0, 10)).toBeLessThan(Math.max(1_500, small * 12));
    }
  });
});

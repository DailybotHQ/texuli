// @vitest-environment node
import {
  createEditorIds,
  type EditorDocument,
  validateEditorDocument,
} from '@texuli/core/editor-model';
import { describe, expect, it } from 'vitest';
import {
  documentToMarkdown,
  MARKDOWN_CODEC_LIMITS,
  markdownToDocument,
} from '../src/markdown/index.ts';

// @texuli/editor/markdown: Markdown in and out of the editor document. Every
// format the editor holds round-trips, HTML never becomes markup, links pass
// the URL policy, and hostile input reads and writes in linear time.

/** A document without its runtime ids, for structural comparison. */
const shape = (doc: EditorDocument) =>
  JSON.parse(JSON.stringify(doc, (key, value) => (key === 'id' ? undefined : value)));

const read = (source: string, trust: 'developer' | 'untrusted' = 'untrusted') =>
  markdownToDocument(source, { trust, newId: createEditorIds('md') });

/** Canonical Markdown for each format the editor supports: it reads and writes back unchanged. */
const CANONICAL: Record<string, string> = {
  paragraph: 'Plain text.',
  headings: '# One\n\n## Two\n\n### Three\n\n#### Four',
  marks: '**strong** *em* ~~strike~~ `code` [link](https://example.com/a)',
  nested: '**strong *em inside* text** and **bold with [a link](https://example.com)**',
  break: 'first line\\\nsecond line',
  bullet: '- one\n- two\n\n    - nested',
  ordered: '3. three\n4. four',
  todo: '- [ ] open\n- [x] done',
  quote: '> quoted **text**\n>\n> - item',
  code: '```ts\nconst a = 1;\n\n// <b>not html</b>\n```',
  divider: 'above\n\n---\n\nbelow',
  media: '![A chart](media:chart-1)',
  escapes: '\\# not a heading, \\*not em\\*, \\<b>\n\n1\\. not a list, # mid',
  mailto: '[write](mailto:team@example.com) and [top](#top)',
  outline: '- Plan\n\n    - [ ] Draft\n    - [x] Review\n- Ship',
};

describe('@texuli/editor/markdown', () => {
  it('round-trips every format the editor supports', () => {
    for (const [name, source] of Object.entries(CANONICAL)) {
      const { doc, diagnostics } = read(source);
      expect(diagnostics, name).toEqual([]);
      expect(validateEditorDocument(doc), name).toEqual([]);
      const written = documentToMarkdown(doc);
      expect(written, name).toBe(source);
      expect(shape(read(written).doc), name).toEqual(shape(doc));
    }
    // The block types the fixtures cover: every type of the editor model.
    const types = new Set(
      Object.values(CANONICAL).flatMap((source) => read(source).doc.blocks.map((b) => b.type))
    );
    expect([...types].sort()).toEqual(
      ['code', 'divider', 'heading', 'list', 'media', 'paragraph', 'quote'].sort()
    );
  });

  it('keeps HTML as literal text and holds links to the URL policy', () => {
    const hostile: [string, string][] = [
      ['<script>alert(1)</script>', '<script>alert(1)</script>'],
      ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'],
      ['<a href="javascript:alert(1)">x</a>', '<a href="javascript:alert(1)">x</a>'],
      ['<!-- comment --> <div>block</div>', '<!-- comment --> <div>block</div>'],
      ['[x](javascript:alert(1))', 'x'],
      ['[x](data:text/html,hi)', 'x'],
      ['<javascript:alert(1)>', '<javascript:alert(1)>'],
    ];
    for (const [source, text] of hostile) {
      const { doc } = read(source);
      const block = doc.blocks[0];
      expect(block?.type, source).toBe('paragraph');
      const content = block?.type === 'paragraph' ? block.content : [];
      // One unmarked text run: no element, no link mark.
      expect(content, source).toEqual([{ type: 'text', text, marks: [] }]);
      const written = documentToMarkdown(doc);
      expect(written, source).not.toMatch(/(^|[^\\])</);
      expect(shape(read(written).doc), source).toEqual(shape(doc));
    }
    // A refused link reports once and keeps its text.
    expect(read('[a](javascript:x) [b](javascript:y)').diagnostics.map((d) => d.code)).toEqual([
      'link-rejected',
    ]);
    // Writing checks every link again at the given trust: a hand-built document
    // with an unsafe href writes as text; http passes only at the developer tier.
    const handBuilt = (href: string): EditorDocument => ({
      version: 1,
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          content: [{ type: 'text', text: 'go', marks: [{ type: 'link', href }] }],
        },
      ],
    });
    expect(documentToMarkdown(handBuilt('javascript:alert(1)'))).toBe('go');
    expect(documentToMarkdown(handBuilt('javascript:alert(1)'), { trust: 'developer' })).toBe('go');
    expect(documentToMarkdown(handBuilt('http://example.com/'))).toBe('go');
    expect(documentToMarkdown(handBuilt('http://example.com/'), { trust: 'developer' })).toBe(
      '[go](http://example.com/)'
    );
  });

  it('reads line endings and line separators the same everywhere', () => {
    const cases: [string, string][] = [
      ['# Title\r\n\r\n- a\r\n- b', '# Title\n\n- a\n- b'],
      ['# Title\r\rtext', '# Title\n\ntext'],
      // U+2028 and U+2029 are not Markdown line endings: they stay inside the
      // line (a heading, list item or quote keeps its kind) and the model
      // stores them as breaks, which a heading writes as a space.
      ['# a b', '# a b'],
      ['- a b', '- a\\\n    b'],
      ['1. a b', '1. a\\\n    b'],
      ['> a b', '> a\\\n> b'],
      ['a b', 'a\\\nb'],
    ];
    for (const [source, markdown] of cases) {
      const { doc } = read(source);
      expect(validateEditorDocument(doc), JSON.stringify(source)).toEqual([]);
      expect(documentToMarkdown(doc), JSON.stringify(source)).toBe(markdown);
      expect(documentToMarkdown(read(markdown).doc), JSON.stringify(source)).toBe(markdown);
    }
  });

  it('reads and writes hostile input in bounded, linear time', () => {
    const n = MARKDOWN_CODEC_LIMITS.source - 10;
    const fill = (unit: string, length = n) => unit.repeat(Math.ceil(length / unit.length));
    const hostile: Record<string, string> = {
      'heading closing spaces': `# a${' '.repeat(n)}x`,
      'heading hashes and tabs': `# a${fill(' #\t')}x`,
      'fence info spaces': `\`\`\`${' '.repeat(n)}!`,
      'fence info tabs': `~~~${'\t'.repeat(n)}!`,
      'bullet with a line separator': `- ${' '.repeat(n)} `,
      'ordered with a line separator': `1. ${' '.repeat(n)} `,
      'quote with a line separator': `> ${' '.repeat(n)} `,
      'line separators': fill('a '),
      'paragraph separators in a heading': `# ${fill('a ')}`,
      'soft lines': fill('a\n'),
      'spaces before a hard break': `a${' '.repeat(n)}b  \nc`,
      'one long line': fill('word '),
      'link labels sharing a mark': `[${fill('a *b* ')}](https://example.com)`,
      'emphasis openers': fill('*a '),
      'bracket openers': fill('[a'),
      'html tags': fill('<b>'),
      'nested quotes': fill('>'),
      'nested bullets': fill(' - '),
    };
    for (const [name, source] of Object.entries(hostile)) {
      const started = performance.now();
      const { doc } = read(source);
      const readMs = performance.now() - started;
      const markdown = documentToMarkdown(doc);
      const writeMs = performance.now() - started - readMs;
      // Generous bounds for a loaded host; the quadratic and cubic paths these
      // inputs once hit took minutes.
      expect(readMs, `${name}: read`).toBeLessThan(5_000);
      expect(writeMs, `${name}: write`).toBeLessThan(5_000);
      expect(validateEditorDocument(doc), name).toEqual([]);
      expect(typeof markdown).toBe('string');
    }
  }, 180_000);
});

describe('host inline extensions (G48)', () => {
  it('keeps mentions and references with their entity id through markdownToDocument and documentToMarkdown', () => {
    const extensions = [
      { name: 'mention', sigil: '@' as const },
      { name: 'reference', sigil: '#' as const },
    ];
    const source = 'Ping @{person-1|Ada} on #{record-7|Roadmap}';
    const { doc, diagnostics } = markdownToDocument(source, { extensions });
    expect(diagnostics).toEqual([]);
    const marks = editorMarks(doc);
    expect(marks).toEqual([
      { type: 'extension', name: 'mention', id: 'person-1' },
      { type: 'extension', name: 'reference', id: 'record-7' },
    ]);
    expect(documentToMarkdown(doc, { extensions })).toBe(source);
    // Without the registry the writer keeps only the labels.
    expect(documentToMarkdown(doc)).toBe('Ping Ada on Roadmap');
  });
});

/** Every mark in a one-paragraph document, in order. */
function editorMarks(doc: EditorDocument): unknown[] {
  const block = doc.blocks[0];
  if (block?.type !== 'paragraph') return [];
  return block.content.flatMap((node) => (node.type === 'text' ? node.marks : []));
}

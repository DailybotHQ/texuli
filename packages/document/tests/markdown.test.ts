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
    expect(markdown).not.toContain('Uptime');
    expect(documentToMarkdown(doc, { embeds: 'drop' })).not.toContain('Roadmap');
    const core = everyBlock();
    core.blocks = core.blocks.filter((block) =>
      ['heading', 'paragraph', 'code', 'list', 'quote', 'divider', 'media'].includes(block.type)
    );
    core.annotations = undefined;
    expect(shape(read(documentToMarkdown(core)))).toEqual(shape(core));
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

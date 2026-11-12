/**
 * Size and depth limits across every reader and writer: nesting bombs and oversized input never
 * throw, finish in time, and produce trees within `MARKDOWN_LIMITS`.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import { MARKDOWN_LIMITS, type MdRoot } from '../../../src/markdown/ast.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import {
  MARKDOWN_DIALECTS,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { cpuMs, htmlProblems, treeDepth } from './check.ts';

const BUDGET_MS = 4000;
/** Block containers nest at most blockDepth, each adding at most two levels (list + item). */
const MAX_DEPTH = MARKDOWN_LIMITS.blockDepth * 2 + MARKDOWN_LIMITS.inlineDepth + 8;

const readers: Record<string, (source: string) => MdRoot> = {
  commonmark: (source) => parseMarkdown(source).tree,
  html: (source) => htmlToMarkdownTree(source).tree,
  ...Object.fromEntries(
    MARKDOWN_DIALECTS.map((dialect) => [
      dialect,
      (source: string) => readMarkdownDialect(source, dialect).tree,
    ])
  ),
};

const BOMBS: Record<string, string> = {
  'quote nesting': `${'> '.repeat(100_000)}x`,
  'list nesting': Array.from({ length: 2000 }, (_, i) => `${'  '.repeat(i)}- x`).join('\n'),
  'emphasis nesting': `${'*'.repeat(50_000)}x${'*'.repeat(50_000)}`,
  'link nesting': `${'['.repeat(50_000)}x${'](https://example.com)'.repeat(2000)}`,
  'spoiler nesting': '||'.repeat(100_000),
  'html nesting': '<blockquote><ul><li><b><i>'.repeat(20_000),
  'telegram tag nesting': '<b><i><u><s><tg-spoiler>'.repeat(20_000),
  'oversized source': 'x'.repeat(MARKDOWN_LIMITS.source + 1024),
  'many paragraphs': 'a\n\n'.repeat(300_000),
  'one huge line': `${'word '.repeat(150_000)}`,
};

describe('nesting bombs and oversized input, every reader', () => {
  for (const [name, read] of Object.entries(readers)) {
    it(name, () => {
      const problems: string[] = [];
      for (const [bomb, source] of Object.entries(BOMBS)) {
        const started = cpuMs();
        const tree = read(source);
        const ms = cpuMs() - started;
        if (ms > BUDGET_MS) problems.push(`${bomb}: ${ms.toFixed(0)} ms`);
        const depth = treeDepth(tree);
        if (depth > MAX_DEPTH) problems.push(`${bomb}: depth ${depth}`);
        const html = markdownTreeToHtml(tree).html;
        for (const problem of htmlProblems(html, 'untrusted')) problems.push(`${bomb}: ${problem}`);
      }
      expect(problems).toEqual([]);
    }, 120_000);
  }
});

describe('readers report the limits they hit', () => {
  it('commonmark reports depth, source and node limits', () => {
    const codes = (source: string) => parseMarkdown(source).diagnostics.map((d) => d.code);
    expect(codes(BOMBS['quote nesting'] as string)).toContain('depth-limit');
    expect(codes(BOMBS['oversized source'] as string)).toContain('source-truncated');
    expect(codes(BOMBS['many paragraphs'] as string)).toContain('node-limit');
  });

  it('commonmark lets a caller lower the limits, never raise them', () => {
    const lowered = parseMarkdown('> > > x', { limits: { blockDepth: 1 } });
    expect(lowered.diagnostics.map((d) => d.code)).toContain('depth-limit');
    const raised = parseMarkdown('x'.repeat(MARKDOWN_LIMITS.source + 10), {
      limits: { source: Number.MAX_SAFE_INTEGER },
    });
    expect(raised.diagnostics.map((d) => d.code)).toContain('source-truncated');
  });

  it('the HTML reader reports depth and source limits', () => {
    const codes = (source: string) => htmlToMarkdownTree(source).diagnostics.map((d) => d.code);
    expect(codes(BOMBS['html nesting'] as string)).toContain('depth-limit');
    expect(codes(BOMBS['oversized source'] as string)).toContain('source-truncated');
  });
});

describe('writers on deep and wide trees', () => {
  it('every dialect writer survives a 20,000-deep tree', () => {
    let tree: MdRoot = { type: 'root', version: 'texuli-md/v1', children: [] };
    let inline: never = { type: 'text', value: 'deep' } as never;
    for (let i = 0; i < 20_000; i += 1) inline = { type: 'strong', children: [inline] } as never;
    tree = { ...tree, children: [{ type: 'paragraph', children: [inline] }] };
    for (const dialect of MARKDOWN_DIALECTS) {
      expect(() => writeMarkdownDialect(tree, dialect), dialect).not.toThrow();
    }
    expect(() => markdownTreeToHtml(tree)).not.toThrow();
  });
});

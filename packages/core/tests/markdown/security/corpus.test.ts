/**
 * The hostile corpus through every path of the Markdown stack: CommonMark → HTML and → every
 * dialect; untrusted HTML → tree → HTML and → every dialect; every dialect reader → HTML and → every
 * dialect. HTML output is re-tokenized and held to the writer allowlist and the URL policy.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import type { MdRoot } from '../../../src/markdown/ast.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import {
  MARKDOWN_DIALECTS,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { safeHref, safeImageSrc } from '../../../src/url-policy/index.ts';
import { dialectProblems, htmlProblems } from './check.ts';
import { DIALECT_VECTORS, HOSTILE_URLS, HTML_VECTORS, MARKDOWN_VECTORS } from './corpus.ts';

const TIERS = ['untrusted', 'developer'] as const;

/** Every writer's problems for one tree, labelled by writer and tier. */
function writerProblems(tree: MdRoot): string[] {
  const problems: string[] = [];
  for (const trust of TIERS) {
    for (const problem of htmlProblems(markdownTreeToHtml(tree, { trust }).html, trust))
      problems.push(`html/${trust}: ${problem}`);
    for (const dialect of MARKDOWN_DIALECTS) {
      const { value } = writeMarkdownDialect(tree, dialect, { trust });
      for (const problem of dialectProblems(value, dialect, trust))
        problems.push(`${dialect}/${trust}: ${problem}`);
    }
  }
  return problems;
}

describe('the policy refuses every hostile URL at the untrusted tier', () => {
  it.each(HOSTILE_URLS.map((url) => [url]))('%j', (url) => {
    expect(safeHref(url, 'untrusted')).toBeUndefined();
    // The image policy also accepts same-origin paths at the untrusted tier (an image cannot run
    // code); whatever it keeps is never an executing scheme.
    const image = safeImageSrc(url, 'untrusted');
    if (image !== undefined) expect(image).not.toMatch(/^\s*(?:javascript|vbscript|data):/i);
  });
});

describe('CommonMark → every writer', () => {
  it.each(MARKDOWN_VECTORS.map((source) => [source]))('%j', (source) => {
    const { tree } = parseMarkdown(source);
    expect(writerProblems(tree)).toEqual([]);
  });
});

describe('untrusted HTML → tree → every writer', () => {
  it.each(HTML_VECTORS.map((source) => [source]))('%j', (source) => {
    for (const trust of TIERS) {
      const { tree } = htmlToMarkdownTree(source, { trust });
      // The reader applies the policy itself: every URL it keeps passes unchanged.
      const stack: unknown[] = [tree];
      while (stack.length > 0) {
        const node = stack.pop() as { type: string; url?: string; children?: unknown[] };
        if (node.type === 'link') expect(safeHref(node.url, trust)).toBe(node.url);
        if (node.type === 'image') expect(safeImageSrc(node.url, trust)).toBe(node.url);
        if (node.children) stack.push(...node.children);
      }
      expect(writerProblems(tree)).toEqual([]);
    }
  });
});

describe('every dialect reader → every writer', () => {
  for (const dialect of MARKDOWN_DIALECTS) {
    it(`${dialect}: ${DIALECT_VECTORS.length} vectors`, () => {
      const problems: string[] = [];
      for (const source of DIALECT_VECTORS) {
        const { tree } = readMarkdownDialect(source, dialect);
        for (const problem of writerProblems(tree))
          problems.push(`${JSON.stringify(source)} ${problem}`);
      }
      expect(problems).toEqual([]);
    });
  }
});

describe('script content never reaches visible text', () => {
  it('drops script and style bodies on the HTML path', () => {
    const { tree } = htmlToMarkdownTree('a<script>steal()</script><style>p{}</style>b');
    expect(JSON.stringify(tree)).not.toMatch(/steal|p\{\}/);
  });

  it('keeps raw HTML in Markdown out of the HTML output', () => {
    const { html } = markdownTreeToHtml(
      parseMarkdown('a <b onclick="x()">b</b>\n\n<div>\nc\n</div>').tree
    );
    expect(html).not.toMatch(/<b|<div|onclick/);
  });
});

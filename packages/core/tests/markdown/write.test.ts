/**
 * `writeMarkdown` (ADR-034): a tree written as Markdown reads back to the same tree. Measured on
 * every example of the CommonMark 0.31.2, GFM 0.29 spec and cmark-gfm extensions corpora, and
 * cross-checked with `core/html` (`htmlToMarkdown = writeMarkdown(htmlToMarkdownTree(html).tree)`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../src/html/index.ts';
import {
  type MarkdownParseOptions,
  type MdInline,
  type MdRoot,
  parseMarkdown,
  writeMarkdown,
} from '../../src/markdown/index.ts';
import { markdownTreeToHtml } from '../../src/markdown-html/index.ts';
import { p, root, t } from './helpers.ts';

const corpus = (file: string) =>
  (
    JSON.parse(readFileSync(`packages/core/tests/markdown/fixtures/${file}`, 'utf8')) as {
      example: number;
      markdown: string;
    }[]
  ).map((example) => [example.example, example.markdown] as const);

const COMMONMARK = corpus('commonmark-0.31.2.json');
const GFM_SPEC = corpus('gfm-0.29-spec.json');
const GFM_EXTENSIONS = corpus('gfm-0.29-extensions.json');

/** Examples whose tree does not survive a write, with the reason. */
const KNOWN = {
  // An indented code block whose lines start with a space, right after a bullet list: no
  // bullet indent keeps it outside the list, so it is written fenced (`fenced` changes).
  commonmark: [257],
  gfmSpec: [235],
  gfmExtensions: [] as number[],
};

function unstable(examples: readonly (readonly [number, string])[], options: MarkdownParseOptions) {
  const failing: number[] = [];
  for (const [number, markdown] of examples) {
    const tree = parseMarkdown(markdown, options).tree;
    const again = parseMarkdown(writeMarkdown(tree), options).tree;
    if (JSON.stringify(again) !== JSON.stringify(tree)) failing.push(number);
  }
  return failing;
}

describe('round trips at tree level on the spec corpora', () => {
  it('CommonMark 0.31.2, strict (651 of 652)', () => {
    expect(unstable(COMMONMARK, { gfm: false })).toEqual(KNOWN.commonmark);
  });

  it('CommonMark 0.31.2, with GFM (651 of 652)', () => {
    expect(unstable(COMMONMARK, {})).toEqual(KNOWN.commonmark);
  });

  it('GFM 0.29 spec (671 of 672)', () => {
    expect(unstable(GFM_SPEC, {})).toEqual(KNOWN.gfmSpec);
  });

  it('cmark-gfm extensions (30 of 30)', () => {
    expect(unstable(GFM_EXTENSIONS, {})).toEqual(KNOWN.gfmExtensions);
  });

  it('HTML to Markdown through core/html is stable on every corpus example', () => {
    const failing: number[] = [];
    for (const [number, markdown] of [...COMMONMARK, ...GFM_SPEC, ...GFM_EXTENSIONS]) {
      const html = markdownTreeToHtml(parseMarkdown(markdown).tree, { trust: 'developer' }).html;
      const tree = htmlToMarkdownTree(html, { trust: 'developer' }).tree;
      if (JSON.stringify(parseMarkdown(writeMarkdown(tree)).tree) !== JSON.stringify(tree))
        failing.push(number);
    }
    expect(failing).toEqual([]);
  });
});

describe('writing', () => {
  it('writes each construct in its usual Markdown form', () => {
    const markdown = [
      '# Release notes',
      '',
      'Some *em*, **strong**, ~~gone~~, `code`, [a link](https://example.com "Home") and ![alt](i.png).[^1]',
      '',
      '> Quoted',
      '',
      '- [x] done',
      '- [ ] next',
      '',
      '3. three',
      '4. four',
      '',
      '| Plan | Seats |',
      '| :-- | --: |',
      '| Team | 12 |',
      '',
      '```ts title="a.ts"',
      'const a = 1;',
      '```',
      '',
      '***',
      '',
      '[^1]: A fictional note.',
      '',
    ].join('\n');
    expect(writeMarkdown(parseMarkdown(markdown).tree)).toBe(markdown);
  });

  it('escapes text so it never becomes markup', () => {
    const value =
      '*not em* _nor_ [a](b) <b> `c` ~d~ &amp; www.example.com x@example.com https://example.com |';
    const lines = [
      '# not a heading',
      '- not a list',
      '1. not ordered',
      '> not quoted',
      '=== not setext',
    ];
    for (const text of [value, ...lines]) {
      const tree = root(p(t(text)));
      expect(parseMarkdown(writeMarkdown(tree)).tree).toEqual(tree);
    }
  });

  it('keeps leading, trailing and doubled line-ending whitespace through references', () => {
    const tree = root(p(t(' padded \n\nparagraph ')));
    expect(parseMarkdown(writeMarkdown(tree)).tree).toEqual(tree);
  });

  it('writes the text of nodes CommonMark cannot express', () => {
    const tree = root(
      p(
        { type: 'underline', children: [t('under')] },
        t(' '),
        { type: 'spoiler', children: [t('secret')] },
        t(' '),
        { type: 'mention', kind: 'user', id: 'U1', label: 'ada' },
        t(' '),
        { type: 'mention', kind: 'everyone' }
      )
    );
    expect(writeMarkdown(tree)).toBe('under secret @ada @everyone\n');
  });

  it('never throws, and stays bounded on deep hand-built trees', () => {
    for (const input of [undefined, null, {}, { type: 'root' }, { type: 'root', children: 'x' }])
      expect(writeMarkdown(input as unknown as MdRoot)).toBe('');
    let inline: MdInline = t('deep');
    for (let i = 0; i < 50_000; i++) inline = { type: 'emphasis', children: [inline] };
    expect(writeMarkdown(root(p(inline)))).toContain('deep');
    let block: MdRoot['children'][number] = p(t('deep'));
    for (let i = 0; i < 50_000; i++) block = { type: 'blockquote', children: [block] };
    expect(() => writeMarkdown(root(block))).not.toThrow();
  });
});

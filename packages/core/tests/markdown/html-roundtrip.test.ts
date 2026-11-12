/**
 * Round trips (AC-md-html): a tree written by `core/markdown-html` reads back through `core/html`
 * to the same tree, and HTML that went through one read and write is stable under another. The
 * fixtures avoid the documented losses (raw HTML, definitions, indented code, `code.meta`,
 * whitespace runs, a mention label equal to its id); `losses` below pins each of those.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../src/html/index.ts';
import type { MdBlock, MdRoot } from '../../src/markdown/ast.ts';
import { markdownTreeToHtml } from '../../src/markdown-html/index.ts';
import { item, p, root, t } from './helpers.ts';

const roundTrip = (tree: MdRoot, trust: 'developer' | 'untrusted' = 'untrusted') =>
  htmlToMarkdownTree(markdownTreeToHtml(tree, { trust }).html, { trust }).tree;

const list = (
  ordered: boolean,
  spread: boolean,
  ...children: ReturnType<typeof item>[]
): MdBlock =>
  ordered
    ? { type: 'list', ordered: true, start: 1, spread, children }
    : { type: 'list', ordered: false, spread, children };

const FIXTURES: Record<string, MdRoot> = {
  'paragraphs and soft breaks': root(p(t('one\ntwo')), p(t('three'))),
  headings: root(
    { type: 'heading', depth: 1, children: [t('A')] },
    { type: 'heading', depth: 3, children: [t('C '), { type: 'emphasis', children: [t('em')] }] }
  ),
  'inline marks': root(
    p(
      t('plain '),
      { type: 'strong', children: [t('bold '), { type: 'emphasis', children: [t('both')] }] },
      t(' '),
      { type: 'delete', children: [t('gone')] },
      t(' '),
      { type: 'underline', children: [t('under')] },
      t(' '),
      { type: 'spoiler', children: [t('secret')] },
      t(' '),
      { type: 'inlineCode', value: 'a <b> & c' },
      { type: 'break' },
      t('after break')
    )
  ),
  'escaped characters': root(p(t('1 < 2 & 3 > 2, "quoted" \'single\' <script>'))),
  links: root(
    p(
      {
        type: 'link',
        url: 'https://example.com/a?b=1&c=2#d',
        title: 'Title "q"',
        children: [t('link')],
      },
      t(' and '),
      {
        type: 'link',
        url: 'mailto:ada@example.com',
        children: [{ type: 'strong', children: [t('mail')] }],
      }
    )
  ),
  images: root(
    p({ type: 'image', url: 'https://example.com/a.png', alt: 'An image', title: 'T' }, t(' text'))
  ),
  'tight lists, nested': root(
    list(
      false,
      false,
      item([p(t('a')), list(true, false, item([p(t('a1'))]), item([p(t('a2'))]))]),
      item([p(t('b'))])
    )
  ),
  'loose list with a two-paragraph item': root(
    list(false, true, item([p(t('first')), p(t('second'))], undefined, true), item([p(t('third'))]))
  ),
  'ordered list with a start': root({
    type: 'list',
    ordered: true,
    start: 42,
    spread: false,
    children: [item([p(t('x'))])],
  }),
  'task list': root(list(false, false, item([p(t('done'))], true), item([p(t('todo'))], false))),
  'blockquote with blocks': root({
    type: 'blockquote',
    children: [
      p(t('quote')),
      list(false, false, item([p(t('in quote'))])),
      { type: 'thematicBreak' },
    ],
  }),
  'code blocks': root(
    { type: 'code', lang: 'ts', value: 'const a = 1 < 2;\n\nreturn a;', fenced: true },
    { type: 'code', value: '  indented\ttabs', fenced: true }
  ),
  table: root({
    type: 'table',
    align: ['left', 'center', 'right', null],
    children: [
      {
        type: 'tableRow',
        children: ['h1', 'h2', 'h3', 'h4'].map((v) => ({
          type: 'tableCell' as const,
          children: [t(v)],
        })),
      },
      {
        type: 'tableRow',
        children: [
          { type: 'tableCell', children: [{ type: 'strong', children: [t('b')] }] },
          { type: 'tableCell', children: [{ type: 'inlineCode', value: 'c' }] },
          { type: 'tableCell', children: [t('3')] },
          { type: 'tableCell', children: [] },
        ],
      },
    ],
  }),
  mentions: root(
    p(
      { type: 'mention', kind: 'user', id: 'U1', label: 'Ada' },
      t(' '),
      { type: 'mention', kind: 'channel', id: 'C9' },
      t(' '),
      { type: 'mention', kind: 'role', id: 'R1', label: 'admins' },
      t(' '),
      { type: 'mention', kind: 'everyone' },
      t(' '),
      { type: 'mention', kind: 'here' }
    )
  ),
  footnotes: root(
    p(t('See'), { type: 'footnoteReference', label: '1' }, t(' and'), {
      type: 'footnoteReference',
      label: 'note b',
    }),
    { type: 'footnoteDefinition', label: '1', children: [p(t('First.'))] },
    {
      type: 'footnoteDefinition',
      label: 'note b',
      children: [p(t('Second '), { type: 'emphasis', children: [t('note')] })],
    }
  ),
};

describe('Markdown → HTML → Markdown round trips', () => {
  for (const [name, tree] of Object.entries(FIXTURES)) {
    it(`keeps the tree: ${name}`, () => {
      expect(roundTrip(tree)).toEqual(tree);
    });

    it(`keeps the HTML stable: ${name}`, () => {
      const once = markdownTreeToHtml(tree).html;
      const twice = markdownTreeToHtml(htmlToMarkdownTree(once).tree).html;
      expect(twice).toBe(once);
    });
  }

  it('keeps developer-tier URLs at the developer tier', () => {
    const tree = root(
      p({ type: 'link', url: '/docs/page', children: [t('rel')] }, t(' '), {
        type: 'image',
        url: 'data:image/png;base64,AAAA',
        alt: 'dot',
      })
    );
    expect(roundTrip(tree, 'developer')).toEqual(tree);
  });
});

describe('documented losses', () => {
  it('raw HTML is dropped (or kept as text), never read back as markup', () => {
    const tree = root(p(t('a'), { type: 'html', value: '<b>' }, t('b')));
    expect(roundTrip(tree)).toEqual(root(p(t('ab'))));
    const escaped = htmlToMarkdownTree(markdownTreeToHtml(tree, { rawHtml: 'escape' }).html).tree;
    expect(escaped).toEqual(root(p(t('a<b>b'))));
  });

  it('definitions are not rendered', () => {
    expect(roundTrip(root({ type: 'definition', label: 'x', url: 'https://example.com' }))).toEqual(
      root()
    );
  });

  it('code blocks read back fenced, without meta', () => {
    expect(
      roundTrip(root({ type: 'code', lang: 'js', meta: 'title=a', value: 'x', fenced: false }))
    ).toEqual(root({ type: 'code', lang: 'js', value: 'x', fenced: true }));
  });

  it('whitespace runs collapse', () => {
    expect(roundTrip(root(p(t('a   b \n  c'))))).toEqual(root(p(t('a b\nc'))));
  });

  it('a refused URL keeps the label only', () => {
    expect(
      roundTrip(root(p({ type: 'link', url: 'http://example.com', children: [t('x')] })))
    ).toEqual(root(p(t('x'))));
  });

  it('footnote definitions move to the end, in definition order', () => {
    const tree = root(
      { type: 'footnoteDefinition', label: 'a', children: [p(t('A'))] },
      p(t('x'), { type: 'footnoteReference', label: 'a' })
    );
    expect(roundTrip(tree)).toEqual(
      root(p(t('x'), { type: 'footnoteReference', label: 'a' }), {
        type: 'footnoteDefinition',
        label: 'a',
        children: [p(t('A'))],
      })
    );
  });

  it('a mention label equal to its id reads back without a label', () => {
    expect(roundTrip(root(p({ type: 'mention', kind: 'user', id: 'U1', label: 'U1' })))).toEqual(
      root(p({ type: 'mention', kind: 'user', id: 'U1' }))
    );
  });
});

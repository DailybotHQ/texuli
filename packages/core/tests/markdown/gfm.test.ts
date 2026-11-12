/**
 * GFM extensions in the `texuli-md/v1` tree (ADR-034): tables, task items, strikethrough,
 * extended autolinks and footnotes; the `gfm` option; pathological GFM input; and nested-list
 * scaling.
 */
import { describe, expect, it } from 'vitest';
import { type MdBlock, parseMarkdown } from '../../src/markdown/index.ts';

const blocks = (markdown: string, gfm?: Parameters<typeof parseMarkdown>[1]) =>
  parseMarkdown(markdown, gfm).tree.children;

describe('GFM in the tree', () => {
  it('reads a table: alignments, header row, padded and cut rows, escaped pipes', () => {
    const [table] = blocks(
      '| Plan | Seats |\n| :-- | --: |\n| Team \\| Pro | 12 | extra |\n| Solo |\n'
    );
    expect(table).toEqual({
      type: 'table',
      align: ['left', 'right'],
      children: [
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: 'Plan' }] },
            { type: 'tableCell', children: [{ type: 'text', value: 'Seats' }] },
          ],
        },
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: 'Team | Pro' }] },
            { type: 'tableCell', children: [{ type: 'text', value: '12' }] },
          ],
        },
        {
          type: 'tableRow',
          children: [
            { type: 'tableCell', children: [{ type: 'text', value: 'Solo' }] },
            { type: 'tableCell', children: [] },
          ],
        },
      ],
    });
  });

  it('keeps the paragraph lines before a table header, and ends a table at a blank line', () => {
    const tree = blocks('Intro line\n| a |\n| - |\n| b |\n\nAfter\n');
    expect(tree.map((node) => node.type)).toEqual(['paragraph', 'table', 'paragraph']);
  });

  it('reads task items as checked list items', () => {
    const [list] = blocks('- [x] ship it\n- [ ] write docs\n- [?] not a task\n');
    expect(list?.type === 'list' && list.children.map((item) => item.checked)).toEqual([
      true,
      false,
      undefined,
    ]);
    expect(list?.type === 'list' && list.children[0]?.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'ship it' }] },
    ]);
  });

  it('reads strikethrough with one or two tildes, never three', () => {
    const [p] = blocks('~a~ ~~b~~ ~~~c~~~ ~~d~');
    expect(p?.type === 'paragraph' && p.children).toEqual([
      { type: 'delete', children: [{ type: 'text', value: 'a' }] },
      { type: 'text', value: ' ' },
      { type: 'delete', children: [{ type: 'text', value: 'b' }] },
      { type: 'text', value: ' ~~~c~~~ ~~d~' },
    ]);
  });

  it('reads extended autolinks, trimming trailing punctuation, and not inside links', () => {
    const [p] = blocks(
      'See www.example.com/a_b. Mail team@example.com, or (https://example.com/x). [www.example.org](u)'
    );
    expect(p?.type === 'paragraph' && p.children).toEqual([
      { type: 'text', value: 'See ' },
      {
        type: 'link',
        url: 'http://www.example.com/a_b',
        children: [{ type: 'text', value: 'www.example.com/a_b' }],
      },
      { type: 'text', value: '. Mail ' },
      {
        type: 'link',
        url: 'mailto:team@example.com',
        children: [{ type: 'text', value: 'team@example.com' }],
      },
      { type: 'text', value: ', or (' },
      {
        type: 'link',
        url: 'https://example.com/x',
        children: [{ type: 'text', value: 'https://example.com/x' }],
      },
      { type: 'text', value: '). ' },
      { type: 'link', url: 'u', children: [{ type: 'text', value: 'www.example.org' }] },
    ]);
  });

  it('never links escaped or referenced text', () => {
    const [p] = blocks(
      'www\\.example.com https\\://example.com team\\@example.com team&#64;example.com'
    );
    expect(p?.type === 'paragraph' && p.children.every((node) => node.type === 'text')).toBe(true);
  });

  it('reads footnote references and definitions; an undefined label stays text', () => {
    const tree = blocks(
      'Fact[^note] and[^missing].\n\n[^note]: Fictional source.\n    More text.\n'
    );
    expect(tree).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Fact' },
          { type: 'footnoteReference', label: 'note' },
          { type: 'text', value: ' and[^missing].' },
        ],
      },
      {
        type: 'footnoteDefinition',
        label: 'note',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Fictional source.\nMore text.' }],
          },
        ],
      },
    ] satisfies MdBlock[]);
  });
});

describe('the gfm option', () => {
  const source = '| a |\n| - |\n\n- [x] t\n\n~~s~~ www.example.com [^f]\n\n[^f]: n\n';

  it('is on by default', () => {
    expect(blocks(source).map((node) => node.type)).toEqual([
      'table',
      'list',
      'paragraph',
      'footnoteDefinition',
    ]);
  });

  it('reads strict CommonMark with gfm: false', () => {
    const tree = blocks(source, { gfm: false });
    expect(tree.map((node) => node.type)).toEqual(['paragraph', 'list', 'paragraph', 'definition']);
    expect(JSON.stringify(tree)).not.toMatch(/"checked"|"delete"|"footnote|"table"|"url":"http/);
  });

  it('turns single extensions off', () => {
    const tree = blocks(source, { gfm: { table: false, footnote: false } });
    expect(tree.map((node) => node.type)).toEqual(['paragraph', 'list', 'paragraph', 'definition']);
    const list = tree[1];
    expect(list?.type === 'list' && list.children[0]?.checked).toBe(true);
  });
});

/** Median of three runs, in milliseconds. */
function median(run: () => void): number {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    run();
    times.push(performance.now() - started);
  }
  return times.sort((a, b) => a - b)[1] as number;
}

describe('pathological GFM input stays linear', () => {
  const N = 40_000;
  const CASES: readonly [string, string][] = [
    ['www. candidates with underscores', 'www.a_'.repeat(N)],
    ['scheme runs', 'http://'.repeat(N)],
    ['email starts', 'a@'.repeat(N)],
    ['email-like runs', 'a.b@c.'.repeat(N)],
    ['unbalanced parentheses after an autolink', `www.example.com/${')'.repeat(N)}`],
    ['tilde runs', '~a ~~b~ '.repeat(N)],
    ['a wide table', `${'|a'.repeat(N / 4)}\n${'|-'.repeat(N / 4)}\n${'x\n'.repeat(200)}`],
    ['a tall table', `|a|b|\n|-|-|\n${'|x|y|\n'.repeat(N)}`],
    ['many footnote references', `[^a]: x\n\n${'[^a]'.repeat(N)}`],
    ['many task items', '- [x] a\n'.repeat(N / 2)],
  ];

  it.each(CASES)('%s', (_name, markdown) => {
    const started = performance.now();
    const result = parseMarkdown(markdown);
    expect(result.tree.type).toBe('root');
    expect(performance.now() - started).toBeLessThan(3_000);
  });

  it('parses nested lists in time linear in their size', () => {
    // Lists cycling through 30 nesting levels (PLAN_023 lead probe).
    const lists = (lines: number) =>
      Array.from({ length: lines }, (_, i) => `${'  '.repeat(i % 30)}* a\n`).join('');
    const small = lists(5_000);
    const large = lists(20_000);
    parseMarkdown(small);
    const ratio =
      median(() => parseMarkdown(large)) /
      Math.max(
        1,
        median(() => parseMarkdown(small))
      );
    // Four times the input: linear is about 4, quadratic about 16.
    expect(ratio).toBeLessThan(10);
  });
});

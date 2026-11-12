/**
 * `parseMarkdown` (ADR-034): the `texuli-md/v1` tree it builds, its limits and diagnostics,
 * hostile input (never throws), and pathological shapes that a backtracking or quadratic parser
 * would take seconds or minutes on.
 */
import { describe, expect, it } from 'vitest';
import {
  MARKDOWN_AST_VERSION,
  MARKDOWN_LIMITS,
  type MdNode,
  type MdRoot,
  parseMarkdown,
} from '../../src/markdown/index.ts';

const tree = (markdown: string) => parseMarkdown(markdown).tree;

/** Every node of a tree, without recursion. */
function nodes(root: MdRoot): MdNode[] {
  const out: MdNode[] = [];
  const stack: MdNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as MdNode;
    out.push(node);
    if ('children' in node) stack.push(...(node.children as MdNode[]));
  }
  return out;
}

/** Deepest nesting of inline containers (emphasis, strong, link). */
function inlineDepth(root: MdRoot): number {
  let max = 0;
  const stack: [MdNode, number][] = [[root, 0]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop() as [MdNode, number];
    const container = node.type === 'emphasis' || node.type === 'strong' || node.type === 'link';
    const here = container ? depth + 1 : depth;
    max = Math.max(max, here);
    if ('children' in node)
      for (const child of node.children as MdNode[]) stack.push([child, here]);
  }
  return max;
}

describe('the texuli-md/v1 tree', () => {
  it('builds blocks and inlines in the contract shape', () => {
    const root = tree(
      '# Release *notes*\n\nSee [the guide](https://example.com/guide "Guide") and `npm i`.  \nNext line\nsoft\n\n> quoted\n\n---\n'
    );
    expect(root.type).toBe('root');
    expect(root.version).toBe(MARKDOWN_AST_VERSION);
    expect(root.children).toEqual([
      {
        type: 'heading',
        depth: 1,
        children: [
          { type: 'text', value: 'Release ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'notes' }] },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'See ' },
          {
            type: 'link',
            url: 'https://example.com/guide',
            title: 'Guide',
            children: [{ type: 'text', value: 'the guide' }],
          },
          { type: 'text', value: ' and ' },
          { type: 'inlineCode', value: 'npm i' },
          { type: 'text', value: '.' },
          { type: 'break' },
          // Soft breaks are text line endings, merged with their neighbors.
          { type: 'text', value: 'Next line\nsoft' },
        ],
      },
      {
        type: 'blockquote',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: 'quoted' }] }],
      },
      { type: 'thematicBreak' },
    ]);
  });

  it('keeps code info as lang and meta, and code values without the final line ending', () => {
    expect(tree('```ts title="a.ts"\nconst a = 1;\n```\n\n    indented\n').children).toEqual([
      { type: 'code', lang: 'ts', meta: 'title="a.ts"', value: 'const a = 1;', fenced: true },
      { type: 'code', value: 'indented', fenced: false },
    ]);
  });

  it('reads lists: ordered start, tight and loose, and item spread', () => {
    const [tight, loose] = tree('3. one\n4. two\n\n- a\n\n  more\n- b\n').children;
    expect(tight).toMatchObject({ type: 'list', ordered: true, start: 3, spread: false });
    expect(loose).toMatchObject({ type: 'list', ordered: false, spread: true });
    expect(loose?.type === 'list' && loose.children.map((item) => item.spread)).toEqual([
      true,
      false,
    ]);
    expect(loose && 'start' in loose).toBe(false);
  });

  it('keeps link reference definitions as nodes, resolved by normalized label', () => {
    const root = tree(
      '[Docs  Home]\n\n[docs home]: https://example.com/ "Home"\n[docs home]: https://example.com/second\n'
    );
    expect(root.children).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com/',
            title: 'Home',
            children: [{ type: 'text', value: 'Docs  Home' }],
          },
        ],
      },
      { type: 'definition', label: 'DOCS HOME', url: 'https://example.com/', title: 'Home' },
      // A later definition of the same label is kept for round trips but never wins.
      { type: 'definition', label: 'DOCS HOME', url: 'https://example.com/second' },
    ]);
  });

  it('keeps URLs as written (decoded, never normalized) and raw HTML as literal html nodes', () => {
    const root = tree(
      '[a](<https://example.com/a b>) <span onclick="x()">hi</span> ![alt *em*](i.png)\n\n<div>\nblock\n</div>\n'
    );
    const paragraph = root.children[0];
    expect(paragraph?.type === 'paragraph' && paragraph.children).toEqual([
      { type: 'link', url: 'https://example.com/a b', children: [{ type: 'text', value: 'a' }] },
      { type: 'text', value: ' ' },
      { type: 'html', value: '<span onclick="x()">' },
      { type: 'text', value: 'hi' },
      { type: 'html', value: '</span>' },
      { type: 'text', value: ' ' },
      { type: 'image', url: 'i.png', alt: 'alt em' },
    ]);
    expect(root.children[1]).toEqual({ type: 'html', value: '<div>\nblock\n</div>' });
  });

  it('reads autolinks: a URI as written, an email as mailto', () => {
    const paragraph = tree('<https://example.com/x?a=1> <team@example.com>').children[0];
    expect(paragraph?.type === 'paragraph' && paragraph.children).toEqual([
      {
        type: 'link',
        url: 'https://example.com/x?a=1',
        children: [{ type: 'text', value: 'https://example.com/x?a=1' }],
      },
      { type: 'text', value: ' ' },
      {
        type: 'link',
        url: 'mailto:team@example.com',
        children: [{ type: 'text', value: 'team@example.com' }],
      },
    ]);
  });

  it('decodes entities and escapes, and replaces U+0000 and invalid code points', () => {
    const paragraph = tree('&copy; &#x1F600; &#0; \\* a\u0000b').children[0];
    expect(paragraph?.type === 'paragraph' && paragraph.children).toEqual([
      { type: 'text', value: '\u00a9 \u{1F600} \uFFFD * a\uFFFDb' },
    ]);
  });
});

describe('limits and diagnostics', () => {
  it('cuts an over-long source without splitting a surrogate pair', () => {
    const { tree: root, diagnostics } = parseMarkdown(`ab\u{1F600}cd`, { limits: { source: 3 } });
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'source-truncated', position: { start: 2, end: 6 } }),
    ]);
    expect(root.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'ab' }] },
    ]);
  });

  it('stops opening block quotes and lists at the block depth limit', () => {
    const deep = parseMarkdown(`${'>'.repeat(200)} a`);
    let depth = 0;
    let node: MdNode | undefined = deep.tree.children[0];
    while (node?.type === 'blockquote') {
      depth++;
      node = node.children[0];
    }
    expect(depth).toBe(MARKDOWN_LIMITS.blockDepth);
    expect(node?.type).toBe('paragraph');
    expect(deep.diagnostics.map((d) => d.code)).toEqual(['depth-limit']);
    const lists = parseMarkdown('- a\n  - b\n    - c\n', { limits: { blockDepth: 2 } });
    expect(JSON.stringify(lists.tree)).toContain('- c');
    expect(lists.diagnostics.map((d) => d.code)).toEqual(['depth-limit']);
  });

  it('flattens inline nesting past the limit into its content, without recursion', () => {
    const markdown = `${'*a **a '.repeat(2000)}b${' a** a*'.repeat(2000)}`;
    const { tree: root, diagnostics } = parseMarkdown(markdown);
    expect(inlineDepth(root)).toBeLessThanOrEqual(MARKDOWN_LIMITS.inlineDepth);
    expect(diagnostics.map((d) => d.code)).toEqual(['depth-limit']);
    // The text survives the flattening.
    const text = nodes(root)
      .map((node) => (node.type === 'text' ? node.value : ''))
      .join('');
    expect(text.replace(/[^b]/g, '')).toBe('b');
    const lowered = parseMarkdown('***a*** [b *c*](u)', { limits: { inlineDepth: 1 } });
    expect(inlineDepth(lowered.tree)).toBe(1);
  });

  it('stops growing the tree at the node limit', () => {
    const { tree: root, diagnostics } = parseMarkdown('para\n\n'.repeat(500), {
      limits: { nodes: 50 },
    });
    expect(nodes(root).length).toBeLessThanOrEqual(51);
    expect(diagnostics.map((d) => d.code)).toEqual(['node-limit']);
  });

  it('never raises a limit above MARKDOWN_LIMITS and ignores invalid limits', () => {
    const big = parseMarkdown(`${'>'.repeat(100)} a`, { limits: { blockDepth: 10_000 } });
    expect(big.diagnostics.map((d) => d.code)).toEqual(['depth-limit']);
    const invalid = parseMarkdown('a', { limits: { source: Number.NaN, nodes: -1 } });
    expect(invalid.diagnostics).toEqual([]);
    expect(invalid.tree.children).toHaveLength(1);
  });

  it('never throws on hostile or non-string input', () => {
    for (const input of [
      undefined,
      null,
      42,
      {},
      [],
      Symbol('x'),
      '\u0000',
      '\uD800',
      '\r\r\n\r',
      '\t\t>\t-\t1.\t',
    ]) {
      const result = parseMarkdown(input);
      expect(result.tree.type).toBe('root');
      expect(Array.isArray(result.diagnostics)).toBe(true);
    }
  });
});

describe('pathological input stays linear', () => {
  // Each input is 100k+ characters: a quadratic or backtracking parser needs minutes on these.
  const N = 40_000;
  const CASES: readonly [string, string][] = [
    ['nested strong and emphasis', `${'*a **a '.repeat(N / 8)}b${' a** a*'.repeat(N / 8)}`],
    ['emphasis closers without openers', 'a_ '.repeat(N)],
    ['emphasis openers without closers', '_a '.repeat(N)],
    ['a long emphasis run', `${'*'.repeat(N)}a${'*'.repeat(N)}`],
    ['mismatched openers and closers', '*a_ '.repeat(N)],
    ['openers and closers multiple of 3', `a**b${'c* '.repeat(N)}`],
    ['link closers without openers', 'a]'.repeat(N)],
    ['link openers without closers', '[a'.repeat(N)],
    ['link openers and emphasis closers', '[ a_'.repeat(N)],
    ['nested brackets', `${'['.repeat(N)}a${']'.repeat(N)}`],
    ['brackets and parentheses', '[ (]('.repeat(N)],
    ['unclosed link destinations', '[](('.repeat(N)],
    ['unclosed pointy destinations', '[a](<b'.repeat(N)],
    ['unclosed titles', '[a](b "'.repeat(N)],
    [
      'backtick runs of growing length',
      Array.from({ length: 400 }, (_, i) => `e${'`'.repeat(i + 1)}`).join(''),
    ],
    ['unclosed comments', `</${'<!--'.repeat(N)}`],
    ['unclosed attribute quotes', "<a b='".repeat(N)],
    ['unclosed declarations and instructions', 'a <!A <?'.repeat(N)],
    ['autolink and email starts', '<a:<a@'.repeat(N)],
    ['deep block quotes', `${'>'.repeat(N * 3)} a`],
    ['deep lists', Array.from({ length: 300 }, (_, i) => `${' '.repeat(i * 2)}* a\n`).join('')],
    [
      'many definitions and references',
      Array.from({ length: N / 4 }, (_, i) => `[${i}]: /u\n`).join('') + '[0] '.repeat(N / 4),
    ],
  ];

  it.each(CASES)('%s', (_name, markdown) => {
    const started = performance.now();
    const result = parseMarkdown(markdown);
    const elapsed = performance.now() - started;
    expect(result.tree.type).toBe('root');
    // Linear runs take tens of milliseconds; the bound is generous for a loaded machine.
    expect(elapsed).toBeLessThan(3_000);
  });
});

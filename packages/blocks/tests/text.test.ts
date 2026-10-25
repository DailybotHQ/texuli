import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { checkTextBlock, loadTextFamily, TEXT_BLOCK_TYPES } from '../src/index.ts';
import { resolveTextBlockLabels } from '../src/text/index.ts';
import {
  inlineText,
  type MdBlock,
  type MdInline,
  parseInline,
  parseMarkdown,
} from '../src/text/markdown.ts';
import { RichText, TextBlockView } from '../src/text/renderers.ts';

const RLO = '\u202e';

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('expected an item');
  return item;
}

function paragraph(block: MdBlock): MdInline[] {
  if (block.type !== 'paragraph') throw new Error(`expected a paragraph, got ${block.type}`);
  return block.children;
}

describe('parseMarkdown', () => {
  it('splits paragraphs, headings, rules, quotes and code fences', () => {
    const { blocks } = parseMarkdown(
      '# Title\n\nFirst line\nsecond line\n\n---\n\n> quoted **bold**\n\n```ts\nconst a = 1;\n```'
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'rule',
      'quote',
      'code',
    ]);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(inlineText(paragraph(blocks[1] as MdBlock))).toBe('First line\nsecond line');
    expect(blocks[4]).toEqual({ type: 'code', lang: 'ts', text: 'const a = 1;' });
  });

  it('parses bullet, ordered, nested and task lists', () => {
    const { blocks } = parseMarkdown('3. three\n4. four\n   - nested\n\n- [x] done\n- [ ] open');
    const ordered = blocks[0];
    expect(ordered).toMatchObject({ type: 'list', ordered: true, start: 3 });
    if (ordered?.type !== 'list') throw new Error('list');
    expect(ordered.items).toHaveLength(2);
    expect(ordered.items[1]?.children.map((child) => child.type)).toEqual(['paragraph', 'list']);
    const tasks = blocks[1];
    if (tasks?.type !== 'list') throw new Error('list');
    expect(tasks.items.map((item) => item.checked)).toEqual([true, false]);
    expect(inlineText(paragraph(first(first(tasks.items).children)))).toBe('done');
  });

  it('parses inline marks, code, escapes and hard breaks', () => {
    const nodes = parseInline(
      '**bold** *em* ~~gone~~ `a*b` \\*lit\\* snake_case_name line  \nnext',
      0
    );
    expect(nodes.map((node) => node.type)).toEqual([
      'strong',
      'text',
      'em',
      'text',
      'del',
      'text',
      'code',
      'text',
      'break',
      'text',
    ]);
    expect(inlineText(nodes)).toBe('bold em gone a*b *lit* snake_case_name line\nnext');
  });

  it('keeps safe links and drops executable or protocol-relative ones', () => {
    const nodes = parseInline(
      '[docs](https://example.com/docs) [mail](mailto:team@example.com) [x](javascript:alert(1)) [y](//evil.example) <https://example.com/a>',
      0
    );
    const links = nodes.filter((node) => node.type === 'link');
    expect(links.map((link) => (link.type === 'link' ? link.href : null))).toEqual([
      'https://example.com/docs',
      'mailto:team@example.com',
      undefined,
      undefined,
      'https://example.com/a',
    ]);
  });

  it('never interprets HTML and never loads images', () => {
    const nodes = parseInline('<script>alert(1)</script> ![a cat](https://example.com/cat.png)', 0);
    expect(nodes).toEqual([{ type: 'text', text: '<script>alert(1)</script> a cat' }]);
  });

  it('caps nesting so hostile input stays flat and fast', () => {
    const quotes = parseMarkdown(`${'>'.repeat(200)} deep`);
    let depth = 0;
    let node: MdBlock | undefined = quotes.blocks[0];
    while (node?.type === 'quote') {
      depth += 1;
      node = node.children[0];
    }
    expect(depth).toBeLessThanOrEqual(5);

    const started = performance.now();
    parseMarkdown('*['.repeat(2_000));
    parseMarkdown('**a '.repeat(1_000));
    parseMarkdown(`${'['.repeat(1_000)}x${']('.repeat(1_000)}`);
    // Wall-clock bound only in the serialized perf run (pnpm test:perf): under the
    // full parallel suite on a loaded machine any fixed bound flakes.
    if (process.env.TEXULI_PERF === '1') expect(performance.now() - started).toBeLessThan(1_000);
    expect(inlineText(paragraph(first(parseMarkdown('a'.repeat(5_000)).blocks)))).toHaveLength(
      4_000
    );
  });
});

describe('checkTextBlock', () => {
  it('accepts every text family type', () => {
    const samples = [
      { type: 'heading', level: 2, text: 'Roadmap', eyebrow: 'Q3', subtitle: 'What ships next' },
      { type: 'text', markdown: 'Hello **world**.' },
      { type: 'list', ordered: true, items: [{ text: 'One' }, { text: 'Two' }] },
      { type: 'quote', quote: 'Ship small.', cite: 'Avery Example' },
      { type: 'callout', tone: 'warning', title: 'Heads up', body: 'Back up first.' },
    ];
    expect(samples.map((sample) => checkTextBlock(sample).ok)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(TEXT_BLOCK_TYPES).toEqual(['heading', 'text', 'list', 'quote', 'callout']);
  });

  it('rejects other families, bad shapes, bidi overrides and non-plain objects', () => {
    const rejected = [
      { type: 'divider' },
      { type: 'heading', level: 7, text: 'Too deep' },
      { type: 'text', markdown: '' },
      { type: 'text', markdown: `price ${RLO}0.01` },
      { type: 'list', items: [] },
      { type: 'quote', quote: 'x', cite: 'line\nbreak' },
      { type: 'callout', body: 'x', tone: 'neon' },
      { type: 'text', markdown: 'x'.repeat(4_001) },
      Object.assign(Object.create({ polluted: true }), { type: 'text', markdown: 'x' }),
      null,
      'text',
    ];
    for (const value of rejected) {
      const result = checkTextBlock(value);
      expect(result.ok, JSON.stringify(value)).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('TextBlockView', () => {
  it('renders a heading with its eyebrow, subtitle and id', () => {
    const { container } = render(TextBlockView, {
      block: {
        type: 'heading',
        id: 'roadmap',
        level: 3,
        text: 'Roadmap',
        eyebrow: 'Q3',
        subtitle: 'Next',
      },
    });
    const heading = container.querySelector('h3');
    expect(heading?.textContent).toBe('Roadmap');
    expect(heading?.id).toBe('roadmap');
    expect(container.querySelector('hgroup')?.textContent).toContain('Q3');
    expect(container.querySelector('hgroup')?.textContent).toContain('Next');
  });

  it('maps Markdown headings onto consecutive levels from headingBase', () => {
    const { container } = render(RichText, { source: '## Top\n\n#### Deeper\n\n## Again' });
    expect([...container.querySelectorAll('h3, h4, h5, h6')].map((h) => h.tagName)).toEqual([
      'H3',
      'H4',
      'H3',
    ]);
    const based = render(RichText, { source: '# A\n\n### B', headingBase: 2 });
    expect([...based.container.querySelectorAll('h2, h3, h4')].map((h) => h.tagName)).toEqual([
      'H2',
      'H3',
    ]);
  });

  it('renders rich text with relative headings, lists and safe links', () => {
    const { container } = render(TextBlockView, {
      block: {
        type: 'text',
        markdown: '# Inside\n\nRead [the docs](https://example.com/docs) and `npm`.\n\n- a\n- b',
      },
    });
    expect(container.querySelector('h3')?.textContent).toBe('Inside');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/docs');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link?.hasAttribute('target')).toBe(false);
    expect(container.querySelector('code')?.textContent).toBe('npm');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders lists, quotes and callouts with a visible tone label', () => {
    const list = render(TextBlockView, {
      block: { type: 'list', ordered: true, items: [{ text: '**One**' }, { text: 'Two' }] },
    });
    expect(list.container.querySelector('ol > li > strong')?.textContent).toBe('One');

    const quote = render(TextBlockView, {
      block: { type: 'quote', quote: 'Ship small.', cite: 'Avery Example' },
    });
    expect(quote.container.querySelector('figure blockquote')?.textContent).toContain(
      'Ship small.'
    );
    expect(quote.container.querySelector('figcaption cite')?.textContent).toBe('Avery Example');

    const callout = render(TextBlockView, {
      block: { type: 'callout', tone: 'danger', title: 'Careful', body: 'Back up first.' },
      labels: { tones: { danger: 'Peligro' } },
    });
    const note = callout.container.querySelector('[role="note"]');
    expect(note?.getAttribute('data-tone')).toBe('danger');
    expect(note?.textContent).toContain('Peligro');
    expect(note?.textContent).toContain('Careful');
  });

  it('renders hostile markup as inert text', () => {
    const { container } = render(TextBlockView, {
      block: {
        type: 'text',
        markdown:
          '<img src=x onerror=alert(1)> <script>alert(1)</script> [click](javascript:alert(1)) [data](data:text/html,hi)',
      },
    });
    expect(container.querySelector('script, img, iframe, [onerror]')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('shows a translatable notice and reports issues for invalid data', () => {
    const oninvalid = vi.fn();
    const { container } = render(TextBlockView, {
      block: { type: 'text', markdown: `bad ${RLO}` },
      labels: { invalid: 'Bloque no válido.' },
      oninvalid,
    });
    expect(container.querySelector('[data-tx-block="invalid"]')?.textContent).toBe(
      'Bloque no válido.'
    );
    expect(container.textContent).not.toContain('bad');
    expect(oninvalid).toHaveBeenCalledWith([expect.objectContaining({ path: ['markdown'] })]);
  });
});

describe('RichText and the lazy family', () => {
  it('unwraps a lone paragraph in compact mode', () => {
    const { container } = render(RichText, { source: 'just *this*', compact: true });
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('em')?.textContent).toBe('this');
  });

  it('labels task items and code fences', () => {
    const { container } = render(RichText, {
      source: '- [x] shipped\n\n```\ncode\n```',
      labels: resolveTextBlockLabels({ taskDone: 'Hecho', codeBlock: 'Código' }),
    });
    expect(container.querySelector('input[type="checkbox"]')?.getAttribute('aria-label')).toBe(
      'Hecho'
    );
    expect(container.querySelector('pre')?.getAttribute('aria-label')).toBe('Código');
    expect(container.querySelector('pre')?.getAttribute('tabindex')).toBe('0');
  });

  it('loads the renderer on demand', async () => {
    const family = await loadTextFamily();
    const { container } = render(family.default, { block: { type: 'text', markdown: 'Lazy.' } });
    expect(container.textContent).toContain('Lazy.');
  });
});

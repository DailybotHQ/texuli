import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import { contrastRatio, SEMANTIC_ROLES, tokenToCssVar } from '@texuli/tokens';
import { SYSTEM_TOKEN_NAMES } from '@texuli/tokens/system';
import { describe, expect, it, vi } from 'vitest';
import { stripLightMarkdown } from '../src/core/text.ts';
import { checkTextBlock, loadTextFamily, TEXT_BLOCK_TYPES } from '../src/index.ts';
import { resolveTextBlockLabels } from '../src/text/index.ts';
import {
  inlineText,
  MARKDOWN_LIMITS,
  type MdBlock,
  type MdInline,
  parseInline,
  parseMarkdown,
} from '../src/text/markdown.ts';
import { RichText, TextBlockView } from '../src/text/renderers.ts';
import Glyph from './fixtures/Glyph.svelte';

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
  it('splits paragraphs, headings, rules, quotes and code fences, and 5 related cases', () => {
    {
      // splits paragraphs, headings, rules, quotes and code fences
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
    }
    cleanup();
    {
      // parses bullet, ordered, nested and task lists
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
    }
    cleanup();
    {
      // parses inline marks, code, escapes and hard breaks
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
    }
    cleanup();
    {
      // keeps safe links and drops executable or protocol-relative ones
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
    }
    cleanup();
    {
      // never interprets HTML and never loads images
      const nodes = parseInline(
        '<script>alert(1)</script> ![a cat](https://example.com/cat.png)',
        0
      );
      expect(nodes).toEqual([{ type: 'text', text: '<script>alert(1)</script> a cat' }]);
    }
    cleanup();
    {
      // caps nesting so hostile input stays flat and fast
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
    }
  });
});

describe('parseMarkdown: no super-linear backtracking (ReDoS)', () => {
  const CAP = MARKDOWN_LIMITS.source;
  const spaces = (n: number) => ' '.repeat(n);
  /** One hostile source at the 4,000-character text cap per regex shape that backtracked. */
  const HOSTILE: readonly (readonly [string, string])[] = [
    ['heading: a space run before text', `# a${spaces(CAP - 4)}x`],
    ['heading: spaces and hashes', `# a${' #'.repeat((CAP - 4) / 2)}x`],
    ['fence: a space run in the info string', `${'`'.repeat(3)}${spaces(CAP - 4)}!`],
    ['bullet: a space run before U+2028', `- ${spaces(CAP - 3)}\u2028`],
    ['ordered: a space run before U+2029', `1. ${spaces(CAP - 4)}\u2029`],
    ['rule: spaced dashes before text', `- -${' -'.repeat((CAP - 4) / 2)}x`],
    ['hard break: a space run before a line break', `${spaces(CAP - 3)}x\ny`],
    ['hard breaks: many soft line breaks', `a${spaces(18)}b\n`.repeat(CAP / 20)],
    ['emphasis: unclosed stars', '*a '.repeat(CAP / 3)],
    ['emphasis: unclosed underscores', '_a '.repeat(CAP / 3)],
    ['strong: unclosed pairs', '**a '.repeat(CAP / 4)],
    ['strikethrough: unclosed pairs', '~~a '.repeat(CAP / 4)],
    ['links: a run of open brackets', '['.repeat(CAP)],
    ['images: unclosed image labels', '![a'.repeat(CAP / 3)],
  ];
  /** Fastest of three runs, so one scheduler pause on a loaded host cannot fail a linear parse. */
  const fastest = (run: () => void) => {
    let best = Number.POSITIVE_INFINITY;
    for (let k = 0; k < 3; k += 1) {
      const started = performance.now();
      run();
      best = Math.min(best, performance.now() - started);
    }
    return best;
  };

  // Before the line readers were written by hand, the first line took over 20 s
  // and the others 130–670 ms; now each parses in about a millisecond.
  it.each(HOSTILE)('parses %s well under 100 ms', (name, source) => {
    expect(source.length, name).toBeGreaterThanOrEqual(CAP - 1);
    expect(
      fastest(() => parseMarkdown(source)),
      name
    ).toBeLessThan(100);
    expect(
      fastest(() => stripLightMarkdown(source)),
      name
    ).toBeLessThan(100);
  });

  // The link target regex let `\(\s*`, `\s+"` and `\s*\)` compete for one
  // whitespace run: the first source took about 250 ms before the target was
  // read by hand.
  it.each([
    ['a space run before text', `[a](${spaces(CAP - 5)}x`],
    ['a space run before an open title', `[a](${spaces(CAP - 6)}"x`],
    ['an href, then a space run', `[a](b${spaces(CAP - 6)}x`],
  ])('reads a link target with %s under 20 ms', (name, source) => {
    expect(source.length, name).toBeGreaterThanOrEqual(CAP - 1);
    expect(
      fastest(() => parseMarkdown(source)),
      name
    ).toBeLessThan(20);
  });

  it('reads link targets: angle brackets, balanced parentheses and titles', () => {
    const href = (source: string) => {
      const block = parseMarkdown(source).blocks[0];
      const node = block?.type === 'paragraph' ? block.children[0] : undefined;
      return node?.type === 'link' ? `link ${node.href ?? '(none)'}` : node?.type;
    };
    const cases: readonly (readonly [string, string])[] = [
      ['[a](https://example.com)', 'link https://example.com'],
      ['[a](  <https://example.com/x>  "Title" )', 'link https://example.com/x'],
      ['[a](https://example.com/a_(b))', 'link https://example.com/a_(b)'],
      // A title alone is a link with an empty href, which the URL policy drops.
      ['[a](  "only a title")', 'link (none)'],
      ['[a](https://example.com "open title)', 'text'],
      ['[a](b c)', 'text'],
    ];
    expect(cases.map(([source]) => href(source))).toEqual(cases.map(([, expected]) => expected));
  });

  it('reads U+2028 and U+2029 as line breaks and keeps the heading grammar', () => {
    expect(
      parseMarkdown('# One\u2028## Two\u2029- item').blocks.map((block) => block.type)
    ).toEqual(['heading', 'heading', 'list']);
    const heading = (line: string) => {
      const block = parseMarkdown(line).blocks[0];
      return block?.type === 'heading' ? [block.level, inlineText(block.children)] : block?.type;
    };
    expect(heading('# Title ##  ')).toEqual([1, 'Title']);
    expect(heading('## Title#')).toEqual([2, 'Title']);
    expect(heading('   ###\tTabbed')).toEqual([3, 'Tabbed']);
    expect(heading('#Title')).toBe('paragraph');
    expect(heading('####### x')).toBe('paragraph');
    expect(heading('    # code-indented')).toBe('paragraph');
    expect(heading('```TS  ')).toBe('code');
    expect(parseMarkdown('```TS  \nx\n```').blocks[0]).toEqual({
      type: 'code',
      lang: 'ts',
      text: 'x',
    });
    expect(parseMarkdown('``` not a lang\nx').blocks[0]?.type).toBe('paragraph');
    expect(parseMarkdown('* * *').blocks[0]?.type).toBe('rule');
    expect(stripLightMarkdown('see [docs](https://example.com/a_(b)) now')).toBe('see docs now');
  });
});

describe('checkTextBlock', () => {
  it('accepts every text family type; rejects other families, bad shapes, bidi overrides and non-plain objects', () => {
    {
      // accepts every text family type
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
    }
    cleanup();
    {
      // rejects other families, bad shapes, bidi overrides and non-plain objects
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
    }
  });
});

describe('TextBlockView', () => {
  it('renders a heading with its eyebrow, subtitle and id, and 5 related cases', () => {
    {
      // renders a heading with its eyebrow, subtitle and id
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
    }
    cleanup();
    {
      // maps Markdown headings onto consecutive levels from headingBase
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
    }
    cleanup();
    {
      // renders rich text with relative headings, lists and safe links
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
    }
    cleanup();
    {
      // renders lists, quotes and callouts with a visible tone label
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
    }
    cleanup();
    {
      // renders hostile markup as inert text
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
    }
    cleanup();
    {
      // shows a translatable notice and reports issues for invalid data
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
    }
  });
});

describe('TextBlockView presentation fields', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  it('renders align, size, list markers, quote role and avatar, and callout icons', () => {
    const resolveAvatar = vi.fn((id: string) =>
      id === 'av-007' ? 'https://cdn.example.com/av-007.webp' : undefined
    );
    const cases: readonly {
      block: Record<string, unknown>;
      props?: Record<string, unknown>;
      check: (root: HTMLElement) => void;
    }[] = [
      {
        block: { type: 'heading', level: 2, text: 'Plan', align: 'center' },
        check: (root) => expect(root.querySelector('hgroup')?.dataset.align).toBe('center'),
      },
      {
        block: { type: 'text', markdown: 'Body', size: 'sm', align: 'center' },
        check: (root) => {
          const text = root.querySelector<HTMLElement>('[data-tx-block="text"]');
          expect([text?.dataset.size, text?.dataset.align]).toEqual(['sm', 'center']);
        },
      },
      {
        block: {
          type: 'list',
          style: 'check',
          items: [{ text: 'Ship', done: true }, { text: 'Measure' }],
        },
        check: (root) => {
          expect(root.querySelector('ul')?.dataset.style).toBe('check');
          const boxes = [...root.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]')];
          expect(
            boxes.map((box) => [box.checked, box.disabled, box.getAttribute('aria-label')])
          ).toEqual([
            [true, true, 'Done'],
            [false, true, 'Not done'],
          ]);
        },
      },
      {
        block: { type: 'list', style: 'number', items: [{ text: 'One' }, { text: 'Two' }] },
        check: (root) => expect(root.querySelectorAll('ol > li')).toHaveLength(2),
      },
      {
        block: {
          type: 'list',
          style: 'icon',
          items: [
            { text: 'Built in', icon: 'check' },
            { text: 'Host icon', icon: 'rocket' },
            { text: 'Unknown', icon: 'no-such-icon' },
          ],
        },
        props: { resolveIcon: (name: string) => (name === 'rocket' ? Glyph : undefined) },
        check: (root) => {
          const icons = [...root.querySelectorAll<HTMLElement>('li .tx-block-icon')];
          expect(icons.map((icon) => icon.dataset.icon)).toEqual(['check', 'rocket']);
          for (const icon of icons) expect(icon.getAttribute('aria-hidden')).toBe('true');
          expect(root.querySelector('[data-glyph="rocket"]')).not.toBeNull();
        },
      },
      {
        block: { type: 'quote', quote: 'Q', cite: 'Ada', role: 'CTO', avatar: 'avatar:av-007' },
        props: { resolveAvatar },
        check: (root) => {
          expect(root.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'Ada, CTO'
          );
          const img = root.querySelector('figcaption img');
          expect(img?.getAttribute('src')).toBe('https://cdn.example.com/av-007.webp');
          expect(img?.getAttribute('alt')).toBe('');
          expect(resolveAvatar).toHaveBeenCalledWith('av-007');
        },
      },
      {
        block: { type: 'quote', quote: 'Q', role: 'Founder', avatar: PNG },
        check: (root) => {
          expect(root.querySelector('figcaption img')?.getAttribute('src')).toBe(PNG);
          expect(root.querySelector('cite')).toBeNull();
        },
      },
      {
        // The host resolver is the only way to a remote image, and its URL still passes the policy.
        block: { type: 'quote', quote: 'Q', avatar: 'avatar:av-008' },
        props: { resolveAvatar: () => 'javascript:alert(1)' },
        check: (root) => expect(root.querySelector('img')).toBeNull(),
      },
      {
        block: { type: 'callout', title: 'Heads up', body: 'B', icon: 'info', tone: 'info' },
        check: (root) =>
          expect(
            root.querySelector('.tx-callout-head .tx-block-icon')?.getAttribute('data-icon')
          ).toBe('info'),
      },
    ];
    for (const { block, props, check } of cases) {
      const { container } = render(TextBlockView, { block, ...props });
      expect(
        container.querySelector('[data-tx-block="invalid"]'),
        JSON.stringify(block)
      ).toBeNull();
      check(container);
      cleanup();
    }
  });
});

describe('RichText and the lazy family', () => {
  it('unwraps a lone paragraph in compact mode; labels task items and code fences; loads the renderer on demand', async () => {
    {
      // unwraps a lone paragraph in compact mode
      const { container } = render(RichText, { source: 'just *this*', compact: true });
      expect(container.querySelector('p')).toBeNull();
      expect(container.querySelector('em')?.textContent).toBe('this');
    }
    cleanup();
    {
      // labels task items and code fences
      const { container } = render(RichText, {
        source: '- [x] shipped\n\n```\ncode\n```',
        labels: resolveTextBlockLabels({ taskDone: 'Hecho', codeBlock: 'Código' }),
      });
      expect(container.querySelector('input[type="checkbox"]')?.getAttribute('aria-label')).toBe(
        'Hecho'
      );
      expect(container.querySelector('pre')?.getAttribute('aria-label')).toBe('Código');
      expect(container.querySelector('pre')?.getAttribute('tabindex')).toBe('0');
    }
    cleanup();
    // loads the renderer on demand
    await (async () => {
      const family = await loadTextFamily();
      const { container } = render(family.default, { block: { type: 'text', markdown: 'Lazy.' } });
      expect(container.textContent).toContain('Lazy.');
    })();
  });
});

describe('text family styles use the token contract', () => {
  const styleSource = (name: string) =>
    readFileSync(join(import.meta.dirname, '..', 'src', name), 'utf8');
  const styled = ['text/TextBlockView.svelte', 'text/RichText.svelte'];
  /** Every rule of one top-level selector (`  .tx-callout { … }`). */
  const rulesOf = (text: string, selector: string) =>
    [...text.matchAll(new RegExp(`^  ${selector} \\{[^}]*\\}`, 'gm'))].map((match) => match[0]);
  it('never references a phantom --tx-color-* token (themes emit --tx-<role>), and 5 related cases', () => {
    // never references a phantom --tx-color-* token (themes emit --tx-<role>)
    for (const source of [...styled, 'code/code.css']) {
      expect(styleSource(source), source).not.toMatch(/--tx-color-/);
    }
    cleanup();
    {
      // resolves every var(--tx-…) to a semantic role, a design token, or a local definition
      const roles = new Set(SEMANTIC_ROLES.map((role) => tokenToCssVar(role)));
      // Design (non-color) tokens this lane reads (STYLE_VARIABLES in
      // packages/tokens/src/css/apply.ts, plus the tailwind preset's target size);
      // every color comes from a semantic role.
      const designTokens = new Set([
        '--tx-font-mono',
        '--tx-font-sans',
        '--tx-radius',
        '--tx-border-width',
        '--tx-font-size-xs',
        '--tx-font-size-sm',
        '--tx-font-weight-medium',
        '--tx-font-weight-bold',
        '--tx-focus-ring-width',
        '--tx-target-size',
        // Token contract v2 system tokens (base.css declares them).
        ...SYSTEM_TOKEN_NAMES,
      ]);
      for (const source of [...styled, 'code/code.css']) {
        const text = styleSource(source);
        const local = new Set(
          [...text.matchAll(/--(tx-[a-z0-9-]+)\s*:/g)].map((match) => `--${match[1]}`)
        );
        for (const match of text.matchAll(/var\((--tx-[a-z0-9-]+)/g)) {
          const token = match[1] ?? '';
          const known = roles.has(token) || designTokens.has(token) || local.has(token);
          expect(known, `${source}: ${token} is not a token the themes emit`).toBe(true);
        }
      }
    }
    cleanup();
    {
      // draws each tone from its contract role with a >=3:1 fallback on light and dark surfaces
      const view = styleSource('text/TextBlockView.svelte');
      const roles: Record<string, string> = {
        accent: '--tx-primary',
        info: '--tx-info',
        success: '--tx-success',
        warning: '--tx-warning',
        danger: '--tx-destructive',
      };
      for (const [tone, role] of Object.entries(roles)) {
        const rule = new RegExp(`\\[data-tone='${tone}'\\]\\s*\\{[^}]*\\}`).exec(view)?.[0] ?? '';
        expect(rule, `tone ${tone} must draw from ${role}`).toContain(`var(${role}`);
        const fallback = new RegExp(`var\\(${role},\\s*(#[0-9a-fA-F]{3,8})\\)`).exec(rule)?.[1];
        // Border/tint color (non-text): the docs promise >=3:1 against white and #121212.
        expect(fallback, `tone ${tone} keeps a hex fallback`).toBeTruthy();
        expect(contrastRatio(fallback ?? '', '#ffffff')).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(fallback ?? '', '#121212')).toBeGreaterThanOrEqual(3);
      }
    }
    cleanup();
    {
      // uses paired semantic soft fills for callouts instead of near-transparent tone mixes
      const view = styleSource('text/TextBlockView.svelte');
      const fills: Record<string, string> = {
        accent: '--tx-primary-soft',
        info: '--tx-info-soft',
        success: '--tx-success-soft',
        warning: '--tx-warning-soft',
        danger: '--tx-destructive-soft',
      };
      const foregrounds: Record<string, string> = {
        accent: '--tx-primary-soft-foreground',
        info: '--tx-info-soft-foreground',
        success: '--tx-success-soft-foreground',
        warning: '--tx-warning-soft-foreground',
        danger: '--tx-destructive-soft-foreground',
      };
      for (const [tone, fill] of Object.entries(fills)) {
        const rule = new RegExp(`\\[data-tone='${tone}'\\]\\s*\\{[^}]*\\}`).exec(view)?.[0] ?? '';
        expect(rule, `${tone} maps to its semantic soft fill`).toContain(`var(${fill}`);
        expect(rule, `${tone} maps to its paired soft foreground`).toContain(
          `var(${foregrounds[tone]}`
        );
      }
      expect(rulesOf(view, '\\.tx-callout')[0]).not.toContain('color-mix(');
    }
    cleanup();
    {
      // draws the accent tone with the primary role, never the soft accent fill
      // `--tx-accent` is a soft fill in the token contract (light in light mode),
      // so as a border or rule color it is near-invisible on the page canvas.
      const view = styleSource('text/TextBlockView.svelte');
      const rule = /\[data-tone='accent'\]\s*\{[^}]*\}/.exec(view)?.[0] ?? '';
      expect(rule).toMatch(/--tx-block-tone:\s*var\(--tx-primary\b/);
      expect(rule).not.toContain('var(--tx-accent');
    }
    cleanup();
    // takes surface radii from the theme radius token like the code family does
    for (const [source, selector] of [
      ['text/TextBlockView.svelte', '\\.tx-callout'],
      ['text/TextBlockView.svelte', '\\.tx-block-invalid'],
      ['text/RichText.svelte', '\\.tx-md-pre'],
      ['text/RichText.svelte', '\\.tx-md-code'],
      ['code/code.css', '\\.tx-block-invalid'],
    ] as const) {
      const rules = rulesOf(styleSource(source), selector);
      expect(rules.length, `${source}: ${selector}`).toBeGreaterThan(0);
      expect(
        // --tx-shape-radius-* derive from the theme's --tx-radius (token contract v2).
        rules.some((rule) => /var\(--tx-(shape-)?radius/u.test(rule)),
        `${source}: ${selector} must take its radius from the theme radius`
      ).toBe(true);
    }
  });
});

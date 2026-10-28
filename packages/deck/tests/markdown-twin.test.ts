// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deckOutline,
  deckToMarkdown,
  deckToText,
  formatDeckOutline,
  parseDeckMarkdown,
  slideTitle,
} from '../src/markdown/index.ts';
import { isSafeLinkTarget, jsonEqual, neutralizeLinks } from '../src/markdown/text.ts';
import { type Deck, migrateDeck, parseDeck } from '../src/model/index.ts';
import createAnything from './fixtures/migrate/protoyard-create-anything.json';

function valid(input: unknown): Deck {
  const result = parseDeck(input);
  expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  return result.deck as Deck;
}

const deck = valid({
  formatVersion: 2,
  meta: { title: 'Launch review' },
  outline: { sections: [{ id: 'intro', title: 'Intro', slideIds: ['cover', 'why'] }] },
  slides: [
    {
      id: 'cover',
      layout: 'title-hero',
      props: { title: 'Launch *review*', subtitle: 'Q3 <b>results</b>' },
      notes: 'Welcome everyone.',
    },
    {
      id: 'why',
      layout: 'quote',
      props: { quote: 'Small pieces. Infinite possibilities.', cite: 'Texuli' },
    },
    {
      id: 'details',
      layout: 'free',
      blocks: [
        { type: 'heading', level: 2, text: 'Details' },
        { type: 'text', markdown: 'Click <a href="javascript:x">here</a>.' },
        { type: 'list', items: [{ text: 'One' }, { text: 'Two' }], ordered: true },
        { type: 'math', tex: '\\frac{1}{2}' },
        { type: 'component', component: 'data-board', props: { title: 'Board' } },
        { type: 'callout', title: 'Note', body: 'Fictional data.' },
      ],
    },
    { id: 'secret', layout: 'section-divider', hidden: true, props: { title: 'Hidden' } },
  ],
});

describe('deck text twins', () => {
  it('deckToText is readable, inert and deterministic', () => {
    const text = deckToText(deck);
    expect(text).toBe(deckToText(deck));
    expect(text).toContain('# Launch review');
    expect(text).toContain('## Intro');
    expect(text).toContain('### 1. Launch \\*review\\*');
    expect(text).toContain('Q3 \\<b\\>results\\</b\\>');
    expect(text).toContain('Click \\<a href="javascript:x">here\\</a>.');
    expect(text).toContain('*Formula: 12*');
    expect(text).toContain('*Component `data-board`*');
    expect(text).toContain('#### Notes\n\nWelcome everyone.');
    expect(text).not.toContain('Hidden');
    expect(text).not.toMatch(/(?<!\\)<[a-z]/);
    expect(deckToText(deck, { includeHidden: true, notes: false })).toContain('Hidden');
    expect(deckToText(deck, { notes: false })).not.toContain('Welcome everyone');
  });

  it('deckOutline lists every slide with its layout, title and section', () => {
    const outline = deckOutline(deck);
    expect(
      outline.slides.map((slide) => [
        slide.id,
        slide.layout,
        slide.title,
        slide.section,
        slide.hidden,
      ])
    ).toEqual([
      ['cover', 'title-hero', 'Launch *review*', 'intro', false],
      ['why', 'quote', 'Small pieces. Infinite possibilities.', 'intro', false],
      ['details', 'free', 'Details', null, false],
      ['secret', 'section-divider', 'Hidden', null, true],
    ]);
    expect(formatDeckOutline(outline).split('\n')[3]).toBe(
      '4. secret · section-divider · Hidden (hidden)'
    );
    expect(slideTitle(deck.slides[2] as Deck['slides'][number])).toBe('Details');
  });

  it('neutralizeLinks keeps safe links and drops every other target, keeping the label', () => {
    const kept = [
      '[a](https://example.com/x?q=1#f)',
      '[a](http://example.com)',
      '[a](MAILTO:team@example.com)',
      '[a](#top)',
      '[a](#/intro/2)',
      '[a](docs/guide.md)',
      '[a](./x?y=a:b)',
      '[a]()',
      '![alt](img/cat.png "A cat")',
      '[ref]: https://example.com',
      'plain [brackets] and (parens)',
    ];
    for (const text of kept) expect(neutralizeLinks(text), text).toBe(text);
    const cases: [string, string][] = [
      ['See [docs](javascript:alert(1)) now', 'See docs now'],
      ['[a](JavaScript:alert(1) "title (x)")!', 'a!'],
      ['[a]( <javascript:x> )', 'a'],
      ['[a](\n  vbscript:x)', 'a'],
      ['![alt](data:text/html,hi)', 'alt'],
      ['[a](java&#115;cript:x)', 'a'],
      ['[a](javascript&#58;x)', 'a'],
      ['[a](java\u200bscript:x)', 'a'],
      ['[a](//evil.example)', 'a'],
      ['[a](file:///etc/passwd)', 'a'],
      ['[outer [inner](javascript:x) text](javascript:y)', 'outer inner text'],
      ['[ref]: javascript:x', '[ref\\]: javascript:x'],
      ['> [ref]:\n> data:text/html,x', '> [ref\\]:\n> data:text/html,x'],
      ['[a](javascript:x "open', '[a]\\(javascript:x "open'],
      // No opener (escaped or inside code): no link, and the URL still goes.
      ['\\[a](javascript:x) b', '\\[a b'],
    ];
    for (const [input, output] of cases) expect(neutralizeLinks(input), input).toBe(output);
    for (const url of ['javascript:x', ' javascript:x', 'data:x', 'blob:x', 'a\\:b'])
      expect(isSafeLinkTarget(url), url).toBe(false);
    // Linear: hostile runs of every lookahead finish quickly.
    const hostile = [
      `${'[a]('.repeat(50_000)}javascript:x`,
      '[a](javascript:x "'.repeat(20_000),
      '[a](<javascript:x '.repeat(20_000),
      `](${'a'.repeat(50)}`.repeat(5_000),
      '[r]:'.repeat(50_000),
      `${'['.repeat(100_000)}${']('.repeat(50_000)}`,
    ];
    for (const text of hostile) {
      const started = performance.now();
      neutralizeLinks(text);
      expect(performance.now() - started, text.slice(0, 20)).toBeLessThan(1500);
    }
  });

  it('text twins drop unsafe link targets from author Markdown and keep the label', () => {
    const hostile = valid({
      formatVersion: 2,
      meta: { title: 'Links' },
      slides: [
        {
          id: 'links',
          layout: 'free',
          title: 'Read [this](javascript:alert(1))',
          blocks: [
            {
              type: 'text',
              markdown: 'See [docs](javascript:alert(1)) and [ok](https://example.com).',
            },
            {
              type: 'list',
              items: [{ text: '[x](data:text/html,hi)' }, { text: '[y](#/links/1)' }],
            },
            { type: 'quote', quote: 'Go [there](vbscript:msgbox)' },
            { type: 'callout', title: 'Note', body: '[ref]: javascript:x\n\nUse [ref].' },
          ],
          notes: 'Open [n](javascript:y) after.',
        },
      ],
    });
    const text = deckToText(hostile);
    expect(text).toContain('See docs and [ok](https://example.com).');
    expect(text).toContain('- x\n- [y](#/links/1)');
    expect(text).toContain('> Go there');
    expect(text).toContain('> [ref\\]: javascript:x');
    expect(text).toContain('## 1. Read \\[this\\](javascript:alert(1))'); // escaped: plain text
    expect(text).not.toMatch(/(?<!\\)\]\((?:javascript|data|vbscript):/i);
    const outline = deckOutline(hostile);
    expect(outline.slides[0]?.title).toBe('Read this');
    expect(formatDeckOutline(outline)).toBe('1. links · free · Read this');

    // The canonical writer never writes a live unsafe link: blocks and slides
    // whose Markdown would carry one become exact JSON fences, and the deck
    // still round-trips.
    const markdown = deckToMarkdown(hostile);
    expect(markdown).not.toMatch(/^(?!\s*").*(?<!\\)\]\((?:javascript|data|vbscript):/im);
    expect(markdown).not.toContain('Note: Open [n](javascript:y)');
    const back = parseDeckMarkdown(markdown);
    expect(back.ok).toBe(true);
    expect(jsonEqual(back.deck, hostile)).toBe(true);
  });

  it('covers a migrated Protoyard flagship deck', () => {
    const input = structuredClone(createAnything);
    const flagship = valid(migrateDeck(input).deck);
    const text = deckToText(flagship);
    expect(text.split('\n').filter((line) => /^#{2,3} \d+\. /.test(line))).toHaveLength(
      flagship.slides.filter((slide) => !slide.hidden).length
    );
    expect(deckOutline(flagship).slides).toHaveLength(flagship.slides.length);
  });
});

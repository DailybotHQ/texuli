// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fromMarkdown, MARKDOWN_CODEC_LIMITS, toMarkdown } from '../src/editor/markdown.ts';
import {
  createInlineExtensions,
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorDocument,
  editorLeaves,
  editorPlainText,
  extensionHref,
  inheritedMarks,
  inlineFromTree,
  inlineToTree,
  loadEditorDocument,
  sortMarks,
  validateEditorDocument,
} from '../src/editor/model.ts';

/** A document without its runtime ids, for comparisons. */
function shape(doc: EditorDocument): unknown {
  const strip = (blocks: readonly EditorBlock[]): unknown =>
    blocks.map((block) => {
      const { id: _id, ...rest } = block as EditorBlock & Record<string, unknown>;
      if (block.type === 'quote') return { ...rest, blocks: strip(block.blocks) };
      if (block.type === 'list')
        return {
          ...rest,
          items: block.items.map(({ id: _i, ...item }) => ({
            ...item,
            blocks: strip(item.blocks),
          })),
        };
      return rest;
    });
  return strip(doc.blocks);
}

const read = (source: string) => fromMarkdown(source).doc;

describe('reading Markdown', () => {
  it('reads every block of the subset, and 3 related cases', () => {
    {
      // reads every block of the subset
      const doc = read(
        [
          '# Title',
          '',
          'Text with **strong**, *em*, ~~strike~~, `code` and [a link](https://example.com).',
          '',
          '- one',
          '- [two](https://example.com/2)',
          '    - nested',
          '',
          '3. third',
          '4. fourth',
          '',
          '- [x] done',
          '- [ ] open',
          '',
          '> quoted',
          '',
          '```ts',
          'const x = 1;',
          '```',
          '',
          '---',
          '',
          '![A chart](asset-7)',
        ].join('\n')
      );
      expect(validateEditorDocument(doc)).toEqual([]);
      expect(doc.blocks.map((b) => b.type)).toEqual([
        'heading',
        'paragraph',
        'list',
        'list',
        'list',
        'quote',
        'code',
        'divider',
        'media',
      ]);
      expect(doc.blocks[3]).toMatchObject({ kind: 'ordered', start: 3 });
      expect(doc.blocks[4]).toMatchObject({
        kind: 'todo',
        items: [{ checked: true }, { checked: false }],
      });
      expect(doc.blocks[6]).toMatchObject({ lang: 'ts', text: 'const x = 1;' });
      expect(doc.blocks[8]).toMatchObject({ ref: 'asset-7', alt: 'A chart' });
      const marks = (doc.blocks[1] as Extract<EditorBlock, { type: 'paragraph' }>).content.flatMap(
        (n) => (n.type === 'text' ? n.marks.map((m) => m.type) : [])
      );
      expect(marks).toEqual(['strong', 'em', 'strike', 'code', 'link']);
    }
    {
      // keeps raw HTML as literal text and refuses executable links
      const { doc, diagnostics } = fromMarkdown(
        '<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>'
      );
      expect(editorPlainText(doc)).toBe('<script>alert(1)</script> x <img src=x onerror=alert(1)>');
      expect(JSON.stringify(doc)).not.toContain('javascript');
      expect(diagnostics.map((d) => d.code)).toEqual(['link-rejected']);
    }
    {
      // reads link targets: angle brackets, balanced parentheses, titles and whitespace
      const hrefs = (source: string) =>
        (fromMarkdown(source).doc.blocks[0] as Extract<EditorBlock, { type: 'paragraph' }>).content
          .flatMap((n) => (n.type === 'text' ? n.marks : []))
          .flatMap((m) => (m.type === 'link' ? [m.href] : []));
      expect(hrefs('[a](  <https://example.com/x>  "Title" )')).toEqual(['https://example.com/x']);
      expect(hrefs('[a](https://example.com/a_(b))')).toEqual(['https://example.com/a_(b)']);
      expect(hrefs('[a](https://example.com "open title)')).toEqual([]);
      expect(hrefs('[a](b c)')).toEqual([]);
    }
    {
      // reads images inside text as their alt text, hard breaks as breaks, soft breaks as spaces
      const doc = read('see ![alt text](https://example.com/i.png) here  \nnext\\\nlast\nsoft');
      expect(doc.blocks[0]).toMatchObject({
        type: 'paragraph',
        content: [
          { text: 'see alt text here' },
          { type: 'break' },
          { text: 'next' },
          { type: 'break' },
          { text: 'last soft' },
        ],
      });
    }
    {
      // clamps deep headings and caps nesting
      const { doc, diagnostics } = fromMarkdown(`###### Deep\n\n${'>'.repeat(50)} core`);
      expect(doc.blocks[0]).toMatchObject({ type: 'heading', level: 4 });
      expect(Math.max(...editorLeaves(doc).map((l) => l.depth))).toBeLessThanOrEqual(
        EDITOR_LIMITS.depth
      );
      expect(diagnostics.map((d) => d.code)).toEqual(['heading-clamped', 'depth-capped']);
    }
  });

  it('bounds hostile input in size and time', () => {
    const big = fromMarkdown('x'.repeat(MARKDOWN_CODEC_LIMITS.source + 10));
    expect(big.diagnostics[0]?.code).toBe('text-truncated');
    const smaller = fromMarkdown('abcdef', { maxSource: 3 });
    expect(editorPlainText(smaller.doc)).toBe('abc');
    for (const unit of ['*a ', '_a ', '**a ', '[a', '`a ', '~~a ']) {
      const started = performance.now();
      const { doc } = fromMarkdown(
        unit.repeat(Math.floor(MARKDOWN_CODEC_LIMITS.source / unit.length))
      );
      expect(performance.now() - started).toBeLessThan(3_000);
      expect(validateEditorDocument(doc)).toEqual([]);
    }
    {
      // The link target regex let `\(\s*`, `\s+"` and `\s*\)` compete for one
      // whitespace run: 47 such links at the source cap took about 3 s before
      // the target was read by hand. Fastest of three, for a loaded host.
      const unit = `[a](${' '.repeat(2_096)}x\n\n`;
      const source = unit.repeat(Math.floor(MARKDOWN_CODEC_LIMITS.source / unit.length));
      expect(source.length).toBeGreaterThan(MARKDOWN_CODEC_LIMITS.source - unit.length);
      let best = Number.POSITIVE_INFINITY;
      for (let k = 0; k < 3; k += 1) {
        const started = performance.now();
        fromMarkdown(source);
        best = Math.min(best, performance.now() - started);
      }
      expect(best).toBeLessThan(200);
    }
    const blocks = fromMarkdown('p\n\n'.repeat(5_000));
    expect(blocks.doc.blocks.length).toBeLessThanOrEqual(EDITOR_LIMITS.blocks);
    expect(blocks.diagnostics.map((d) => d.code)).toContain('blocks-capped');
  }, 30_000);

  it('reads long plain paragraphs in linear time', () => {
    // A long paragraph read slower than linear: every soft line break read
    // the end of the text being built, which flattened the whole string
    // (101 ms at 100,000 characters and 3.7 s at 400,000 before the fix), and
    // the mark pass made one object per character. Compared at N and 4N with
    // the caps raised.
    const limits = { maxSource: 400_000, limits: { chars: 400_000 } };
    const time = (source: string) => {
      const started = performance.now();
      fromMarkdown(source, limits);
      return performance.now() - started;
    };
    const shapes = {
      'soft line breaks': (n: number) => 'ab\n'.repeat(Math.floor(n / 3)),
      'one long word': (n: number) => 'x'.repeat(n),
      'words and breaks': (n: number) => 'one two\nthree '.repeat(Math.floor(n / 14)),
    };
    for (const [name, make] of Object.entries(shapes)) {
      const read = fromMarkdown(make(400_000), limits);
      expect(editorPlainText(read.doc).length, name).toBeGreaterThan(390_000);
      // Interleaved fastest-of-seven, so a load spike hits both sizes alike.
      // Linear growth is 4x and the old quadratic paths were 16x or more
      // (3.7 s at 400,000); a 10x ratio with a 150 ms floor separates them
      // on a loaded host without flaking on sub-millisecond noise.
      const small = make(100_000);
      const large = make(400_000);
      let bestSmall = Number.POSITIVE_INFINITY;
      let bestLarge = Number.POSITIVE_INFINITY;
      for (let k = 0; k < 7; k += 1) {
        bestSmall = Math.min(bestSmall, time(small));
        bestLarge = Math.min(bestLarge, time(large));
      }
      expect(
        bestLarge,
        `${name}: ${bestSmall.toFixed(1)} ms -> ${bestLarge.toFixed(1)} ms`
      ).toBeLessThan(Math.max(10 * bestSmall, 150));
    }
  }, 60_000);
});

describe('writing Markdown', () => {
  const source = [
    '# Title with a `#`',
    '',
    'A **strong *mixed* run**, ~~gone~~ and [**bold link**](https://example.com/a%20b).',
    '',
    'Escapes: \\*not em\\*, \\_x\\_, 1\\. not a list, \\[not a link\\], back\\\\slash',
    '',
    '1. first',
    '2. second',
    '',
    '    continued',
    '',
    '    - nested',
    '',
    '- [x] done',
    '',
    '> quote',
    '>',
    '> - in a quote',
    '',
    '````md',
    '```',
    'inner fence',
    '```',
    '````',
    '',
    '---',
  ].join('\n');
  it('round-trips a document exactly; escapes line starts that would open another block; spells adjacent marks so they read back the same', () => {
    {
      // round-trips a document exactly
      const doc = read(source);
      const written = toMarkdown(doc);
      expect(shape(read(written))).toEqual(shape(doc));
      expect(toMarkdown(read(written))).toBe(written);
    }
    {
      // escapes line starts that would open another block
      const doc: EditorDocument = {
        version: 1,
        blocks: ['# no', '- no', '> no', '1. no', '```', '---', '+ no'].map((text, i) => ({
          id: `p${i}`,
          type: 'paragraph',
          content: [{ type: 'text', text, marks: [] }],
        })),
      };
      const back = read(toMarkdown(doc));
      expect(back.blocks.every((b) => b.type === 'paragraph')).toBe(true);
      expect(editorPlainText(back)).toBe(editorPlainText(doc));
    }
    {
      // spells adjacent marks so they read back the same
      const doc: EditorDocument = {
        version: 1,
        blocks: [
          {
            id: 'p',
            type: 'paragraph',
            content: [
              { type: 'text', text: 'both', marks: [{ type: 'strong' }, { type: 'em' }] },
              { type: 'text', text: 'em', marks: [{ type: 'em' }] },
              { type: 'text', text: 'strong', marks: [{ type: 'strong' }] },
              { type: 'text', text: ' tick`s ', marks: [{ type: 'code' }] },
            ],
          },
        ],
      };
      expect(shape(read(toMarkdown(doc)))).toEqual(shape(doc));
    }
  });
});

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('round-trip property', () => {
  const PIECES = [
    'word',
    'other',
    ' ',
    ' ',
    '  ',
    '*',
    '**',
    '_',
    '__',
    '~~',
    '`',
    '``',
    '[',
    ']',
    '(',
    ')',
    '](https://example.com)',
    '\\',
    '#',
    '# ',
    '> ',
    '- ',
    '1. ',
    '[ ] ',
    '[x] ',
    '    ',
    '\n',
    '\n',
    '\n\n',
    '  \n',
    '\\\n',
    '<',
    '>',
    '<https://example.com>',
    '![',
    'é',
    '👍',
    '---',
    '```',
    '!',
    '.',
    'javascript:x',
    '|',
    '{',
    '}',
  ];
  const inputs = (() => {
    const random = rng(8);
    return Array.from({ length: 2_000 }, () => {
      const length = 1 + Math.floor(random() * 40);
      let input = '';
      for (let i = 0; i < length; i += 1) input += PIECES[Math.floor(random() * PIECES.length)];
      return input;
    });
  })();
  const same = (a: EditorDocument, b: EditorDocument) =>
    JSON.stringify(shape(a)) === JSON.stringify(shape(b));
  it('writing is stable: what was written reads and writes back unchanged (2,000 seeded inputs), and 1 related cases', () => {
    // writing is stable: what was written reads and writes back unchanged (2,000 seeded inputs)
    for (const input of inputs) {
      const written = toMarkdown(read(input));
      const again = toMarkdown(read(written));
      if (again !== written || !same(read(again), read(written))) {
        throw new Error(
          `input ${JSON.stringify(input)}\nwritten ${JSON.stringify(written)}\nagain ${JSON.stringify(again)}`
        );
      }
    }
    {
      // reading what was written gives the same document, except for spans the subset cannot spell
      const lossy = inputs.filter((input) => {
        const once = read(input);
        return !same(read(toMarkdown(once)), once);
      });
      // Measured with seed 8; any growth means the writer lost fidelity.
      expect(lossy.length).toBeLessThanOrEqual(LOSSY_BUDGET);
    }
  }, 30_000);
});

/**
 * Inputs (of 2,000) whose first reading the subset cannot spell exactly. All
 * five are an em mark on a lone `*` or `_` (`****` reads as `*` then em `*`):
 * the escaped delimiter next to the closer reads back as literal text.
 */
const LOSSY_BUDGET = 5;

describe('host inline extensions (G48)', () => {
  const extensions = createInlineExtensions([
    { name: 'mention', sigil: '@', href: (id) => `https://example.com/people/${id}` },
    { name: 'reference', sigil: '#', accepts: (id) => id.startsWith('rec-') },
  ]);
  const runs = (doc: EditorDocument) =>
    (doc.blocks[0] as Extract<EditorBlock, { type: 'paragraph' }>).content;

  it('reads, writes and round trips mentions and references with their entity id', () => {
    const source = 'Ask @{person-1|Ada} about #{rec-7|Roadmap} and **@{person-2|Bob}**.';
    const { doc, diagnostics } = fromMarkdown(source, { extensions });
    expect(diagnostics).toEqual([]);
    expect(validateEditorDocument(doc)).toEqual([]);
    expect(runs(doc)).toEqual([
      { type: 'text', text: 'Ask ', marks: [] },
      {
        type: 'text',
        text: 'Ada',
        marks: [{ type: 'extension', name: 'mention', id: 'person-1' }],
      },
      { type: 'text', text: ' about ', marks: [] },
      {
        type: 'text',
        text: 'Roadmap',
        marks: [{ type: 'extension', name: 'reference', id: 'rec-7' }],
      },
      { type: 'text', text: ' and ', marks: [] },
      {
        type: 'text',
        text: 'Bob',
        marks: [{ type: 'strong' }, { type: 'extension', name: 'mention', id: 'person-2' }],
      },
      { type: 'text', text: '.', marks: [] },
    ]);
    const written = toMarkdown(doc, { extensions });
    expect(written).toBe(source);
    expect(shape(fromMarkdown(written, { extensions }).doc)).toEqual(shape(doc));
    // Labels with delimiters, escapes and Markdown characters survive.
    for (const label of ['a}b', 'x|y', 'back\\slash', '*not em*', '[no](link)', '@{inner|x}']) {
      const once = fromMarkdown(`@{person-1|${label.replace(/[\\{}*[\]]/g, '\\$&')}}`, {
        extensions,
      }).doc;
      expect(runs(once), label).toEqual([
        {
          type: 'text',
          text: label,
          marks: [{ type: 'extension', name: 'mention', id: 'person-1' }],
        },
      ]);
      expect(shape(fromMarkdown(toMarkdown(once, { extensions }), { extensions }).doc)).toEqual(
        shape(once)
      );
    }
    // In lists, quotes and headings too.
    const nested = fromMarkdown('# Hi @{p1|Ada}\n\n> - [x] #{rec-1|Plan}', { extensions }).doc;
    expect(shape(fromMarkdown(toMarkdown(nested, { extensions }), { extensions }).doc)).toEqual(
      shape(nested)
    );
  });

  it('keeps unregistered or refused tokens as literal text, and plain text never becomes a token', () => {
    // Without extensions the grammar is plain text, as before.
    expect(editorPlainText(fromMarkdown('@{person-1|Ada}').doc)).toBe('@{person-1|Ada}');
    // A refused id (host check, charset, length), an empty label, a newline
    // inside or an unknown sigil stay literal.
    for (const source of [
      '#{doc-7|Roadmap}',
      '@{bad id|Ada}',
      `@{${'x'.repeat(129)}|Ada}`,
      '@{p1|}',
      '@{p1|Ada',
      // An unregistered sigil (`$`).
      ['$', '{p1|Ada}'].join(''),
    ]) {
      const { doc } = fromMarkdown(source, { extensions });
      expect(
        runs(doc).every((run) => run.type !== 'text' || run.marks.length === 0),
        source
      ).toBe(true);
    }
    // Plain text that spells a token is escaped on the way out.
    const plain: EditorDocument = {
      version: 1,
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          content: [{ type: 'text', text: 'mail @{p1|Ada}', marks: [] }],
        },
      ],
    };
    const written = toMarkdown(plain, { extensions });
    expect(written).toBe('mail @\\{p1|Ada}');
    expect(runs(fromMarkdown(written, { extensions }).doc)).toEqual(runs(plain));
    // Unregistered extension marks are written (and loaded) as their label.
    const foreign: EditorDocument = {
      version: 1,
      blocks: [
        {
          id: 'p',
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Ada', marks: [{ type: 'extension', name: 'team', id: 't1' }] },
          ],
        },
      ],
    };
    expect(toMarkdown(foreign, { extensions })).toBe('Ada');
    const loaded = loadEditorDocument(foreign, { extensions });
    expect(runs(loaded.doc)).toEqual([{ type: 'text', text: 'Ada', marks: [] }]);
    expect(loaded.diagnostics.map((d) => d.code)).toContain('mark-dropped');
  });

  it('loads extension marks from JSON and trees, and checks hrefs with the URL policy', () => {
    const mark = { type: 'extension', name: 'mention', id: 'person-1' } as const;
    const json = {
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ada', marks: [mark] }] }],
    };
    expect(runs(loadEditorDocument(json, { extensions }).doc)).toEqual([
      { type: 'text', text: 'Ada', marks: [mark] },
    ]);
    const tree = inlineToTree([{ type: 'text', text: 'Ada', marks: [{ type: 'em' }, mark] }]);
    expect(tree).toEqual([
      {
        type: 'em',
        children: [
          {
            type: 'extension',
            name: 'mention',
            id: 'person-1',
            children: [{ type: 'text', text: 'Ada' }],
          },
        ],
      },
    ]);
    expect(inlineFromTree(tree, { extensions }).content).toEqual([
      { type: 'text', text: 'Ada', marks: [{ type: 'em' }, mark] },
    ]);
    expect(extensionHref(extensions, mark)).toBe('https://example.com/people/person-1');
    const hostile = createInlineExtensions([
      { name: 'mention', sigil: '@', href: () => 'javascript:alert(1)' },
    ]);
    expect(extensionHref(hostile, mark)).toBeUndefined();
    expect(() => createInlineExtensions([{ name: 'Bad Name', sigil: '@' }])).toThrow(TypeError);
    expect(() =>
      createInlineExtensions([
        { name: 'a', sigil: '@' },
        { name: 'b', sigil: '@' },
      ])
    ).toThrow(TypeError);
    // A link and code never share a run with an entity; typing after it leaves it.
    expect(
      sortMarks([{ type: 'link', href: 'https://example.com' }, { type: 'code' }, mark])
    ).toEqual([mark]);
    expect(inheritedMarks([{ type: 'text', text: 'Ada', marks: [mark] }], 3)).toEqual([]);
    expect(inheritedMarks([{ type: 'text', text: 'Ada', marks: [mark] }], 1)).toEqual([mark]);
  });

  it('reads hostile extension input in linear time', { retry: 2, timeout: 120_000 }, () => {
    // A token is matched in constant time after two linear passes. A matcher
    // that searched for the closing `}` from every sigil would take seconds
    // on the unclosed and escaped shapes at 400,000 characters (about 10^10
    // steps); the linear one takes tens of milliseconds. Fastest of five,
    // with a bound a loaded host stays far under. (The N-to-4N ratio is not
    // asserted here: these shapes spend their time in the text buffer every
    // special character already goes through, whose garbage collection makes
    // the ratio swing between 5x and 13x under load.)
    const limits = { maxSource: 400_000, limits: { chars: 400_000 }, extensions };
    const fastest = (source: string) => {
      let best = Number.POSITIVE_INFINITY;
      for (let k = 0; k < 5; k += 1) {
        const started = performance.now();
        fromMarkdown(source, limits);
        best = Math.min(best, performance.now() - started);
      }
      return best;
    };
    const shapes = {
      'open tokens': '@{'.repeat(200_000),
      'long ids': `@{${'a'.repeat(127)}`.repeat(Math.floor(400_000 / 129)),
      'unclosed labels': '@{a|'.repeat(100_000),
      'escaped closers': `@{a|${'\\}'.repeat(300)}`.repeat(Math.floor(400_000 / 604)),
      'labels past the cap': `@{a|${'x'.repeat(600)}}`.repeat(Math.floor(400_000 / 606)),
      tokens: '@{p1|Ada} '.repeat(40_000),
    };
    for (const [name, source] of Object.entries(shapes)) {
      const doc = fromMarkdown(source, limits).doc;
      expect(
        validateEditorDocument(doc).filter((issue) => issue.code !== 'text-truncated'),
        name
      ).toEqual([]);
      const took = fastest(source);
      expect(took, `${name}: ${took.toFixed(1)} ms`).toBeLessThan(1_500);
    }
    // The tokens all read as entities.
    const read = fromMarkdown(shapes.tokens, limits).doc;
    const entities = editorLeaves(read).flatMap(({ block }) =>
      block.type === 'paragraph'
        ? block.content.filter((run) => run.type === 'text' && run.marks.length > 0)
        : []
    );
    expect(entities).toHaveLength(40_000);
  });
});

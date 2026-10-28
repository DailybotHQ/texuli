// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DECK_MARKDOWN_LIMITS,
  deckToMarkdown,
  parseDeckMarkdown,
  readJson,
} from '../src/markdown/index.ts';
import { inertJson } from '../src/markdown/text.ts';
import type { Deck } from '../src/model/index.ts';

type Bag = Record<string, unknown>;

const FRONT = '---\ntitle: Hostile\n---\n\n';
const char = (code: number) => String.fromCodePoint(code);

function codes(markdown: string): string[] {
  return parseDeckMarkdown(`${FRONT}${markdown}`).issues.map((issue) => issue.code);
}

/** Run `fn` and return its duration in milliseconds. */
function timed(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('deck markdown: HTML and iframes are refused', () => {
  it.each([
    ['<script>alert(1)</script>', 'md-html-refused'],
    ['<iframe src="https://example.com"></iframe>', 'md-iframe-refused'],
    ['<img src=x onerror=alert(1)>', 'md-html-refused'],
    ['<svg><foreignObject>x</foreignObject></svg>', 'md-html-refused'],
    ['<style>body{display:none}</style>', 'md-html-refused'],
    ['<div class="grid grid-cols-2">', 'md-html-refused'],
    ['</div>', 'md-html-refused'],
    ['<!DOCTYPE html>', 'md-html-refused'],
    ['<?xml version="1.0"?>', 'md-html-refused'],
  ])('%s', (line, code) => {
    const result = parseDeckMarkdown(`${FRONT}# Ok\n\n${line}`);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(code);
    // Nothing from the refused line reaches the deck.
    expect(JSON.stringify(result.draft)).not.toMatch(
      /script|iframe|onerror|foreignObject|<style|DOCTYPE/
    );
  });

  it('keeps inline tags as escaped text, never as markup', () => {
    const result = parseDeckMarkdown(`${FRONT}Click <a href="javascript:x">here</a> or <IFRAME>`);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'md-html-refused',
      'md-html-refused',
      'md-iframe-refused',
    ]);
    const block = ((result.draft as Bag).slides as Bag[])[0]?.blocks as Bag[];
    expect(block[0]?.markdown).toBe('Click \\<a href="javascript:x">here\\</a> or \\<IFRAME>');
  });

  it('leaves tags inside code spans and fences alone', () => {
    const result = parseDeckMarkdown(
      `${FRONT}Use \`<div>\` here.\n\n\`\`\`html\n<div>ok</div>\n\`\`\``
    );
    expect(result.ok).toBe(true);
  });

  it('refuses CSS, classes, styles and handlers in attributes', () => {
    expect(codes('<!-- .slide: background-gradient="url(javascript:alert(1))" -->\nx')).toContain(
      'md-css-refused'
    );
    expect(codes('x <!-- .element: style="position:fixed" -->')).toContain('md-style-refused');
    expect(codes('x <!-- .element: onmouseover="x()" -->')).toContain('md-handler-refused');
    expect(codes('x <!-- .element: class="evil" -->')).toContain('md-class-refused');
    expect(codes('::: component chart-bar {.evil}\n{}\n:::')).toContain('md-class-refused');
    expect(codes('::: component chart-bar {tier=developer}\n{}\n:::')).toContain('md-tier-ignored');
  });
});

describe('deck markdown: URLs', () => {
  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](data:text/html,<script>)',
    '[x](//evil.example/x)',
    '[x](vbscript:msgbox)',
    '[x](http://example.com)',
    '![x](javascript:alert(1))',
    '![x](../../etc/passwd)',
    '![x](https://example.com/a.svg)',
    '<javascript:alert(1)>',
  ])('%s is refused', (line) => {
    expect(
      codes(line).some((code) => code === 'md-url-refused' || code === 'md-html-refused')
    ).toBe(true);
  });

  it('refuses unsafe media in backgrounds and layouts through the model', () => {
    const background = parseDeckMarkdown(
      `${FRONT}<!-- .slide: background-image="javascript:alert(1)" -->\nx`
    );
    expect(background.ok).toBe(false);
    const layout = parseDeckMarkdown(
      `${FRONT}<!-- .slide: layout=image-centered -->\n![a](javascript:x)`
    );
    expect(layout.ok).toBe(false);
  });
});

describe('deck markdown: hidden characters', () => {
  it.each([0x202e, 0x2067, 0x200b, 0x200e, 0x2060, 0xfeff, 0x061c, 0x0007, 0x0085])(
    'U+%s is reported and removed',
    (code) => {
      const result = parseDeckMarkdown(`${FRONT}# Title${char(code)}\n\nNote: a${char(code)}b`);
      expect(result.issues.map((issue) => issue.code)).toEqual([
        'md-invisible-char',
        'md-invisible-char',
      ]);
      expect(JSON.stringify(result.draft)).not.toContain(char(code));
    }
  );

  it('keeps ZWJ and ZWNJ, and a leading BOM is not an issue', () => {
    const result = parseDeckMarkdown(
      `${char(0xfeff)}${FRONT}# 👩${char(0x200d)}💻 می${char(0x200c)}خواهم`
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('escapes hidden characters in JSON fences, and the model refuses them in props', () => {
    const text = inertJson({ label: `a${char(0x202e)}b` });
    expect(text).not.toContain(char(0x202e));
    expect(text).toContain('\\u202e');
    expect(JSON.parse(text)).toEqual({ label: `a${char(0x202e)}b` });
    const result = parseDeckMarkdown(`${FRONT}::: component badge\n{"label": "a\\u202eb"}\n:::`);
    expect(result.ok).toBe(false);
  });
});

describe('deck markdown: structure attacks', () => {
  it('reports unclosed fences and regions at their opener, bounded to the slide', () => {
    const fence = parseDeckMarkdown(`${FRONT}\`\`\`ts\nconst a = 1;\n\n---\n\n# Next`);
    expect(fence.issues.map((issue) => [issue.code, issue.source?.line])).toEqual([
      ['md-code-unclosed', 5],
    ]);
    expect(fence.draft?.slides as Bag[]).toHaveLength(2);

    expect(codes('::: left\n# x')).toContain('md-region-unclosed');
    expect(codes('$$\n\\frac{1}{2}')).toContain('md-math-unclosed');
    expect(codes('::: component chart-bar\n{}')).toContain('md-region-unclosed');
    expect(codes('<!-- a comment that never ends\n# x')).toContain('md-comment-unclosed');
  });

  it('refuses nested regions and unknown directives', () => {
    const nested = `<!-- .slide: layout=two-column-split -->\n${'::: left\n'.repeat(500)}x\n${':::\n'.repeat(500)}`;
    const time = timed(() => {
      expect(codes(nested)).toContain('md-directive-depth');
    });
    expect(time).toBeLessThan(500);
    expect(codes('::: script\nalert(1)\n:::')).toContain('md-region-unknown');
  });

  it('bounds JSON bodies: prototype keys, depth, size, numbers and duplicates', () => {
    expect(codes('::: component x\n{"__proto__": {"polluted": true}}\n:::')).toContain('md-json');
    expect(({} as Bag).polluted).toBeUndefined();
    expect(codes('::: component x\n{"constructor": 1}\n:::')).toContain('md-json');
    expect(codes(`::: component x\n${'['.repeat(40)}${']'.repeat(40)}\n:::`)).toContain(
      'md-json-limit'
    );
    expect(codes(`::: component x\n{"a": "${'x'.repeat(70_000)}"}\n:::`)).toEqual(
      expect.arrayContaining(['md-too-large'])
    );
    expect(codes('::: component x\n{"a": 1e999}\n:::')).toContain('md-json');
    expect(codes('::: component x\n{"a": NaN}\n:::')).toContain('md-json');
    expect(codes('::: component x\n[1, 2]\n:::')).toContain('md-json');
    expect(readJson('{"a": [1, {"b": null}]}', { nodes: 100 })).toMatchObject({
      ok: true,
      value: { a: [1, { b: null }] },
    });
    expect(readJson('[1,2,3]', { nodes: 2 })).toMatchObject({ ok: false, limit: true });
  });

  it('shares one JSON node budget across the document', () => {
    const big = `{"items": [${Array.from({ length: 9_000 }, () => '1').join(',')}]}`;
    const fences = Array.from({ length: 3 }, () => `::: component x\n${big}\n:::`).join(
      '\n\n---\n\n'
    );
    expect(codes(fences)).toContain('md-json-limit');
  });

  it('refuses TeX that links, colors, loads or defines macros', () => {
    for (const tex of [
      '\\href{javascript:x}{y}',
      '\\color{red}{x}',
      '\\htmlClass{x}{y}',
      '\\def\\x{1}',
      '\\includegraphics{a.png}',
      '\\url{https://example.com}',
    ]) {
      expect(codes(`$$\n${tex}\n$$`)).toContain('md-tex-unsupported');
    }
    expect(codes(`$$\n${'{'.repeat(40)}x${'}'.repeat(40)}\n$$`)).toContain('md-tex-limit');
  });

  it('reads frontmatter as scalars only: no YAML tags, anchors or blocks', () => {
    for (const line of [
      'title: !!js/function "x"',
      'title: &a x',
      'title: *a',
      'title: |',
      'title: >',
      'title: {a: 1}',
      'title: [1]',
      'title: @x',
    ]) {
      const result = parseDeckMarkdown(`---\n${line}\n---\n\n# x`);
      expect(result.issues.map((issue) => issue.code)).toContain('md-frontmatter-value');
    }
  });
});

describe('deck markdown: bounds', () => {
  it('refuses a document over 1 MiB before reading it', () => {
    const result = parseDeckMarkdown(`${FRONT}${'a'.repeat(DECK_MARKDOWN_LIMITS.bytes)}`);
    expect(result.issues.map((issue) => issue.code)).toEqual(['md-too-large']);
    expect(result.draft).toBeUndefined();
  });

  it('cuts over-long lines and stops after 200 slides', () => {
    expect(codes(`x${'a'.repeat(DECK_MARKDOWN_LIMITS.lineLength + 5)}`)).toContain('md-too-large');
    const many = Array.from({ length: 205 }, (_, i) => `# S${i}`).join('\n\n---\n\n');
    const result = parseDeckMarkdown(`${FRONT}${many}`);
    expect(result.issues.map((issue) => issue.code)).toContain('md-too-many-slides');
    expect(result.draft?.slides as Bag[]).toHaveLength(200);
  });

  it('caps issues at 200 and says so', () => {
    const result = parseDeckMarkdown(`${FRONT}${'<b>\n\n'.repeat(400)}`);
    expect(result.issues).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });

  it.each([
    ['emphasis runs', `${'*'.repeat(19_000)}\n`.repeat(40)],
    ['backtick runs', `${'``x`'.repeat(4_900)}\n`.repeat(40)],
    ['unclosed links', `${'[a]('.repeat(4_900)}\n`.repeat(40)],
    ['brackets', `${'['.repeat(19_000)}\n`.repeat(40)],
    ['inline tags', `${'<b>'.repeat(6_000)}\n`.repeat(40)],
    ['trailing comments', `${'x <!-- <!-- '.repeat(1_500)}\n`.repeat(40)],
    ['list items', '- item <!-- .element: fragment -->\n'.repeat(25_000)],
    ['table rows', `| a | b |\n| - | - |\n${'| 1 | 2 |\n'.repeat(80_000)}`],
    ['separators', '---\n'.repeat(90_000)],
    ['fence openers', '```\n---\n'.repeat(45_000)],
    ['comments', '<!--\n'.repeat(90_000)],
  ])('stays bounded on hostile %s (about 1 MiB)', (_name, body) => {
    const time = timed(() => {
      parseDeckMarkdown(`${FRONT}${body}`);
    });
    expect(time).toBeLessThan(1_500);
  });
});

describe('deck markdown: a 200-slide document', () => {
  function document(slides: number): string {
    const parts: string[] = [];
    for (let i = 0; i < slides; i++) {
      parts.push(
        i % 5 === 0
          ? `<!-- .slide: layout=two-column-split transition=fade -->\n## Compare ${i}\n\n::: left\n### Before\nThe old way ${i}.\n:::\n\n::: right {fragment=fade-up}\n### After\nThe new way.\n:::\n\nNote: Notes for slide ${i}.`
          : `## Slide ${i}\n\n- one <!-- .element: fragment -->\n- two <!-- .element: fragment -->\n\nSome **text** with [a link](https://example.com/${i}).\n\n\`\`\`ts [1|2]\nconst a = ${i};\nconst b = 2;\n\`\`\`\n\n$$\n\\frac{${i}}{2}\n$$\n\n::: component chart-bar {step=4}\n{"title": "Revenue", "data": [1, 2, 3]}\n:::\n\n| a | b |\n| --- | --- |\n| 1 | 2 |`
      );
    }
    return `${FRONT}${parts.join('\n\n---\n\n')}\n`;
  }

  it('parses, validates and writes back within bounds', () => {
    const text = document(200);
    let result = parseDeckMarkdown(text);
    const parse = timed(() => {
      result = parseDeckMarkdown(text);
    });
    expect(result.ok).toBe(true);
    expect(result.deck?.slides).toHaveLength(200);
    let markdown = '';
    const write = timed(() => {
      markdown = deckToMarkdown(result.deck as Deck);
    });
    expect(parseDeckMarkdown(markdown).ok).toBe(true);
    // Generous wall-clock ceilings (local runs: ~30 ms parse, ~40 ms write).
    expect(parse).toBeLessThan(1_000);
    expect(write).toBeLessThan(2_000);
  });

  it('scales linearly: 4× the slides costs well under 16× the time', () => {
    const small = document(50);
    const large = document(200);
    parseDeckMarkdown(small);
    parseDeckMarkdown(large);
    const best = (text: string) =>
      Math.min(...Array.from({ length: 3 }, () => timed(() => parseDeckMarkdown(text))));
    const ratio = best(large) / Math.max(best(small), 0.5);
    expect(ratio).toBeLessThan(10);
  });
});

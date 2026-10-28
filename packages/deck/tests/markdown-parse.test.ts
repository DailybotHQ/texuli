// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DECK_MARKDOWN_CODES, parseDeckMarkdown } from '../src/markdown/index.ts';
import type { DeckDiagnostic } from '../src/schema/index.ts';

type Bag = Record<string, unknown>;

const FRONT = '---\ntitle: Test deck\n---\n\n';

function parse(markdown: string, front = FRONT) {
  return parseDeckMarkdown(`${front}${markdown}`);
}

function deck(markdown: string, front = FRONT) {
  const result = parse(markdown, front);
  expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  expect(result.ok).toBe(true);
  return result.deck as unknown as {
    slides: Bag[];
    meta: Bag;
    style?: Bag;
    navigation?: Bag;
    outline?: Bag;
  };
}

function codes(issues: readonly DeckDiagnostic[]): string[] {
  return issues.map((issue) => issue.code);
}

describe('deck markdown: frontmatter', () => {
  it('reads the closed key set into meta, style, navigation and outline', () => {
    const result = deck(
      '<!-- .slide: section=intro -->\n# One\n\n---\n\n# Two',
      [
        '---',
        'title: "Quarterly: review"',
        'description: A fictional deck',
        'author: Ada Example',
        'date: 2026-10-27',
        'locale: en-GB',
        'dir: ltr',
        'theme: nord',
        'themeMode: dark',
        'fontPair: geometric',
        'aspect: 4:3',
        'density: compact',
        'radius: large',
        'motion: subtle',
        'transition: zoom',
        'background: "#1a1a2e"',
        'logo: images/logo.png',
        'footer: Example Inc.',
        'slideNumbers: false',
        'progress: top',
        'codeTheme: github',
        'math: true',
        'start: two',
        'loop: true',
        'autoSlide: 5000',
        'outlineTitle: Agenda',
        '---',
        '',
      ].join('\n')
    );
    expect(result.meta).toEqual({
      title: 'Quarterly: review',
      description: 'A fictional deck',
      author: 'Ada Example',
      date: '2026-10-27',
      locale: 'en-GB',
      dir: 'ltr',
    });
    expect(result.style).toEqual({
      theme: { kind: 'catalog', id: 'nord', mode: 'dark' },
      fontPair: 'geometric',
      aspect: '4:3',
      density: 'compact',
      radius: 'large',
      motion: 'subtle',
      transition: 'zoom',
      background: { kind: 'solid', color: '#1a1a2e' },
      logo: 'images/logo.png',
      footer: 'Example Inc.',
      slideNumbers: false,
      progress: 'top',
      codeTheme: 'github',
      math: true,
    });
    expect(result.navigation).toEqual({ start: 'two', loop: true, autoSlideMs: 5000 });
    expect(result.outline).toEqual({
      title: 'Agenda',
      sections: [{ id: 'intro', slideIds: ['one', 'two'] }],
    });
  });

  it('accepts kebab-case aliases, presets, tokens and seeds', () => {
    const result = deck(
      '# One',
      '---\ntitle: T\nfont-pair: serif\nslide-numbers: true\nbackground: gradient-dusk\nthemeSeed: 42\n---\n'
    );
    expect(result.style).toEqual({
      theme: { kind: 'seed', seed: 42 },
      fontPair: 'serif',
      slideNumbers: true,
      background: 'gradient-dusk',
    });
    expect(deck('# One', '---\ntitle: T\nbackground: primary\n---\n').style).toEqual({
      background: { kind: 'solid', token: 'primary' },
    });
  });

  it('refuses unknown keys, non-scalars and wrong types with line numbers', () => {
    const result = parse(
      '# One',
      '---\ntitle: T\ncolour: red\ntheme: [a, b]\nmath: yes\nfooter: |\nloop: !!js/function x\nautoSlide: soon\n---\n'
    );
    expect(result.ok).toBe(false);
    const found = result.issues.map((issue) => [issue.code, issue.source?.line]);
    expect(found).toEqual(
      expect.arrayContaining([
        ['md-frontmatter-key', 3],
        ['md-frontmatter-value', 4],
        ['md-frontmatter-value', 5],
        ['md-frontmatter-value', 6],
        ['md-frontmatter-value', 7],
        ['md-frontmatter-value', 8],
      ])
    );
  });

  it('derives a title with a warning, and maps model issues back to the key', () => {
    const untitled = parseDeckMarkdown('# Hello there');
    expect(untitled.ok).toBe(true);
    expect(untitled.deck?.meta.title).toBe('Hello there');
    expect(codes(untitled.issues)).toContain('md-title-missing');

    const bad = parse('# One', '---\ntitle: T\naspect: 21:9\n---\n');
    expect(bad.ok).toBe(false);
    const issue = bad.issues.find((item) => item.jsonPath === '$.style.aspect');
    expect(issue?.source).toEqual({ line: 3, column: 1 });
  });

  it('reports an unclosed frontmatter', () => {
    const result = parseDeckMarkdown('---\ntitle: T\n# One');
    expect(codes(result.issues)).toContain('md-frontmatter-unclosed');
  });
});

describe('deck markdown: slides, stacks, notes and ids', () => {
  it('splits on --- and -- outside fences, and stacks vertical slides', () => {
    const result = deck(
      '# One\n\n---\n\n# Two\n\n--\n\n# Two A\n\n```yaml\n---\nkey: value\n--\n```\n\n--\n\n# Two B\n\n---\n\n# Three'
    );
    expect(result.slides.map((slide) => slide.id)).toEqual([
      'one',
      'two',
      'two-a',
      'two-b',
      'three',
    ]);
    expect(result.outline).toEqual({
      sections: [{ id: 'stack-two', slideIds: ['two', 'two-a', 'two-b'], stack: true }],
    });
    const code = ((result.slides[2] as Bag).blocks as Bag[])[1];
    expect(code).toEqual({ type: 'code', code: '---\nkey: value\n--', lang: 'yaml' });
  });

  it('names stacks and sections from slide attributes, and ends a section', () => {
    const slides = [
      '<!-- .slide: section=intro section-title="Getting started" -->\n# A',
      '# B',
      '<!-- .slide: section-end -->\n# C',
      '<!-- .slide: section=deep -->\n# D',
    ].join('\n\n---\n\n');
    const result = deck(`${slides}\n\n--\n\n# D2`);
    expect(result.outline).toEqual({
      sections: [
        { id: 'intro', title: 'Getting started', slideIds: ['a', 'b'] },
        { id: 'deep', slideIds: ['d', 'd2'], stack: true },
      ],
    });
  });

  it('keeps Note: to the end of the slide as plain text, unescaping separator lines', () => {
    const result = deck(
      '# One\n\nNote: First line\n\n- not a list\n\\---\n\\```\nlast\n\n---\n\n# Two\n\nnotes: lower'
    );
    expect(result.slides[0]?.notes).toBe('First line\n\n- not a list\n---\n```\nlast');
    expect(result.slides[1]?.notes).toBe('lower');
  });

  it('derives unique ids from titles and keeps explicit ones', () => {
    const result = deck(
      '# Hello World\n\n---\n\n# Hello World\n\n---\n\n<!-- .slide: id=custom -->\n# Other\n\n---\n\nplain text only'
    );
    expect(result.slides.map((slide) => slide.id)).toEqual([
      'hello-world',
      'hello-world-2',
      'custom',
      'slide-4',
    ]);
  });

  it('drops empty slides and reports a stack with no slide before it', () => {
    expect(deck('# One\n\n---\n\n\n\n---\n\n# Two').slides).toHaveLength(2);
    const stacked = parseDeckMarkdown('--\n\n# One');
    expect(codes(stacked.issues)).toContain('md-stack-start');
  });
});

describe('deck markdown: blocks', () => {
  it('maps headings, paragraphs, lists, quotes, rules, tables, images and math', () => {
    const slide = deck(
      [
        '## Title',
        'Some **bold** text\nover two lines, with [a link](https://example.com).',
        '- one\n- two\n  - nested',
        '1. first\n2. second',
        '> A quote\n> on two lines\n>\n> — Ada Example',
        '***',
        '| Name | Score |\n| --- | ---: |\n| Ada | 3 |\n| Bo \\| Co |  |',
        '![A chart](images/chart.png "Q3 revenue")\n<!-- .element: width=800 height=450 -->',
        '$$\n\\frac{1}{2}\n$$',
        '$$ e^{i\\pi} + 1 = 0 $$',
      ].join('\n\n')
    ).slides[0] as Bag;
    expect(slide.layout).toBe('free');
    expect(slide.blocks).toEqual([
      { type: 'heading', level: 2, text: 'Title' },
      {
        type: 'text',
        markdown: 'Some **bold** text\nover two lines, with [a link](https://example.com).',
      },
      { type: 'list', items: [{ text: 'one' }, { text: 'two\n- nested' }] },
      { type: 'list', items: [{ text: 'first' }, { text: 'second' }], ordered: true },
      { type: 'quote', quote: 'A quote\non two lines', cite: 'Ada Example' },
      { type: 'divider' },
      {
        type: 'table',
        columns: [
          { id: 'c1', label: 'Name' },
          { id: 'c2', label: 'Score' },
        ],
        rows: [
          { c1: 'Ada', c2: '3' },
          { c1: 'Bo | Co', c2: null },
        ],
      },
      {
        type: 'image',
        src: 'images/chart.png',
        alt: 'A chart',
        width: 800,
        height: 450,
        caption: 'Q3 revenue',
      },
      { type: 'math', tex: '\\frac{1}{2}' },
      { type: 'math', tex: 'e^{i\\pi} + 1 = 0' },
    ]);
  });

  it('keeps inline $…$ math inside the text string', () => {
    const slide = deck('Euler: $e^{i\\pi} + 1 = 0$ and \\$5.').slides[0] as Bag;
    expect(slide.blocks).toEqual([
      { type: 'text', markdown: 'Euler: $e^{i\\pi} + 1 = 0$ and \\$5.' },
    ]);
  });

  it('reads code fences with language, [1-2|4-6] steps and brace attributes', () => {
    const slide = deck(
      '```ts [1-2|4,6|8] {#fetch filename="fetch.ts" caption="Fetching" numbers step=2}\nline\n```\n\n~~~~\n```inner```\n~~~~'
    ).slides[0] as Bag;
    expect(slide.blocks).toEqual([
      {
        type: 'code',
        code: 'line',
        lang: 'ts',
        highlights: ['1-2', '4,6', '8'],
        id: 'fetch',
        filename: 'fetch.ts',
        caption: 'Fetching',
        lineNumbers: true,
        step: 2,
      },
      { type: 'code', code: '```inner```' },
    ]);
  });

  it('drops a reveal.js line offset with a warning and refuses bad steps', () => {
    const offset = parse('```js [2: 1-2|3]\na\nb\nc\n```');
    expect(codes(offset.issues)).toEqual(['md-code-offset-unsupported']);
    expect(((offset.deck as unknown as { slides: Bag[] }).slides[0] as Bag).blocks).toEqual([
      { type: 'code', code: 'a\nb\nc', lang: 'js', highlights: ['1-2', '3'] },
    ]);
    expect(codes(parse('```js [1-a]\nx\n```').issues)).toContain('md-code-steps');
    expect(
      codes(
        parse(`\`\`\`js [${Array.from({ length: 17 }, (_, i) => i + 1).join('|')}]\nx\n\`\`\``)
          .issues
      )
    ).toContain('md-code-steps');
  });

  it('places components with bounded JSON props and brace attributes', () => {
    const slide = deck(
      '::: component data-board {#sprint step=2 fragment=fade-up tone=accent height=lg}\n{\n  "columns": [{ "id": "todo", "title": "To do" }]\n}\n:::\n\n::: component badge\n:::'
    ).slides[0] as Bag;
    expect(slide.blocks).toEqual([
      {
        type: 'component',
        component: 'data-board',
        props: { columns: [{ id: 'todo', title: 'To do' }] },
        id: 'sprint',
        step: 2,
        fragment: 'fade-up',
        tone: 'accent',
        height: 'lg',
      },
      { type: 'component', component: 'badge', props: {} },
    ]);
  });

  it('places any block family as a ::: block JSON fence', () => {
    const slide = deck('::: block diagram {step=1}\n{ "kind": "flow", "nodes": [] }\n:::')
      .slides[0] as Bag;
    expect(slide.blocks).toEqual([{ type: 'diagram', kind: 'flow', nodes: [], step: 1 }]);
  });

  it('points JSON errors and model issues inside a fence at their line and column', () => {
    const broken = parse('::: component chart-bar\n{\n  "a": 1,\n  "a": 2\n}\n:::');
    const dup = broken.issues.find((issue) => issue.code === 'md-json');
    expect(dup?.source).toEqual({ line: 8, column: 3 });

    const model = parse('::: component chart-bar {step=5000}\n{}\n:::');
    expect(codes(model.issues)).toContain('md-attr-value');

    const hostIssue = parseDeckMarkdown(
      `${FRONT}::: component chart-bar\n{\n  "title": 42\n}\n:::`,
      {
        validateComponent: (_component, path) => [
          {
            code: 'component-props',
            severity: 'error',
            path: [...path, 'props', 'title'],
            jsonPath: '',
            pointer: '',
            message: 'title must be text',
          },
        ],
      }
    );
    const mapped = hostIssue.issues.find((issue) => issue.code === 'component-props');
    expect(mapped?.source).toEqual({ line: 7, column: 12 });
  });

  it('sets masters on free slides and refuses them elsewhere', () => {
    expect(deck('<!-- .slide: master=two-column -->\nLeft\n\n***\n\nRight').slides[0]?.master).toBe(
      'two-column'
    );
    expect(codes(parse('<!-- .slide: master=nope -->\nText').issues)).toContain('md-attr-value');
    expect(codes(parse('<!-- .slide: layout=quote master=quote -->\n> Hi').issues)).toContain(
      'md-attr-conflict'
    );
  });
});

describe('deck markdown: slide attributes', () => {
  it('maps reveal.js aliases onto the closed set', () => {
    const slides = deck(
      [
        '<!-- .slide: data-background-color="#1a1a2e" data-transition="zoom" -->\nA',
        '<!-- .slide: data-background-image="images/bg.jpg" data-background-opacity="0.3" data-background-size=contain data-background-position=top class="has-dark-background" -->\nB',
        '<!-- .slide: data-background-video="clips/loop.mp4" data-background-video-loop data-background-video-muted class="slide-bg-overlay--dark" -->\nC',
        '<!-- .slide: data-auto-animate data-visibility="hidden" -->\nD',
        '<!-- .slide: data-background-gradient="dusk, 120deg" data-transition="convex" -->\nE',
        '<!-- .slide: background=pattern-dots theme=nord title="Custom title" steps="Intro|Detail" hidden=false -->\nF',
      ].join('\n\n---\n\n')
    ).slides;
    expect(slides.map((slide) => [slide.background, slide.transition])).toEqual([
      [{ kind: 'solid', color: '#1a1a2e' }, 'zoom'],
      [
        {
          kind: 'image',
          src: 'images/bg.jpg',
          fit: 'contain',
          position: 'top',
          tone: 'dark',
          overlay: 0.7,
        },
        undefined,
      ],
      [{ kind: 'video', src: 'clips/loop.mp4', tone: 'dark', overlay: 0.6 }, undefined],
      [undefined, 'morph'],
      [{ kind: 'gradient', gradient: 'dusk', angle: 120 }, 'slide'],
      ['pattern-dots', undefined],
    ]);
    expect(slides[3]?.hidden).toBe(true);
    expect(slides[5]).toMatchObject({
      theme: 'nord',
      title: 'Custom title',
      steps: ['Intro', 'Detail'],
      hidden: false,
    });
  });

  it('assembles full-bleed media backgrounds with every option', () => {
    const slide = deck(
      '<!-- .slide: background-image="https://example.com/bg.webp" background-full background-alt="A field" background-fit=cover background-position=center tone=light background-overlay=0.4 -->\nText'
    ).slides[0];
    expect(slide?.background).toEqual({
      kind: 'image-full',
      src: 'https://example.com/bg.webp',
      alt: 'A field',
      fit: 'cover',
      position: 'center',
      tone: 'light',
      overlay: 0.4,
    });
  });

  it('refuses iframes, CSS, classes, styles, handlers and unknown attributes', () => {
    const result = parse(
      [
        '<!-- .slide: data-background-iframe="https://example.com" -->\nA',
        '<!-- .slide: data-background-gradient="linear-gradient(red, blue)" -->\nB',
        '<!-- .slide: background-color="rgb(1,2,3)" -->\nC',
        '<!-- .slide: class="grid grid-cols-2" -->\nD',
        '<!-- .slide: style="color:red" onclick="x()" -->\nE',
        '<!-- .slide: colour=red data-transition-speed=fast -->\nF',
        '<!-- .slide: background=gradient-dusk background-color=primary -->\nG',
      ].join('\n\n---\n\n')
    );
    expect(codes(result.issues)).toEqual(
      expect.arrayContaining([
        'md-iframe-refused',
        'md-css-refused',
        'md-class-refused',
        'md-style-refused',
        'md-handler-refused',
        'md-attr-unknown',
        'md-attr-unsupported',
        'md-attr-conflict',
      ])
    );
    const iframe = result.issues.find((issue) => issue.code === 'md-iframe-refused');
    expect(iframe?.source).toEqual({ line: 5, column: 14 });
  });

  it('reports unknown layouts and comments that do not close on their line', () => {
    expect(codes(parse('<!-- .slide: layout=mosaic -->\nText').issues)).toContain(
      'md-layout-unknown'
    );
    expect(codes(parse('<!-- .slide: layout=quote\n-->\n> Hi').issues)).toContain('md-attr-value');
  });
});

describe('deck markdown: fragments', () => {
  it('numbers fragments in document order, keeping explicit steps', () => {
    const blocks = deck(
      [
        'First <!-- .element: class="fragment" -->',
        'Second <!-- .element: class="fragment fade-up" -->',
        'Third <!-- .element: fragment=grow data-fragment-index=7 -->',
        'Fourth\n<!-- .element: fragment=highlight-red -->',
        '## Heading <!-- .element: fragment=fade-out -->',
      ].join('\n\n')
    ).slides[0]?.blocks as Bag[];
    expect(blocks.map((block) => [block.step, block.fragment, block.tone])).toEqual([
      [1, undefined, undefined],
      [2, 'fade-up', undefined],
      [7, 'grow', undefined],
      [8, 'highlight', 'danger'],
      [9, 'out', undefined],
    ]);
  });

  it('folds same-effect item fragments into one list step', () => {
    const blocks = deck(
      'Intro <!-- .element: fragment -->\n\n- a <!-- .element: fragment=fade-up -->\n- b <!-- .element: fragment=fade-up -->\n- c <!-- .element: fragment=fade-up -->\n\nAfter <!-- .element: fragment -->'
    ).slides[0]?.blocks as Bag[];
    expect(blocks.map((block) => block.step)).toEqual([1, 2, 5]);
    expect(blocks[1]).toMatchObject({ type: 'list', step: 2, fragment: 'fade-up' });
  });

  it('approximates mixed item fragments and nearest effects with warnings', () => {
    const result = parse(
      '- a <!-- .element: fragment=grow -->\n- b\n\nText <!-- .element: class="fragment zoom-in" -->'
    );
    expect(result.ok).toBe(true);
    expect(codes(result.issues)).toEqual(
      expect.arrayContaining(['md-fragment-approximated', 'md-effect-approximated'])
    );
  });

  it('applies a tone without a step, and orphans are errors', () => {
    expect(deck('Callout <!-- .element: tone=warning -->').slides[0]?.blocks).toEqual([
      { type: 'text', markdown: 'Callout', tone: 'warning' },
    ]);
    expect(codes(parse('<!-- .element: fragment -->\nText').issues)).toContain('md-element-orphan');
    expect(codes(parse('Text <!-- .element: fragment=wobble -->').issues)).toContain(
      'md-attr-value'
    );
  });
});

describe('deck markdown: diagnostics', () => {
  it('documents every md-* code with a severity', () => {
    for (const [code, info] of Object.entries(DECK_MARKDOWN_CODES)) {
      expect(code).toMatch(/^md-[a-z-]+$/);
      expect(['error', 'warning']).toContain(info.severity);
      expect(info.meaning.length).toBeGreaterThan(10);
    }
  });

  it('gives every dialect issue a 1-based line and column, and a source map', () => {
    const result = parse('# One\n\n<div>bad</div>\n\nText with <span>tag</span>');
    for (const issue of result.issues) {
      expect(issue.source?.line).toBeGreaterThan(0);
      expect(issue.source?.column).toBeGreaterThan(0);
    }
    expect(result.issues.map((issue) => [issue.code, issue.source])).toEqual([
      ['md-html-refused', { line: 7, column: 1 }],
      ['md-html-refused', { line: 9, column: 11 }],
      ['md-html-refused', { line: 9, column: 20 }],
    ]);
    expect(result.sourceMap.get('$.slides[0].blocks[1]')).toEqual({ line: 9, column: 1 });
  });

  it('collects all issues at once rather than stopping at the first', () => {
    const result = parse(
      '<b>x</b>\n\n---\n\n<!-- .slide: layout=nope -->\nx\n\n---\n\n![x](javascript:alert(1))'
    );
    expect(codes(result.issues)).toEqual(
      expect.arrayContaining([
        'md-html-refused',
        'md-layout-unknown',
        'md-url-refused',
        'unknown-layout',
      ])
    );
    expect(result.issues.every((issue) => issue.source !== undefined)).toBe(true);
  });
});

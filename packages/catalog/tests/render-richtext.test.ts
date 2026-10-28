// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  RICHTEXT_LIMITS,
  type RichTextInline,
  renderRichText,
  richTextToPlain,
} from '../src/render/richtext/index.ts';

function texts(nodes: readonly RichTextInline[]): string {
  return richTextToPlain({
    paragraphs: [{ type: 'paragraph', children: nodes }],
  });
}

function collectTypes(nodes: readonly RichTextInline[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly RichTextInline[]) => {
    for (const node of list) {
      out.push(node.type);
      if (node.type === 'strong' || node.type === 'em' || node.type === 'link') {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return out;
}

describe('renderRichText', () => {
  it('renderRichText', () => {
    // returns an empty paragraph for empty input
    {
      const result = renderRichText('');
      expect(result.document.paragraphs).toHaveLength(1);
      expect(result.document.paragraphs[0]?.children).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    }
    // parses plain text without inventing nodes
    {
      const { document, diagnostics } = renderRichText('Hello, Harbor Notes.');
      expect(diagnostics).toEqual([]);
      expect(document.paragraphs).toHaveLength(1);
      expect(document.paragraphs[0]?.children).toEqual([
        { type: 'text', value: 'Hello, Harbor Notes.' },
      ]);
    }
    // parses strong, em and inline code
    {
      const { document, diagnostics } = renderRichText('Say **hello** and *world* plus `code`.');
      expect(diagnostics).toEqual([]);
      const children = document.paragraphs[0]?.children ?? [];
      expect(collectTypes(children)).toEqual([
        'text',
        'strong',
        'text',
        'text',
        'em',
        'text',
        'text',
        'code',
        'text',
      ]);
      expect(texts(children)).toBe('Say hello and world plus code.');
    }
    // parses nested emphasis within the depth cap
    {
      const { document, diagnostics } = renderRichText('**bold and *italic* inside**');
      expect(diagnostics).toEqual([]);
      const strong = document.paragraphs[0]?.children.find((n) => n.type === 'strong');
      expect(strong?.type).toBe('strong');
      if (strong?.type === 'strong') {
        expect(collectTypes(strong.children)).toContain('em');
        expect(texts(strong.children)).toBe('bold and italic inside');
      }
    }
    // accepts policy-safe links and keeps the label when href is rejected
    {
      const ok = renderRichText('See [docs](https://example.com/guide).');
      expect(ok.diagnostics).toEqual([]);
      const link = ok.document.paragraphs[0]?.children.find((n) => n.type === 'link');
      expect(link).toEqual({
        type: 'link',
        href: 'https://example.com/guide',
        children: [{ type: 'text', value: 'docs' }],
      });

      const bad = renderRichText('Click [here](javascript:alert(1)).');
      expect(bad.diagnostics.some((d) => d.code === 'link-rejected')).toBe(true);
      const nodes = bad.document.paragraphs[0]?.children ?? [];
      expect(nodes.some((n) => n.type === 'link')).toBe(false);
      expect(texts(nodes)).toContain('here');
      expect(JSON.stringify(nodes)).not.toMatch(/javascript:/i);
    }
    // never echoes a refused href into the link-rejected diagnostic
    {
      const bad = renderRichText('Pay [here](javascript:alert("\u202eevil.example/steal")).');
      const diagnostic = bad.diagnostics.find((d) => d.code === 'link-rejected');
      expect(diagnostic).toBeDefined();
      const message = diagnostic?.message ?? '';
      expect(message).not.toContain('javascript');
      expect(message).not.toContain('evil.example');
      expect(message).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/);
    }
    // keeps raw HTML-like tags as literal text (never HTML sinks)
    {
      const { document, diagnostics } = renderRichText(
        'Hello <script>alert(1)</script> and <b>bold</b>.'
      );
      expect(diagnostics.some((d) => d.code === 'html-as-text')).toBe(true);
      const plain = richTextToPlain(document);
      expect(plain).toContain('<script>alert(1)</script>');
      expect(plain).toContain('<b>bold</b>');
      // No node type that could be an HTML sink.
      const types = collectTypes(document.paragraphs.flatMap((p) => p.children));
      expect(
        types.every((t) => ['text', 'strong', 'em', 'code', 'link', 'break'].includes(t))
      ).toBe(true);
    }
    // splits paragraphs on blank lines and supports hard breaks
    {
      const { document } = renderRichText('First line.\n\nSecond  \nparagraph.');
      expect(document.paragraphs).toHaveLength(2);
      expect(texts(document.paragraphs[0]?.children ?? [])).toBe('First line.');
      const second = document.paragraphs[1]?.children ?? [];
      expect(second.some((n) => n.type === 'break')).toBe(true);
      expect(texts(second)).toBe('Second\nparagraph.');
    }
    // honours backslash escapes for markers
    {
      const { document } = renderRichText('Not \\*em\\* and not \\`code\\`.');
      expect(document.paragraphs[0]?.children).toEqual([
        { type: 'text', value: 'Not *em* and not `code`.' },
      ]);
    }
    // truncates overlong sources and reports a diagnostic
    {
      const long = `${'a'.repeat(RICHTEXT_LIMITS.source)}EXTRA`;
      const { document, diagnostics } = renderRichText(long);
      expect(diagnostics.some((d) => d.code === 'source-truncated')).toBe(true);
      expect(richTextToPlain(document).length).toBe(RICHTEXT_LIMITS.source);
    }
    // caps inline nesting and degrades extra markers to text
    {
      // maxDepth 0 refuses all emphasis; markers stay literal text.
      const { document, diagnostics } = renderRichText('**still bold?** and *em*', {
        maxDepth: 0,
      });
      expect(diagnostics.some((d) => d.code === 'depth-capped')).toBe(true);
      expect(richTextToPlain(document)).toContain('**still bold?**');
      expect(richTextToPlain(document)).toContain('*em*');
      const types = collectTypes(document.paragraphs.flatMap((p) => [...p.children]));
      expect(types.every((t) => t === 'text')).toBe(true);
    }
    // never returns HTML sink node kinds (tags stay plain text)
    {
      const samples = [
        '**x**',
        '*y*',
        '`z`',
        '[a](https://example.com)',
        '[b](javascript:1)',
        '<img src=x onerror=1>',
        'line  \nbreak',
      ];
      for (const sample of samples) {
        const { document } = renderRichText(sample);
        // Structural guarantee: only known node shapes (no html/raw/script kinds).
        for (const paragraph of document.paragraphs) {
          for (const node of paragraph.children) {
            expect(['text', 'code', 'break', 'strong', 'em', 'link']).toContain(node.type);
            if (node.type === 'text' && sample.includes('<')) {
              // Hostile markup is data, not a sink: it lives only as text.value.
              expect(node.value).toContain('<');
            }
          }
        }
      }
    }
    // richTextToPlain flattens nested nodes
    {
      const { document } = renderRichText('A **B *C* D** E');
      expect(richTextToPlain(document)).toBe('A B C D E');
    }
  });

  it('parses hostile text at the source cap in linear time and keeps it as text', () => {
    const cap = RICHTEXT_LIMITS.source;
    const fill = (unit: string) => unit.repeat(Math.ceil(cap / unit.length)).slice(0, cap);
    /** The fastest of three runs: the algorithm's cost, not a busy host's scheduler. */
    const fastest = (source: string) => {
      let best = Number.POSITIVE_INFINITY;
      let result = renderRichText(source);
      for (let run = 0; run < 3; run += 1) {
        const started = performance.now();
        result = renderRichText(source);
        best = Math.min(best, performance.now() - started);
      }
      return { best, result };
    };
    // Each shape made the old forward scans or regexes restart at every
    // opener: unclosed labels, label targets, HTML-like tags, trailing-space
    // lines, emphasis markers and backtick runs.
    const shapes: Record<string, string> = {
      'a run of [': '['.repeat(cap),
      '[ run, then *(': `${'['.repeat(cap - 2)}*(`,
      'empty labels with open targets': fill('[]('),
      'labels with open targets': fill('[a](x'),
      'tags without >': fill('<a'),
      'closing tags without >': fill('</b'),
      'space-ended lines': fill(' \n__'),
      'word lines ending in a space': fill('x \n'),
      'single stars': fill('*x'),
      underscores: fill('_ '),
      'double stars': fill('**x'),
      'star, then star pairs': `*${fill(' **').slice(1)}`,
      'falling backtick runs': fill(
        Array.from({ length: 88 }, (_, k) => `${'`'.repeat(88 - k)}a`).join('')
      ),
    };
    for (const [name, source] of Object.entries(shapes)) {
      expect(source.length, name).toBe(cap);
      const { best, result } = fastest(source);
      expect(best, `${name}: ${best.toFixed(2)} ms`).toBeLessThan(20);
      // No markup is invented: every node is a known sink-free shape.
      for (const paragraph of result.document.paragraphs) {
        for (const type of collectTypes(paragraph.children)) {
          expect(['text', 'code', 'break', 'strong', 'em', 'link'], name).toContain(type);
        }
      }
    }
    // Unclosed openers stay literal text, character for character.
    expect(texts(renderRichText('['.repeat(cap)).document.paragraphs[0]?.children ?? [])).toBe(
      '['.repeat(cap)
    );
    expect(renderRichText(fill('<a')).diagnostics).toEqual([]);
    expect(renderRichText(`${fill('<a').slice(0, -1)}>`).diagnostics.map((d) => d.code)).toEqual([
      'html-as-text',
    ]);
  });

  it('keeps the old line-terminator rule for padded code spans', () => {
    // `/^ .* $/` never matched across U+2028 or U+2029, so the padding stays.
    for (const [source, value] of [
      ['` a `', 'a'],
      ['` a\u2028b `', ' a\u2028b '],
      ['` a\u2029b `', ' a\u2029b '],
      ['` a\nb `', 'a b'],
      ['`  `', '  '],
    ] as const) {
      expect(renderRichText(source).document.paragraphs[0]?.children, source).toEqual([
        { type: 'code', value },
      ]);
    }
  });
});

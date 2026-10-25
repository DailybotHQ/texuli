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
  it('returns an empty paragraph for empty input', () => {
    const result = renderRichText('');
    expect(result.document.paragraphs).toHaveLength(1);
    expect(result.document.paragraphs[0]?.children).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('parses plain text without inventing nodes', () => {
    const { document, diagnostics } = renderRichText('Hello, Harbor Notes.');
    expect(diagnostics).toEqual([]);
    expect(document.paragraphs).toHaveLength(1);
    expect(document.paragraphs[0]?.children).toEqual([
      { type: 'text', value: 'Hello, Harbor Notes.' },
    ]);
  });

  it('parses strong, em and inline code', () => {
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
  });

  it('parses nested emphasis within the depth cap', () => {
    const { document, diagnostics } = renderRichText('**bold and *italic* inside**');
    expect(diagnostics).toEqual([]);
    const strong = document.paragraphs[0]?.children.find((n) => n.type === 'strong');
    expect(strong?.type).toBe('strong');
    if (strong?.type === 'strong') {
      expect(collectTypes(strong.children)).toContain('em');
      expect(texts(strong.children)).toBe('bold and italic inside');
    }
  });

  it('accepts policy-safe links and keeps the label when href is rejected', () => {
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
  });

  it('keeps raw HTML-like tags as literal text (never HTML sinks)', () => {
    const { document, diagnostics } = renderRichText(
      'Hello <script>alert(1)</script> and <b>bold</b>.'
    );
    expect(diagnostics.some((d) => d.code === 'html-as-text')).toBe(true);
    const plain = richTextToPlain(document);
    expect(plain).toContain('<script>alert(1)</script>');
    expect(plain).toContain('<b>bold</b>');
    // No node type that could be an HTML sink.
    const types = collectTypes(document.paragraphs.flatMap((p) => p.children));
    expect(types.every((t) => ['text', 'strong', 'em', 'code', 'link', 'break'].includes(t))).toBe(
      true
    );
  });

  it('splits paragraphs on blank lines and supports hard breaks', () => {
    const { document } = renderRichText('First line.\n\nSecond  \nparagraph.');
    expect(document.paragraphs).toHaveLength(2);
    expect(texts(document.paragraphs[0]?.children ?? [])).toBe('First line.');
    const second = document.paragraphs[1]?.children ?? [];
    expect(second.some((n) => n.type === 'break')).toBe(true);
    expect(texts(second)).toBe('Second\nparagraph.');
  });

  it('honours backslash escapes for markers', () => {
    const { document } = renderRichText('Not \\*em\\* and not \\`code\\`.');
    expect(document.paragraphs[0]?.children).toEqual([
      { type: 'text', value: 'Not *em* and not `code`.' },
    ]);
  });

  it('truncates overlong sources and reports a diagnostic', () => {
    const long = `${'a'.repeat(RICHTEXT_LIMITS.source)}EXTRA`;
    const { document, diagnostics } = renderRichText(long);
    expect(diagnostics.some((d) => d.code === 'source-truncated')).toBe(true);
    expect(richTextToPlain(document).length).toBe(RICHTEXT_LIMITS.source);
  });

  it('caps inline nesting and degrades extra markers to text', () => {
    // maxDepth 0 refuses all emphasis; markers stay literal text.
    const { document, diagnostics } = renderRichText('**still bold?** and *em*', {
      maxDepth: 0,
    });
    expect(diagnostics.some((d) => d.code === 'depth-capped')).toBe(true);
    expect(richTextToPlain(document)).toContain('**still bold?**');
    expect(richTextToPlain(document)).toContain('*em*');
    const types = collectTypes(document.paragraphs.flatMap((p) => [...p.children]));
    expect(types.every((t) => t === 'text')).toBe(true);
  });

  it('never returns HTML sink node kinds (tags stay plain text)', () => {
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
  });

  it('richTextToPlain flattens nested nodes', () => {
    const { document } = renderRichText('A **B *C* D** E');
    expect(richTextToPlain(document)).toBe('A B C D E');
  });
});

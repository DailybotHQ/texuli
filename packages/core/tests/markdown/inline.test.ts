/**
 * `parseInlineMarkdown` (PLAN_023 T-md-adopt): inline content only, for the closed inline
 * vocabularies (chat messages, catalog rich text); and list items at the block depth limit.
 */
import { describe, expect, it } from 'vitest';
import { parseInlineMarkdown, parseMarkdown } from '../../src/markdown/index.ts';

describe('parseInlineMarkdown', () => {
  it('reads no block structure', () => {
    expect(parseInlineMarkdown('# not a heading\n- not a list').children).toEqual([
      { type: 'text', value: '# not a heading\n- not a list' },
    ]);
  });

  it('gives links and images their source position', () => {
    const source = 'see [a](https://example.com) and ![b](c.png)';
    const [, link, , image] = parseInlineMarkdown(source).children;
    expect(link?.position && source.slice(link.position.start, link.position.end)).toBe(
      '[a](https://example.com)'
    );
    expect(image?.position && source.slice(image.position.start, image.position.end)).toBe(
      '![b](c.png)'
    );
    // Block reads carry no inline positions.
    const paragraph = parseMarkdown(source).tree.children[0];
    expect(JSON.stringify(paragraph)).not.toContain('position');
  });

  it('never throws and bounds its source', () => {
    expect(parseInlineMarkdown(undefined).children).toEqual([]);
    const cut = parseInlineMarkdown('x'.repeat(20), { limits: { source: 5 } });
    expect(cut.children).toEqual([{ type: 'text', value: 'xxxxx' }]);
    expect(cut.diagnostics.map((d) => d.code)).toEqual(['source-truncated']);
  });
});

describe('block depth limit', () => {
  it('lets a sibling item join a list opened at the limit', () => {
    const { tree, diagnostics } = parseMarkdown('- a\n  - b\n  - c\n', {
      limits: { blockDepth: 2 },
    });
    expect(diagnostics).toEqual([]);
    const inner =
      tree.children[0]?.type === 'list' ? tree.children[0].children[0]?.children[1] : undefined;
    expect(inner?.type === 'list' && inner.children).toHaveLength(2);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DOCS_SECTIONS,
  docsPager,
  flattenDocsNav,
  normalizeDocsPath,
} from '../../apps/website/src/components/docs-shell/nav.ts';

describe('docs shell nav', () => {
  it('normalizes paths for comparison', () => {
    expect(normalizeDocsPath('/docs-shell')).toBe('/docs-shell/');
    expect(normalizeDocsPath('/docs-shell/index.html')).toBe('/docs-shell/');
    expect(normalizeDocsPath('docs-shell/getting-started')).toBe('/docs-shell/getting-started/');
  });

  it('flattens sections into reading order', () => {
    const flat = flattenDocsNav(DOCS_SECTIONS);
    expect(flat.map((item) => item.href)).toEqual([
      '/docs-shell/',
      '/docs-shell/getting-started/',
      '/docs-shell/navigation/',
      '/slides-page/',
      '/slides-page/#package-docs',
      '/examples/slides-tour/',
      '/showcase/slide-deck/',
    ]);
  });

  it('computes previous and next without wrapping', () => {
    expect(docsPager('/docs-shell/').prev).toBeUndefined();
    expect(docsPager('/docs-shell/').next?.href).toBe('/docs-shell/getting-started/');
    expect(docsPager('/docs-shell/getting-started/').prev?.href).toBe('/docs-shell/');
    expect(docsPager('/docs-shell/getting-started/').next?.href).toBe('/docs-shell/navigation/');
    expect(docsPager('/docs-shell/navigation/').next?.href).toBe('/slides-page/');
    expect(docsPager('/showcase/slide-deck/').next).toBeUndefined();
    expect(docsPager('/unknown/').current).toBeUndefined();
  });
});

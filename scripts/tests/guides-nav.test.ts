// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  flattenGuidesNav,
  GUIDES_SECTIONS,
  guidesPager,
  normalizeDocsPath,
} from '../../apps/website/src/components/guides/nav.ts';

describe('guides nav', () => {
  it('lists every guide path once in reading order', () => {
    const hrefs = flattenGuidesNav().map((item) => item.href);
    expect(hrefs).toEqual([
      '/guides/',
      '/guides/getting-started/',
      '/guides/why-svelte-kotlin/',
      '/guides/theming/',
      '/guides/dark-mode/',
      '/guides/accessibility/',
      '/guides/rtl-i18n/',
      '/guides/forms/',
      '/guides/performance/',
    ]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('normalizes guide paths the same way as the docs shell', () => {
    expect(normalizeDocsPath('/guides')).toBe('/guides/');
    expect(normalizeDocsPath('/guides/forms/index.html')).toBe('/guides/forms/');
  });

  it('pagers without wrapping and covers every section item', () => {
    expect(guidesPager('/guides/').prev).toBeUndefined();
    expect(guidesPager('/guides/').next?.href).toBe('/guides/getting-started/');
    expect(guidesPager('/guides/performance/').next).toBeUndefined();
    expect(guidesPager('/guides/performance/').prev?.href).toBe('/guides/forms/');
    expect(guidesPager('/unknown/').current).toBeUndefined();

    const flatCount = flattenGuidesNav().length;
    const sectionCount = GUIDES_SECTIONS.reduce((sum, section) => sum + section.items.length, 0);
    expect(flatCount).toBe(sectionCount);
  });
});

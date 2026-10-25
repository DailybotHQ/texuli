import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

describe('Astro content site doc example', () => {
  it('registers a stable id and renders static doc-page previews in both themes', async () => {
    expect(listExampleIds()).toContain('astro-site-doc');
    const entry = getExample('astro-site-doc');
    expect(entry).toMatchObject({
      title: 'Astro content site doc',
      component: 'astro/layouts/ContentLayout',
      tags: expect.arrayContaining(['astro', 'docs', 'responsive', 'light', 'dark']),
    });

    const example = await entry?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Astro site doc example did not load.');

    const { container } = render(example.default);
    expect(container.querySelectorAll('[data-tx-mode="light"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-tx-mode="dark"]')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(2);
    expect(container.querySelectorAll('h4')).toHaveLength(4);
    expect(container.querySelectorAll('a[href="https://example.com/changelog"]')).toHaveLength(2);
  });
});

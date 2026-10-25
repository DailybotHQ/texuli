import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

describe('Astro content site example', () => {
  it('registers a stable id and renders static hero and section previews in both themes', async () => {
    expect(listExampleIds()).toContain('astro-site-hero');
    const entry = getExample('astro-site-hero');
    expect(entry).toMatchObject({
      title: 'Astro content site hero',
      component: 'astro/sections/Hero',
      tags: expect.arrayContaining(['astro', 'responsive', 'light', 'dark']),
    });

    const example = await entry?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Astro site hero example did not load.');

    const { container } = render(example.default);
    expect(container.querySelectorAll('[data-tx-mode="light"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-tx-mode="dark"]')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(2);
    expect(container.querySelectorAll('.features')).toHaveLength(2);
    expect(container.querySelectorAll('a[href="https://example.com/stories"]')).toHaveLength(2);
  });
});

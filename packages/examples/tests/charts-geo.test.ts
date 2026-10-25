import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('geo chart example', () => {
  it('loads the map components lazily in light and dark modes', async () => {
    const entry = getExample('charts-geo');
    expect(entry?.component).toBe('charts/geo');
    const example = await entry?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Geo chart example did not load.');
    const { container } = render(example.default);
    expect(container.querySelector('[data-tx-mode="light"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-mode="dark"]')).not.toBeNull();
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(4);
    expect(container.querySelectorAll('details')).toHaveLength(4);
  });
});

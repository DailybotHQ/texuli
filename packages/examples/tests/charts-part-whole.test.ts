import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('part-whole chart example', () => {
  it('loads the charts lazily and demonstrates both color schemes', async () => {
    const entry = getExample('charts-part-whole');
    expect(entry?.component).toBe('charts/part-whole');
    const example = await entry?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Part-whole chart example did not load.');
    const { container } = render(example.default);

    expect(container.querySelector('[data-tx-mode="light"]')).not.toBeNull();
    expect(container.querySelector('[data-tx-mode="dark"]')).not.toBeNull();
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(8);
    expect(container.querySelectorAll('details')).toHaveLength(8);
  });
});

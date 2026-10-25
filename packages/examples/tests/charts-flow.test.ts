import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('flow chart example', () => {
  it('registers one lazy light and dark showcase of all three chart types', async () => {
    const entry = getExample('charts-flow');
    expect(entry?.component).toBe('charts/flow');
    const example = await entry?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Flow chart example did not load.');
    const { container } = render(example.default);

    expect(container.querySelectorAll('[data-tx-mode="light"] figure')).toHaveLength(3);
    expect(container.querySelectorAll('[data-tx-mode="dark"] figure')).toHaveLength(3);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(6);
    expect(container.querySelectorAll('details')).toHaveLength(6);
  });
});

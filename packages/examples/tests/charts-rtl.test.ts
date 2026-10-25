import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('charts-rtl example', () => {
  it('renders charts in an RTL container with LTR plot coordinates', async () => {
    const module = await getExample('charts-rtl')?.load();
    if (!module) throw new Error('charts-rtl example did not load.');
    const { container } = render(module.default);
    const root = container.querySelector('[data-example="charts-rtl"]');
    expect(root?.getAttribute('dir')).toBe('rtl');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 5000 });
    const plots = [...container.querySelectorAll('svg[role="img"]')];
    expect(plots.length).toBeGreaterThanOrEqual(5);
    for (const svg of plots) expect(svg.getAttribute('direction')).toBe('ltr');
  });
});

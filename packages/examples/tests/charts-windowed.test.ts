import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

describe('charts-windowed example', () => {
  it('registers and moves its visible window within the series', async () => {
    expect(listExampleIds()).toContain('charts-windowed');
    const module = await getExample('charts-windowed')?.load();
    if (!module) throw new Error('charts-windowed example did not load.');
    const { container } = render(module.default);
    const window = () => container.querySelector('[data-window]')?.textContent?.trim();
    expect(window()).toBe('Showing requests 40 to 60');

    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    expect(window()).toBe('Showing requests 20 to 40');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    // Clamped at the start of the series.
    expect(window()).toBe('Showing requests 0 to 20');
    await fireEvent.click(screen.getByRole('button', { name: 'Full range' }));
    expect(window()).toBe('Showing requests 0 to 199');
  });
});

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('data board example', () => {
  it('keeps the default example left-to-right and labels its RTL preview', async () => {
    const example = await getExample('data-board')?.load();
    expect(example).toBeDefined();
    if (!example) throw new Error('Data board example did not load.');

    const { container, getByRole } = render(example.default);
    const root = container.querySelector('section.demo');
    expect(root?.getAttribute('dir')).toBe('ltr');
    expect(getByRole('heading', { name: 'Right-to-left preview' })).toBeTruthy();
    expect(container.querySelector('.rtl-preview .tx-board')?.getAttribute('dir')).toBe('rtl');
  });
});

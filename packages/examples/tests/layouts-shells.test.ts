import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('application shell example', () => {
  it('registers and renders skip links, navigation, RTL copy, and notifications', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const entry = getExample('layouts-shells');
    expect(entry?.component).toBe('texuli/AppShell');
    const loaded = await entry?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Application shell example did not load.');

    const { container, getByText } = render(loaded.default);
    expect(container.querySelectorAll('.tx-app-shell__skip')).toHaveLength(2);
    expect(container.querySelectorAll('[data-tx-app-shell-slot="notifications"]')).toHaveLength(2);
    expect(getByText('Wide workspace')).toBeTruthy();
    expect(getByText('RTL shell with drawer')).toBeTruthy();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('[data-tx-layout-drawer]')).not.toBeNull());
  });
});

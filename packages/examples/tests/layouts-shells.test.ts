import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

async function renderExample() {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const entry = getExample('layouts-shells');
  expect(entry?.component).toBe('texuli/AppShell');
  const loaded = await entry?.load();
  expect(loaded).toBeDefined();
  if (!loaded) throw new Error('Application shell example did not load.');
  return render(loaded.default);
}

describe('application shell example', () => {
  it('registers and renders skip links, navigation, RTL copy, and notifications', async () => {
    const { container, getByText } = await renderExample();
    expect(container.querySelectorAll('.tx-app-shell__skip')).toHaveLength(2);
    expect(container.querySelectorAll('[data-tx-app-shell-slot="notifications"]')).toHaveLength(2);
    expect(getByText('Wide workspace')).toBeTruthy();
    expect(getByText('RTL shell with drawer')).toBeTruthy();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
  });

  it('starts with the RTL drawer closed and opens it only from its expanded-state toggle', async () => {
    const { getByRole, queryByRole } = await renderExample();
    // Let any lazy drawer chunk settle: a drawer opened on mount would move
    // focus into a modal the visitor never asked for and make the page inert.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await tick();
    expect(document.querySelector('[data-tx-layout-drawer]')).toBeNull();
    expect(queryByRole('dialog')).toBeNull();
    // No lingering "loading the drawer" status either.
    expect(queryByRole('status')).toBeNull();

    const toggle = getByRole('button', { name: 'فتح التنقل' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.querySelector('[data-tx-layout-drawer]')).not.toBeNull());
  });
});

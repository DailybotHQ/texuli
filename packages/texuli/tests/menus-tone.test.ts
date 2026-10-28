import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { menuItemClass } from '../src/components/menus/index.ts';
import Harness from './fixtures/MenuToneHarness.svelte';

// G28: a destructive (danger) tone on MenuItem.

describe('MenuItem destructive tone (G28)', () => {
  afterEach(cleanup);

  it('marks only the destructive item with the danger class and data-tone', async () => {
    render(Harness);
    const remove = await screen.findByRole('menuitem', { name: 'Delete board' });
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(remove.className).toContain('tx-menu-item--destructive');
    expect(remove.getAttribute('data-tone')).toBe('destructive');
    expect(rename.className).not.toContain('tx-menu-item--destructive');
    expect(rename.hasAttribute('data-tone')).toBe(false);
    expect(menuItemClass({ destructive: true })).toBe('tx-menu-item tx-menu-item--destructive');
  });
});

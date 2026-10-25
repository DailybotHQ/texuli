import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TabsHarness from './TabsHarness.svelte';

afterEach(cleanup);

describe('Tabs', () => {
  it('exposes a named tablist with the first tab selected and its panel shown', () => {
    const view = render(TabsHarness, { props: { value: 'profile' } });
    expect(view.getByRole('tablist', { name: 'Account' })).toBeTruthy();
    expect(view.getAllByRole('tab')).toHaveLength(4);
    expect(view.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true');
    expect(view.getByRole('tabpanel', { name: 'Profile' }).textContent).toMatch(/Profile details/);
    expect(view.getByRole('tab', { name: 'Billing' })).toHaveProperty('disabled', true);
  });

  it('selects on click and notifies onValueChange', async () => {
    const onValueChange = vi.fn();
    const view = render(TabsHarness, {
      props: { value: 'profile', onValueChange },
    });
    await fireEvent.click(view.getByRole('tab', { name: 'Team' }));
    expect(onValueChange).toHaveBeenCalledWith('team');
    expect(view.getByRole('tab', { name: 'Team' }).getAttribute('aria-selected')).toBe('true');
    expect(view.getByRole('tabpanel', { name: 'Team' }).textContent).toMatch(/teammates/);
  });

  it('in manual mode, Space activates without relying on automatic focus selection', async () => {
    const onValueChange = vi.fn();
    const view = render(TabsHarness, {
      props: { value: 'profile', activationMode: 'manual', onValueChange },
    });
    const security = view.getByRole('tab', { name: 'Security' });
    security.focus();
    // Manual: focus alone must not change value
    expect(view.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(security, { key: ' ' });
    expect(onValueChange).toHaveBeenCalledWith('security');
  });

  it('keeps inactive panels hidden but mounted by default', () => {
    const view = render(TabsHarness, { props: { value: 'profile' } });
    const security = view.container.querySelector('[data-tx-tabs-content][data-value="security"]');
    expect(security).toBeTruthy();
    expect(security?.hasAttribute('hidden')).toBe(true);
  });
});

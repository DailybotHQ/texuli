import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Accordion from '../src/components/tabs-accordion/Accordion.svelte';
import Collapsible from '../src/components/tabs-accordion/Collapsible.svelte';
import Tabs from '../src/components/tabs-accordion/Tabs.svelte';

afterEach(cleanup);

const tabItems = [
  { value: 'profile', label: 'Profile' },
  { value: 'team', label: 'Team', badge: 3 },
  { value: 'billing', label: 'Billing', disabled: true },
];

describe('Tabs', () => {
  it('renders a named tablist and selects on click', async () => {
    const onValueChange = vi.fn();
    const view = render(Tabs, {
      props: {
        items: tabItems,
        value: 'profile',
        label: 'Account',
        variant: 'pills',
        onValueChange,
      },
    });
    expect(view.getByRole('tablist', { name: 'Account' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true');
    expect(view.getByRole('tab', { name: 'Billing' })).toHaveProperty('disabled', true);
    expect(view.getByText('3')).toBeTruthy();
    await fireEvent.click(view.getByRole('tab', { name: 'Team' }));
    expect(onValueChange).toHaveBeenCalledWith('team');
  });

  it('exposes line, pills and enclosed variants', () => {
    for (const variant of ['line', 'pills', 'enclosed'] as const) {
      const view = render(Tabs, {
        props: { items: tabItems, value: 'profile', label: 'Nav', variant },
      });
      expect(view.container.querySelector(`[data-variant="${variant}"]`)).toBeTruthy();
      view.unmount();
    }
  });

  it('wraps arrow-key focus past the ends when loop is set (APG)', async () => {
    const view = render(Tabs, {
      props: {
        items: [
          { value: 'alpha', label: 'Alpha' },
          { value: 'beta', label: 'Beta' },
          { value: 'gamma', label: 'Gamma' },
        ],
        value: 'gamma',
        label: 'Wrap',
        loop: true,
      },
    });
    const gamma = view.getByRole('tab', { name: 'Gamma' });
    gamma.focus();
    expect(document.activeElement).toBe(gamma);
    await fireEvent.keyDown(gamma, { key: 'ArrowRight' });
    // `loop` reaches the tabs primitive: focus wraps to the first tab …
    const alpha = view.getByRole('tab', { name: 'Alpha' });
    expect(document.activeElement).toBe(alpha);
    // … and automatic activation follows the focus move.
    expect(alpha.getAttribute('aria-selected')).toBe('true');
    expect(gamma.getAttribute('aria-selected')).toBe('false');
  });
});

describe('Accordion', () => {
  it('opens one section in single mode and reports changes', async () => {
    const onValueChange = vi.fn();
    render(Accordion, {
      props: {
        type: 'single',
        value: '',
        onValueChange,
        items: [
          { value: 'ship', title: 'Shipping', content: 'Ships in two fictional days.' },
          { value: 'return', title: 'Returns', content: '30-day fictional window.' },
        ],
      },
    });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    const ship = screen.getByRole('button', { name: 'Shipping' });
    expect(ship.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(ship);
    expect(onValueChange).toHaveBeenCalledWith('ship');
    expect(ship.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'Shipping' }).textContent).toMatch(/two fictional/);
  });

  it('allows multiple open sections', async () => {
    const onValueChange = vi.fn();
    render(Accordion, {
      props: {
        type: 'multiple',
        value: [],
        onValueChange,
        variant: 'bordered',
        items: [
          { value: 'a', title: 'Alpha', content: 'A body' },
          { value: 'b', title: 'Beta', content: 'B body' },
        ],
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b']);
    expect(document.querySelector('[data-variant="bordered"]')).toBeTruthy();
  });
});

describe('Collapsible', () => {
  it('toggles disclosure content', async () => {
    const onOpenChange = vi.fn();
    render(Collapsible, {
      props: {
        label: 'Shipping details',
        defaultOpen: false,
        onOpenChange,
      },
    });
    const trigger = screen.getByRole('button', { name: /Shipping details/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

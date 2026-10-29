import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Tabs from '../src/components/tabs-accordion/Tabs.svelte';
import CustomIcon from './fixtures/CustomIcon.svelte';

// G29: TabItem icon (a built-in name or a Svelte SVG component).

describe('TabItem icon (G29)', () => {
  afterEach(cleanup);

  it('renders a decorative icon before the label and keeps the tab name the label', () => {
    const view = render(Tabs, {
      props: {
        label: 'Views',
        items: [
          { value: 'search', label: 'Search', icon: 'search' },
          { value: 'custom', label: 'Custom', icon: CustomIcon },
          { value: 'plain', label: 'Plain' },
        ],
      },
    });
    for (const name of ['Search', 'Custom']) {
      const tab = view.getByRole('tab', { name });
      const icon = tab.querySelector('[data-tx-tabs-icon]');
      expect(icon, name).toBeTruthy();
      expect(icon?.getAttribute('aria-hidden'), name).toBe('true');
      expect(tab.firstElementChild, name).toBe(icon);
    }
    expect(view.getByRole('tab', { name: 'Plain' }).querySelector('svg')).toBeNull();
  });
});

// G54: a tab badge is part of the tab's accessible name (or `badgeLabel`).

describe('TabItem badge name (G54)', () => {
  afterEach(cleanup);

  it('names each tab with its badge, or with badgeLabel when given', () => {
    const view = render(Tabs, {
      props: {
        label: 'Sections',
        items: [
          { value: 'members', label: 'Members', badge: 12 },
          { value: 'invites', label: 'Invites', badge: 3, badgeLabel: '3 pending' },
          { value: 'plain', label: 'Plain' },
        ],
      },
    });
    const cases: Array<[string, string]> = [
      ['members', 'Members 12'],
      ['invites', 'Invites 3 pending'],
      ['plain', 'Plain'],
    ];
    const tabs = view.getAllByRole('tab');
    for (const [index, [value, name]] of cases.entries()) {
      // The visible badge stays decorative; a visually hidden suffix carries the name.
      expect(view.getByRole('tab', { name }), value).toBe(tabs[index]);
      expect(tabs[index]?.querySelector('.tx-tabs__badge')?.getAttribute('aria-hidden')).toBe(
        value === 'plain' ? undefined : 'true'
      );
    }
  });
});

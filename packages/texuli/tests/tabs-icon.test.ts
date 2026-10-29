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

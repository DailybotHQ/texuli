import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Icon from '../src/components/icons/Icon.svelte';
import { ICON_NAMES } from '../src/components/icons/index.ts';
import { LucideIcon } from '../src/components/icons/lucide.ts';
import type { IconName, IconSize } from '../src/components/icons/types.ts';
import CustomIcon from './fixtures/CustomIcon.svelte';

afterEach(() => cleanup());

describe('Icon', () => {
  it('renders every built-in name as a decorative SVG by default', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(Icon, { props: { icon: name } });
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('data-tx-icon')).toBe(name);
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.querySelector('path')?.getAttribute('d')).toBeTruthy();
      unmount();
    }
  });

  it.each([
    ['xs', '12'],
    ['sm', '16'],
    ['md', '20'],
    ['lg', '24'],
  ] as const)('renders the %s size variant', (size, pixels) => {
    const { container } = render(Icon, { props: { icon: 'search', size } });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe(pixels);
    expect(svg?.getAttribute('height')).toBe(pixels);
    expect(svg?.getAttribute('class')).toContain(`tx-icon--${size}`);
  });

  it('supports a translated accessible name and keeps consumer classes last', () => {
    render(Icon, {
      props: {
        icon: 'info',
        label: 'Information',
        class: 'consumer-class',
      },
    });
    const icon = screen.getByRole('img', { name: 'Information' });
    expect(icon.getAttribute('class')).toBe('tx-icon tx-icon--md consumer-class');
    expect(icon.getAttribute('aria-hidden')).toBeNull();
  });

  it('accepts a Lucide-compatible Svelte component through the optional bridge', () => {
    render(LucideIcon, {
      props: {
        icon: CustomIcon,
        size: 'lg' satisfies IconSize,
        label: 'Favorite',
      },
    });
    const icon = screen.getByRole('img', { name: 'Favorite' });
    expect(icon.getAttribute('width')).toBe('24');
    expect(icon.getAttribute('data-tx-icon')).toBe('custom');
  });

  it('renders nothing for a runtime name outside the built-in set', () => {
    const { container } = render(Icon, { props: { icon: 'unknown' as IconName } });
    expect(container.querySelector('svg')).toBeNull();
  });
});

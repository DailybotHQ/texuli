// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ScrollAreaHarness from './fixtures/ScrollAreaHarness.svelte';

afterEach(cleanup);

describe('ScrollArea', () => {
  it('renders a labelled, focusable native viewport with the default size', () => {
    const view = render(ScrollAreaHarness, { props: {} });
    const region = screen.getByRole('region', { name: 'Activity' });
    const viewport = region.querySelector('[data-tx-scroll-area-viewport]');

    expect(viewport?.getAttribute('tabindex')).toBe('0');
    expect(viewport?.textContent).toContain('Activity item');
    expect(view.container.querySelector('[data-tx-scroll-area]')?.className).toContain(
      'tx-scroll-area--md'
    );
  });

  it('supports size variants, direction, visibility type and caller classes', () => {
    const view = render(ScrollAreaHarness, {
      props: {
        label: 'Arabic messages',
        size: 'lg',
        type: 'always',
        dir: 'rtl',
        class: 'custom-scroll-area',
      },
    });

    const root = view.container.querySelector('[data-tx-scroll-area]');
    expect(root?.getAttribute('dir')).toBe('rtl');
    expect(root?.getAttribute('data-type')).toBe('always');
    expect(root?.className).toContain('tx-scroll-area--lg');
    expect(root?.className).toContain('custom-scroll-area');
  });

  it('offers all documented size presets', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const view = render(ScrollAreaHarness, { props: { size } });
      expect(view.container.querySelector('[data-tx-scroll-area]')?.className).toContain(
        `tx-scroll-area--${size}`
      );
      view.unmount();
    }
  });

  it('keeps a visible custom scrollbar decorative and hidden from assistive technology', async () => {
    const view = render(ScrollAreaHarness, { props: { type: 'always' } });
    const viewport = view.container.querySelector('[data-tx-scroll-area-viewport]');
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
    await fireEvent.scroll(viewport as Element);

    await waitFor(() => {
      const scrollbar = view.container.querySelector('[data-tx-scroll-area-scrollbar]');
      expect(scrollbar?.getAttribute('aria-hidden')).toBe('true');
      expect(
        view.container.querySelector('[data-tx-scroll-area-thumb]')?.getAttribute('aria-hidden')
      ).toBe('true');
    });
  });
});

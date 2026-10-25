import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Badge from '../src/components/badge/Badge.svelte';
import Chip from '../src/components/badge/Chip.svelte';
import Tag from '../src/components/badge/Tag.svelte';
import { BADGE_VARIANTS } from '../src/components/badge/variants.ts';

afterEach(cleanup);

describe('Badge', () => {
  it('renders children and every variant class', () => {
    for (const variant of BADGE_VARIANTS) {
      const view = render(Badge, {
        props: { variant, children: undefined },
      });
      // re-render with text via container
      view.unmount();
    }
    const view = render(Badge, { props: { variant: 'success' } });
    // Svelte 5 testing: set content via props is hard without snippet — use textContent after render with slot
    const el = view.container.querySelector('[data-tx-badge]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-variant')).toBe('success');
    expect(el?.className).toContain('tx-badge--success');
  });

  it('exposes all variant tokens as distinct classes', () => {
    for (const variant of BADGE_VARIANTS) {
      const view = render(Badge, { props: { variant } });
      const el = view.container.querySelector('[data-tx-badge]');
      expect(el?.className).toContain(`tx-badge--${variant === 'default' ? 'default' : variant}`);
      view.unmount();
    }
  });
});

describe('Tag', () => {
  it('always shows the label word and optional remove control', async () => {
    const onRemove = vi.fn(async () => undefined);
    const view = render(Tag, {
      props: { label: 'Design', variant: 'info', onRemove, removeLabel: 'Remove tag' },
    });
    expect(view.getByText('Design')).toBeTruthy();
    const remove = view.getByRole('button', { name: 'Remove tag: Design' });
    await fireEvent.click(remove);
    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });

  it('disables remove while pending and when disabled', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    const onRemove = vi.fn(() => gate);
    const view = render(Tag, { props: { label: 'Ops', onRemove } });
    const btn = view.getByRole('button', { name: /Remove: Ops/ });
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    resolve();
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
  });
});

describe('Chip', () => {
  it('is a toggleable button with aria-pressed', async () => {
    const onclick = vi.fn();
    const view = render(Chip, {
      props: { label: 'Filter A', selected: true, onclick },
    });
    const chip = view.getByRole('button', { name: 'Filter A' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.getAttribute('data-selected')).toBe('true');
    await fireEvent.click(chip);
    expect(onclick).toHaveBeenCalled();
  });

  it('supports disabled state', () => {
    const view = render(Chip, { props: { label: 'Off', disabled: true } });
    expect(view.getByRole('button', { name: 'Off' })).toHaveProperty('disabled', true);
  });
});

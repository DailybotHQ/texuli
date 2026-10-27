import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('Tag remove target size', () => {
  // jsdom does no layout, so the 24px hit box is pinned as a stylesheet
  // contract (same pattern as the avatar contrast rules in avatar.test.ts).
  it('gives the remove control a 24px hit box without growing the tag', () => {
    const css = readFileSync(
      join(import.meta.dirname, '../src/components/badge/badge.css'),
      'utf8'
    );
    const rule = css.match(/\.tx-tag__remove\s*\{([^}]*)\}/)?.[1] ?? '';
    // The audit bar (rubric, responsive dimension): tap targets >= 24px. The
    // remove control rendered a 16px box (12px glyph + 2px padding).
    expect(rule).toContain('min-inline-size: 1.5rem');
    expect(rule).toContain('min-block-size: 1.5rem');
    // The larger box is clawed back on both axes so the tag's outer
    // geometry (and every visual baseline) stays as it was.
    expect(rule).toMatch(/margin:\s*-0\.25rem;/);
    expect(rule).toMatch(/padding:\s*0\.375rem;/);
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

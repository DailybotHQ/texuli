// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  POPOVER_SIZES,
  POPOVER_VARIANTS,
  popoverContentClass,
} from '../src/components/popover/index.ts';
import HoverCardFixture from './fixtures/HoverCardFixture.svelte';
import PopoverFixture from './fixtures/PopoverFixture.svelte';

afterEach(() => {
  cleanup();
});

describe('popover variants', () => {
  it('exposes elevated/flat variants and sm/md/lg sizes', () => {
    expect(POPOVER_VARIANTS).toEqual(['elevated', 'flat']);
    expect(POPOVER_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(popoverContentClass({ variant: 'flat', size: 'sm' })).toContain('tx-popover--flat');
    expect(popoverContentClass({ variant: 'flat', size: 'sm' })).toContain('tx-popover--sm');
  });
});

describe('Popover', () => {
  it('passes initialFocus through to the primitive content', async () => {
    render(PopoverFixture, { props: { label: 'Account menu', focusDone: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('dialog', { name: 'Account menu' });
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
    );
  });

  it('opens from the trigger, shows the arrow surface, and closes with Escape', async () => {
    render(PopoverFixture, {
      props: { open: true, label: 'Account menu' },
    });
    const content = await screen.findByRole('dialog', { name: 'Account menu' });
    expect(content.className).toContain('tx-popover');
    expect(content.querySelector('[data-tx-popover-arrow]')).toBeTruthy();
    expect(screen.getByText('Signed in as ada@example.com')).toBeTruthy();

    await fireEvent.keyDown(content.ownerDocument, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Account menu' })).toBeNull();
    });
  });

  it('applies flat and size classes', async () => {
    render(PopoverFixture, {
      props: { open: true, label: 'Filters', variant: 'flat', size: 'lg' },
    });
    const content = await screen.findByRole('dialog', { name: 'Filters' });
    expect(content.getAttribute('data-variant')).toBe('flat');
    expect(content.getAttribute('data-size')).toBe('lg');
    expect(content.className).toContain('tx-popover--flat');
    expect(content.className).toContain('tx-popover--lg');
  });

  it('closes from the Close control', async () => {
    render(PopoverFixture, {
      props: { open: true, label: 'Notes' },
    });
    await screen.findByRole('dialog', { name: 'Notes' });
    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull();
    });
  });
});

describe('HoverCard', () => {
  it('opens on pointer enter after delay and renders the arrow surface', async () => {
    render(HoverCardFixture, {
      props: { openDelay: 0, closeDelay: 0, label: 'Ada Lovelace' },
    });
    const trigger = screen.getByRole('button', { name: 'Ada Lovelace' });
    await fireEvent.pointerEnter(trigger);
    const content = await screen.findByRole('dialog', { name: 'Ada Lovelace' });
    expect(content.className).toContain('tx-hover-card');
    expect(content.querySelector('[data-tx-hover-card-arrow]')).toBeTruthy();
    expect(screen.getByText('Mathematician · example.com')).toBeTruthy();
  });
});

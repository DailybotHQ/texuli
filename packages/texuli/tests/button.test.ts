import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonVariants } from '../src/components/button/index.ts';
import ButtonGroupHarness from './fixtures/ButtonGroupHarness.svelte';
import ButtonHarness from './fixtures/ButtonHarness.svelte';
import IconButtonHarness from './fixtures/IconButtonHarness.svelte';

afterEach(() => {
  cleanup();
});

describe('buttonVariants', () => {
  it('emits layer class names for every variant and size', () => {
    expect(buttonVariants({ variant: 'destructive', size: 'lg' })).toContain(
      'tx-button--destructive'
    );
    expect(buttonVariants({ variant: 'link' })).toContain('tx-button--link-size');
    expect(buttonVariants({ size: 'icon' })).toContain('tx-button--icon');
  });
});

describe('Button', () => {
  it('renders a button with variant data attributes', () => {
    const { getByRole } = render(ButtonHarness, {
      props: { label: 'Save draft', variant: 'secondary', size: 'sm' },
    });
    const button = getByRole('button', { name: 'Save draft' });
    expect(button.className).toContain('tx-button--secondary');
    expect(button.className).toContain('tx-button--sm');
    expect(button.getAttribute('data-variant')).toBe('secondary');
  });

  it('shows pending while an async onclick promise is unsettled', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    const onclick = vi.fn(() => promise);
    const { getByRole, container } = render(ButtonHarness, {
      props: { label: 'Submit', onclick },
    });
    const button = getByRole('button', { name: 'Submit' });
    await fireEvent.click(button);
    expect(onclick).toHaveBeenCalled();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[data-tx-button-spinner]')).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    resolve();
    await promise;
    await vi.waitFor(() => {
      expect(button.getAttribute('aria-busy')).toBeNull();
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('renders safe href anchors and blocks unsafe ones', () => {
    const safe = render(ButtonHarness, {
      props: { label: 'Docs', href: 'https://example.com/docs' },
    });
    const link = safe.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('href')).toBe('https://example.com/docs');
    expect(link.className).toContain('tx-button--default');
    safe.unmount();

    const blocked = render(ButtonHarness, {
      props: { label: 'Bad', href: 'javascript:alert(1)' },
    });
    const btn = blocked.getByRole('button', { name: 'Bad' });
    expect(btn.getAttribute('data-href-blocked')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('honours disabled and loading props', () => {
    const { getByRole } = render(ButtonHarness, {
      props: { label: 'Wait', loading: true, loadingLabel: 'Saving' },
    });
    const button = getByRole('button', { name: /Wait|Saving/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});

describe('IconButton', () => {
  it('requires an accessible name via label', () => {
    const { getByRole } = render(IconButtonHarness, {
      props: { label: 'Close dialog' },
    });
    const button = getByRole('button', { name: 'Close dialog' });
    expect(button.className).toContain('tx-button--icon');
    expect(button.getAttribute('aria-label')).toBe('Close dialog');
  });
});

describe('ButtonGroup', () => {
  it('exposes a labelled group with orientation', () => {
    const { getByRole, getAllByRole } = render(ButtonGroupHarness, {
      props: { label: 'Alignment', orientation: 'horizontal' },
    });
    const group = getByRole('group', { name: 'Alignment' });
    expect(group.getAttribute('data-orientation')).toBe('horizontal');
    expect(group.getAttribute('data-attached')).toBe('true');
    expect(getAllByRole('button')).toHaveLength(3);
  });
});

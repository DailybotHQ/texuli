import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('loadingLabel replaces, not joins, the accessible name while busy', () => {
    // ui-button.md contract: `loadingLabel` is "the accessible name announced
    // while loading". The visible label must not concatenate into it.
    const { getByRole, queryByRole } = render(ButtonHarness, {
      props: { label: 'Save', loading: true, loadingLabel: 'Saving changes' },
    });
    expect(getByRole('button', { name: 'Saving changes' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Save Saving changes' })).toBeNull();
  });

  it('keeps the visible label as the name while busy without loadingLabel', () => {
    const { getByRole } = render(ButtonHarness, {
      props: { label: 'Save', loading: true },
    });
    expect(getByRole('button', { name: 'Save' })).toBeTruthy();
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

  it('forwards a non-default size and still defaults to icon', () => {
    const sized = render(IconButtonHarness, {
      props: { label: 'Large icon action', size: 'lg' },
    });
    const large = sized.getByRole('button', { name: 'Large icon action' });
    expect(large.className).toContain('tx-button--lg');
    expect(large.className).not.toContain('tx-button--icon');
    // The icon squareness follows the control at every size.
    expect(large.getAttribute('data-icon-only')).toBe('true');
    sized.unmount();

    const { getByRole } = render(IconButtonHarness, { props: { label: 'Icon action' } });
    const regular = getByRole('button', { name: 'Icon action' });
    expect(regular.className).toContain('tx-button--icon');
    expect(regular.getAttribute('data-icon-only')).toBe('true');
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

describe('button CSS source guards', () => {
  // Source guards for the audit lane T-54 (tex-buttons-actions). Layout and
  // motion behavior they pin is measured in browsers by the behavior suite;
  // these keep the family CSS rules from silently regressing in a unit run.
  const buttonCss = () =>
    readFileSync(join(process.cwd(), 'packages/texuli/src/components/button/button.css'), 'utf8');

  it('spinner period matches the sibling Spinner (tx-motion-slow, 0.75s)', () => {
    // components/feedback/feedback.css spins at var(--tx-motion-slow, 0.75s);
    // the busy spinner inside buttons must share the family period, not the
    // 200ms transition base (a frantic 5 revolutions per second).
    expect(buttonCss()).toMatch(
      /animation:\s*tx-button-spin\s+var\(--tx-motion-slow,\s*0\.75s\)\s+linear\s+infinite;/
    );
  });

  it('colors only through --tx-* tokens (no hex literals)', () => {
    expect(buttonCss()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('icon-only controls keep the square ratio at every size', () => {
    expect(buttonCss()).toMatch(
      /\.tx-button\[data-icon-only=['"]true['"]\]\s*\{[^}]*aspect-ratio:\s*1;/
    );
  });

  it('uses logical properties only (no physical top/right/bottom/left)', () => {
    expect(buttonCss()).not.toMatch(/(^|[^-a-z])(top|right|bottom|left)\s*:/);
  });
});

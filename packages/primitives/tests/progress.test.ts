import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { Progress } from '../src/progress/index.ts';
import ProgressRoot from '../src/progress/Progress.svelte';

afterEach(cleanup);

describe('Progress.Root', () => {
  it('exposes a named progressbar with value range', () => {
    const view = render(ProgressRoot, {
      props: {
        value: 40,
        max: 100,
        min: 0,
        'aria-label': 'Upload',
      },
    });
    const bar = view.getByRole('progressbar', { name: 'Upload' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('data-state')).toBe('loading');
    expect(bar.getAttribute('data-value')).toBe('40');
  });

  it('clamps value into [min, max] and marks complete at max', () => {
    const high = render(ProgressRoot, {
      props: { value: 150, max: 100, 'aria-label': 'Done' },
    });
    expect(high.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(high.getByRole('progressbar').getAttribute('data-state')).toBe('complete');
    high.unmount();

    const low = render(ProgressRoot, {
      props: { value: -10, min: 0, max: 50, 'aria-label': 'Low' },
    });
    expect(low.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('omits aria-valuenow when indeterminate (value null)', () => {
    const view = render(ProgressRoot, {
      props: { value: null, max: 100, 'aria-label': 'Working' },
    });
    const bar = view.getByRole('progressbar', { name: 'Working' });
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.getAttribute('data-state')).toBe('indeterminate');
    expect(bar.getAttribute('data-value')).toBeNull();
  });

  it('updates aria-valuenow when value changes', async () => {
    const view = render(ProgressRoot, {
      props: { value: 10, 'aria-label': 'Load' },
    });
    expect(view.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('10');
    await view.rerender({ value: 70, 'aria-label': 'Load' });
    expect(view.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('70');
    await view.rerender({ value: null, 'aria-label': 'Load' });
    expect(view.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('accepts aria-labelledby for the accessible name', () => {
    const view = render(ProgressRoot, {
      props: {
        value: 25,
        'aria-labelledby': 'upload-label',
      },
    });
    const bar = view.container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-labelledby')).toBe('upload-label');
  });

  it('renders through a child snippet with composed props', () => {
    const child = createRawSnippet((args: () => { props: Record<string, unknown> }) => ({
      render: () => {
        const props = args().props;
        const role = String(props.role ?? '');
        const now = props['aria-valuenow'] != null ? String(props['aria-valuenow']) : '';
        return `<div data-child-root role="${role}" aria-valuenow="${now}" aria-label="Via child"></div>`;
      },
    }));
    const view = render(ProgressRoot, {
      props: { value: 55, child },
    });
    const el = view.container.querySelector('[data-child-root]');
    expect(el?.getAttribute('role')).toBe('progressbar');
    expect(el?.getAttribute('aria-valuenow')).toBe('55');
  });

  it('exports Progress.Root namespace', () => {
    expect(Progress.Root).toBe(ProgressRoot);
  });
});

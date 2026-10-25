import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Progress from '../src/components/feedback/Progress.svelte';
import Skeleton from '../src/components/feedback/Skeleton.svelte';
import Spinner from '../src/components/feedback/Spinner.svelte';
import {
  FEEDBACK_SIZES,
  FEEDBACK_TONES,
  PROGRESS_SHAPES,
} from '../src/components/feedback/variants.ts';

afterEach(cleanup);

describe('Skeleton', () => {
  it('renders decorative placeholders for each size and circle', () => {
    for (const size of FEEDBACK_SIZES) {
      const view = render(Skeleton, { props: { size } });
      const el = view.container.querySelector('[data-tx-skeleton]');
      expect(el?.getAttribute('aria-hidden')).toBe('true');
      expect(el?.getAttribute('data-size')).toBe(size);
      view.unmount();
    }
    const circle = render(Skeleton, { props: { circle: true } });
    expect(circle.container.querySelector('[data-circle="true"]')?.className).toContain(
      'tx-skeleton--circle'
    );
  });
});

describe('Spinner', () => {
  it('is decorative without a label and a live status with one', () => {
    const deco = render(Spinner, { props: { tone: 'success' } });
    const el = deco.container.querySelector('[data-tx-spinner]');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.getAttribute('role')).toBeNull();
    expect(el?.getAttribute('data-tone')).toBe('success');
    deco.unmount();

    const live = render(Spinner, { props: { label: 'Saving notes' } });
    expect(live.getByRole('status').textContent).toContain('Saving notes');
    expect(live.container.querySelector('.tx-sr-only')?.textContent).toBe('Saving notes');
  });

  it('supports size presets', () => {
    for (const size of FEEDBACK_SIZES) {
      const view = render(Spinner, { props: { size, label: 'Wait' } });
      expect(view.container.querySelector(`[data-size="${size}"]`)).toBeTruthy();
      view.unmount();
    }
  });
});

describe('Progress', () => {
  it('renders a named linear bar with value and range', () => {
    const view = render(Progress, {
      props: {
        label: 'Upload',
        value: 40,
        max: 100,
        showValue: true,
        tone: 'primary',
      },
    });
    const bar = view.getByRole('progressbar', { name: 'Upload' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(view.getByText('40%')).toBeTruthy();
    expect(
      view.container.querySelector('[data-tx-progress-indicator]')?.getAttribute('style')
    ).toContain('--tx-progress-value: 40%');
  });

  it('omits aria-valuenow when indeterminate', () => {
    const view = render(Progress, {
      props: { label: 'Working', value: null, loadingLabel: 'Please wait' },
    });
    const bar = view.getByRole('progressbar', { name: 'Working' });
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.getAttribute('aria-valuetext')).toBe('Please wait');
    expect(view.container.querySelector('[data-state="indeterminate"]')).toBeTruthy();
    expect(view.container.querySelector('.tx-progress__indicator--indeterminate')).toBeTruthy();
  });

  it('renders circular progress with center value', () => {
    const view = render(Progress, {
      props: {
        shape: 'circular',
        value: 75,
        showValue: true,
        ariaLabel: 'Disk used',
        tone: 'info',
        size: 'lg',
      },
    });
    const bar = view.getByRole('progressbar', { name: 'Disk used' });
    expect(bar.getAttribute('aria-valuenow')).toBe('75');
    expect(view.container.querySelector('[data-shape="circular"]')).toBeTruthy();
    expect(view.container.querySelector('[data-tx-progress-value]')?.textContent).toContain('75%');
    const svg = view.container.querySelector('svg.tx-progress__circle');
    expect(svg?.getAttribute('style')).toContain('--tx-progress-offset');
  });

  it('covers tones and shapes without throwing', () => {
    for (const tone of FEEDBACK_TONES) {
      const view = render(Progress, { props: { value: 10, tone, ariaLabel: tone } });
      expect(view.container.querySelector(`[data-tone="${tone}"]`)).toBeTruthy();
      view.unmount();
    }
    for (const shape of PROGRESS_SHAPES) {
      const view = render(Progress, {
        props: { value: 20, shape, ariaLabel: shape },
      });
      expect(view.container.querySelector(`[data-shape="${shape}"]`)).toBeTruthy();
      view.unmount();
    }
  });
});

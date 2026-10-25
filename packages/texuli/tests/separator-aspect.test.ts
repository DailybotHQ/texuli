import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ASPECT_RATIOS,
  aspectRatioClass,
  SEPARATOR_ORIENTATIONS,
  SEPARATOR_VARIANTS,
  separatorClass,
  visuallyHiddenClass,
} from '../src/components/separator-aspect/index.ts';
import SeparatorAspectHarness from './fixtures/SeparatorAspectHarness.svelte';

afterEach(() => cleanup());

describe('separatorClass / aspectRatioClass / visuallyHiddenClass', () => {
  it('applies separator orientation and variant classes', () => {
    expect(separatorClass({ orientation: 'vertical' })).toContain('tx-separator--vertical');
    expect(separatorClass({ variant: 'subtle' })).toContain('tx-separator--subtle');
    expect(SEPARATOR_ORIENTATIONS).toContain('horizontal');
    expect(SEPARATOR_VARIANTS).toContain('strong');
  });

  it('applies named aspect ratio classes', () => {
    expect(aspectRatioClass({ ratio: '1/1' })).toContain('tx-aspect-ratio--1-1');
    expect(aspectRatioClass({ ratio: '16/9' })).toContain('tx-aspect-ratio--16-9');
    expect(ASPECT_RATIOS).toContain('9/16');
  });

  it('builds the visually-hidden base class', () => {
    expect(visuallyHiddenClass()).toContain('tx-visually-hidden');
    expect(visuallyHiddenClass({ class: 'extra' })).toContain('extra');
  });
});

describe('Separator / AspectRatio / VisuallyHidden', () => {
  it('renders a decorative horizontal separator by default', () => {
    const { container } = render(SeparatorAspectHarness, { props: { show: 'separator' } });
    const el = container.querySelector('[data-tx-separator]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('role')).toBe('none');
    expect(el?.getAttribute('data-orientation')).toBe('horizontal');
    expect(el?.className).toContain('tx-separator--horizontal');
  });

  it('renders a semantic vertical separator', () => {
    const { container } = render(SeparatorAspectHarness, {
      props: {
        show: 'separator',
        orientation: 'vertical',
        decorative: false,
        variant: 'strong',
      },
    });
    const el = container.querySelector('[data-tx-separator]');
    expect(el?.getAttribute('role')).toBe('separator');
    expect(el?.getAttribute('aria-orientation')).toBe('vertical');
    expect(el?.getAttribute('data-variant')).toBe('strong');
    expect(el?.className).toContain('tx-separator--vertical');
  });

  it('renders AspectRatio with a named ratio and slotted content', () => {
    const { container, getByText } = render(SeparatorAspectHarness, {
      props: { show: 'aspect', ratio: '4/3' },
    });
    const el = container.querySelector('[data-tx-aspect-ratio]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-ratio')).toBe('4/3');
    expect(el?.className).toContain('tx-aspect-ratio--4-3');
    expect(getByText('Preview')).toBeTruthy();
  });

  it('applies a custom aspect-ratio CSS variable', () => {
    const { container } = render(SeparatorAspectHarness, {
      props: { show: 'aspect', custom: '5 / 4' },
    });
    const el = container.querySelector('[data-tx-aspect-ratio]') as HTMLElement | null;
    expect(el?.getAttribute('data-ratio')).toBe('custom');
    expect(el?.className).toContain('tx-aspect-ratio--custom');
    expect(el?.getAttribute('style') ?? el?.style.cssText ?? '').toMatch(/--tx-aspect-ratio/);
  });

  it('renders VisuallyHidden content for assistive tech', () => {
    const { container, getByText } = render(SeparatorAspectHarness, {
      props: { show: 'hidden' },
    });
    const el = container.querySelector('[data-tx-visually-hidden]');
    expect(el).toBeTruthy();
    expect(el?.className).toContain('tx-visually-hidden');
    expect(getByText('Screen reader only label')).toBeTruthy();
  });
});

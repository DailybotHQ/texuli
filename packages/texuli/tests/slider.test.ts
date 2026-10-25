import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SliderHarness from './fixtures/SliderHarness.svelte';

afterEach(() => cleanup());

describe('Slider', () => {
  it('renders a labelled single slider with a value readout', () => {
    render(SliderHarness, { props: { mode: 'single', label: 'Volume' } });
    expect(screen.getByText('Volume')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    const thumb = screen.getByRole('slider', { name: 'Volume' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('40');
    expect(document.querySelector('.tx-slider')).toBeTruthy();
    expect(document.querySelector('.tx-slider__range')).toBeTruthy();
  });

  it('renders a range with two thumbs', () => {
    render(SliderHarness, { props: { mode: 'range' } });
    expect(screen.getByRole('slider', { name: 'Minimum price' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Maximum price' })).toBeTruthy();
    expect(screen.getByText('200 – 800')).toBeTruthy();
  });

  it('marks disabled state on the root', () => {
    render(SliderHarness, { props: { mode: 'disabled' } });
    const root = document.querySelector('[data-tx-slider-root]');
    expect(root?.getAttribute('data-disabled')).toBe('');
    const thumb = screen.getByRole('slider', { name: 'Locked' });
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows mark labels and ticks', () => {
    render(SliderHarness, { props: { mode: 'marks' } });
    expect(screen.getByText('Low')).toBeTruthy();
    expect(screen.getByText('Mid')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(document.querySelectorAll('.tx-slider__tick').length).toBeGreaterThan(0);
  });

  it('moves the thumb with keyboard', async () => {
    render(SliderHarness, { props: { mode: 'single', label: 'Volume' } });
    const thumb = screen.getByRole('slider', { name: 'Volume' });
    thumb.focus();
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(Number(thumb.getAttribute('aria-valuenow'))).toBeGreaterThan(40);
  });

  it('applies size classes', () => {
    render(SliderHarness, { props: { mode: 'single', size: 'lg' } });
    expect(document.querySelector('.tx-slider--lg')).toBeTruthy();
  });
});

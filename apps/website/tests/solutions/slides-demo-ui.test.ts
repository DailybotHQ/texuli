// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SlidesDemo from '../../src/components/solutions/slides/demo/SlidesDemo.svelte';
import SlidesDemoPreview from '../../src/components/solutions/slides/demo/SlidesDemoPreview.svelte';

const stage = (root: ParentNode = document) => root.querySelector<HTMLElement>('.tx-deck-stage');
const activeSlide = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>('[aria-roledescription="slide"][data-tx-deck-active="true"]');
const activeSlideId = (root: ParentNode = document) => activeSlide(root)?.dataset.slideId;

async function startDemo(root: HTMLElement): Promise<void> {
  const button = root.querySelector<HTMLButtonElement>('.slides-demo__start');
  expect(button).not.toBeNull();
  await fireEvent.click(button as HTMLButtonElement);
  await waitFor(() => expect(activeSlide(root)).not.toBeNull(), { timeout: 10_000 });
}

afterEach(() => {
  window.location.hash = '';
});

describe('Slides Solution demo island', () => {
  it('renders the same local fixture in its SSR preview and the island without URL or network behavior', async () => {
    const preview = render(SlidesDemoPreview);
    await waitFor(() => expect(activeSlide(preview.container)).not.toBeNull(), { timeout: 10_000 });
    expect(
      preview.container.querySelector('[data-tx-slides-demo-preview="texuli-in-motion"]')
    ).not.toBeNull();
    expect(preview.container.textContent).toContain('Presentations, built from pieces');
    expect(stage(preview.container)?.getAttribute('aria-label')).toContain('Texuli in motion');

    const island = render(SlidesDemo);
    await startDemo(island.container);
    expect(island.container.querySelector('[data-tx-slides-demo=""]')).not.toBeNull();
    expect(activeSlideId(island.container)).toBe('pieces');
    expect(window.location.hash).toBe('');
    expect(island.container.querySelector('script, [onerror], [onclick]')).toBeNull();
  });

  it('performs navigation, play, theme, source, scenario and reset actions accessibly', async () => {
    const { container } = render(SlidesDemo);
    await startDemo(container);

    await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlideId(container)).toBe('compare');
    expect(container.querySelector('.controls__position')?.textContent).toContain('Slide 2 of 7');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlideId(container)).toBe('pieces');

    await fireEvent.click(screen.getByRole('button', { name: 'Play slides' }));
    expect(screen.getByRole('button', { name: 'Pause slides' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Pause slides' }));

    await fireEvent.click(screen.getByRole('button', { name: /^Theme: ocean$/i }));
    expect(screen.getByRole('button', { name: /^Theme: graphite$/i })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(screen.getByRole('region', { name: 'Deck source as JSON' }).textContent).toContain(
      'Texuli in motion'
    );
    expect(container.querySelector('pre')?.textContent).toContain('formatVersion');

    await fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: 'data-report' } });
    await waitFor(() => expect(activeSlideId(container)).toBe('opening'));
    expect(container.querySelector('.controls__position')?.textContent).toContain('Slide 1 of 5');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset example' }));
    await waitFor(() => expect(activeSlideId(container)).toBe('opening'));
    expect(screen.queryByRole('region', { name: 'Deck source as JSON' })).toBeNull();
    expect(container.querySelector('.controls__position')?.textContent).toContain('Example reset');
  });

  it('supports keyboard navigation and touch swipes through the real slides stage', async () => {
    const { container } = render(SlidesDemo);
    await startDemo(container);

    const slide = activeSlide(container);
    slide?.focus();
    await fireEvent.keyDown(slide as HTMLElement, { key: 'ArrowRight' });
    expect(activeSlideId(container)).toBe('compare');

    const canvas = container.querySelector<HTMLElement>('[data-tx-deck-canvas]');
    expect(canvas).not.toBeNull();
    await fireEvent.pointerDown(canvas as HTMLElement, {
      pointerId: 17,
      pointerType: 'touch',
      clientX: 400,
      clientY: 200,
    });
    await fireEvent.pointerUp(canvas as HTMLElement, {
      pointerId: 17,
      pointerType: 'touch',
      clientX: 280,
      clientY: 204,
    });
    expect(activeSlideId(container)).toBe('signal');
  });
});

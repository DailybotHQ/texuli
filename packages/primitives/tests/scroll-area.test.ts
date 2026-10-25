// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ScrollAreaFixture from './fixtures/ScrollAreaFixture.svelte';

afterEach(() => {
  cleanup();
});

describe('ScrollArea', () => {
  it('renders a focusable viewport that keeps native overflow scrolling', async () => {
    render(ScrollAreaFixture, { props: { type: 'always', itemCount: 50, height: 100 } });
    const viewport = screen.getByTestId('scroll-viewport');
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.getAttribute('data-tx-scroll-area-viewport')).toBe('');
    // Force layout sizes for happy-dom
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 240, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 240, configurable: true });
    fireEvent.scroll(viewport, { target: { scrollTop: 40 } });
    // scrollTop assignment
    (viewport as HTMLElement).scrollTop = 40;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      expect(screen.getByTestId('scroll-y').getAttribute('data-state')).toBe('visible');
    });
  });

  it('exposes vertical scrollbar chrome that is aria-hidden', async () => {
    render(ScrollAreaFixture, { props: { type: 'always', itemCount: 30, height: 80 } });
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperty(viewport, 'clientHeight', { value: 80, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
    fireEvent.scroll(viewport);
    await waitFor(() => {
      const bar = screen.getByTestId('scroll-y');
      expect(bar.getAttribute('aria-hidden')).toBe('true');
      expect(bar.getAttribute('data-orientation')).toBe('vertical');
    });
  });

  it('type=hover starts hidden until pointer enters the root', async () => {
    render(ScrollAreaFixture, { props: { type: 'hover', itemCount: 30, height: 80 } });
    const root = screen.getByTestId('scroll-root');
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperty(viewport, 'clientHeight', { value: 80, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
    fireEvent.scroll(viewport);
    // hover type: not visible until hover
    expect(root.getAttribute('data-state')).toBe('hidden');
    await fireEvent.pointerEnter(root);
    expect(root.getAttribute('data-state')).toBe('visible');
  });

  it('sizes and moves the thumb from the live scroll metrics', async () => {
    render(ScrollAreaFixture, { props: { type: 'always', itemCount: 30, height: 100 } });
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
    fireEvent.scroll(viewport);
    // The thumb mounts once the scrollbar shows; it must keep following the metrics.
    const thumb = await screen.findByTestId('scroll-y-thumb');
    await waitFor(() => {
      expect(thumb.style.getPropertyValue('--tx-sa-thumb-size-y').trim()).toBe('25%');
      expect(thumb.style.getPropertyValue('--tx-sa-thumb-offset-y').trim()).toBe('0%');
    });
    (viewport as HTMLElement).scrollTop = 300;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      expect(thumb.style.getPropertyValue('--tx-sa-thumb-offset-y').trim()).toBe('75%');
    });
  });

  it('hides the corner when only one axis overflows', async () => {
    render(ScrollAreaFixture, { props: { type: 'always', itemCount: 20, height: 80 } });
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperty(viewport, 'clientHeight', { value: 80, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(viewport, 'scrollWidth', { value: 200, configurable: true });
    fireEvent.scroll(viewport);
    await waitFor(() => {
      expect(screen.queryByTestId('scroll-corner')).toBeNull();
    });
  });

  it('labels the root for assistive tech when aria-label is set', () => {
    render(ScrollAreaFixture, { props: { label: 'Task backlog' } });
    expect(screen.getByLabelText('Task backlog')).toBeTruthy();
  });
});

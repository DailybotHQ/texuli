import { fireEvent, render } from '@testing-library/svelte';
import { createRawSnippet, flushSync, tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Carousel,
  type CarouselItem,
  canStep,
  carouselVariants,
  createAutoplay,
  DEFAULT_AUTOPLAY_INTERVAL,
  formatMessage,
  MIN_AUTOPLAY_INTERVAL,
  resolveCarouselMessages,
  resolveIndex,
  resolveInterval,
  swipeStep,
} from '../src/components/carousel/index.ts';

const items: CarouselItem[] = [
  { id: 'harbor', label: 'Harbor at dawn' },
  { id: 'market', label: 'Night market' },
  { id: 'ridge', label: 'Ridge trail' },
];

const body = createRawSnippet<[CarouselItem, number]>((item) => ({
  render: () => `<p data-testid="body">${item().label}</p>`,
}));

function mediaStub(reduced: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/** Renders inside a container with an explicit `dir`, as an app would. */
function renderIn(dir: 'ltr' | 'rtl', props: Record<string, unknown>) {
  const host = document.createElement('div');
  host.setAttribute('dir', dir);
  document.body.append(host);
  return render(Carousel, { target: host, props: props as never });
}

const status = (container: HTMLElement) =>
  container.querySelector('.tx-carousel-status')?.textContent?.trim();
const slide = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-tx-carousel-slide="${id}"]`);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('carousel logic', () => {
  it('wraps with loop and clamps without it', () => {
    expect(resolveIndex(3, 3, true)).toBe(0);
    expect(resolveIndex(-1, 3, true)).toBe(2);
    expect(resolveIndex(7, 3, true)).toBe(1);
    expect(resolveIndex(3, 3, false)).toBe(2);
    expect(resolveIndex(-4, 3, false)).toBe(0);
    expect(resolveIndex(1.9, 3, false)).toBe(1);
    expect(resolveIndex(Number.NaN, 3, true)).toBe(0);
    expect(resolveIndex(5, 1, true)).toBe(0);
    expect(resolveIndex(5, 0, true)).toBe(0);
  });

  it('knows when previous and next can move', () => {
    expect(canStep(0, 3, false, -1)).toBe(false);
    expect(canStep(0, 3, false, 1)).toBe(true);
    expect(canStep(2, 3, false, 1)).toBe(false);
    expect(canStep(0, 3, true, -1)).toBe(true);
    expect(canStep(0, 1, true, 1)).toBe(false);
  });

  it('turns a drag toward the inline start into "next", in LTR and RTL', () => {
    expect(swipeStep(-60, 48, 'ltr')).toBe(1);
    expect(swipeStep(60, 48, 'ltr')).toBe(-1);
    expect(swipeStep(60, 48, 'rtl')).toBe(1);
    expect(swipeStep(-60, 48, 'rtl')).toBe(-1);
    expect(swipeStep(-47, 48, 'ltr')).toBe(0);
    expect(swipeStep(Number.NaN, 48, 'ltr')).toBe(0);
    // A threshold below one pixel still ignores a zero-length tap.
    expect(swipeStep(0, 0, 'ltr')).toBe(0);
  });

  it('merges translated labels over the English defaults', () => {
    const t = resolveCarouselMessages({ next: 'Siguiente', previous: 3 as unknown as string });
    expect(t.next).toBe('Siguiente');
    expect(t.previous).toBe('Previous slide');
    expect(t.status).toBe('Slide {index} of {total}');
  });

  it('fills placeholders as plain text and leaves unknown ones', () => {
    expect(formatMessage('Slide {index} of {total}', { index: 2, total: 5 })).toBe('Slide 2 of 5');
    expect(formatMessage('{label}', { label: '<b>x</b>' })).toBe('<b>x</b>');
    expect(formatMessage('{constructor} {missing}', {})).toBe('{constructor} {missing}');
  });

  it('keeps the autoplay interval readable', () => {
    expect(resolveInterval(undefined)).toBe(DEFAULT_AUTOPLAY_INTERVAL);
    expect(resolveInterval(Number.POSITIVE_INFINITY)).toBe(DEFAULT_AUTOPLAY_INTERVAL);
    expect(resolveInterval(500)).toBe(MIN_AUTOPLAY_INTERVAL);
    expect(resolveInterval(7000.4)).toBe(7000);
  });

  it('builds root classes with the consumer class last', () => {
    expect(carouselVariants()).toBe('tx-carousel tx-carousel--controls-below');
    expect(carouselVariants({ controls: 'overlay', class: 'mine' })).toBe(
      'tx-carousel tx-carousel--controls-overlay mine'
    );
  });
});

describe('createAutoplay', () => {
  /** A manual clock: `advance` fires due timers in order. */
  function clock() {
    let now = 0;
    let next = 1;
    const timers = new Map<number, { at: number; run: () => void }>();
    return {
      setTimer: (run: () => void, ms: number) => {
        const id = next++;
        timers.set(id, { at: now + ms, run });
        return id;
      },
      clearTimer: (id: unknown) => {
        timers.delete(id as number);
      },
      advance(ms: number) {
        const end = now + ms;
        for (;;) {
          const due = [...timers.entries()]
            .filter(([, timer]) => timer.at <= end)
            .sort((a, b) => a[1].at - b[1].at)[0];
          if (!due) break;
          timers.delete(due[0]);
          now = due[1].at;
          due[1].run();
        }
        now = end;
      },
      pending: () => timers.size,
    };
  }

  it('ticks while playing, pauses for holds and stops for good on stop()', () => {
    const c = clock();
    const onTick = vi.fn();
    const onPlayingChange = vi.fn();
    const auto = createAutoplay({ interval: 3000, onTick, onPlayingChange, ...c });
    c.advance(10_000);
    expect(onTick).not.toHaveBeenCalled();

    auto.play();
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
    c.advance(9000);
    expect(onTick).toHaveBeenCalledTimes(3);

    auto.hold('hover');
    expect(auto.running).toBe(false);
    c.advance(9000);
    expect(onTick).toHaveBeenCalledTimes(3);
    auto.hold('hidden');
    auto.release('hover');
    c.advance(9000);
    expect(onTick).toHaveBeenCalledTimes(3);
    auto.release('hidden');
    expect(auto.playing).toBe(true);
    c.advance(3000);
    expect(onTick).toHaveBeenCalledTimes(4);

    auto.stop();
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    c.advance(30_000);
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(c.pending()).toBe(0);
  });

  it('restarts the countdown, applies a new interval and cleans up on destroy', () => {
    const c = clock();
    const onTick = vi.fn();
    const auto = createAutoplay({ interval: 4000, onTick, ...c });
    auto.play();
    c.advance(3000);
    auto.restart();
    c.advance(3000);
    expect(onTick).not.toHaveBeenCalled();
    c.advance(1000);
    expect(onTick).toHaveBeenCalledTimes(1);

    auto.setInterval(2000);
    c.advance(2000);
    expect(onTick).toHaveBeenCalledTimes(2);

    auto.toggle();
    expect(auto.playing).toBe(false);
    auto.toggle();
    auto.destroy();
    expect(c.pending()).toBe(0);
    auto.play();
    c.advance(10_000);
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});

describe('Carousel', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', mediaStub(false));
  });

  it('is a labelled carousel region whose picker tabs control their slides (APG tabbed)', () => {
    const view = render(Carousel, { props: { items, label: 'Destinations', children: body } });
    const region = view.getByRole('region', { name: 'Destinations' });
    expect(region.getAttribute('aria-roledescription')).toBe('carousel');

    const tabs = view.getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Go to slide 1: Harbor at dawn',
      'Go to slide 2: Night market',
      'Go to slide 3: Ridge trail',
    ]);
    for (const [i, tab] of tabs.entries()) {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-label')).toBe(`${i + 1} of 3: ${items[i]?.label}`);
    }
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(status(view.container)).toBe('Slide 1 of 3');
  });

  it('makes hidden slides inert so their content leaves the tab order', () => {
    const view = render(Carousel, { props: { items, children: body } });
    expect(slide(view.container, 'harbor')?.hasAttribute('inert')).toBe(false);
    expect(slide(view.container, 'market')?.hasAttribute('inert')).toBe(true);
    expect(slide(view.container, 'ridge')?.hasAttribute('inert')).toBe(true);
  });

  it('uses grouped slides with a role description when there is no picker (APG basic)', () => {
    const view = render(Carousel, { props: { items, showDots: false } });
    const first = slide(view.container, 'harbor');
    expect(first?.getAttribute('role')).toBe('group');
    expect(first?.getAttribute('aria-roledescription')).toBe('slide');
    expect(view.queryAllByRole('tab')).toHaveLength(0);
    // Without a snippet, a slide shows its label.
    expect(first?.textContent).toContain('Harbor at dawn');
  });

  it('moves with the buttons and the picker, reporting each change', async () => {
    const onIndexChange = vi.fn();
    const view = render(Carousel, { props: { items, children: body, onIndexChange } });
    await fireEvent.click(view.getByRole('button', { name: 'Next slide' }));
    expect(status(view.container)).toBe('Slide 2 of 3');
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(view.container.querySelector('[data-tx-carousel]')?.getAttribute('data-index')).toBe(
      '1'
    );

    await fireEvent.click(view.getByRole('tab', { name: 'Go to slide 3: Ridge trail' }));
    expect(status(view.container)).toBe('Slide 3 of 3');
    expect(slide(view.container, 'ridge')?.hasAttribute('inert')).toBe(false);

    await fireEvent.click(view.getByRole('button', { name: 'Next slide' }));
    expect(status(view.container)).toBe('Slide 1 of 3');
    await fireEvent.click(view.getByRole('button', { name: 'Previous slide' }));
    expect(status(view.container)).toBe('Slide 3 of 3');
    expect(onIndexChange.mock.calls.map(([i]) => i)).toEqual([1, 2, 0, 2]);
  });

  it('stops at the ends when loop is off', async () => {
    const view = render(Carousel, { props: { items, loop: false } });
    const previous = view.getByRole('button', { name: 'Previous slide' });
    const next = view.getByRole('button', { name: 'Next slide' });
    expect(previous.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(next);
    await fireEvent.click(next);
    expect(status(view.container)).toBe('Slide 3 of 3');
    expect(next.hasAttribute('disabled')).toBe(true);
    expect(previous.hasAttribute('disabled')).toBe(false);
  });

  it('moves focus and the slide with arrow keys in the picker, flipped in RTL', async () => {
    const ltr = renderIn('ltr', { items });
    const first = ltr.getAllByRole('tab')[0] as HTMLElement;
    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(status(ltr.container)).toBe('Slide 2 of 3');
    expect(document.activeElement).toBe(ltr.getAllByRole('tab')[1]);
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(status(ltr.container)).toBe('Slide 3 of 3');
    ltr.unmount();

    const rtl = renderIn('rtl', { items });
    const start = rtl.getAllByRole('tab')[0] as HTMLElement;
    start.focus();
    await fireEvent.keyDown(start, { key: 'ArrowLeft' });
    expect(status(rtl.container)).toBe('Slide 2 of 3');
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(status(rtl.container)).toBe('Slide 1 of 3');
  });

  it('accepts arrows from its buttons but never from slide content', async () => {
    const field = createRawSnippet<[CarouselItem, number]>(() => ({
      render: () => '<label>Note <input data-testid="note" /></label>',
    }));
    const view = renderIn('ltr', { items, children: field });
    const next = view.getByRole('button', { name: 'Next slide' });
    await fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(status(view.container)).toBe('Slide 2 of 3');
    await fireEvent.keyDown(next, { key: 'Home' });
    expect(status(view.container)).toBe('Slide 1 of 3');

    const input = view.getAllByTestId('note')[0] as HTMLElement;
    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(status(view.container)).toBe('Slide 1 of 3');
  });

  it('is focusable and keyboard operable on its own when it shows no controls', async () => {
    const view = renderIn('ltr', { items, showControls: false, showDots: false });
    const region = view.getByRole('region');
    expect(region.tabIndex).toBe(0);
    region.focus();
    await fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(status(view.container)).toBe('Slide 2 of 3');
  });

  it('changes slide on a swipe past the threshold, mirrored in RTL', async () => {
    const swipe = async (container: HTMLElement, from: number, to: number) => {
      const viewport = container.querySelector('.tx-carousel-viewport') as HTMLElement;
      await fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: from });
      await fireEvent.pointerMove(viewport, { pointerId: 1, clientX: to });
      await fireEvent.pointerUp(viewport, { pointerId: 1, clientX: to });
    };
    const ltr = renderIn('ltr', { items, swipeThreshold: 40 });
    await swipe(ltr.container, 200, 120);
    expect(status(ltr.container)).toBe('Slide 2 of 3');
    await swipe(ltr.container, 200, 180);
    expect(status(ltr.container)).toBe('Slide 2 of 3');
    ltr.unmount();

    const rtl = renderIn('rtl', { items, swipeThreshold: 40 });
    await swipe(rtl.container, 120, 200);
    expect(status(rtl.container)).toBe('Slide 2 of 3');
  });

  it('positions the track with custom properties, not a style string', async () => {
    const view = render(Carousel, { props: { items } });
    const track = view.container.querySelector<HTMLElement>('.tx-carousel-track');
    expect(track?.style.getPropertyValue('--tx-carousel-index')).toBe('0');
    await fireEvent.click(view.getByRole('button', { name: 'Next slide' }));
    expect(track?.style.getPropertyValue('--tx-carousel-index')).toBe('1');

    // The only inline styles are the track's two custom properties (no style strings).
    const styled = [...view.container.querySelectorAll<HTMLElement>('[style]')];
    expect(styled).toEqual([track]);
    const style = track?.style;
    const declared = Array.from({ length: style?.length ?? 0 }, (_, i) => style?.item(i)).sort();
    expect(declared).toEqual(['--tx-carousel-drag', '--tx-carousel-index']);
  });

  it('renders translated labels', () => {
    const view = render(Carousel, {
      props: {
        items,
        messages: {
          carousel: 'Carrusel',
          previous: 'Diapositiva anterior',
          next: 'Diapositiva siguiente',
          slides: 'Diapositivas',
          goTo: 'Ir a la diapositiva {index}: {label}',
          slide: '{index} de {total}: {label}',
          status: 'Diapositiva {index} de {total}',
        },
      },
    });
    expect(view.getByRole('region', { name: 'Carrusel' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Diapositiva siguiente' })).toBeTruthy();
    expect(view.getByRole('tablist', { name: 'Diapositivas' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Ir a la diapositiva 2: Night market' })).toBeTruthy();
    expect(status(view.container)).toBe('Diapositiva 1 de 3');
  });

  it('hides every control for a single slide, and renders nothing to move for none', () => {
    const one = render(Carousel, { props: { items: [items[0] as CarouselItem], autoplay: true } });
    expect(one.queryAllByRole('button')).toHaveLength(0);
    expect(one.queryAllByRole('tab')).toHaveLength(0);
    one.unmount();
    const none = render(Carousel, { props: { items: [] } });
    expect(none.queryAllByRole('button')).toHaveLength(0);
    expect(none.getByRole('region')).toBeTruthy();
  });

  it('keeps the bound index in range and merges the consumer class last', async () => {
    const view = render(Carousel, { props: { items, index: 9, class: 'gallery' } });
    await tick();
    expect(status(view.container)).toBe('Slide 3 of 3');
    expect(view.getByRole('region').className).toMatch(
      /tx-carousel tx-carousel--controls-below gallery/
    );
  });

  it('places overlay controls at the inline edges, around the slides in tab order', () => {
    const view = render(Carousel, { props: { items, controls: 'overlay' } });
    const region = view.getByRole('region');
    expect(region.getAttribute('data-controls')).toBe('overlay');
    const order = [...region.querySelectorAll('button')].map(
      (button) => button.getAttribute('data-tx-carousel-button') ?? 'tab'
    );
    expect(order).toEqual(['previous', 'next', 'tab', 'tab', 'tab']);
    expect(
      [...region.querySelectorAll('[data-edge]')].map((edge) => edge.getAttribute('data-edge'))
    ).toEqual(['start', 'end']);
  });

  describe('autoplay', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    it('rotates, offers a rotation control first, and silences the live region while rotating', async () => {
      const onPlayingChange = vi.fn();
      const view = render(Carousel, {
        props: { items, autoplay: true, interval: 3000, onPlayingChange },
      });
      flushSync();
      const control = view.getByRole('button', { name: 'Stop automatic slide show' });
      expect(view.getAllByRole('button')[0]).toBe(control);
      expect(onPlayingChange).toHaveBeenLastCalledWith(true);
      const live = view.container.querySelector('.tx-carousel-status');
      expect(live?.getAttribute('aria-live')).toBe('off');

      vi.advanceTimersByTime(3000);
      flushSync();
      expect(status(view.container)).toBe('Slide 2 of 3');
      vi.advanceTimersByTime(6000);
      flushSync();
      // Rotation wraps even without loop-able controls.
      expect(status(view.container)).toBe('Slide 1 of 3');

      await fireEvent.click(control);
      expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
      expect(live?.getAttribute('aria-live')).toBe('polite');
      vi.advanceTimersByTime(30_000);
      flushSync();
      expect(status(view.container)).toBe('Slide 1 of 3');
    });

    it('pauses while the pointer is over it and resumes when it leaves', async () => {
      const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
      flushSync();
      const region = view.getByRole('region');
      await fireEvent.pointerEnter(region);
      // Two intervals: an unpaused carousel would be on slide 3 (three would wrap to 1).
      vi.advanceTimersByTime(6000);
      flushSync();
      expect(status(view.container)).toBe('Slide 1 of 3');
      await fireEvent.pointerLeave(region);
      vi.advanceTimersByTime(3000);
      flushSync();
      expect(status(view.container)).toBe('Slide 2 of 3');
    });

    it('stops for good when keyboard focus enters, but not when a click focuses a control', async () => {
      const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
      flushSync();
      const control = view.getByRole('button', { name: 'Stop automatic slide show' });

      // A click: pointer down first, then focus, then click toggles once (stop).
      await fireEvent.pointerDown(control);
      await fireEvent.focusIn(control, { relatedTarget: null });
      await fireEvent.pointerUp(control);
      expect(view.getByRole('button', { name: 'Stop automatic slide show' })).toBeTruthy();
      await fireEvent.click(control);
      expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
      await fireEvent.click(control);
      expect(view.getByRole('button', { name: 'Stop automatic slide show' })).toBeTruthy();

      // Keyboard focus arriving from outside stops it.
      const tab = view.getAllByRole('tab')[0] as HTMLElement;
      await fireEvent.focusIn(tab, { relatedTarget: document.body });
      expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
      vi.advanceTimersByTime(30_000);
      flushSync();
      expect(status(view.container)).toBe('Slide 1 of 3');
    });

    it('does not start when the user prefers reduced motion', () => {
      vi.stubGlobal('matchMedia', mediaStub(true));
      const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
      flushSync();
      expect(view.getByRole('button', { name: 'Start automatic slide show' })).toBeTruthy();
      vi.advanceTimersByTime(30_000);
      flushSync();
      expect(status(view.container)).toBe('Slide 1 of 3');
    });

    it('holds while the page is hidden', () => {
      let state: DocumentVisibilityState = 'visible';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);
      const view = render(Carousel, { props: { items, autoplay: true, interval: 3000 } });
      flushSync();
      state = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      // Two intervals: a rotating carousel would be on slide 3 (three would wrap to 1).
      vi.advanceTimersByTime(6000);
      flushSync();
      expect(status(view.container)).toBe('Slide 1 of 3');
      state = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(3000);
      flushSync();
      expect(status(view.container)).toBe('Slide 2 of 3');
    });
  });
});

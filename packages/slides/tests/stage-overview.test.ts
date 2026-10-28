// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import {
  moveOverviewSelection,
  OVERVIEW_WINDOW_RADIUS,
  overviewColumns,
  overviewWindow,
} from '../src/stage/overview/index.ts';
import { clearDeckHash, scenario } from './scenario.ts';

// The default renderer tables load on first use; preload them, as a host that paints at once does.
beforeAll(() => loadDefaultDeckRenderers());

// ---------------------------------------------------------------------------
// Fixtures

const text = (markdown: string, extra: Record<string, unknown> = {}) => ({
  type: 'text',
  markdown,
  ...extra,
});

/** `count` free slides; the second one reveals a line at step 1. */
function longDeck(count: number, meta: Record<string, unknown> = {}) {
  return {
    formatVersion: 2,
    meta: { title: 'Long review', ...meta },
    slides: Array.from({ length: count }, (_, i) => ({
      id: `s-${i + 1}`,
      title: `Topic ${i + 1}`,
      layout: 'free',
      blocks:
        i === 1
          ? [text('Always here.'), text('Revealed later.', { step: 1 })]
          : [text(`Body ${i + 1}.`)],
    })),
  };
}

function mockMatchMedia() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList
  );
}

/** Give every box a laid-out width, so the overview measures and thumbnails mount. */
function mockLayout(width = 960) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: width * 0.5625,
    width,
    height: width * 0.5625,
    toJSON: () => ({}),
  } as DOMRect);
}

/** A controllable IntersectionObserver (happy-dom's never reports). */
function mockIntersections() {
  const observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = [];
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {
        this.targets = [];
      }
      takeRecords() {
        return [];
      }
    }
  );
  return (positions: number[], isIntersecting = true) => {
    for (const observer of observers) {
      const records = observer.targets
        .filter((target) =>
          positions.includes(Number((target as HTMLElement).dataset.txDeckOverviewPosition))
        )
        .map((target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry);
      observer.callback(records, observer as unknown as IntersectionObserver);
    }
  };
}

const activeSlide = () =>
  document.querySelector<HTMLElement>('[data-tx-deck-canvas] [data-tx-deck-active="true"]');
const cards = () => [...document.querySelectorAll<HTMLElement>('[data-tx-deck-overview-item]')];
const card = (position: number) =>
  document.querySelector<HTMLElement>(`[data-tx-deck-overview-position="${position}"]`);
const paintedPositions = () =>
  cards()
    .filter((item) => item.querySelector('[data-tx-deck-preview]'))
    .map((item) => Number(item.dataset.txDeckOverviewPosition));

async function openOverview() {
  const slide = activeSlide() as HTMLElement;
  slide.focus();
  await fireEvent.keyDown(slide, { key: 'o' });
}

async function key(name: string) {
  await fireEvent.keyDown(document.activeElement as HTMLElement, { key: name });
}

const reset = () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearDeckHash();
};

afterEach(reset);

// ---------------------------------------------------------------------------

describe('overview helpers', () => {
  it('columns per width, grid moves with right-to-left and the mounted window', () => {
    expect([0, 359, 360, 640, 900, 1200, Number.NaN, -5].map(overviewColumns)).toEqual([
      1, 1, 2, 3, 4, 5, 1, 1,
    ]);

    const moves = (keys: string[], start: number, dir: 'ltr' | 'rtl' = 'ltr') =>
      keys.map((name) => moveOverviewSelection(start, name, 10, 4, dir));
    // Left/right step and stop at the ends; up/down move a row and stop at the edges.
    expect(moves(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'], 5)).toEqual([
      6, 4, 9, 1, 0, 9,
    ]);
    expect(moves(['ArrowRight', 'ArrowDown'], 9)).toEqual([9, 9]);
    expect(moves(['ArrowLeft', 'ArrowUp', 'Tab'], 0)).toEqual([0, 0, 0]);
    expect(moves(['ArrowLeft', 'ArrowRight'], 5, 'rtl')).toEqual([6, 4]);
    expect(moveOverviewSelection(3, 'ArrowRight', 0, 4)).toBe(0);

    expect(OVERVIEW_WINDOW_RADIUS).toBe(12);
    expect(overviewWindow(0, 40)).toEqual({ start: 0, end: 13 });
    expect(overviewWindow(20, 40)).toEqual({ start: 8, end: 33 });
    expect(overviewWindow(39, 40)).toEqual({ start: 27, end: 40 });
    expect(overviewWindow(99, 5, 2)).toEqual({ start: 2, end: 5 });
    expect(overviewWindow(0, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('DeckOverview', () => {
  it('windowed thumbnails, grid keyboard, choosing once and focus back to the slide', async () => {
    await scenario(
      'paints real thumbnails at the last step for the window around the selection only',
      async () => {
        mockMatchMedia();
        mockLayout(960);
        const reveal = mockIntersections();
        render(DeckStage, { props: { deck: longDeck(40), loadTheme: null } });
        await openOverview();

        const nav = screen.getByRole('navigation', { name: 'Slides' });
        expect(nav.dataset.columns).toBe('4');
        expect(cards()).toHaveLength(40);
        // The cards are there at once; the thumbnail painter is a lazy chunk.
        await waitFor(() =>
          expect(paintedPositions()).toEqual(Array.from({ length: 13 }, (_, i) => i))
        );
        // No slide of the stage canvas stays mounted while the overview is open.
        expect(document.querySelector('[data-tx-deck-canvas]')).toBeNull();

        // The thumbnail is the stage slide view, inert, at its last step.
        const thumb = card(1)?.querySelector<HTMLElement>('[data-tx-deck-slide="s-2"]');
        expect(thumb?.dataset.step).toBe('1');
        expect(thumb?.dataset.stepCount).toBe('1');
        expect(thumb?.closest('[inert]')).not.toBeNull();
        expect(thumb?.closest('[aria-hidden="true"]')).not.toBeNull();
        await waitFor(() => expect(thumb?.textContent).toContain('Revealed later.'));

        // Each card is named by number and title; the shown slide is aria-current.
        expect(card(0)?.hasAttribute('aria-label')).toBe(false);
        // Named by the visible caption (label-content-name-mismatch); the position is the description.
        expect(
          screen.getByRole('button', { name: '1 Topic 1', description: 'slide 1 of 40' })
        ).toBe(card(0));
        expect(card(0)?.getAttribute('aria-current')).toBe('step');
        expect(cards().filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);

        // Cards scrolled into view paint too, and stop painting once they leave.
        reveal([30, 31]);
        await waitFor(() => expect(paintedPositions()).toContain(31));
        reveal([30, 31], false);
        await waitFor(() => expect(paintedPositions()).not.toContain(31));
      },
      reset
    );

    await scenario(
      'moves with arrows, rows, Home and End (roving tab stop) and shifts the window',
      async () => {
        mockMatchMedia();
        mockLayout(960);
        render(DeckStage, { props: { deck: longDeck(40), loadTheme: null } });
        await openOverview();
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
        expect(cards().filter((item) => item.tabIndex === 0)).toEqual([card(0)]);

        await key('ArrowRight');
        await waitFor(() => expect(document.activeElement).toBe(card(1)));
        await key('ArrowDown');
        await waitFor(() => expect(document.activeElement).toBe(card(5)));
        await key('ArrowUp');
        await key('ArrowLeft');
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
        await key('End');
        await waitFor(() => expect(document.activeElement).toBe(card(39)));
        expect(card(39)?.tabIndex).toBe(0);
        expect(card(0)?.tabIndex).toBe(-1);
        await waitFor(() =>
          expect(paintedPositions()).toEqual(Array.from({ length: 13 }, (_, i) => 27 + i))
        );
        await key('Home');
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
        // The stage did not move while browsing.
        expect(screen.getByRole('navigation', { name: 'Slides' })).toBeTruthy();
      },
      reset
    );

    await scenario(
      'Enter opens the selected slide once; a second activation never moves again',
      async () => {
        mockMatchMedia();
        const onSlideChange = vi.fn();
        render(DeckStage, { props: { deck: longDeck(12), loadTheme: null, onSlideChange } });
        await openOverview();
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
        await key('ArrowRight');
        await key('ArrowRight');
        await waitFor(() => expect(document.activeElement).toBe(card(2)));
        const chosen = card(2) as HTMLElement;
        await key('Enter');
        // The button's own click activation after Enter is a no-op.
        await fireEvent.click(chosen);
        expect(onSlideChange).toHaveBeenCalledTimes(1);
        expect(onSlideChange).toHaveBeenCalledWith({ index: 2, slideId: 's-3' });
        expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(activeSlide()));
        expect(activeSlide()?.dataset.slideId).toBe('s-3');
      },
      reset
    );

    await scenario(
      'Escape closes without moving and hands focus back; the current card stays current',
      async () => {
        mockMatchMedia();
        const onSlideChange = vi.fn();
        render(DeckStage, {
          props: { deck: longDeck(12), loadTheme: null, onSlideChange, initialSlideId: 's-4' },
        });
        await openOverview();
        await waitFor(() => expect(document.activeElement).toBe(card(3)));
        expect(card(3)?.getAttribute('aria-current')).toBe('step');
        await key('ArrowRight');
        await key('Escape');
        expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
        expect(onSlideChange).not.toHaveBeenCalled();
        await waitFor(() => expect(document.activeElement).toBe(activeSlide()));
        expect(activeSlide()?.dataset.slideId).toBe('s-4');
      },
      reset
    );

    await scenario(
      'flips left and right in a right-to-left deck and localizes the cards',
      async () => {
        mockMatchMedia();
        render(DeckStage, {
          props: {
            deck: longDeck(6, { dir: 'rtl', locale: 'ar' }),
            loadTheme: null,
            messages: {
              'stage.overviewCardPosition': 'شريحة {current} من {total}',
              'stage.overviewHint': 'تلميح',
            },
          },
        });
        await openOverview();
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
        expect(screen.getByRole('button', { name: '1 Topic 1', description: 'شريحة 1 من 6' })).toBe(
          card(0)
        );
        expect(screen.getByText('تلميح')).toBeTruthy();
        await key('ArrowLeft');
        await waitFor(() => expect(document.activeElement).toBe(card(1)));
        await key('ArrowRight');
        await waitFor(() => expect(document.activeElement).toBe(card(0)));
      },
      reset
    );
  });
});

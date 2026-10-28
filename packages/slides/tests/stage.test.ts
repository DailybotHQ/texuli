// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { DeckController, DeckPlugin } from '@texuli/deck/engine';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeckGrammar, toDeckGrammar } from '../src/grammar/index.ts';
import { DECK_TRANSITIONS, parseDeck, resolveSlideTransition } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import FreeSlide from '../src/stage/FreeSlide.svelte';
import { createPresenterTimer, formatElapsed } from '../src/stage/presenter.ts';
import {
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
  resolveDeckThemeMode,
} from '../src/stage/theme.ts';
import { clearDeckHash, scenario } from './scenario.ts';

// ---------------------------------------------------------------------------
// Fixtures

type Bag = Record<string, unknown>;

const text = (markdown: string) => ({ type: 'text', markdown });

function free(id: string, title: string, extra: Bag = {}, blocks: unknown[] = [text(`${title}.`)]) {
  return { id, title, layout: 'free', blocks, ...extra };
}

function deckOf(slides: unknown[], extra: Bag = {}) {
  const { meta, ...rest } = extra as { meta?: Bag };
  return { formatVersion: 2, meta: { title: 'Quarterly update', ...meta }, ...rest, slides };
}

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SIX = ['opening', 'market', 'plan', 'risks', 'team', 'close'];
const sixSlides = () => SIX.map((id) => free(id, id[0]?.toUpperCase() + id.slice(1)));

const slides = (root: ParentNode = document) => [
  ...root.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]'),
];
const active = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>('[data-tx-deck-active="true"]') as HTMLElement;
const activeId = (root: ParentNode = document) => active(root)?.dataset.slideId;
const live = (root: ParentNode = document) =>
  root.querySelector('.tx-deck-stage__live')?.textContent?.trim();

async function press(key: string, init: Bag = {}, root: ParentNode = document) {
  const target = active(root);
  target.focus();
  await fireEvent.keyDown(target, { key, ...init });
}

function mockPreferences({ dark = false, reduced = false, contrastMore = false } = {}) {
  const matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-contrast: more')
        ? contrastMore
        : query.includes('prefers-color-scheme: dark')
          ? dark
          : query.includes('reduced-motion')
            ? reduced
            : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }) as unknown as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockImplementation(matchMedia);
  return matchMedia;
}

type Doc = Omit<Document, 'startViewTransition'> & { startViewTransition?: unknown };

const clearHash = clearDeckHash;

/** Runs after every test and between the scenarios of a grouped test. */
function resetAll() {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
  delete document.documentElement.dataset.txMotion;
  clearHash();
}

// ---------------------------------------------------------------------------

describe('DeckStage v2: input, canvas and the mounted window', () => {
  afterEach(resetAll);

  it('validates every input and shows an accessible error state instead of an invalid deck', async () => {
    await scenario(
      'paints a v2 deck and a migrated v1 deck alike',
      async () => {
        mockPreferences();
        const first = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null },
        });
        expect(screen.getByRole('region', { name: 'Presentation: Quarterly update' })).toBeTruthy();
        expect(activeId()).toBe('opening');
        first.unmount();

        const v1 = parseDeck({
          meta: { title: 'Legacy deck' },
          slides: [{ id: 'one', title: 'One', blocks: [text('Hello')] }],
        });
        if (!v1.success) throw new Error('v1 deck');
        render(DeckStage, { props: { deck: v1.deck, loadTheme: null } });
        expect(screen.getByRole('region', { name: 'Presentation: Legacy deck' })).toBeTruthy();
        expect(screen.getByRole('group', { name: 'One' })).toBeTruthy();
      },
      resetAll
    );
    await scenario(
      'never paints an invalid or hostile deck: it lists the problems and reports them',
      async () => {
        mockPreferences();
        for (const input of [
          deckOf([free('Bad Id', 'Bad'), { id: 'two', layout: 'title-hero', props: {} }]),
          null,
          'not a deck',
          { formatVersion: 2, meta: { title: 'Empty' }, slides: [] },
        ]) {
          const onError = vi.fn();
          const events: unknown[] = [];
          const listen = (event: Event) => events.push((event as CustomEvent).detail);
          document.addEventListener('tx-deck:error', listen);
          const { container, unmount } = render(DeckStage, {
            props: { deck: input, loadTheme: null, onError },
          });
          expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.');
          expect(slides(container)).toHaveLength(0);
          expect(container.querySelector('[data-tx-deck-invalid]')).toBeTruthy();
          await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
          const issues = onError.mock.calls[0]?.[0] as { severity: string }[];
          expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
          expect(events).toHaveLength(1);
          expect(
            container.querySelectorAll('.tx-deck-stage__invalid-list li').length
          ).toBeGreaterThan(0);
          document.removeEventListener('tx-deck:error', listen);
          unmount();
        }
      },
      resetAll
    );
  });

  it('mounts at most three slides, keeps the neighbours inert and announces the position', async () => {
    await scenario(
      'windows the canvas around the active slide and skips hidden slides',
      async () => {
        mockPreferences();
        const deck = deckOf([
          ...sixSlides().slice(0, 3),
          free('secret', 'Secret', { hidden: true }),
          ...sixSlides().slice(3),
        ]);
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        const ids = () => slides(container).map((slide) => slide.dataset.slideId);

        expect(ids()).toEqual(['opening', 'market']);
        expect(live(container)).toBe('Slide 1 of 6: Opening');
        await press('ArrowRight');
        await press('ArrowRight');
        expect(ids()).toEqual(['market', 'plan', 'risks']);
        expect(live(container)).toBe('Slide 3 of 6: Plan');
        for (const slide of slides(container)) {
          const isActive = slide.dataset.slideId === 'plan';
          expect(slide.getAttribute('aria-roledescription')).toBe('slide');
          expect(slide.hasAttribute('inert')).toBe(!isActive);
          expect(slide.getAttribute('aria-hidden')).toBe(isActive ? null : 'true');
          expect(slide.getAttribute('tabindex')).toBe(isActive ? '-1' : null);
        }
        // Only the active slide is in the accessibility tree.
        expect(screen.getAllByRole('group', { name: /Market|Plan|Risks/ })).toHaveLength(1);
        expect(document.activeElement).toBe(active(container));

        await press('End');
        expect(ids()).toEqual(['team', 'close']);
        expect(container.querySelector('[data-slide-id="secret"]')).toBeNull();
      },
      resetAll
    );
    await scenario(
      'letterboxes the fixed virtual canvas with a ResizeObserver',
      async () => {
        mockPreferences();
        const observers: { callback: ResizeObserverCallback }[] = [];
        vi.stubGlobal(
          'ResizeObserver',
          class {
            callback: ResizeObserverCallback;
            constructor(callback: ResizeObserverCallback) {
              this.callback = callback;
              observers.push(this);
            }
            observe() {}
            disconnect() {}
          }
        );
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides(), { style: { aspect: '4:3' } }), loadTheme: null },
        });
        const viewport = container.querySelector<HTMLElement>('.tx-deck-stage__viewport');
        const canvas = container.querySelector<HTMLElement>('[data-tx-deck-canvas]');
        expect(viewport?.dataset.txDeckFit).toBe('pending');
        expect([canvas?.dataset.width, canvas?.dataset.height]).toEqual(['1024', '768']);
        const stage = screen.getByRole('region', { name: /Presentation/ });
        expect(stage.style.getPropertyValue('--tx-deck-canvas-width')).toBe('1024px');

        for (const observer of observers) {
          observer.callback(
            [{ contentRect: { width: 1024, height: 1000 } } as ResizeObserverEntry],
            observer as unknown as ResizeObserver
          );
        }
        flushSync();
        expect(viewport?.dataset.txDeckFit).toBe('ready');
        expect(viewport?.style.getPropertyValue('--tx-deck-scale')).toBe('1');
        expect(viewport?.style.getPropertyValue('--tx-deck-offset-x')).toBe('0px');
        expect(viewport?.style.getPropertyValue('--tx-deck-offset-y')).toBe('116px');
      },
      resetAll
    );
    await scenario(
      'announces steps and slide titles from catalog layout props',
      async () => {
        mockPreferences();
        const deck = deckOf([
          free('steps', 'Steps', {}, [
            { type: 'list', step: 1, items: [{ text: 'One' }, { text: 'Two' }] },
          ]),
          { id: 'hero', layout: 'title-hero', props: { title: 'Hero title' } },
        ]);
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        expect(live(container)).toBe('Slide 1 of 2: Steps, step 0 of 2');
        await press('ArrowRight');
        expect(live(container)).toBe('Slide 1 of 2: Steps, step 1 of 2');
        await press('End');
        expect(live(container)).toBe('Slide 2 of 2: Hero title');
      },
      resetAll
    );
  });

  it('routes #/<slide>/<step>: deep links, replaceState, hashchange and one owner per page', async () => {
    await scenario(
      'opens a deep link, writes every position and follows the address bar',
      async () => {
        mockPreferences();
        const deck = deckOf([
          ...sixSlides().slice(0, 2),
          free('plan', 'Plan', {}, [
            { type: 'list', step: 1, items: [{ text: 'A' }, { text: 'B' }] },
          ]),
        ]);
        history.replaceState(null, '', '#/plan/1');
        const replace = vi.spyOn(history, 'replaceState');
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        expect(activeId(container)).toBe('plan');
        expect(active(container).dataset.step).toBe('1');

        await press('ArrowLeft');
        await waitFor(() => expect(location.hash).toBe('#/plan/0'));
        await press('ArrowLeft');
        await waitFor(() => expect(location.hash).toBe('#/market/0'));
        expect(replace).toHaveBeenCalled();
        expect(history.length).toBeLessThanOrEqual(2);

        history.replaceState(null, '', '#/opening/0');
        window.dispatchEvent(new Event('hashchange'));
        await waitFor(() => expect(activeId(container)).toBe('opening'));

        // Hostile or unknown hashes are ignored.
        for (const hostile of ['#/../etc/0', '#/OPENING/0', '#/nope/0', '#/plan/%31']) {
          history.replaceState(null, '', hostile);
          window.dispatchEvent(new Event('hashchange'));
          await Promise.resolve();
          expect(activeId(container)).toBe('opening');
        }
      },
      resetAll
    );
    await scenario(
      'lets only the first stage own the hash, and never writes with syncHash off',
      async () => {
        mockPreferences();
        const replace = vi.spyOn(history, 'replaceState');
        const off = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null, syncHash: false },
        });
        await press('ArrowRight', {}, off.container);
        expect(activeId(off.container)).toBe('market');
        expect(replace).not.toHaveBeenCalled();
        off.unmount();

        const a = document.createElement('div');
        const b = document.createElement('div');
        document.body.append(a, b);
        render(DeckStage, { target: a, props: { deck: deckOf(sixSlides()), loadTheme: null } });
        render(DeckStage, { target: b, props: { deck: deckOf(sixSlides()), loadTheme: null } });
        await press('ArrowRight', {}, b);
        expect(activeId(b)).toBe('market');
        expect(location.hash).toBe('#/opening/0');
        await press('ArrowRight', {}, a);
        await waitFor(() => expect(location.hash).toBe('#/market/0'));
        a.remove();
        b.remove();
      },
      resetAll
    );
    await scenario(
      'rewrites a followed hash past the last step to the clamped route',
      async () => {
        mockPreferences();
        const deck = deckOf([
          free('opening', 'Opening'),
          free('plan', 'Plan', {}, [
            { type: 'list', step: 1, items: [{ text: 'A' }, { text: 'B' }] },
          ]),
        ]);
        history.replaceState(null, '', '#/plan/9');
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        // A deep link is clamped too.
        expect(active(container).dataset.step).toBe('2');
        await waitFor(() => expect(location.hash).toBe('#/plan/2'));
        // Already on the last step: the engine does not move, the address still follows.
        for (const hash of ['#/plan/7', '#/plan/32']) {
          history.replaceState(null, '', hash);
          window.dispatchEvent(new Event('hashchange'));
          await waitFor(() => expect(location.hash, hash).toBe('#/plan/2'));
        }
        // From another slide: the deck lands on the last step and says so.
        history.replaceState(null, '', '#/opening/0');
        window.dispatchEvent(new Event('hashchange'));
        await waitFor(() => expect(activeId(container)).toBe('opening'));
        history.replaceState(null, '', '#/plan/5');
        window.dispatchEvent(new Event('hashchange'));
        await waitFor(() => expect(activeId(container)).toBe('plan'));
        expect(active(container).dataset.step).toBe('2');
        await waitFor(() => expect(location.hash).toBe('#/plan/2'));
      },
      resetAll
    );
    await scenario(
      'never drops a hashchange that arrives during a slide transition: it applies after',
      async () => {
        mockPreferences();
        // Browsers run a view transition's DOM swap a frame or more later: hold it.
        const pending: (() => void)[] = [];
        (document as unknown as Doc).startViewTransition = vi.fn((update: () => void) => {
          let finish: () => void = () => undefined;
          const finished = new Promise<void>((resolve) => {
            finish = resolve;
          });
          pending.push(() => {
            update();
            finish();
          });
          return { ready: Promise.resolve(), finished };
        });
        document.documentElement.animate =
          vi.fn() as unknown as typeof document.documentElement.animate;
        const release = async () => {
          for (const run of pending.splice(0)) run();
          await Promise.resolve();
          await Promise.resolve();
        };
        const hashchange = () => window.dispatchEvent(new Event('hashchange'));
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null },
        });
        await waitFor(() => expect(location.hash).toBe('#/opening/0'));

        // The address bar changes while opening → market is still playing. Its
        // event is a queued task: the swap must not overwrite the typed hash first.
        await press('ArrowRight');
        expect(activeId(container)).toBe('opening');
        history.replaceState(null, '', '#/plan/0');
        await release();
        expect(location.hash).toBe('#/plan/0');
        hashchange();
        await release();
        await waitFor(() => expect(activeId(container)).toBe('plan'));
        await waitFor(() => expect(location.hash).toBe('#/plan/0'));

        // A hashchange while a transition is in flight waits for it, then applies.
        await press('ArrowRight');
        expect(activeId(container)).toBe('plan');
        history.replaceState(null, '', '#/close/0');
        hashchange();
        expect(location.hash).toBe('#/close/0');
        await release();
        await waitFor(() => expect(pending.length).toBe(1));
        await release();
        await waitFor(() => expect(activeId(container)).toBe('close'));
        await waitFor(() => expect(location.hash).toBe('#/close/0'));
      },
      resetAll
    );
  });

  it('keyboard input is focus-scoped: in an embedded pair only the focused deck reacts', async () => {
    await scenario(
      'moves the focused deck only, and gives page-wide keys to the hash owner',
      async () => {
        mockPreferences();
        const a = document.createElement('div');
        const b = document.createElement('div');
        document.body.append(a, b);
        render(DeckStage, { target: a, props: { deck: deckOf(sixSlides()), loadTheme: null } });
        render(DeckStage, {
          target: b,
          props: { deck: deckOf(sixSlides()), loadTheme: null, fit: 'container' },
        });

        await press('ArrowRight', {}, b);
        await press('ArrowRight', {}, b);
        expect([activeId(a), activeId(b)]).toEqual(['opening', 'plan']);
        await press('Home', {}, a);
        await press('End', {}, a);
        expect([activeId(a), activeId(b)]).toEqual(['close', 'plan']);

        // Keys with nothing focused go to the deck that owns the URL, never to the other.
        (document.activeElement as HTMLElement | null)?.blur();
        await fireEvent.keyDown(document.body, { key: 'Home' });
        expect([activeId(a), activeId(b)]).toEqual(['opening', 'plan']);
        a.remove();
        b.remove();
      },
      resetAll
    );
    await scenario(
      'keeps the registry key map and leaves fields and toolbar keys alone',
      async () => {
        mockPreferences();
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null },
        });
        const moves: [string, Bag, string][] = [
          [' ', {}, 'market'],
          ['PageDown', {}, 'plan'],
          ['Enter', {}, 'risks'],
          ['ArrowDown', {}, 'team'],
          ['Backspace', {}, 'risks'],
          [' ', { shiftKey: true }, 'plan'],
          ['PageUp', {}, 'market'],
          ['ArrowUp', {}, 'opening'],
          ['End', {}, 'close'],
          ['Home', {}, 'opening'],
          ['ArrowRight', { ctrlKey: true }, 'opening'],
        ];
        for (const [key, init, expected] of moves) {
          await press(key, init);
          expect(`${JSON.stringify(key)}→${activeId(container)}`).toBe(
            `${JSON.stringify(key)}→${expected}`
          );
        }
        const next = screen.getByRole('button', { name: 'Next step or slide' });
        next.focus();
        await fireEvent.keyDown(next, { key: ' ' });
        expect(activeId(container)).toBe('opening');
        const field = document.createElement('input');
        active(container).querySelector('.tx-deck-stage__slide-body')?.append(field);
        field.focus();
        await fireEvent.keyDown(field, { key: 'ArrowRight' });
        expect(activeId(container)).toBe('opening');
      },
      resetAll
    );
    await scenario(
      'toggles the overview with O and closes it with Escape, handing focus back to the slide',
      async () => {
        mockPreferences();
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null },
        });
        await press('o');
        const nav = screen.getByRole('navigation', { name: 'Slides' });
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole('button', { name: '1 Opening' }))
        );
        expect(slides(container)).toHaveLength(0);
        await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
        expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
        expect(nav.isConnected).toBe(false);
        await waitFor(() => expect(document.activeElement).toBe(active(container)));

        await press('o');
        await fireEvent.click(screen.getByRole('button', { name: '4 Risks' }));
        expect(activeId(container)).toBe('risks');
        await waitFor(() => expect(document.activeElement).toBe(active(container)));
      },
      resetAll
    );
  });

  it('pointer input: swipe, click-to-advance and its guards', async () => {
    await scenario(
      'advances on a click unless it lands on a link, a control or interactive content',
      async () => {
        mockPreferences();
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null },
        });
        const body = () =>
          active(container).querySelector('.tx-deck-stage__slide-body') as HTMLElement;
        await fireEvent.pointerDown(body(), { pointerType: 'mouse', pointerId: 1 });
        await fireEvent.click(body());
        expect(activeId(container)).toBe('market');

        const link = document.createElement('a');
        link.href = 'https://example.com/';
        const interactive = document.createElement('div');
        interactive.setAttribute('data-tx-deck-interactive', '');
        const inner = document.createElement('span');
        interactive.append(inner);
        body().append(link, interactive);
        for (const target of [link, inner]) {
          await fireEvent.click(target);
          expect(activeId(container)).toBe('market');
        }
        await fireEvent.click(body(), { button: 2 });
        await fireEvent.click(body(), { shiftKey: true });
        expect(activeId(container)).toBe('market');
      },
      resetAll
    );
    await scenario(
      'swipes with touch (left = next) and ignores mouse drags; an embedded deck takes its first click as focus',
      async () => {
        mockPreferences();
        const { container } = render(DeckStage, {
          props: { deck: deckOf(sixSlides()), loadTheme: null, syncHash: false },
        });
        const canvas = container.querySelector<HTMLElement>('[data-tx-deck-canvas]') as HTMLElement;
        const swipe = async (dx: number, pointerType: string) => {
          await fireEvent.pointerDown(canvas, {
            pointerId: 7,
            pointerType,
            clientX: 400,
            clientY: 200,
          });
          await fireEvent.pointerUp(canvas, {
            pointerId: 7,
            pointerType,
            clientX: 400 + dx,
            clientY: 205,
          });
        };
        await swipe(-120, 'touch');
        expect(activeId(container)).toBe('market');
        await swipe(-120, 'mouse');
        expect(activeId(container)).toBe('market');
        await swipe(120, 'touch');
        expect(activeId(container)).toBe('opening');

        (document.activeElement as HTMLElement | null)?.blur();
        const body = active(container).querySelector('.tx-deck-stage__slide-body') as HTMLElement;
        await fireEvent.pointerDown(body, { pointerType: 'mouse', pointerId: 2 });
        await fireEvent.click(body);
        expect(activeId(container)).toBe('opening');
        await waitFor(() => expect(document.activeElement).toBe(active(container)));
        await fireEvent.pointerDown(body, { pointerType: 'mouse', pointerId: 3 });
        await fireEvent.click(body);
        expect(activeId(container)).toBe('market');
      },
      resetAll
    );
  });
});

describe('DeckStage v2: transitions, motion and language', () => {
  afterEach(resetAll);

  function mockViewTransitions() {
    const seen: { from?: string | null; to?: string | null }[] = [];
    const start = vi.fn((update: () => void) => {
      const named = () =>
        [...document.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]')].find(
          (slide) => slide.style.getPropertyValue('view-transition-name') !== ''
        )?.dataset.slideId;
      const from = named();
      update();
      seen.push({ from, to: named() });
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    (document as unknown as Doc).startViewTransition = start;
    const animate = vi.fn();
    document.documentElement.animate =
      animate as unknown as typeof document.documentElement.animate;
    return { start, seen, animate };
  }

  function transitionEvents() {
    const events: Bag[] = [];
    const listen = (event: Event) => events.push((event as CustomEvent).detail as Bag);
    document.addEventListener('tx-deck:transition-start', listen);
    return { events, stop: () => document.removeEventListener('tx-deck:transition-start', listen) };
  }

  const motionDeck = (style: Bag = {}) =>
    deckOf(
      [
        free('opening', 'Opening'),
        free('rise', 'Rise', { transition: 'fade-up' }),
        free('cut', 'Cut', { transition: 'none' }),
        free('glide', 'Glide', { transition: 'slide' }),
        free('morph', 'Morph', { transition: 'morph' }),
      ],
      { style }
    );

  it('plays the resolved transition with View Transitions, scoped names and morph pairs', async () => {
    await scenario(
      'starts a view transition per slide change with the resolved name, duration and direction',
      async () => {
        mockPreferences();
        const vt = mockViewTransitions();
        const log = transitionEvents();
        render(DeckStage, { props: { deck: motionDeck(), loadTheme: null, namespace: 'tour' } });
        await press('ArrowRight');
        await press('ArrowRight');
        await press('ArrowRight');
        await press('ArrowLeft');
        expect(
          log.events.map((event) => {
            const transition = event.transition as Bag;
            return `${event.from}>${event.to}:${transition.name}/${transition.durationMs}/${event.mode}`;
          })
        ).toEqual([
          'opening>rise:fade-up/300/view-transition',
          'rise>cut:none/0/cut',
          'cut>glide:slide/400/view-transition',
          'glide>cut:none/0/cut',
        ]);
        // The cut never starts a view transition; the slide name moves from the old slide to the new one.
        expect(vt.start).toHaveBeenCalledTimes(2);
        expect(vt.seen).toEqual([
          { from: 'opening', to: 'rise' },
          { from: 'cut', to: 'glide' },
        ]);
        await waitFor(() => expect(vt.animate).toHaveBeenCalled());
        const pseudo = vt.animate.mock.calls.map(([, options]) => (options as Bag).pseudoElement);
        expect(pseudo).toContain('::view-transition-new(tx-deck-tour-slide)');
        expect(pseudo).toContain('::view-transition-old(tx-deck-tour-slide)');
        // Names are cleared once the transition finished.
        await waitFor(() =>
          expect(
            slides().every((slide) => slide.style.getPropertyValue('view-transition-name') === '')
          ).toBe(true)
        );
        log.stop();
      },
      resetAll
    );
    await scenario(
      'pairs matching elements on morph slides',
      async () => {
        mockPreferences();
        const names: string[][] = [];
        (document as unknown as Doc).startViewTransition = vi.fn((update: () => void) => {
          const collect = () =>
            [...document.querySelectorAll<HTMLElement>('[data-tx-deck-slide]')].flatMap((slide) =>
              [...slide.querySelectorAll<HTMLElement>('*')]
                .map((element) => element.style.getPropertyValue('view-transition-name'))
                .filter(Boolean)
                .map((name) => `${slide.dataset.slideId}:${name}`)
            );
          names.push(collect());
          update();
          names.push(collect());
          return { ready: Promise.resolve(), finished: Promise.resolve() };
        });
        render(DeckStage, {
          props: {
            deck: motionDeck(),
            loadTheme: null,
            namespace: 'tour',
            initialSlideId: 'glide',
          },
        });
        await press('ArrowRight');
        expect(names).toEqual([
          ['glide:tx-deck-tour-m-title', 'glide:tx-deck-tour-m-text-0'],
          ['morph:tx-deck-tour-m-title', 'morph:tx-deck-tour-m-text-0'],
        ]);
      },
      resetAll
    );
  });

  it('moves focus to the incoming slide once a deferred view transition swaps the DOM', async () => {
    // Browsers run the update callback a frame or more later; hold it until the test releases it.
    function deferredViewTransitions() {
      const pending: (() => void)[] = [];
      (document as unknown as Doc).startViewTransition = vi.fn((update: () => void) => {
        let finish: () => void = () => undefined;
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        pending.push(() => {
          update();
          finish();
        });
        return { ready: Promise.resolve(), finished };
      });
      document.documentElement.animate =
        vi.fn() as unknown as typeof document.documentElement.animate;
      return {
        release: async () => {
          for (const run of pending.splice(0)) run();
          await Promise.resolve();
        },
      };
    }
    await scenario(
      'focus waits for the swap and lands on the new slide, never on the outgoing one',
      async () => {
        mockPreferences();
        const vt = deferredViewTransitions();
        const { container } = render(DeckStage, { props: { deck: motionDeck(), loadTheme: null } });
        await press('ArrowRight');
        // The engine moved, the DOM did not yet: focus stays where it was meanwhile.
        await Promise.resolve();
        expect(activeId(container)).toBe('opening');
        await vt.release();
        expect(activeId(container)).toBe('rise');
        await waitFor(() => expect(document.activeElement).toBe(active(container)));
        expect((document.activeElement as HTMLElement).dataset.slideId).toBe('rise');
      },
      resetAll
    );
    await scenario(
      'focus dropped to <body> by the swap comes back to the new slide',
      async () => {
        mockPreferences();
        const vt = deferredViewTransitions();
        const { container } = render(DeckStage, { props: { deck: motionDeck(), loadTheme: null } });
        await press('ArrowRight');
        await Promise.resolve();
        (document.activeElement as HTMLElement).blur();
        await vt.release();
        await waitFor(() => expect(document.activeElement).toBe(active(container)));
        expect(activeId(container)).toBe('rise');
      },
      resetAll
    );
    await scenario(
      'never steals focus the page moved elsewhere before the swap (embedded decks)',
      async () => {
        mockPreferences();
        const vt = deferredViewTransitions();
        const outside = document.createElement('button');
        outside.textContent = 'Page control';
        document.body.append(outside);
        try {
          const { container } = render(DeckStage, {
            props: { deck: motionDeck(), loadTheme: null },
          });
          await press('ArrowRight');
          await Promise.resolve();
          outside.focus();
          await vt.release();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(activeId(container)).toBe('rise');
          expect(document.activeElement).toBe(outside);
        } finally {
          outside.remove();
        }
      },
      resetAll
    );
  });

  it('falls back to CSS, lowers motion for reduced motion and cuts for motion none', async () => {
    await scenario(
      'marks the entering slide for the CSS fallback when View Transitions are missing',
      async () => {
        mockPreferences();
        const log = transitionEvents();
        const { container } = render(DeckStage, { props: { deck: motionDeck(), loadTheme: null } });
        await press('ArrowRight');
        expect(active(container).dataset.txDeckEnter).toBe('fade-up');
        expect(active(container).dataset.txDeckDirection).toBe('forward');
        await press('ArrowRight');
        expect(active(container).dataset.txDeckEnter).toBeUndefined();
        await press('ArrowLeft');
        expect(active(container).dataset.txDeckEnter).toBe('fade-up');
        expect(active(container).dataset.txDeckDirection).toBe('backward');
        expect(log.events.map((event) => event.mode)).toEqual(['css', 'cut', 'css']);
        // Re-mounting after the overview never replays the entrance.
        await press('o');
        await waitFor(() => expect(document.activeElement?.tagName).toBe('BUTTON'));
        await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'o' });
        expect(activeId(container)).toBe('rise');
        expect(active(container).dataset.txDeckEnter).toBeUndefined();
        log.stop();
      },
      resetAll
    );
    await scenario(
      'plays a 150 ms fade under the OS or host reduced-motion preference',
      async () => {
        for (const setup of [
          () => mockPreferences({ reduced: true }),
          () => {
            mockPreferences();
            document.documentElement.dataset.txMotion = 'reduce';
          },
        ]) {
          setup();
          const vt = mockViewTransitions();
          const log = transitionEvents();
          const { container, unmount } = render(DeckStage, {
            props: { deck: motionDeck(), loadTheme: null, initialSlideId: 'cut' },
          });
          const stage = screen.getByRole('region', { name: /Presentation/ });
          await waitFor(() => expect(stage.dataset.motion).toBe('reduce'));
          expect(stage.dataset.txDeckMotion).toBe('subtle');
          await press('ArrowRight');
          expect(activeId(container)).toBe('glide');
          expect(log.events[0]?.transition).toMatchObject({
            name: 'fade',
            durationMs: 150,
            reason: 'reduced-motion',
          });
          expect(vt.start).toHaveBeenCalledTimes(1);
          log.stop();
          unmount();
          resetAll();
        }
      },
      resetAll
    );
    await scenario(
      'cuts every change when the deck sets motion none',
      async () => {
        mockPreferences();
        const vt = mockViewTransitions();
        const log = transitionEvents();
        const { container } = render(DeckStage, {
          props: { deck: motionDeck({ motion: 'none' }), loadTheme: null },
        });
        expect(screen.getByRole('region', { name: /Presentation/ }).dataset.txDeckMotion).toBe(
          'none'
        );
        await press('ArrowRight');
        await press('ArrowRight');
        expect(activeId(container)).toBe('cut');
        expect(vt.start).not.toHaveBeenCalled();
        expect(log.events.map((event) => event.mode)).toEqual(['cut', 'cut']);
        log.stop();
      },
      resetAll
    );
  });

  it('i18n: message overrides, lang and dir from meta or props, right-to-left arrows', async () => {
    await scenario(
      'resolves every stage string through overrides and sets lang and dir',
      async () => {
        mockPreferences();
        const messages = {
          'stage.label': 'Presentación: {title}',
          'stage.announce': 'Diapositiva {current} de {total}: {title}',
          'stage.controls': 'Controles',
          'controls.next': 'Siguiente',
          'controls.previous': 7 as unknown as string,
        };
        const { container } = render(DeckStage, {
          props: {
            deck: deckOf(sixSlides(), { meta: { title: 'Plan', locale: 'es', dir: 'ltr' } }),
            loadTheme: null,
            messages,
          },
        });
        const stage = screen.getByRole('region', { name: 'Presentación: Plan' });
        expect(stage.getAttribute('lang')).toBe('es');
        expect(stage.getAttribute('dir')).toBe('ltr');
        expect(live(container)).toBe('Diapositiva 1 de 6: Opening');
        const toolbar = screen.getByRole('group', { name: 'Controles' });
        expect(toolbar).toBeTruthy();
        // A non-string override keeps the default.
        expect(screen.getByRole('button', { name: 'Previous step or slide' })).toBeTruthy();
        await fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(live(container)).toBe('Diapositiva 2 de 6: Market');
      },
      resetAll
    );
    await scenario(
      'flips the arrows in right-to-left decks; props override meta',
      async () => {
        mockPreferences();
        const rtl = render(DeckStage, {
          props: {
            deck: deckOf(sixSlides(), { meta: { locale: 'ar', dir: 'rtl' } }),
            loadTheme: null,
          },
        });
        let stage = screen.getByRole('region', { name: /Presentation/ });
        expect([stage.getAttribute('lang'), stage.getAttribute('dir')]).toEqual(['ar', 'rtl']);
        await press('ArrowLeft');
        expect(activeId(rtl.container)).toBe('market');
        await press('ArrowRight');
        expect(activeId(rtl.container)).toBe('opening');
        rtl.unmount();

        render(DeckStage, {
          props: {
            deck: deckOf(sixSlides(), { meta: { locale: 'ar', dir: 'rtl' } }),
            loadTheme: null,
            locale: 'en-GB',
            dir: 'ltr',
          },
        });
        stage = screen.getByRole('region', { name: /Presentation/ });
        expect([stage.getAttribute('lang'), stage.getAttribute('dir')]).toEqual(['en-GB', 'ltr']);
      },
      resetAll
    );
  });
});

describe('DeckStage v2: steps, renderers, style and hooks', () => {
  afterEach(resetAll);

  const fragmentStates = (root: ParentNode = document) =>
    [
      ...active(root).querySelectorAll<HTMLElement>(
        '.tx-deck-stage__fragment[data-tx-deck-fragment]'
      ),
    ].map(
      (element) =>
        `${element.dataset.txDeckEffect}:${element.dataset.txDeckFragment}${
          element.dataset.visibleItems === undefined ? '' : `/${element.dataset.visibleItems}`
        }${element.hasAttribute('inert') ? ' inert' : ''}`
    );

  it('gives each mounted slide its step context: phases, list items, neighbours at their edges', async () => {
    await scenario(
      'reveals fragments step by step and leaves the neighbours at their first or last state',
      async () => {
        mockPreferences();
        const deck = deckOf([
          free('opening', 'Opening'),
          free('goals', 'Goals', {}, [
            { type: 'heading', level: 3, text: 'This quarter' },
            {
              type: 'list',
              step: 1,
              fragment: 'fade-up',
              items: [{ text: 'Ship' }, { text: 'Scale' }],
            },
            { type: 'callout', tone: 'info', step: 3, body: 'Both met.' },
            { type: 'text', markdown: 'Old plan', fragment: 'strike', step: 3 },
            { type: 'text', markdown: 'Teaser', fragment: 'in-then-out', step: 2 },
          ]),
          free('close', 'Close'),
        ]);
        const { container } = render(DeckStage, {
          props: { deck, loadTheme: null, initialSlideId: 'close' },
        });
        // The previous slide is mounted at its final step.
        const goals = () =>
          container.querySelector<HTMLElement>('[data-slide-id="goals"]') as HTMLElement;
        expect(goals().dataset.step).toBe('3');
        await press('Home');
        expect(goals().dataset.step).toBe('0');

        await press('ArrowRight');
        expect(fragmentStates()).toEqual([
          'fade-up:hidden/0 inert',
          'in:hidden inert',
          'strike:visible',
          'in-then-out:hidden inert',
        ]);
        await press('ArrowRight');
        expect(fragmentStates()).toEqual([
          'fade-up:visible/1',
          'in:hidden inert',
          'strike:visible',
          'in-then-out:hidden inert',
        ]);
        await press('ArrowRight');
        expect(fragmentStates()[3]).toBe('in-then-out:visible');
        await press('ArrowRight');
        expect(fragmentStates()).toEqual([
          'fade-up:visible/2',
          'in:visible',
          'strike:active',
          'in-then-out:gone inert',
        ]);
        expect(
          active().querySelector('[data-tx-deck-fragment="hidden"]')?.getAttribute('aria-hidden')
        ).toBeUndefined();
        await press('ArrowLeft');
        expect(fragmentStates()[1]).toBe('in:hidden inert');
      },
      resetAll
    );
    await scenario(
      'drives code highlights through the block family host step',
      async () => {
        mockPreferences();
        const deck = deckOf([
          free('walk', 'Walkthrough', {}, [
            {
              type: 'code',
              lang: 'ts',
              code: 'const a = 1;\nconst b = 2;',
              highlights: ['1', '2'],
            },
          ]),
        ]);
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        const step = () =>
          active(container)
            .querySelector('[data-highlight-step]')
            ?.getAttribute('data-highlight-step');
        await waitFor(() => expect(step()).toBe('0'));
        await press('ArrowRight');
        await waitFor(() => expect(step()).toBe('1'));
      },
      resetAll
    );
  });

  it('asks the renderer list first, paints the default layouts and components, and labels what has no renderer', async () => {
    await scenario(
      'paints catalog layouts and components by default and names a custom slide with no host renderer',
      async () => {
        mockPreferences();
        const deck = deckOf([
          { id: 'host', title: 'Host', layout: 'custom', props: { component: 'host-widget' } },
          { id: 'hero', title: 'Hero', layout: 'title-hero', props: { title: 'Hero title' } },
        ]);
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        const note = () =>
          active(container).querySelector('.tx-deck-stage__placeholder-text')?.textContent?.trim();
        expect(note()).toBe('The host has no renderer for the custom slide host-widget.');
        await press('ArrowRight');
        await waitFor(() => expect(active(container).textContent).toContain('Hero title'));
        expect(note()).toBeUndefined();
      },
      resetAll
    );
    await scenario(
      'loads a lazy host renderer once, passes the lookup and never re-announces loading',
      async () => {
        mockPreferences();
        const load = vi.fn(async () => ({ default: FreeSlide }));
        const lazy = { load };
        const lookups: Bag[] = [];
        const renderers = [
          {
            slide: (slide: { id: string }, lookup: { tier: string }) => {
              lookups.push({ id: slide.id, tier: lookup.tier });
              return undefined;
            },
          },
          { free: (slide: { id: string }) => (slide.id === 'lazy' ? lazy : undefined) },
        ];
        const deck = deckOf([free('one', 'One'), free('lazy', 'Lazy'), free('three', 'Three')]);
        const { container } = render(DeckStage, {
          props: { deck, loadTheme: null, renderers, tier: 'developer' },
        });
        expect(lookups).toContainEqual({ id: 'one', tier: 'developer' });
        const lazySlide = () => container.querySelector<HTMLElement>('[data-slide-id="lazy"]');
        expect(lazySlide()?.querySelector('[role="status"]')?.textContent).toBe(
          'Loading slide content…'
        );
        await waitFor(() => expect(lazySlide()?.querySelector('h2')?.textContent).toBe('Lazy'));
        await press('ArrowRight');
        await press('ArrowRight');
        await press('ArrowLeft');
        expect(lazySlide()?.querySelector('.tx-deck-stage__slide-title')).toBeTruthy();
        expect(
          lazySlide()?.querySelector('.tx-deck-stage__slide-body > [role="status"]')
        ).toBeNull();
        expect(load).toHaveBeenCalledTimes(1);
      },
      resetAll
    );
  });

  it('applies the deck style: variables on the stage root, progress, footer, logo and backgrounds', async () => {
    await scenario(
      'sets --tx-deck-* on the stage root (never <html>) and honors style.progress',
      async () => {
        mockPreferences();
        for (const progress of ['top', 'bottom', 'none'] as const) {
          const { container, unmount } = render(DeckStage, {
            props: {
              deck: deckOf(sixSlides(), {
                style: { progress, density: 'spacious', footer: 'Example Co.', logo: 'logo.png' },
              }),
              loadTheme: null,
            },
          });
          const stage = screen.getByRole('region', { name: /Presentation/ });
          expect(stage.style.getPropertyValue('--tx-deck-density')).toBe('1.25');
          expect(stage.style.getPropertyValue('--tx-deck-progress')).toBe(progress);
          expect(document.documentElement.style.getPropertyValue('--tx-deck-density')).toBe('');
          const bar = container.querySelector<HTMLElement>('[role="progressbar"]');
          if (progress === 'none') expect(bar).toBeNull();
          else {
            expect(bar?.dataset.txDeckProgress).toBe(progress);
            expect(bar?.getAttribute('aria-valuenow')).toBe('1');
            expect(bar?.getAttribute('aria-valuemax')).toBe('6');
          }
          expect(container.querySelector('.tx-deck-stage__footer-text')?.textContent).toBe(
            'Example Co.'
          );
          expect(container.querySelector('.tx-deck-stage__slide-number')?.textContent).toBe('1');
          expect(container.querySelector('.tx-deck-stage__logo')?.getAttribute('src')).toBe(
            'logo.png'
          );
          unmount();
        }
      },
      resetAll
    );
    await scenario(
      'paints background layers with a contrast scrim and applies the URL policy at the host tier',
      async () => {
        mockPreferences();
        const deck = deckOf([
          free('photo', 'Photo', { background: { kind: 'image-full', src: 'assets/harbor.png' } }),
          free('inline', 'Inline', { background: { kind: 'image', src: PNG } }),
          free('grid', 'Grid', { background: { kind: 'pattern', pattern: 'grid' } }),
        ]);
        const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
        const background = () =>
          active(container).querySelector<HTMLElement>('.tx-deck-stage__background');
        expect(background()?.getAttribute('aria-hidden')).toBe('true');
        expect(background()?.querySelector('img')?.getAttribute('src')).toBe('assets/harbor.png');
        expect(background()?.querySelector('.tx-deck-stage__scrim')).toBeTruthy();
        expect(active(container).dataset.txDeckBgTone).toBe('light');
        expect(active(container).style.getPropertyValue('--tx-deck-bg-text')).toMatch(
          /^#[0-9a-f]{6}$/
        );
        // An agent deck (untrusted, the default) may not paint a data: image; the scrim still holds.
        await press('ArrowRight');
        expect(background()?.querySelector('img')).toBeNull();
        expect(background()?.dataset.txDeckBgRefused).toBe('src');
        expect(background()?.querySelector('.tx-deck-stage__scrim')).toBeTruthy();
        await press('ArrowRight');
        expect(background()?.dataset.txDeckPattern).toBe('grid');
        expect(active(container).style.getPropertyValue('--tx-deck-bg-pattern-ink')).toMatch(/^#/);
      },
      resetAll
    );
  });

  it('runs plugin hooks around paints, reports changes and auto-slides on the engine scheduler', async () => {
    await scenario(
      'calls beforeRender and afterRender per position, honors beforeNavigate and emits typed events',
      async () => {
        mockPreferences();
        const order: string[] = [];
        let controller: DeckController | undefined;
        const plugin: DeckPlugin = {
          name: 'probe',
          setup(value) {
            controller = value;
            return undefined;
          },
          beforeRender: (context) => order.push(`before:${context.state.slideId}`),
          afterRender: (context) => order.push(`after:${context.state.slideId}`),
          beforeNavigate: (target) => (target === 'team' ? false : undefined),
        };
        const onSlideChange = vi.fn();
        const onStepChange = vi.fn();
        const events: string[] = [];
        const listen = (event: Event) =>
          events.push(
            `${event.type}:${((event as CustomEvent).detail as { state?: { slideId: string } }).state?.slideId}`
          );
        for (const name of ['tx-deck:ready', 'tx-deck:change'])
          document.addEventListener(name, listen);
        const { container } = render(DeckStage, {
          props: {
            deck: deckOf(sixSlides()),
            loadTheme: null,
            plugins: [plugin],
            onSlideChange,
            onStepChange,
          },
        });
        await press('ArrowRight');
        expect(order).toEqual(['before:opening', 'after:opening', 'before:market', 'after:market']);
        controller?.goTo('team');
        flushSync();
        expect(activeId(container)).toBe('market');
        controller?.goTo('risks');
        flushSync();
        expect(activeId(container)).toBe('risks');
        expect(onSlideChange.mock.calls).toEqual([
          [{ index: 1, slideId: 'market' }],
          [{ index: 3, slideId: 'risks' }],
        ]);
        expect(onStepChange).toHaveBeenLastCalledWith({
          index: 3,
          slideId: 'risks',
          step: 0,
          stepCount: 0,
        });
        expect(events).toEqual([
          'tx-deck:ready:opening',
          'tx-deck:change:market',
          'tx-deck:change:risks',
        ]);
        for (const name of ['tx-deck:ready', 'tx-deck:change'])
          document.removeEventListener(name, listen);
      },
      resetAll
    );
    await scenario(
      'advances on navigation.autoSlideMs and stops once the viewer takes over',
      async () => {
        mockPreferences();
        vi.useFakeTimers();
        const { container } = render(DeckStage, {
          props: {
            deck: deckOf(sixSlides(), { navigation: { autoSlideMs: 1000 } }),
            loadTheme: null,
          },
        });
        expect(activeId(container)).toBe('opening');
        await vi.advanceTimersByTimeAsync(1000);
        flushSync();
        expect(activeId(container)).toBe('market');
        await vi.advanceTimersByTimeAsync(1000);
        flushSync();
        expect(activeId(container)).toBe('plan');
        await press('ArrowLeft');
        await vi.advanceTimersByTimeAsync(5000);
        flushSync();
        expect(activeId(container)).toBe('market');
      },
      resetAll
    );
  });
});

describe('deck themes', () => {
  const reset = () => {
    vi.restoreAllMocks();
    clearHash();
  };
  afterEach(reset);

  const ocean = generateThemeFromSeed({ seed: '#0e7490', id: 'ocean-test', name: 'Ocean test' });
  const ember = generateThemeFromSeed({ seed: '#c2410c', id: 'ember-test', name: 'Ember test' });

  function v1Deck() {
    const parsed = parseDeck({
      meta: { title: 'Themed deck', themeRef: { kind: 'catalog', id: 'ocean-test' } },
      slides: [
        { id: 'opening', title: 'Opening', blocks: [] },
        {
          id: 'section',
          title: 'Section',
          themeRef: { kind: 'catalog', id: 'ember-test', mode: 'dark' },
          blocks: [],
        },
        { id: 'missing', title: 'Missing', themeRef: 'not-a-theme', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  function themedDeck(deckMode?: string) {
    return deckOf(
      [
        free('opening', 'Opening'),
        free('section', 'Section', { theme: { kind: 'catalog', id: 'ember-test', mode: 'dark' } }),
        free('missing', 'Missing', { theme: 'not-a-theme' }),
        free('closing', 'Closing'),
      ],
      {
        meta: { title: 'Themed deck' },
        style: {
          theme: { kind: 'catalog', id: 'ocean-test', ...(deckMode ? { mode: deckMode } : {}) },
        },
      }
    );
  }

  function fakeLoader() {
    const themes = new Map([
      [ocean.id, ocean],
      [ember.id, ember],
    ]);
    return vi.fn(async (id: string) => {
      const theme = themes.get(id);
      if (!theme) throw new Error(`Unknown theme ${id}`);
      return theme;
    });
  }

  it('deck theme helpers: ids, modes, high-contrast variables and the library loader', async () => {
    await scenario(
      'lists unique catalog ids, deck default first',
      async () => {
        expect(deckCatalogThemeIds(v1Deck())).toEqual(['ocean-test', 'ember-test', 'not-a-theme']);
      },
      reset
    );
    await scenario(
      'resolves modes through the token engine, including prefers-contrast',
      async () => {
        const contrast = mockPreferences({ dark: true, contrastMore: true });
        const scheme = mockPreferences({ dark: true });
        expect(resolveDeckThemeMode(undefined, scheme)).toBe('dark');
        expect(resolveDeckThemeMode({ kind: 'catalog', id: 'a', mode: 'system' }, contrast)).toBe(
          'high-contrast'
        );
        expect(resolveDeckThemeMode({ kind: 'catalog', id: 'a', mode: 'light' }, contrast)).toBe(
          'light'
        );
      },
      reset
    );
    await scenario(
      'swaps semantic colors for system colors in high contrast and keeps style tokens',
      async () => {
        const light = deckThemeVariables(ocean, 'light');
        const contrast = deckThemeVariables(ocean, 'high-contrast', { reducedMotion: true });
        const palette = createHighContrastPalette();
        expect(light['--tx-background']).toBe(ocean.light.background.default);
        expect(light['color-scheme']).toBe('light');
        expect(contrast['--tx-background']).toBe(palette.background.default);
        expect(contrast['--tx-radius']).toBe(light['--tx-radius']);
        expect(contrast['color-scheme']).toBe('light dark');
      },
      reset
    );
    await scenario(
      'loads catalog ids from the token theme library by default',
      async () => {
        const theme = await loadDeckLibraryTheme('graphite');
        expect(theme.id).toBe('graphite');
        await expect(loadDeckLibraryTheme('not-a-theme')).rejects.toThrow();
      },
      reset
    );
  });

  it('DeckStage applies loader, slide-override, embedded, seed, high-contrast and host-CSS themes', async () => {
    await scenario(
      'applies catalog themes from the loader and lets slide themes override the deck',
      async () => {
        mockPreferences();
        const loadTheme = fakeLoader();
        render(DeckStage, { props: { deck: themedDeck('light'), loadTheme } });
        const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        const next = screen.getByRole('button', { name: 'Next step or slide' });

        await waitFor(() => expect(stage.getAttribute('data-theme-status')).toBe('applied'));
        expect(stage.style.getPropertyValue('--tx-background')).toBe(
          ocean.light.background.default
        );
        expect(stage.getAttribute('data-tx-theme')).toBe('ocean-test');
        expect(stage.getAttribute('data-tx-surface')).toBe(ocean.style.surface);
        expect(document.documentElement.style.getPropertyValue('--tx-background')).toBe('');

        await fireEvent.click(next);
        await waitFor(() => expect(stage.getAttribute('data-tx-theme')).toBe('ember-test'));
        expect(stage.getAttribute('data-tx-mode')).toBe('dark');
        expect(stage.style.getPropertyValue('--tx-background')).toBe(ember.dark.background.default);

        await fireEvent.click(next);
        await waitFor(() => expect(stage.getAttribute('data-theme-status')).toBe('unavailable'));
        expect(stage.style.getPropertyValue('--tx-background')).toBe('');

        await fireEvent.click(next);
        expect(stage.style.getPropertyValue('--tx-background')).toBe(
          ocean.light.background.default
        );
        expect(loadTheme.mock.calls.map(([id]) => id)).toEqual([
          'ocean-test',
          'ember-test',
          'not-a-theme',
        ]);
      },
      reset
    );
    await scenario(
      'applies embedded themes at once and generates seed themes',
      async () => {
        mockPreferences();
        const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
        const embedded = render(DeckStage, {
          props: {
            deck: deckOf([free('one', 'One')], {
              meta: { title: 'Embedded' },
              style: { theme: { kind: 'embedded', theme, mode: 'dark' } },
            }),
          },
        });
        let stage = screen.getByRole('region', { name: 'Presentation: Embedded' });
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-background')).toBe(
            theme.dark.background.default
          )
        );
        expect(stage.getAttribute('data-tx-theme')).toBe(theme.id);
        embedded.unmount();

        render(DeckStage, {
          props: {
            deck: deckOf([free('one', 'One')], {
              meta: { title: 'Seeded' },
              style: { theme: { kind: 'seed', seed: 0x2b6ce0, mode: 'light' } },
            }),
          },
        });
        stage = screen.getByRole('region', { name: 'Presentation: Seeded' });
        expect(stage.getAttribute('data-tx-theme')).toBe(`seed-${0x2b6ce0}`);
        await waitFor(() => expect(stage.getAttribute('data-theme-status')).toBe('applied'));
        expect(stage.style.getPropertyValue('--tx-background')).not.toBe('');
      },
      reset
    );
    await scenario(
      'applies the high-contrast system palette for explicit and preferred high contrast',
      async () => {
        const palette = createHighContrastPalette();
        mockPreferences();
        const explicit = render(DeckStage, {
          props: { deck: themedDeck('high-contrast'), loadTheme: fakeLoader() },
        });
        let stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        expect(stage.getAttribute('data-tx-mode')).toBe('high-contrast');
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-background')).toBe(palette.background.default)
        );
        explicit.unmount();

        mockPreferences({ dark: true, contrastMore: true });
        render(DeckStage, { props: { deck: themedDeck(), loadTheme: fakeLoader() } });
        stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('high-contrast'));
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-foreground')).toBe(palette.foreground.default)
        );
      },
      reset
    );
    await scenario(
      'follows the host page mode and leaves catalog themes to host CSS when loading is off',
      async () => {
        mockPreferences();
        const host = document.createElement('div');
        host.setAttribute('data-tx-mode', 'dark');
        document.body.append(host);
        render(DeckStage, { target: host, props: { deck: themedDeck(), loadTheme: null } });
        const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('dark'));
        expect(stage.getAttribute('data-theme-status')).toBe('host');
        expect(stage.style.getPropertyValue('--tx-background')).toBe('');
        host.remove();
      },
      reset
    );
  });
});

describe('legacy model helpers the stage still exports', () => {
  it('presenter timer accumulates across pauses, resets and formats elapsed time', () => {
    let now = 1_000;
    const timer = createPresenterTimer(() => now);
    expect(timer.elapsed()).toBe(0);
    timer.start();
    now += 1_500;
    timer.pause();
    now += 10_000;
    expect(timer.elapsed()).toBe(1_500);
    timer.start();
    now += 500;
    expect(timer.elapsed()).toBe(2_000);
    timer.reset();
    expect(timer.elapsed()).toBe(0);
    expect(timer.running).toBe(true);
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });

  it('v1 transition tokens validate, resolve and round-trip through the grammar', () => {
    const parsed = parseDeck({
      meta: { title: 'Motion deck' },
      settings: { defaultTransition: 'fade-up' },
      slides: [
        { id: 'opening', title: 'Opening', blocks: [] },
        { id: 'cut', title: 'Cut', transition: 'none', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    expect(DECK_TRANSITIONS).toEqual(['none', 'fade', 'fade-up']);
    const [opening, cut] = parsed.deck.slides;
    if (!opening || !cut) throw new Error('slides');
    expect(resolveSlideTransition(parsed.deck, opening)).toBe('fade-up');
    expect(resolveSlideTransition(parsed.deck, cut)).toBe('none');
    expect(resolveSlideTransition(parsed.deck, opening, { reducedMotion: true })).toBe('none');
    for (const hostile of ['zoom', 'url(javascript:alert(1))', 3, null]) {
      const bad = parseDeck({
        meta: { title: 'Bad' },
        slides: [{ id: 'one', transition: hostile, blocks: [] }],
      });
      expect(bad.success).toBe(false);
    }
    const decoded = parseDeckGrammar(JSON.parse(JSON.stringify(toDeckGrammar(parsed.deck))));
    expect(decoded.deck).toEqual(parsed.deck);
  });
});

// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/svelte';
import { createMemoryPresenterTransport, resolveDeckTransition } from '@texuli/deck/engine';
import type { DeckSlide } from '@texuli/deck/model';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { deckCssVars } from '../src/stage/css-vars.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { composeFreeSlide } from '../src/stage/free.ts';
import { createSwipeTracker } from '../src/stage/input.ts';
import { createDeckTranslator, DECK_STAGE_MESSAGES } from '../src/stage/messages.ts';
import { prefetchDeckSlides, slideBlockFamilies, whenIdle } from '../src/stage/prefetch.ts';
import { prepareDeck } from '../src/stage/prepare.ts';
import {
  deckValidationHooks,
  loadRenderer,
  readyRenderer,
  resolveItemRenderer,
  resolveSlideRenderer,
} from '../src/stage/renderers.ts';
import {
  claimDeckHash,
  readDeckHash,
  releaseDeckHash,
  watchDeckHash,
  writeDeckHash,
} from '../src/stage/route.ts';
import { deckSlideSteps, deckStepView } from '../src/stage/steps.ts';
import {
  DECK_FALLBACK_PALETTES,
  deckBackgroundPalette,
  deckThemeReferences,
  resolveStageMode,
  seedColor,
} from '../src/stage/style.ts';
import { deckSyncLink } from '../src/stage/sync-link.ts';
import {
  playDeckTransition,
  transitionKeyframes,
  viewTransitionPrefix,
} from '../src/stage/transition.ts';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';
import { scenario } from './scenario.ts';

// The default renderer tables load on first use; preload them, as a host that paints at once does.
beforeAll(() => loadDefaultDeckRenderers());

const reset = () => {
  vi.restoreAllMocks();
};

const free = (id: string, blocks: unknown[], extra: Record<string, unknown> = {}) =>
  ({ id, layout: 'free', blocks, ...extra }) as unknown as DeckSlide;

describe('stage seams: messages, preparation and steps', () => {
  afterEach(reset);

  it('messages: engine and stage keys, placeholders, partial and malformed overrides', () => {
    const t = createDeckTranslator({
      'controls.next': 'Weiter',
      'stage.announce': 'Folie {current}/{total}: {title}',
      'stage.label': 42 as unknown as string,
    });
    expect(t('controls.next')).toBe('Weiter');
    expect(t('controls.previous')).toBe('Previous step or slide');
    expect(t('stage.announce', { current: 2, total: 9, title: 'Plan' })).toBe('Folie 2/9: Plan');
    expect(t('stage.label', { title: 'X' })).toBe('Presentation: X');
    expect(t('stage.slideOf', { current: 1 })).toBe('Slide 1 of {total}');
    for (const key of Object.keys(DECK_STAGE_MESSAGES)) {
      expect(key.startsWith('stage.')).toBe(true);
    }
  });

  it('prepareDeck migrates, validates block bodies and the host registry, and never throws', async () => {
    await scenario(
      'accepts v2 and v1, refuses bad block bodies and unknown components',
      () => {
        const v2 = prepareDeck({
          formatVersion: 2,
          meta: { title: 'Ok' },
          slides: [free('one', [{ type: 'text', markdown: 'Hi' }])],
        });
        expect(v2).toMatchObject({ ok: true, from: 'v2' });
        const v1 = prepareDeck({
          meta: { title: 'Old' },
          slides: [{ id: 'a', title: 'A', blocks: [] }],
        });
        expect(v1).toMatchObject({ ok: true, from: 'texuli-v1' });

        const badBlock = prepareDeck({
          formatVersion: 2,
          meta: { title: 'Bad' },
          slides: [free('one', [{ type: 'heading', level: 9, text: 'Too deep' }])],
        });
        expect(badBlock.ok).toBe(false);
        expect(badBlock.issues.some((issue) => issue.code === 'block-props')).toBe(true);

        const component = {
          formatVersion: 2,
          meta: { title: 'Components' },
          slides: [
            free('one', [{ type: 'component', component: 'stat-card', props: { value: 1 } }]),
          ],
        };
        expect(prepareDeck(component).ok).toBe(true);
        const hooks = deckValidationHooks([
          { knownComponents: ['chart-bar'] },
          { knownComponents: [] },
        ]);
        const unknown = prepareDeck(component, hooks);
        expect(unknown.ok).toBe(false);
        expect(unknown.issues.map((issue) => issue.code)).toContain('unknown-component');
        const validated = prepareDeck(
          component,
          deckValidationHooks([
            {
              validateComponent: (_input, path) => [
                {
                  code: 'component-props',
                  severity: 'error',
                  path,
                  jsonPath: '$',
                  pointer: '',
                  message: 'value must be a string',
                },
              ],
            },
          ])
        );
        expect(validated.ok).toBe(false);

        const hostile = new Proxy(
          {},
          {
            get() {
              throw new Error('trap');
            },
            ownKeys() {
              throw new Error('trap');
            },
          }
        );
        expect(prepareDeck(hostile).ok).toBe(false);
      },
      reset
    );
    await scenario(
      'shows registry refusals in the stage error state',
      () => {
        render(DeckStage, {
          props: {
            deck: {
              formatVersion: 2,
              meta: { title: 'Components' },
              slides: [free('one', [{ type: 'component', component: 'stat-card', props: {} }])],
            },
            renderers: { knownComponents: ['chart-bar'] },
            loadTheme: null,
          },
        });
        expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.');
        expect(document.querySelector('[data-code="unknown-component"]')).toBeTruthy();
      },
      reset
    );
    await scenario(
      'a host validateBlock replaces the blocks check, so host block types paint through the host',
      () => {
        const hostDeck = {
          formatVersion: 2,
          meta: { title: 'Host blocks' },
          slides: [free('one', [{ type: 'host-card', title: 'Hello from the host' }])],
        };
        const refused = prepareDeck(hostDeck);
        expect(refused.ok).toBe(false);
        expect(refused.issues.map((issue) => issue.code)).toContain('block-props');
        // Accept every block (the host paints them), or check them the host's way.
        expect(
          prepareDeck(hostDeck, deckValidationHooks([{ validateBlock: () => undefined }])).ok
        ).toBe(true);
        const strict = prepareDeck(
          hostDeck,
          deckValidationHooks([
            {
              validateBlock: (block, path) =>
                block.type === 'host-card'
                  ? [
                      {
                        code: 'block-props',
                        severity: 'error',
                        path,
                        jsonPath: '$',
                        pointer: '',
                        message: 'The host refuses this card.',
                      },
                    ]
                  : undefined,
            },
            // A later table never overrides the first block check.
            { validateBlock: () => undefined },
          ])
        );
        expect(strict.ok).toBe(false);
        expect(strict.issues.map((issue) => issue.message)).toContain(
          'The host refuses this card.'
        );

        render(DeckStage, {
          props: {
            deck: hostDeck,
            loadTheme: null,
            renderers: { validateBlock: () => undefined, free: () => HostFreeSlide },
          },
        });
        expect(screen.queryByRole('alert')).toBeNull();
        expect(document.querySelector('[data-host-free]')?.textContent?.trim()).toBe(
          'Hello from the host'
        );
      },
      reset
    );
    await scenario(
      'defaultRenderers={false} leaves every slide to the host tables',
      () => {
        const deck = {
          formatVersion: 2,
          meta: { title: 'Host only' },
          slides: [
            { id: 'q', layout: 'quote', props: { quote: 'Small pieces.' } },
            free('two', [{ type: 'text', markdown: 'Two' }]),
          ],
        };
        const on = render(DeckStage, { props: { deck, loadTheme: null } });
        const quote = () => document.querySelector('[data-slide-id="q"]');
        expect(quote()?.querySelector('[data-tx-deck-placeholder]')).toBeNull();
        on.unmount();

        render(DeckStage, { props: { deck, loadTheme: null, defaultRenderers: false } });
        expect(screen.queryByRole('alert')).toBeNull();
        // No default layout table: the quote slide shows the labelled placeholder.
        expect(quote()?.querySelector('[data-tx-deck-placeholder="quote"]')).toBeTruthy();
        cleanup();
        // Without the default registry, component ids are the host's to check.
        const hostComponent = {
          formatVersion: 2,
          meta: { title: 'Ids' },
          slides: [
            { id: 'c', layout: 'component', component: { component: 'host-thing', props: {} } },
          ],
        };
        const withDefaults = render(DeckStage, { props: { deck: hostComponent, loadTheme: null } });
        expect(document.querySelector('[data-code="unknown-component"]')).toBeTruthy();
        withDefaults.unmount();
        render(DeckStage, {
          props: { deck: hostComponent, loadTheme: null, defaultRenderers: false },
        });
        expect(screen.queryByRole('alert')).toBeNull();
        expect(document.querySelector('[data-tx-deck-placeholder="component"]')).toBeTruthy();
      },
      reset
    );
  });

  it('step context: phases, attributes, list items and code highlights for any path', () => {
    const slide = free('s', [
      { type: 'list', step: 1, items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
      { type: 'code', code: 'a\nb\nc', lang: 'ts', step: 2, highlights: ['1', '2', '3'] },
      { type: 'text', markdown: 'out', fragment: 'out', step: 4 },
    ]);
    const steps = deckSlideSteps(slide);
    expect(steps.count).toBe(4);
    const at = (step: number) => deckStepView({ slide, steps, step });
    expect(at(0).visibleItems(['blocks', 0])).toBe(0);
    expect(at(2).visibleItems(['blocks', 0])).toBe(2);
    expect(at(99).step).toBe(4);
    expect(at(-3).step).toBe(0);
    expect(at(0).attributes(['blocks', 0])).toMatchObject({
      'data-tx-deck-fragment': 'hidden',
      'aria-hidden': 'true',
      inert: true,
    });
    expect(at(1).attributes(['blocks', 0])).not.toHaveProperty('inert');
    expect(at(0).attributes(['blocks', 5])).toEqual({});
    expect(at(1).codeHighlight(['blocks', 1])).toBeNull();
    expect(at(2).codeHighlight(['blocks', 1])).toEqual({ lines: '1', index: 0 });
    expect(at(4).codeHighlight(['blocks', 1])).toEqual({ lines: '3', index: 2 });
    expect(at(3).phase(['blocks', 2])).toBe('visible');
    expect(at(4).phase(['blocks', 2])).toBe('gone');
    expect(at(1).active).toBe(true);
    expect(deckStepView({ slide, steps, step: 0, active: false }).active).toBe(false);
  });

  it('free-slide composition keeps item indexes across master regions', () => {
    const composed = composeFreeSlide({
      master: 'media-right',
      blocks: [
        { type: 'image', src: 'a.png', alt: 'A', width: 10, height: 10 },
        { type: 'text', markdown: 'b' },
        { type: 'component', component: 'stat-card', props: {} },
        { type: 'heading', level: 9, text: 'invalid' },
      ] as never,
    });
    expect(
      composed.regions.map((region) => [
        region.slot,
        region.entries.map((e) => `${e.kind}${e.index}`),
      ])
    ).toEqual([
      ['body', ['block1', 'component2', 'invalid3']],
      ['media', ['block0']],
    ]);
    const media = composed.regions[1]?.entries[0];
    expect(media?.kind === 'block' && (media.block as { fit?: string }).fit).toBe('cover');
  });
});

describe('stage seams: renderers, routing, transitions and adapters', () => {
  afterEach(reset);

  it('renderer list: slide first, then the kind resolver, failing resolvers fall through, lazy entries load once', async () => {
    const A = (() => null) as never;
    const B = (() => null) as never;
    const hero = { id: 'h', layout: 'title-hero', props: {} } as unknown as DeckSlide;
    const lookup = { tier: 'untrusted' as const };
    expect(resolveSlideRenderer([], hero, lookup)).toBeUndefined();
    expect(resolveSlideRenderer([{ layout: () => A }], hero, lookup)).toBe(A);
    expect(
      resolveSlideRenderer(
        [
          {
            layout: () => {
              throw new Error('boom');
            },
          },
          { slide: () => undefined, layout: () => B },
        ],
        hero,
        lookup
      )
    ).toBe(B);
    expect(resolveSlideRenderer([{ free: () => A }], hero, lookup)).toBeUndefined();
    expect(
      resolveItemRenderer(
        [{ item: (item) => (item.component === 'x' ? A : null) }],
        { type: 'component', component: 'x', props: {} } as never,
        lookup
      )
    ).toBe(A);

    const load = vi.fn(async () => ({ default: A }));
    const lazy = { load };
    expect(readyRenderer(lazy)).toBeUndefined();
    expect(await loadRenderer(lazy)).toBe(A);
    expect(await loadRenderer(lazy)).toBe(A);
    expect(readyRenderer(lazy)).toBe(A);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await loadRenderer({ load: async () => B })).toBe(B);
  });

  it('hash adapter: one owner per window, replaceState writes and hostile hashes ignored', () => {
    const win = {
      location: { hash: '#/plan/2' },
      history: {
        state: { keep: true },
        replaceState: vi.fn((_state: unknown, _unused: string, url: string) => {
          win.location.hash = url;
        }),
      },
      listeners: new Set<() => void>(),
      addEventListener(_type: 'hashchange', listener: () => void) {
        this.listeners.add(listener);
      },
      removeEventListener(_type: 'hashchange', listener: () => void) {
        this.listeners.delete(listener);
      },
    };
    expect(claimDeckHash(win, 'a')).toBe(true);
    expect(claimDeckHash(win, 'b')).toBe(false);
    expect(claimDeckHash(win, 'a')).toBe(true);
    releaseDeckHash(win, 'b');
    expect(claimDeckHash(win, 'b')).toBe(false);
    releaseDeckHash(win, 'a');
    expect(claimDeckHash(win, 'b')).toBe(true);

    expect(readDeckHash(win)).toEqual({ slideId: 'plan', step: 2 });
    expect(writeDeckHash(win, { slideId: 'plan', step: 2 })).toBe(false);
    expect(writeDeckHash(win, { slideId: 'next', step: 0 })).toBe(true);
    expect(win.history.replaceState).toHaveBeenCalledWith({ keep: true }, '', '#/next/0');
    expect(writeDeckHash(win, { slideId: 'BAD', step: 0 })).toBe(false);

    const seen: unknown[] = [];
    const stop = watchDeckHash(win, (location) => seen.push(location));
    for (const hash of ['#/a/1', '#/../x', '#/b']) {
      win.location.hash = hash;
      for (const listener of win.listeners) listener();
    }
    stop();
    expect(win.listeners.size).toBe(0);
    expect(seen).toEqual([
      { slideId: 'a', step: 1 },
      { slideId: 'b', step: 0 },
    ]);
  });

  it('transition player: cut, CSS fallback, view transitions and a throwing browser', async () => {
    const fade = resolveDeckTransition({ style: { transition: 'fade' } });
    const none = resolveDeckTransition({ style: { transition: 'none' } });
    const update = vi.fn();
    expect(
      playDeckTransition({
        resolved: none,
        direction: 'forward',
        update,
        namespace: 'n',
        doc: { startViewTransition: vi.fn() },
      }).mode
    ).toBe('cut');
    expect(
      playDeckTransition({
        resolved: fade,
        direction: 'forward',
        update,
        namespace: 'n',
        doc: null,
      }).mode
    ).toBe('css');
    const throwing = {
      startViewTransition: () => {
        throw new Error('InvalidStateError');
      },
    };
    expect(
      playDeckTransition({
        resolved: fade,
        direction: 'forward',
        update,
        namespace: 'n',
        doc: throwing,
      }).mode
    ).toBe('css');
    expect(update).toHaveBeenCalledTimes(3);

    const animate = vi.fn();
    const played = playDeckTransition({
      resolved: fade,
      direction: 'backward',
      update,
      namespace: 'Deck 1!',
      doc: {
        startViewTransition: (run) => {
          run();
          return { ready: Promise.resolve(), finished: Promise.resolve() };
        },
        documentElement: { animate },
      },
    });
    expect(played.mode).toBe('view-transition');
    await played.finished;
    expect(viewTransitionPrefix('Deck 1!')).toBe('tx-deck-deck-1-');
    expect(animate.mock.calls.map(([, options]) => options.pseudoElement)).toEqual([
      '::view-transition-old(tx-deck-deck-1-slide)',
      '::view-transition-new(tx-deck-deck-1-slide)',
    ]);
    expect(transitionKeyframes('slide', 'forward').new[0]).toEqual({
      transform: 'translateX(100%)',
    });
    expect(transitionKeyframes('slide', 'forward', true).new[0]).toEqual({
      transform: 'translateX(-100%)',
    });
    expect(transitionKeyframes('slide', 'backward').new[0]).toEqual({
      transform: 'translateX(-100%)',
    });
  });

  it('prefetch, idle scheduling, swipe tracking, CSS variables, styles and sync links', async () => {
    await scenario(
      'prefetches block families and host chunks; idles with a fallback',
      async () => {
        const slides = [
          free('a', [
            { type: 'text', markdown: 'x' },
            { type: 'columns', columns: [[{ type: 'code', code: 'x', lang: 'ts' }]] },
            { type: 'component', component: 'stat-card', props: {} },
            { type: 'no-such-type' },
          ]),
          { id: 'b', layout: 'title-hero', props: {} } as unknown as DeckSlide,
        ];
        expect(slideBlockFamilies(slides[0] as DeckSlide).sort()).toEqual([
          'blocks-code',
          'blocks-structure',
          'blocks-text',
        ]);
        const loadFamily = vi.fn(async () => undefined);
        const prefetch = vi.fn(async () => undefined);
        await prefetchDeckSlides(slides, {
          loadFamily,
          renderers: [
            { prefetch },
            {
              prefetch: () => {
                throw new Error('x');
              },
            },
          ],
        });
        expect(loadFamily).toHaveBeenCalledTimes(3);
        expect(prefetch).toHaveBeenCalledTimes(2);

        const task = vi.fn();
        const idle = {
          requestIdleCallback: vi.fn(() => 4),
          cancelIdleCallback: vi.fn(),
          setTimeout: vi.fn(),
          clearTimeout: vi.fn(),
        };
        whenIdle(idle, task)();
        expect(idle.cancelIdleCallback).toHaveBeenCalledWith(4);
        const timers = { setTimeout: vi.fn(() => 9), clearTimeout: vi.fn() };
        whenIdle(timers, task)();
        expect(timers.clearTimeout).toHaveBeenCalledWith(9);
      },
      reset
    );
    await scenario(
      'tracks one pointer as a swipe and cancels on a second finger',
      () => {
        let now = 0;
        const tracker = createSwipeTracker(() => now);
        const pointer = (pointerId: number, clientX: number) =>
          ({
            pointerId,
            clientX,
            clientY: 0,
            pointerType: 'touch',
            composedPath: () => [],
          }) as unknown as PointerEvent;
        tracker.down(pointer(1, 300), null);
        now = 120;
        expect(tracker.up(pointer(1, 200))).toMatchObject({
          kind: 'swipe',
          dx: -100,
          durationMs: 120,
          pointerType: 'touch',
        });
        tracker.down(pointer(1, 300), null);
        tracker.down(pointer(2, 300), null);
        expect(tracker.up(pointer(2, 100))).toBeNull();
        expect(tracker.up(pointer(1, 100))).toBeNull();
      },
      reset
    );
    await scenario(
      'writes only --tx-* variables through the CSSOM and removes dropped ones',
      () => {
        const node = document.createElement('div');
        const action = deckCssVars(node, { '--tx-deck-a': '1', color: 'red', '--tx-deck-b': '2' });
        expect(node.getAttribute('style')).toContain('--tx-deck-a');
        expect(node.style.getPropertyValue('color')).toBe('');
        action.update({ '--tx-deck-a': '3' });
        expect(node.style.getPropertyValue('--tx-deck-a')).toBe('3');
        expect(node.style.getPropertyValue('--tx-deck-b')).toBe('');
        action.destroy();
        expect(node.style.getPropertyValue('--tx-deck-a')).toBe('');
      },
      reset
    );
    await scenario(
      'resolves theme references, seeds, modes and hex palettes',
      () => {
        expect(
          deckThemeReferences({
            style: { theme: 'ocean' },
            slides: [
              free('a', [], { theme: { kind: 'catalog', id: 'ocean', mode: 'dark' } }),
              free('b', [], { theme: { kind: 'seed', seed: 7 } }),
            ],
          } as never).map((ref) => ref.kind)
        ).toEqual(['catalog', 'seed']);
        expect(seedColor(0xff2b6ce0)).toBe('#2b6ce0');
        expect(seedColor(Number.NaN)).toBe('#000000');
        expect(resolveStageMode({ kind: 'catalog', id: 'x', mode: 'dark' }, 'light')).toBe('dark');
        expect(resolveStageMode(undefined, 'high-contrast')).toBe('high-contrast');
        const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
        expect(deckBackgroundPalette(theme, 'dark').background).toBe(theme.dark.background.default);
        expect(deckBackgroundPalette(theme, 'high-contrast')).toEqual(DECK_FALLBACK_PALETTES.light);
        expect(deckBackgroundPalette(null, 'dark')).toEqual(DECK_FALLBACK_PALETTES.dark);
        const odd = {
          ...theme,
          light: { ...theme.light, primary: { default: 'oklch(0.5 0.1 200)' } },
        };
        expect(deckBackgroundPalette(odd as never, 'light').primary).toBe(
          DECK_FALLBACK_PALETTES.light.primary
        );
      },
      reset
    );
    await scenario(
      'adapts the presenter protocol and the v1 sync link to one shape',
      () => {
        const transport = createMemoryPresenterTransport('room');
        const link = deckSyncLink(transport);
        const signals: unknown[] = [];
        link?.subscribe((signal) => signals.push(signal));
        link?.hello('plan', 1);
        link?.post('plan', 2);
        link?.post('Bad Id', 2);
        transport.post({ type: 'request', slideId: 'plan', step: 0 });
        expect(signals).toEqual([
          { kind: 'hello' },
          { kind: 'position', slideId: 'plan', step: 2 },
          { kind: 'hello' },
        ]);
        expect(deckSyncLink(null)).toBeNull();
      },
      reset
    );
  });
});

// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeckGrammar, toDeckGrammar } from '../src/grammar/index.ts';
import { DECK_TRANSITIONS, parseDeck, resolveSlideTransition } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { createPresenterTimer, formatElapsed } from '../src/stage/presenter.ts';
import {
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
  resolveDeckThemeMode,
} from '../src/stage/theme.ts';
import { scenario } from './scenario.ts';

describe('DeckStage runtime', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.restoreAllMocks();
  };
  afterEach(reset);

  function makeDeck() {
    const parsed = parseDeck({
      meta: {
        title: 'Quarterly update',
        aspect: '16:9',
        themeRef: { kind: 'catalog', id: 'graphite', mode: 'system' },
      },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          blocks: [],
        },
        {
          id: 'priorities',
          title: 'Priorities',
          themeRef: { kind: 'catalog', id: 'ocean', mode: 'light' },
          blocks: [],
        },
      ],
    });
    if (!parsed.success) throw new Error('Test deck is invalid.');
    return parsed.deck;
  }

  function mockMediaPreferences({ dark = false, reduced = false } = {}) {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const matches = query.includes('prefers-color-scheme') ? dark : reduced;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      } as unknown as MediaQueryList;
    });
  }

  it('mounts one slide at a time and applies slide, deck and embedded themes', async () => {
    await scenario(
      'mounts one slide at a time and applies the active slide theme over the deck theme',
      async () => {
        mockMediaPreferences({ dark: true });
        render(DeckStage, { props: { deck: makeDeck() } });

        const stage = screen.getByRole('region', { name: 'Presentation: Quarterly update' });
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('dark'));
        expect(stage.getAttribute('data-tx-theme')).toBe('graphite');
        expect(screen.getByRole('article', { name: 'Opening' })).toBeTruthy();
        expect(screen.queryByRole('article', { name: 'Priorities' })).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        expect(screen.queryByRole('article', { name: 'Opening' })).toBeNull();
        expect(screen.getByRole('article', { name: 'Priorities' })).toBeTruthy();
        expect(stage.getAttribute('data-tx-theme')).toBe('ocean');
        expect(stage.getAttribute('data-tx-mode')).toBe('light');
        expect(
          screen.getByRole('article', { name: 'Priorities' }).getAttribute('data-transition')
        ).toBe('fade');
      },
      reset
    );
    await scenario(
      'applies embedded theme tokens to the stage element',
      async () => {
        const theme = generateThemeFromSeed({ seed: '#2b6ce0' });
        const parsed = parseDeck({
          meta: {
            title: 'Embedded theme',
            themeRef: { kind: 'embedded', theme, mode: 'dark' },
          },
          slides: [{ id: 'themed', title: 'Themed', blocks: [] }],
        });
        if (!parsed.success) throw new Error('Embedded theme deck is invalid.');

        render(DeckStage, { props: { deck: parsed.deck } });
        const stage = screen.getByRole('region', { name: 'Presentation: Embedded theme' });
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-background')).toBe(
            theme.dark.background.default
          )
        );
        expect(stage.getAttribute('data-tx-theme')).toBe(theme.id);
        expect(stage.getAttribute('data-tx-mode')).toBe('dark');
      },
      reset
    );
  });

  it('keys, deep links, overview focus and native toolbar activation', async () => {
    await scenario(
      'supports the presentation key map, host deep-link intent and slide focus',
      async () => {
        mockMediaPreferences();
        const onSlideChange = vi.fn();
        render(DeckStage, {
          props: { deck: makeDeck(), initialSlideId: 'priorities', onSlideChange },
        });
        expect(screen.getByRole('article', { name: 'Priorities' })).toBeTruthy();

        const press = async (key: string, expectedSlide: 'Opening' | 'Priorities') => {
          const article = screen.getByRole('article', { name: /Opening|Priorities/ });
          article.focus();
          await fireEvent.keyDown(article, { key });
          await waitFor(() =>
            expect(screen.getByRole('article', { name: expectedSlide })).toBeTruthy()
          );
          expect(document.activeElement).toBe(screen.getByRole('article', { name: expectedSlide }));
        };

        await press('Home', 'Opening');
        expect(onSlideChange).toHaveBeenLastCalledWith({ index: 0, slideId: 'opening' });
        await press(' ', 'Priorities');
        await press('ArrowLeft', 'Opening');
        await press('PageDown', 'Priorities');
        await press('Backspace', 'Opening');
        await press('Enter', 'Priorities');
        await press('PageUp', 'Opening');
        await press('End', 'Priorities');
        expect(onSlideChange).toHaveBeenCalledTimes(8);
      },
      reset
    );
    await scenario(
      'moves focus into the overview and restores it after choosing a slide or escaping',
      async () => {
        mockMediaPreferences();
        render(DeckStage, { props: { deck: makeDeck() } });
        const opening = screen.getByRole('article', { name: 'Opening' });
        opening.focus();
        await fireEvent.keyDown(opening, { key: 'o' });

        const currentItem = screen.getByRole('button', { name: /Opening/ });
        await waitFor(() => expect(document.activeElement).toBe(currentItem));
        await fireEvent.click(screen.getByRole('button', { name: /Priorities/ }));
        const overviewButton = screen.getByRole('button', { name: 'Overview' });
        expect(document.activeElement).toBe(overviewButton);
        expect(screen.getByRole('article', { name: 'Priorities' })).toBeTruthy();

        await fireEvent.click(overviewButton);
        await fireEvent.keyDown(overviewButton, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Overview' })).toBe(overviewButton);
        expect(document.activeElement).toBe(overviewButton);
        expect(screen.queryByRole('navigation', { name: 'Slides' })).toBeNull();
      },
      reset
    );
    await scenario(
      'does not treat native toolbar key activation as a deck navigation shortcut',
      async () => {
        mockMediaPreferences();
        render(DeckStage, { props: { deck: makeDeck() } });
        const next = screen.getByRole('button', { name: 'Next slide' });
        next.focus();
        await fireEvent.keyDown(next, { key: ' ' });
        expect(screen.getByRole('article', { name: 'Opening' })).toBeTruthy();
      },
      reset
    );
  });
});

describe('deck themes', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.restoreAllMocks();
  };
  afterEach(reset);

  const ocean = generateThemeFromSeed({ seed: '#0e7490', id: 'ocean-test', name: 'Ocean test' });
  const ember = generateThemeFromSeed({ seed: '#c2410c', id: 'ember-test', name: 'Ember test' });

  function makeDeck(deckMode?: string) {
    const parsed = parseDeck({
      meta: {
        title: 'Themed deck',
        themeRef: { kind: 'catalog', id: 'ocean-test', ...(deckMode ? { mode: deckMode } : {}) },
      },
      slides: [
        { id: 'opening', title: 'Opening', blocks: [] },
        {
          id: 'section',
          title: 'Section',
          themeRef: { kind: 'catalog', id: 'ember-test', mode: 'dark' },
          blocks: [],
        },
        { id: 'missing', title: 'Missing', themeRef: 'not-a-theme', blocks: [] },
        { id: 'closing', title: 'Closing', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
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

  function mockPreferences({ dark = false, contrastMore = false } = {}) {
    const matchMedia = (query: string) =>
      ({
        matches: query.includes('prefers-contrast: more')
          ? contrastMore
          : query.includes('prefers-color-scheme: dark')
            ? dark
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

  it('deck theme helpers: ids, modes, high-contrast variables and the library loader', async () => {
    await scenario(
      'lists unique catalog ids, deck default first',
      async () => {
        expect(deckCatalogThemeIds(makeDeck())).toEqual([
          'ocean-test',
          'ember-test',
          'not-a-theme',
        ]);
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
        expect(contrast['--tx-foreground']).toBe(palette.foreground.default);
        expect(contrast['--tx-radius']).toBe(light['--tx-radius']);
        expect(contrast['color-scheme']).toBe('light dark');
        expect(deckThemeVariables(ocean, 'dark')['--tx-background']).toBe(
          ocean.dark.background.default
        );
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

  it('DeckStage applies loader, slide-override, high-contrast and host-CSS themes', async () => {
    await scenario(
      'applies catalog themes from the loader and lets slide themes override the deck',
      async () => {
        mockPreferences();
        const loadTheme = fakeLoader();
        render(DeckStage, { props: { deck: makeDeck('light'), loadTheme } });
        const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        const next = screen.getByRole('button', { name: 'Next slide' });

        await waitFor(() => expect(stage.getAttribute('data-theme-status')).toBe('applied'));
        expect(stage.style.getPropertyValue('--tx-background')).toBe(
          ocean.light.background.default
        );
        expect(stage.getAttribute('data-tx-theme')).toBe('ocean-test');
        expect(stage.getAttribute('data-tx-surface')).toBe(ocean.style.surface);

        await fireEvent.click(next);
        expect(stage.getAttribute('data-tx-theme')).toBe('ember-test');
        expect(stage.getAttribute('data-tx-mode')).toBe('dark');
        expect(stage.style.getPropertyValue('--tx-background')).toBe(ember.dark.background.default);

        await fireEvent.click(next);
        expect(stage.getAttribute('data-theme-status')).toBe('unavailable');
        expect(stage.style.getPropertyValue('--tx-background')).toBe('');

        await fireEvent.click(next);
        expect(stage.style.getPropertyValue('--tx-background')).toBe(
          ocean.light.background.default
        );
        expect(loadTheme).toHaveBeenCalledTimes(3);
        expect(loadTheme.mock.calls.map(([id]) => id)).toEqual([
          'ocean-test',
          'ember-test',
          'not-a-theme',
        ]);
      },
      reset
    );
    await scenario(
      'applies the high-contrast system palette for explicit and preferred high contrast',
      async () => {
        const palette = createHighContrastPalette();
        mockPreferences();
        const explicit = render(DeckStage, {
          props: { deck: makeDeck('high-contrast'), loadTheme: fakeLoader() },
        });
        let stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        expect(stage.getAttribute('data-tx-mode')).toBe('high-contrast');
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-background')).toBe(palette.background.default)
        );
        explicit.unmount();

        mockPreferences({ dark: true, contrastMore: true });
        render(DeckStage, { props: { deck: makeDeck(), loadTheme: fakeLoader() } });
        stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('high-contrast'));
        await waitFor(() =>
          expect(stage.style.getPropertyValue('--tx-foreground')).toBe(palette.foreground.default)
        );
      },
      reset
    );
    await scenario(
      'leaves catalog themes to host CSS when loading is disabled',
      async () => {
        mockPreferences();
        render(DeckStage, { props: { deck: makeDeck('light'), loadTheme: null } });
        const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
        await Promise.resolve();
        expect(stage.getAttribute('data-theme-status')).toBe('host');
        expect(stage.getAttribute('data-tx-theme')).toBe('ocean-test');
        expect(stage.style.getPropertyValue('--tx-background')).toBe('');
      },
      reset
    );
  });
});

describe('slide transitions', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    delete document.documentElement.dataset.txMotion;
    vi.restoreAllMocks();
  };
  afterEach(reset);

  function makeDeck(settings?: Record<string, unknown>) {
    const parsed = parseDeck({
      meta: { title: 'Motion deck' },
      slides: [
        { id: 'opening', title: 'Opening', blocks: [] },
        { id: 'rise', title: 'Rise', transition: 'fade-up', blocks: [] },
        { id: 'cut', title: 'Cut', transition: 'none', blocks: [] },
        { id: 'inherit', title: 'Inherit', blocks: [] },
      ],
      ...(settings ? { settings } : {}),
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  function mockReducedMotion(reduced: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('prefers-reduced-motion') ? reduced : false,
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

  it('closed transition tokens: validation, resolution, reduced motion and grammar round trip', () => {
    // publishes a closed token list and validates slide and deck tokens
    {
      expect(DECK_TRANSITIONS).toEqual(['none', 'fade', 'fade-up']);
      const deck = makeDeck({ defaultTransition: 'none' });
      expect(deck.settings.defaultTransition).toBe('none');
      expect(deck.slides[1]?.transition).toBe('fade-up');
      expect(makeDeck().settings.defaultTransition).toBe('fade');

      for (const hostile of ['zoom', 'url(javascript:alert(1))', 3, null]) {
        const slide = parseDeck({
          meta: { title: 'Bad' },
          slides: [{ id: 'one', transition: hostile, blocks: [] }],
        });
        expect(slide.success).toBe(false);
        expect(slide.issues[0]?.path).toBe('slides[0].transition');
        const deck = parseDeck({
          meta: { title: 'Bad' },
          slides: [{ id: 'one', blocks: [] }],
          settings: { defaultTransition: hostile },
        });
        expect(deck.success).toBe(false);
        expect(deck.issues[0]?.path).toBe('settings.defaultTransition');
      }
    }
    // resolves slide over deck default, and always cuts under reduced motion
    {
      const deck = makeDeck({ defaultTransition: 'fade' });
      const [opening, rise, cut] = deck.slides;
      if (!opening || !rise || !cut) throw new Error('missing slides');
      expect(resolveSlideTransition(deck, opening)).toBe('fade');
      expect(resolveSlideTransition(deck, rise)).toBe('fade-up');
      expect(resolveSlideTransition(deck, cut)).toBe('none');
      for (const slide of deck.slides) {
        expect(resolveSlideTransition(deck, slide, { reducedMotion: true })).toBe('none');
      }
    }
    // round-trips transition tokens through the layout-deck grammar
    {
      const deck = makeDeck({ defaultTransition: 'fade-up' });
      const grammar = toDeckGrammar(deck);
      expect(grammar.props.settings.defaultTransition).toBe('fade-up');
      expect(grammar.props.slides[1]?.transition).toBe('fade-up');
      const decoded = parseDeckGrammar(JSON.parse(JSON.stringify(grammar)));
      expect(decoded.success).toBe(true);
      expect(decoded.deck).toEqual(deck);
    }
  });

  it('DeckStage applies resolved transitions and cuts them under OS or host reduced motion', async () => {
    await scenario(
      'applies the resolved token to the entering slide',
      async () => {
        mockReducedMotion(false);
        render(DeckStage, { props: { deck: makeDeck({ defaultTransition: 'fade' }) } });
        const stage = screen.getByRole('region', { name: 'Presentation: Motion deck' });
        const next = screen.getByRole('button', { name: 'Next slide' });
        const slideTransition = (name: string) =>
          screen.getByRole('article', { name }).getAttribute('data-transition');

        await fireEvent.click(next);
        expect(slideTransition('Rise')).toBe('fade-up');
        expect(stage.getAttribute('data-transition')).toBe('fade-up');
        await fireEvent.click(next);
        expect(slideTransition('Cut')).toBe('none');
        await fireEvent.click(next);
        expect(slideTransition('Inherit')).toBe('fade');
      },
      reset
    );
    await scenario(
      'cuts every slide when the OS prefers reduced motion',
      async () => {
        mockReducedMotion(true);
        render(DeckStage, { props: { deck: makeDeck() } });
        const next = screen.getByRole('button', { name: 'Next slide' });
        await fireEvent.click(next);
        expect(screen.getByRole('article', { name: 'Rise' }).getAttribute('data-transition')).toBe(
          'none'
        );
        await fireEvent.click(next);
        await fireEvent.click(next);
        expect(
          screen.getByRole('article', { name: 'Inherit' }).getAttribute('data-transition')
        ).toBe('none');
      },
      reset
    );
    await scenario(
      'honors a host data-tx-motion="reduce" on the root, including after mount',
      async () => {
        mockReducedMotion(false);
        render(DeckStage, { props: { deck: makeDeck() } });
        const stage = screen.getByRole('region', { name: 'Presentation: Motion deck' });
        const next = screen.getByRole('button', { name: 'Next slide' });
        await fireEvent.click(next);
        expect(screen.getByRole('article', { name: 'Rise' }).getAttribute('data-transition')).toBe(
          'fade-up'
        );

        document.documentElement.dataset.txMotion = 'reduce';
        await waitFor(() => expect(stage.getAttribute('data-motion')).toBe('reduce'));
        await fireEvent.click(next);
        await fireEvent.click(next);
        expect(
          screen.getByRole('article', { name: 'Inherit' }).getAttribute('data-transition')
        ).toBe('none');
      },
      reset
    );
  });
});

describe('presenter view', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  };
  afterEach(reset);

  function makeDeck() {
    const parsed = parseDeck({
      meta: { title: 'Sprint review' },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          notes: 'Welcome everyone.\nIntroduce the team.',
          blocks: [],
        },
        { id: 'demo', title: 'Demo', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error('Test deck is invalid.');
    return parsed.deck;
  }

  function mockMediaPreferences() {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
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

  it('presenter timer accumulates across pauses, resets and formats elapsed time', () => {
    // accumulates elapsed time across pauses and resets to zero
    {
      let clock = 1_000;
      const timer = createPresenterTimer(() => clock);
      expect(timer.running).toBe(false);
      expect(timer.elapsed()).toBe(0);
      timer.start();
      clock += 5_000;
      expect(timer.elapsed()).toBe(5_000);
      timer.pause();
      clock += 60_000;
      expect(timer.elapsed()).toBe(5_000);
      timer.start();
      clock += 2_000;
      expect(timer.elapsed()).toBe(7_000);
      timer.reset();
      expect(timer.elapsed()).toBe(0);
      expect(timer.running).toBe(true);
      clock += 1_000;
      expect(timer.elapsed()).toBe(1_000);
    }
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_400)).toBe('1:05');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });

  it('presenter view: P opens notes as plain text, S focuses them, Escape restores focus, the timer pauses and resets', async () => {
    await scenario(
      'opens with P and shows notes as plain text and the next slide, with no timer by default',
      async () => {
        mockMediaPreferences();
        const onPresenterChange = vi.fn();
        const deck = makeDeck();
        const before = JSON.stringify(deck);
        render(DeckStage, { props: { deck, onPresenterChange } });
        expect(screen.queryByRole('complementary', { name: 'Speaker notes' })).toBeNull();

        const opening = screen.getByRole('article', { name: 'Opening' });
        opening.focus();
        await fireEvent.keyDown(opening, { key: 'p' });

        const notes = await screen.findByRole('complementary', { name: 'Speaker notes' });
        expect(onPresenterChange).toHaveBeenLastCalledWith(true);
        expect(notes.textContent).toContain('Welcome everyone.\nIntroduce the team.');
        expect(notes.querySelector('script, [onclick]')).toBeNull();
        expect(screen.getByRole('region', { name: 'Up next' }).textContent).toContain('Demo');
        expect(screen.queryByRole('timer')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Pause timer' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Presenter' }).getAttribute('aria-pressed')).toBe(
          'true'
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        expect(screen.getByText('No notes for this slide.')).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Up next' }).textContent).toContain(
          'End of presentation'
        );
        expect(JSON.stringify(deck)).toBe(before);
      },
      reset
    );
    await scenario(
      'focuses notes with S and closes with Escape, restoring focus to the toggle',
      async () => {
        mockMediaPreferences();
        render(DeckStage, { props: { deck: makeDeck(), presenter: true } });
        const opening = screen.getByRole('article', { name: 'Opening' });
        opening.focus();
        await fireEvent.keyDown(opening, { key: 's' });
        const notes = screen.getByRole('complementary', { name: 'Speaker notes' });
        expect(document.activeElement).toBe(notes);

        await fireEvent.keyDown(notes, { key: 'Escape' });
        await waitFor(() =>
          expect(screen.queryByRole('complementary', { name: 'Speaker notes' })).toBeNull()
        );
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Presenter' }));
        expect(screen.getByRole('article', { name: 'Opening' })).toBeTruthy();
      },
      reset
    );
    await scenario(
      'counts elapsed time locally and supports pause and reset',
      async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        mockMediaPreferences();
        render(DeckStage, { props: { deck: makeDeck(), presenter: true, presenterTimer: true } });
        const value = () => screen.getByRole('timer', { name: 'Elapsed time' }).textContent?.trim();

        await vi.advanceTimersByTimeAsync(65_000);
        expect(value()).toBe('1:05');
        await fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }));
        await vi.advanceTimersByTimeAsync(30_000);
        expect(value()).toBe('1:05');
        await fireEvent.click(screen.getByRole('button', { name: 'Reset timer' }));
        expect(value()).toBe('0:00');
        await fireEvent.click(screen.getByRole('button', { name: 'Resume timer' }));
        await vi.advanceTimersByTimeAsync(3_000);
        expect(value()).toBe('0:03');
      },
      reset
    );
  });
});

describe('stage accessibility', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    delete document.documentElement.dataset.txMode;
    vi.restoreAllMocks();
  };
  afterEach(reset);

  const light = (query: string) => ({ matches: query.includes('light') });

  function mockMedia() {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
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

  function deck() {
    const parsed = parseDeck({
      meta: { title: 'Planning' },
      slides: [
        { id: 'one', title: 'One', blocks: [] },
        { id: 'two', title: 'Two', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error('deck');
    return parsed.deck;
  }

  it('deck color mode follows the host page', async () => {
    await scenario(
      'resolves system to the host data-tx-mode before the OS preference',
      async () => {
        expect(resolveDeckThemeMode(undefined, light, 'dark')).toBe('dark');
        expect(
          resolveDeckThemeMode(
            { kind: 'catalog', id: 'ocean', mode: 'system' },
            light,
            'high-contrast'
          )
        ).toBe('high-contrast');
        // An explicit deck mode wins over the host; unknown host values are ignored.
        expect(
          resolveDeckThemeMode({ kind: 'catalog', id: 'ocean', mode: 'light' }, light, 'dark')
        ).toBe('light');
        expect(resolveDeckThemeMode(undefined, light, 'sepia')).toBe('light');
        expect(resolveDeckThemeMode(undefined, light, null)).toBe('light');
      },
      reset
    );
    await scenario(
      'paints a system-mode deck dark inside a dark host page while the OS prefers light',
      async () => {
        mockMedia();
        document.documentElement.dataset.txMode = 'dark';
        render(DeckStage, { props: { deck: deck(), loadTheme: null } });
        const stage = screen.getByRole('region', { name: 'Presentation: Planning' });
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('dark'));

        document.documentElement.dataset.txMode = 'light';
        await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('light'));
      },
      reset
    );
  });

  it('controls are a named group, layout changes keep focus without replaying the entrance, revisits do not announce loading', async () => {
    await scenario(
      'exposes the toolbar buttons inside a "Presentation controls" group',
      async () => {
        mockMedia();
        render(DeckStage, { props: { deck: deck(), loadTheme: null } });
        const group = screen.getByRole('group', { name: 'Presentation controls' });
        expect(
          within(group)
            .getAllByRole('button')
            .map((button) => button.textContent?.trim())
        ).toEqual(['Previous', 'Next', 'Overview', 'Presenter', 'Fullscreen']);
        expect(within(group).getByRole('button', { name: 'Previous slide' })).toBeTruthy();
        expect(within(group).getByRole('button', { name: 'Next slide' })).toBeTruthy();
      },
      reset
    );
    await scenario(
      'keeps focus on the slide when p toggles the presenter view from inside it',
      async () => {
        mockMedia();
        render(DeckStage, { props: { deck: deck(), loadTheme: null } });
        const one = screen.getByRole('article', { name: 'One' });
        one.focus();
        await fireEvent.keyDown(one, { key: 'p' });
        await screen.findByRole('complementary', { name: 'Speaker notes' });
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole('article', { name: 'One' }))
        );
        await fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
        await waitFor(() => expect(screen.getByRole('article', { name: 'Two' })).toBeTruthy());

        await fireEvent.keyDown(screen.getByRole('article', { name: 'Two' }), { key: 'p' });
        await waitFor(() =>
          expect(screen.queryByRole('complementary', { name: 'Speaker notes' })).toBeNull()
        );
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole('article', { name: 'Two' }))
        );
      },
      reset
    );
    await scenario(
      'animates navigation but not presenter or overview re-mounts of the same slide',
      async () => {
        mockMedia();
        render(DeckStage, { props: { deck: deck(), loadTheme: null } });
        await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        expect(screen.getByRole('article', { name: 'Two' }).getAttribute('data-transition')).toBe(
          'fade'
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Presenter' }));
        expect(screen.getByRole('article', { name: 'Two' }).getAttribute('data-transition')).toBe(
          'none'
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Close overview' }));
        expect(screen.getByRole('article', { name: 'Two' }).getAttribute('data-transition')).toBe(
          'none'
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
        expect(screen.getByRole('article', { name: 'One' }).getAttribute('data-transition')).toBe(
          'fade'
        );
      },
      reset
    );
    await scenario(
      'renders already-loaded block families on the first render, with no loading status',
      async () => {
        mockMedia();
        const parsed = parseDeck({
          meta: { title: 'Loaded' },
          slides: [
            { id: 'one', title: 'One', blocks: [{ type: 'text', markdown: 'First body' }] },
            { id: 'two', title: 'Two', blocks: [{ type: 'text', markdown: 'Second body' }] },
          ],
        });
        if (!parsed.success) throw new Error('deck');
        render(DeckStage, { props: { deck: parsed.deck, loadTheme: null } });
        await screen.findByText('First body');

        await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        // Synchronously after navigation: the family is cached, so no status flashes.
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.getByText('Second body')).toBeTruthy();
      },
      reset
    );
  });
});

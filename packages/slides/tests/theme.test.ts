// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeck } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import {
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
  resolveDeckThemeMode,
} from '../src/stage/theme.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('deck theme helpers', () => {
  it('lists unique catalog ids, deck default first', () => {
    expect(deckCatalogThemeIds(makeDeck())).toEqual(['ocean-test', 'ember-test', 'not-a-theme']);
  });

  it('resolves modes through the token engine, including prefers-contrast', () => {
    const contrast = mockPreferences({ dark: true, contrastMore: true });
    const scheme = mockPreferences({ dark: true });
    expect(resolveDeckThemeMode(undefined, scheme)).toBe('dark');
    expect(resolveDeckThemeMode({ kind: 'catalog', id: 'a', mode: 'system' }, contrast)).toBe(
      'high-contrast'
    );
    expect(resolveDeckThemeMode({ kind: 'catalog', id: 'a', mode: 'light' }, contrast)).toBe(
      'light'
    );
  });

  it('swaps semantic colors for system colors in high contrast and keeps style tokens', () => {
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
  });

  it('loads catalog ids from the token theme library by default', async () => {
    const theme = await loadDeckLibraryTheme('graphite');
    expect(theme.id).toBe('graphite');
    await expect(loadDeckLibraryTheme('not-a-theme')).rejects.toThrow();
  });
});

describe('DeckStage deck themes', () => {
  it('applies catalog themes from the loader and lets slide themes override the deck', async () => {
    mockPreferences();
    const loadTheme = fakeLoader();
    render(DeckStage, { props: { deck: makeDeck('light'), loadTheme } });
    const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
    const next = screen.getByRole('button', { name: 'Next slide' });

    await waitFor(() => expect(stage.getAttribute('data-theme-status')).toBe('applied'));
    expect(stage.style.getPropertyValue('--tx-background')).toBe(ocean.light.background.default);
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
    expect(stage.style.getPropertyValue('--tx-background')).toBe(ocean.light.background.default);
    expect(loadTheme).toHaveBeenCalledTimes(3);
    expect(loadTheme.mock.calls.map(([id]) => id)).toEqual([
      'ocean-test',
      'ember-test',
      'not-a-theme',
    ]);
  });

  it('applies the high-contrast system palette for explicit and preferred high contrast', async () => {
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
  });

  it('leaves catalog themes to host CSS when loading is disabled', async () => {
    mockPreferences();
    render(DeckStage, { props: { deck: makeDeck('light'), loadTheme: null } });
    const stage = screen.getByRole('region', { name: 'Presentation: Themed deck' });
    await Promise.resolve();
    expect(stage.getAttribute('data-theme-status')).toBe('host');
    expect(stage.getAttribute('data-tx-theme')).toBe('ocean-test');
    expect(stage.style.getPropertyValue('--tx-background')).toBe('');
  });
});

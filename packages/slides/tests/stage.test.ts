// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeck } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('DeckStage runtime', () => {
  it('mounts one slide at a time and applies the active slide theme over the deck theme', async () => {
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
  });

  it('keeps slide transitions cut under reduced motion', async () => {
    mockMediaPreferences({ reduced: true });
    render(DeckStage, { props: { deck: makeDeck() } });

    const stage = screen.getByRole('region', { name: 'Presentation: Quarterly update' });
    await waitFor(() => expect(stage.getAttribute('data-motion')).toBe('reduce'));
    await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));

    expect(stage.getAttribute('data-transition')).toBe('none');
    expect(
      screen.getByRole('article', { name: 'Priorities' }).getAttribute('data-transition')
    ).toBe('none');
  });

  it('applies embedded theme tokens to the stage element', async () => {
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
      expect(stage.style.getPropertyValue('--tx-background')).toBe(theme.dark.background.default)
    );
    expect(stage.getAttribute('data-tx-theme')).toBe(theme.id);
    expect(stage.getAttribute('data-tx-mode')).toBe('dark');
  });

  it('supports the presentation key map, host deep-link intent and slide focus', async () => {
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
  });

  it('moves focus into the overview and restores it after choosing a slide or escaping', async () => {
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
  });

  it('does not treat native toolbar key activation as a deck navigation shortcut', async () => {
    mockMediaPreferences();
    render(DeckStage, { props: { deck: makeDeck() } });
    const next = screen.getByRole('button', { name: 'Next slide' });
    next.focus();
    await fireEvent.keyDown(next, { key: ' ' });
    expect(screen.getByRole('article', { name: 'Opening' })).toBeTruthy();
  });
});

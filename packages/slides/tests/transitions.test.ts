// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeckGrammar, toDeckGrammar } from '../src/grammar/index.ts';
import { DECK_TRANSITIONS, parseDeck, resolveSlideTransition } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';

afterEach(() => {
  delete document.documentElement.dataset.txMotion;
  vi.restoreAllMocks();
});

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

describe('slide transition model', () => {
  it('publishes a closed token list and validates slide and deck tokens', () => {
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
  });

  it('resolves slide over deck default, and always cuts under reduced motion', () => {
    const deck = makeDeck({ defaultTransition: 'fade' });
    const [opening, rise, cut] = deck.slides;
    if (!opening || !rise || !cut) throw new Error('missing slides');
    expect(resolveSlideTransition(deck, opening)).toBe('fade');
    expect(resolveSlideTransition(deck, rise)).toBe('fade-up');
    expect(resolveSlideTransition(deck, cut)).toBe('none');
    for (const slide of deck.slides) {
      expect(resolveSlideTransition(deck, slide, { reducedMotion: true })).toBe('none');
    }
  });

  it('round-trips transition tokens through the layout-deck grammar', () => {
    const deck = makeDeck({ defaultTransition: 'fade-up' });
    const grammar = toDeckGrammar(deck);
    expect(grammar.props.settings.defaultTransition).toBe('fade-up');
    expect(grammar.props.slides[1]?.transition).toBe('fade-up');
    const decoded = parseDeckGrammar(JSON.parse(JSON.stringify(grammar)));
    expect(decoded.success).toBe(true);
    expect(decoded.deck).toEqual(deck);
  });
});

describe('DeckStage transitions', () => {
  it('applies the resolved token to the entering slide', async () => {
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
  });

  it('cuts every slide when the OS prefers reduced motion', async () => {
    mockReducedMotion(true);
    render(DeckStage, { props: { deck: makeDeck() } });
    const next = screen.getByRole('button', { name: 'Next slide' });
    await fireEvent.click(next);
    expect(screen.getByRole('article', { name: 'Rise' }).getAttribute('data-transition')).toBe(
      'none'
    );
    await fireEvent.click(next);
    await fireEvent.click(next);
    expect(screen.getByRole('article', { name: 'Inherit' }).getAttribute('data-transition')).toBe(
      'none'
    );
  });

  it('honors a host data-tx-motion="reduce" on the root, including after mount', async () => {
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
    expect(screen.getByRole('article', { name: 'Inherit' }).getAttribute('data-transition')).toBe(
      'none'
    );
  });
});

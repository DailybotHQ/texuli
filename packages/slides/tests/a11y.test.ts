// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeck } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { resolveDeckThemeMode } from '../src/stage/theme.ts';

afterEach(() => {
  delete document.documentElement.dataset.txMode;
  vi.restoreAllMocks();
});

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

describe('deck color mode follows the host page', () => {
  it('resolves system to the host data-tx-mode before the OS preference', () => {
    expect(resolveDeckThemeMode(undefined, light, 'dark')).toBe('dark');
    expect(
      resolveDeckThemeMode({ kind: 'catalog', id: 'ocean', mode: 'system' }, light, 'high-contrast')
    ).toBe('high-contrast');
    // An explicit deck mode wins over the host; unknown host values are ignored.
    expect(
      resolveDeckThemeMode({ kind: 'catalog', id: 'ocean', mode: 'light' }, light, 'dark')
    ).toBe('light');
    expect(resolveDeckThemeMode(undefined, light, 'sepia')).toBe('light');
    expect(resolveDeckThemeMode(undefined, light, null)).toBe('light');
  });

  it('paints a system-mode deck dark inside a dark host page while the OS prefers light', async () => {
    mockMedia();
    document.documentElement.dataset.txMode = 'dark';
    render(DeckStage, { props: { deck: deck(), loadTheme: null } });
    const stage = screen.getByRole('region', { name: 'Presentation: Planning' });
    await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('dark'));

    document.documentElement.dataset.txMode = 'light';
    await waitFor(() => expect(stage.getAttribute('data-tx-mode')).toBe('light'));
  });
});

describe('deck controls are a named group', () => {
  it('exposes the toolbar buttons inside a "Presentation controls" group', () => {
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
  });
});

describe('layout changes keep focus and do not replay the entrance', () => {
  it('keeps focus on the slide when p toggles the presenter view from inside it', async () => {
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
  });

  it('animates navigation but not presenter or overview re-mounts of the same slide', async () => {
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
  });
});

describe('revisited slides do not announce loading', () => {
  it('renders already-loaded block families on the first render, with no loading status', async () => {
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
  });
});

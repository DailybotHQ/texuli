// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDeck } from '../src/model/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { createPresenterTimer, formatElapsed } from '../src/stage/presenter.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

describe('presenter timer', () => {
  it('accumulates elapsed time across pauses and resets to zero', () => {
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
  });

  it('formats elapsed time as minutes and seconds, adding hours when needed', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_400)).toBe('1:05');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });
});

describe('DeckStage presenter view', () => {
  it('opens with P and shows notes as plain text and the next slide, with no timer by default', async () => {
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
  });

  it('focuses notes with S and closes with Escape, restoring focus to the toggle', async () => {
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
  });

  it('counts elapsed time locally and supports pause and reset', async () => {
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
  });
});

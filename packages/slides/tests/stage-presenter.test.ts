// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import {
  createMemoryPresenterTransport,
  isPresenterMessage,
  type PresenterMessage,
  presenterChannelName,
} from '@texuli/deck/engine';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeckStageContext, DeckStageSlideEntry } from '../src/stage/context.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { createDeckTranslator } from '../src/stage/messages.ts';
import { prepareDeck } from '../src/stage/prepare.ts';
import DeckPresenterWindow from '../src/stage/presenter/DeckPresenterWindow.svelte';
import {
  createDeckPresenterSession,
  createDeckPresenterTimers,
  type DeckPreviewPaint,
  deckPresenterTimers,
  formatWallClock,
  presenterSessionFor,
  presenterWindowName,
} from '../src/stage/presenter/index.ts';
import { mirrorStageRoot } from '../src/stage/presenter/popup.ts';
import { DECK_FALLBACK_PALETTES } from '../src/stage/style.ts';
import { clearDeckHash, scenario } from './scenario.ts';

// ---------------------------------------------------------------------------
// Fixtures

const text = (markdown: string, extra: Record<string, unknown> = {}) => ({
  type: 'text',
  markdown,
  ...extra,
});

function talkDeck() {
  return {
    formatVersion: 2,
    meta: { title: 'Board talk' },
    slides: [
      {
        id: 'intro',
        title: 'Intro',
        layout: 'free',
        notes: 'Say <b>hello</b>.\nThen pause.',
        blocks: [text('Welcome.')],
      },
      {
        id: 'goals',
        title: 'Goals',
        layout: 'free',
        notes: 'Reveal one goal at a time.',
        steps: ['Ship the export', 'Cut latency'],
        blocks: [
          text('Two goals.'),
          text('Ship the export', { step: 1 }),
          text('Cut latency', { step: 2 }),
        ],
      },
      { id: 'close', title: 'Close', layout: 'free', blocks: [text('Thank you.')] },
    ],
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

function mockLayout(width = 480) {
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

/** BroadcastChannel stand-in: same-name channels hear each other, never themselves, asynchronously. */
function channelHub() {
  const members = new Set<FakeChannel>();
  const sent: { name: string; data: unknown }[] = [];
  class FakeChannel {
    name: string;
    listeners = new Set<(event: { data: unknown }) => void>();
    constructor(name: string) {
      this.name = name;
      members.add(this);
    }
    postMessage(data: unknown) {
      sent.push({ name: this.name, data });
      const copy = structuredClone(data);
      for (const member of members) {
        if (member === this || member.name !== this.name) continue;
        queueMicrotask(() => {
          for (const listener of member.listeners) listener({ data: copy });
        });
      }
    }
    addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
      this.listeners.add(listener);
    }
    removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
      this.listeners.delete(listener);
    }
    close() {
      members.delete(this);
    }
  }
  return { FakeChannel, members, sent };
}

/** A same-origin popup stand-in over a fresh document (happy-dom loads no iframes). */
function fakePopup() {
  const doc = document.implementation.createHTMLDocument('');
  const events = new EventTarget();
  const popup = {
    document: doc,
    closed: false,
    opener: window as unknown,
    close: vi.fn(() => {
      popup.closed = true;
    }),
    focus: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  return popup;
}

const stageRoot = () => document.querySelector<HTMLElement>('.tx-deck-stage') as HTMLElement;
const activeSlide = () =>
  document.querySelector<HTMLElement>('[data-tx-deck-canvas] [data-tx-deck-active="true"]');
const split = () => document.querySelector<HTMLElement>('[data-tx-deck-presenter-split]');
const inSplit = () => within(split() as HTMLElement);

async function pressOnSlide(key: string) {
  const slide = activeSlide() as HTMLElement;
  slide.focus();
  await fireEvent.keyDown(slide, { key });
}

/** Click inside the window document (testing-library needs a `defaultView`, which it lacks). */
function clickInWindow(element: Element | null) {
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  flushSync();
}

const reset = () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearDeckHash();
};

afterEach(reset);

// ---------------------------------------------------------------------------

describe('presenter timers', () => {
  it('elapsed and per-slide stopwatches on an injected clock, one set per stage', () => {
    let now = 1_000;
    const timers = createDeckPresenterTimers(() => now);
    expect([timers.running, timers.elapsed(), timers.slide()]).toEqual([false, 0, 0]);
    timers.start();
    timers.markSlide('intro');
    now += 65_000;
    expect([timers.elapsed(), timers.slide()]).toEqual([65_000, 65_000]);
    // A new slide restarts the slide stopwatch; the same slide again does not.
    timers.markSlide('goals');
    now += 10_000;
    timers.markSlide('goals');
    expect([timers.elapsed(), timers.slide()]).toEqual([75_000, 10_000]);
    timers.toggle();
    now += 30_000;
    expect([timers.running, timers.elapsed(), timers.slide()]).toEqual([false, 75_000, 10_000]);
    timers.toggle();
    now += 5_000;
    expect(timers.elapsed()).toBe(80_000);
    timers.reset();
    expect([timers.running, timers.elapsed(), timers.slide()]).toEqual([true, 0, 0]);
    expect(timers.now()).toBe(now);

    const key = {};
    expect(deckPresenterTimers(key)).toBe(deckPresenterTimers(key));
    expect(deckPresenterTimers({})).not.toBe(deckPresenterTimers(key));

    const at = new Date(2026, 9, 27, 9, 5).getTime();
    expect(formatWallClock(at, 'en-US')).toMatch(/^9:05\sAM$/);
    expect(formatWallClock(at, 'de-DE')).toMatch(/^0?9:05$/);
    expect(formatWallClock(at, 'not a locale!')).toMatch(/9:05/);
  });
});

describe('presenter split view', () => {
  it('notes, step label, up next with a live preview, buttons, S focus and timers', async () => {
    await scenario(
      'opens with S and focuses the notes; notes are plain text; previous and next move the deck',
      async () => {
        mockMatchMedia();
        mockLayout();
        render(DeckStage, { props: { deck: talkDeck(), loadTheme: null } });
        await pressOnSlide('s');
        expect(stageRoot().dataset.presenter).toBe('true');
        const notes = screen.getByRole('complementary', { name: 'Speaker notes' });
        await waitFor(() => expect(document.activeElement).toBe(notes));
        expect(notes.tabIndex).toBe(0);
        expect(notes.querySelector('b')).toBeNull();
        expect(notes.textContent).toContain('Say <b>hello</b>.\nThen pause.');
        expect(screen.getByRole('group', { name: 'Presenter view' })).toBe(split());
        // Timers are opt-in on the split view (presenterTimer).
        expect(screen.queryAllByRole('timer')).toHaveLength(0);

        const upNext = screen.getByRole('region', { name: 'Up next' });
        expect(upNext.textContent).toContain('Goals');
        // Previews, buttons and timers are a lazy chunk; the notes and "Up next" are not.
        await inSplit().findByRole('button', { name: 'Next' });
        // The preview shows what the next press reveals: the next slide at step 0.
        const preview = () => split()?.querySelector<HTMLElement>('[data-tx-deck-preview]');
        expect(preview()?.dataset.txDeckPreview).toBe('goals');
        expect(preview()?.dataset.step).toBe('0');
        expect(preview()?.getAttribute('aria-label')).toBe('Preview: Goals');
        expect(preview()?.querySelector('[data-tx-deck-slide="goals"]')).not.toBeNull();

        const previous = inSplit().getByRole('button', { name: 'Previous' });
        const next = inSplit().getByRole('button', { name: 'Next' });
        expect(previous).toHaveProperty('disabled', true);
        await fireEvent.click(next);
        await fireEvent.click(next);
        expect(activeSlide()?.dataset.slideId).toBe('goals');
        expect(activeSlide()?.dataset.step).toBe('1');
        expect(notes.textContent).toContain('Step 1 of 2: Ship the export');
        expect(notes.textContent).toContain('Reveal one goal at a time.');
        expect(upNext.textContent?.replace(/\s+/g, ' ').trim()).toBe(
          'Up next Step 2 of 2 on this slide'
        );
        // The next step of this slide is previewed, not the next slide.
        expect(preview()?.dataset.txDeckPreview).toBe('goals');
        expect(preview()?.dataset.step).toBe('2');

        await fireEvent.click(next);
        await fireEvent.click(next);
        expect(activeSlide()?.dataset.slideId).toBe('close');
        expect(upNext.textContent).toContain('End of deck');
        expect(preview()).toBeNull();
        expect(next).toHaveProperty('disabled', true);
        await fireEvent.click(previous);
        expect(activeSlide()?.dataset.slideId).toBe('goals');
        expect(activeSlide()?.dataset.step).toBe('2');

        // S again closes the split view.
        await pressOnSlide('s');
        expect(split()).toBeNull();
        expect(stageRoot().dataset.presenter).toBeUndefined();
      },
      reset
    );

    await scenario(
      'elapsed, slide and wall-clock timers: pause, start, reset, kept across reopening',
      async () => {
        mockMatchMedia();
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(new Date(2026, 9, 27, 9, 41, 0));
        render(DeckStage, {
          props: { deck: talkDeck(), loadTheme: null, presenter: true, presenterTimer: true },
        });
        const reading = (name: string) =>
          screen.getByRole('timer', { name }).textContent?.trim() ?? '';
        const advance = (ms: number) => {
          vi.advanceTimersByTime(ms);
          flushSync();
        };
        const timers = await screen.findAllByRole('timer');
        expect(timers).toHaveLength(3);
        expect(timers.every((timer) => timer.getAttribute('aria-live') === 'off')).toBe(true);
        expect(screen.getByRole('group', { name: 'Timers' })).toBeTruthy();
        expect([reading('Elapsed'), reading('Slide'), reading('Now')]).toEqual([
          '0:00',
          '0:00',
          formatWallClock(Date.now(), stageRoot().lang),
        ]);

        advance(65_000);
        expect([reading('Elapsed'), reading('Slide')]).toEqual(['1:05', '1:05']);
        expect(reading('Now')).toBe(formatWallClock(Date.now(), stageRoot().lang));

        await fireEvent.click(inSplit().getByRole('button', { name: 'Next' }));
        advance(10_000);
        expect([reading('Elapsed'), reading('Slide')]).toEqual(['1:15', '0:10']);
        // A step on the same slide keeps the slide stopwatch.
        await fireEvent.click(inSplit().getByRole('button', { name: 'Next' }));
        advance(1_000);
        expect(reading('Slide')).toBe('0:11');

        await fireEvent.click(screen.getByRole('button', { name: 'Pause timers' }));
        advance(30_000);
        expect([reading('Elapsed'), reading('Slide')]).toEqual(['1:16', '0:11']);
        await fireEvent.click(screen.getByRole('button', { name: 'Start timers' }));
        advance(4_000);
        expect(reading('Elapsed')).toBe('1:20');

        // Closing and reopening the split view keeps the talk clock.
        await pressOnSlide('p');
        expect(screen.queryAllByRole('timer')).toHaveLength(0);
        advance(10_000);
        await pressOnSlide('p');
        expect(reading('Elapsed')).toBe('1:30');

        await fireEvent.click(screen.getByRole('button', { name: 'Reset timers' }));
        expect([reading('Elapsed'), reading('Slide')]).toEqual(['0:00', '0:00']);
        advance(2_000);
        expect(reading('Elapsed')).toBe('0:02');
      },
      reset
    );
    await scenario(
      'the label says the timers run from the first paint, and the slide stopwatch restarts at navigation',
      async () => {
        mockMatchMedia();
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(new Date(2026, 9, 27, 9, 41, 0));
        // Browsers run a view transition's DOM swap a frame or more later: hold it.
        const pending: (() => void)[] = [];
        const doc = document as unknown as { startViewTransition?: unknown };
        doc.startViewTransition = vi.fn((update: () => void) => {
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
        try {
          render(DeckStage, {
            props: { deck: talkDeck(), loadTheme: null, presenter: true, presenterTimer: true },
          });
          const reading = (name: string) =>
            screen.getByRole('timer', { name }).textContent?.trim() ?? '';
          await screen.findAllByRole('timer');
          // Auto-started: no one-second window that offers "Start timers".
          expect(screen.getByRole('button', { name: 'Pause timers' })).toBeTruthy();
          expect(screen.queryByRole('button', { name: 'Start timers' })).toBeNull();

          vi.advanceTimersByTime(20_000);
          flushSync();
          expect(reading('Slide')).toBe('0:20');
          await fireEvent.click(inSplit().getByRole('button', { name: 'Next' }));
          flushSync();
          // The engine moved; the transition has not painted the new slide yet.
          expect(activeSlide()?.dataset.slideId).toBe('intro');
          expect(reading('Slide')).toBe('0:00');
          expect(reading('Elapsed')).toBe('0:20');
          vi.advanceTimersByTime(3_000);
          for (const run of pending.splice(0)) run();
          await Promise.resolve();
          flushSync();
          expect(activeSlide()?.dataset.slideId).toBe('goals');
          expect(reading('Slide')).toBe('0:03');
        } finally {
          Reflect.deleteProperty(document, 'startViewTransition');
        }
      },
      reset
    );
  });
});

describe('presenter window', () => {
  it('opens a same-origin window synced both ways over the closed protocol, or falls back', async () => {
    await scenario(
      'opens noopener-safe, mirrors the stage, follows the stage and drives it back',
      async () => {
        mockMatchMedia();
        const hub = channelHub();
        vi.stubGlobal('BroadcastChannel', hub.FakeChannel);
        const popup = fakePopup();
        const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        render(DeckStage, {
          props: { deck: talkDeck(), loadTheme: null, presenter: true, namespace: 'board' },
        });
        await fireEvent.click(await screen.findByRole('button', { name: 'Open presenter window' }));

        expect(open).toHaveBeenCalledWith(
          '',
          presenterWindowName('board'),
          expect.stringContaining('popup=yes')
        );
        expect(popup.opener).toBeNull();
        const doc = popup.document;
        const view = () => doc.querySelector<HTMLElement>('.tx-deck-presenter-window__body');
        await waitFor(() => expect(view()).not.toBeNull());
        // The split view closes: the stage now shows the plain slides.
        await waitFor(() => expect(split()).toBeNull());

        expect(doc.title).toBe('Presenter: Board talk');
        expect(doc.documentElement.lang).toBe(stageRoot().lang);
        const windowRoot = doc.querySelector<HTMLElement>(
          '[data-tx-deck-presenter-window="board"]'
        );
        expect(windowRoot?.getAttribute('dir')).toBe(stageRoot().getAttribute('dir'));
        // The window document has no view of its own here, so roles are read from the markup.
        const labelled = (selector: string, name: string) =>
          doc.querySelector(`${selector}[aria-label="${name}"]`);
        expect(labelled('[role="region"]', 'Presenter view')).not.toBeNull();
        expect(labelled('aside', 'Speaker notes')).not.toBeNull();
        expect(labelled('section', 'Current slide')).not.toBeNull();
        expect(labelled('section', 'Up next')).not.toBeNull();
        // The full view carries the timers, never announced live.
        const timers = [...doc.querySelectorAll('[role="timer"]')];
        expect(timers).toHaveLength(3);
        expect(timers.every((timer) => timer.getAttribute('aria-live') === 'off')).toBe(true);
        expect(hub.members.size).toBe(2);

        // The stage moves; the window follows.
        await pressOnSlide('ArrowRight');
        await waitFor(() => expect(view()?.dataset.slideId).toBe('goals'));
        expect(view()?.dataset.step).toBe('0');

        // The window moves; the stage follows.
        clickInWindow(doc.querySelector('[data-tx-deck-presenter-next]'));
        await waitFor(() => expect(activeSlide()?.dataset.step).toBe('1'));
        expect(activeSlide()?.dataset.slideId).toBe('goals');
        expect(view()?.textContent).toContain('Step 1 of 2: Ship the export');

        // Every message is a closed protocol message on this deck's channel, and nothing echoes.
        const count = hub.sent.length;
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(hub.sent).toHaveLength(count);
        expect(
          hub.sent.every(
            ({ name, data }) => name === presenterChannelName('board') && isPresenterMessage(data)
          )
        ).toBe(true);

        // Close from the window: the window closes and both channel ends are released.
        const close = doc.querySelector('[data-tx-deck-presenter-close]') as HTMLElement;
        expect(close.textContent?.trim()).toBe('Close presenter window');
        clickInWindow(close);
        expect(popup.close).toHaveBeenCalled();
        expect(hub.members.size).toBe(0);
        expect(view()).toBeNull();
      },
      reset
    );

    await scenario(
      'ends the session when the user closes the window',
      async () => {
        mockMatchMedia();
        const hub = channelHub();
        vi.stubGlobal('BroadcastChannel', hub.FakeChannel);
        const popup = fakePopup();
        vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
        render(DeckStage, { props: { deck: talkDeck(), loadTheme: null, presenter: true } });
        await fireEvent.click(await screen.findByRole('button', { name: 'Open presenter window' }));
        await waitFor(() =>
          expect(popup.document.querySelector('.tx-deck-presenter-window__body')).not.toBeNull()
        );
        expect(hub.members.size).toBe(2);
        popup.closed = true;
        popup.dispatchEvent(new Event('pagehide'));
        expect(hub.members.size).toBe(0);
        // Reopening the split view offers the window again.
        await pressOnSlide('s');
        expect(screen.getByRole('button', { name: 'Open presenter window' })).toBeTruthy();
      },
      reset
    );

    await scenario(
      'falls back to the split view with the reason when the popup is blocked or there is no channel',
      async () => {
        mockMatchMedia();
        const hub = channelHub();
        vi.stubGlobal('BroadcastChannel', hub.FakeChannel);
        vi.spyOn(window, 'open').mockReturnValue(null);
        render(DeckStage, { props: { deck: talkDeck(), loadTheme: null, presenter: true } });
        await fireEvent.click(await screen.findByRole('button', { name: 'Open presenter window' }));
        const status = await waitFor(() => inSplit().getByRole('status'));
        expect(status.textContent).toBe(
          'The browser blocked the presenter window, so the presenter view stays on this page.'
        );
        expect(
          split()
            ?.querySelector('[data-tx-deck-presenter-reason]')
            ?.getAttribute('data-tx-deck-presenter-reason')
        ).toBe('popup-blocked');
        expect(stageRoot().dataset.presenter).toBe('true');
        expect(hub.members.size).toBe(0);
      },
      reset
    );

    await scenario(
      'reports a missing BroadcastChannel without opening a window, in the host language',
      async () => {
        mockMatchMedia();
        vi.stubGlobal('BroadcastChannel', undefined);
        const open = vi.spyOn(window, 'open');
        render(DeckStage, {
          props: {
            deck: talkDeck(),
            loadTheme: null,
            presenter: true,
            messages: {
              'stage.openPresenterWindow': 'Fenster öffnen',
              'stage.presenterNoChannel': 'Keine Verbindung zwischen Fenstern.',
            },
          },
        });
        await fireEvent.click(await screen.findByRole('button', { name: 'Fenster öffnen' }));
        await waitFor(() =>
          expect(inSplit().getByRole('status').textContent).toBe(
            'Keine Verbindung zwischen Fenstern.'
          )
        );
        expect(open).not.toHaveBeenCalled();
        expect(
          split()
            ?.querySelector('[data-tx-deck-presenter-reason]')
            ?.getAttribute('data-tx-deck-presenter-reason')
        ).toBe('no-broadcast');
      },
      reset
    );

    await scenario(
      'session: no window, a failing view chunk, and focusing an open window',
      async () => {
        const hub = channelHub();
        const stage = { namespace: 'room' } as DeckStageContext;
        const input = {
          stage,
          paint: {} as DeckPreviewPaint,
          timers: createDeckPresenterTimers(),
          stageRoot: null,
        };
        const none = createDeckPresenterSession({ opener: null });
        expect(await none.open(input)).toBe(false);
        expect(none.reason).toBe('no-window');

        const popup = fakePopup();
        const failing = createDeckPresenterSession({
          channel: hub.FakeChannel,
          openWindow: () => popup as unknown as Window,
          load: () => Promise.reject(new Error('chunk')),
        });
        expect(await failing.open(input)).toBe(false);
        expect(failing.reason).toBe('load-error');
        expect(popup.close).toHaveBeenCalled();
        expect(hub.members.size).toBe(0);

        const second = fakePopup();
        const teardown = vi.fn();
        const host = { attach: vi.fn(), detach: vi.fn() };
        const working = presenterSessionFor({}, host, {
          transports: (namespace) => [
            createMemoryPresenterTransport(namespace),
            createMemoryPresenterTransport(namespace),
          ],
          openWindow: () => second as unknown as Window,
          load: async () =>
            ({
              mountDeckPresenterWindow: () => teardown,
            }) as unknown as typeof import('../src/stage/presenter/popup.ts'),
        });
        expect(await working.open(input)).toBe(true);
        expect([working.status, working.reason]).toEqual(['open', null]);
        expect(working.transport?.name).toBe(presenterChannelName('room'));
        expect(host.attach).toHaveBeenCalledWith(working.transport, expect.any(Function));
        expect(await working.open(input)).toBe(true);
        expect(second.focus).toHaveBeenCalled();
        working.close();
        expect(teardown).toHaveBeenCalledTimes(1);
        expect([working.status, working.transport]).toEqual(['closed', null]);
        expect(host.detach).toHaveBeenCalledTimes(1);
      },
      reset
    );
  });

  it('two instances on one memory transport stay in step, without echoes', async () => {
    await scenario(
      'a stage and a presenter window view drive each other with closed messages',
      async () => {
        mockMatchMedia();
        mockLayout();
        const transport = createMemoryPresenterTransport('room');
        const posted: PresenterMessage[] = [];
        const post = transport.post.bind(transport);
        transport.post = (message) => {
          posted.push(message);
          post(message);
        };
        const audience = document.createElement('div');
        const presenterHost = document.createElement('div');
        document.body.append(audience, presenterHost);
        render(DeckStage, {
          target: audience,
          props: { deck: talkDeck(), loadTheme: null, sync: transport, syncHash: false },
        });

        // The window view gets the stage's deck and slide list (as the session passes them).
        const prepared = prepareDeck(talkDeck());
        if (!prepared.ok) throw new Error('invalid fixture');
        const deck = prepared.deck;
        const t = createDeckTranslator();
        const slides: DeckStageSlideEntry[] = deck.slides.map((slide, index) => ({
          slide,
          index,
          position: index,
          title: slide.title ?? slide.id,
        }));
        const stage = {
          deck,
          slides,
          t,
          locale: 'en',
          dir: 'ltr',
          namespace: 'room',
          state: { slideId: 'intro', slideIndex: 0, step: 0, stepCount: 0 },
        } as unknown as DeckStageContext;
        const paint: DeckPreviewPaint = {
          deck,
          renderers: [],
          tier: 'untrusted',
          t,
          canvas: { width: 1280, height: 720 },
          palette: () => DECK_FALLBACK_PALETTES.light,
        };
        render(DeckPresenterWindow, {
          target: presenterHost,
          props: { stage, paint, timers: createDeckPresenterTimers(() => 0), transport },
        });
        const view = () =>
          presenterHost.querySelector<HTMLElement>('.tx-deck-presenter-window__body');
        const audienceSlide = () =>
          audience.querySelector<HTMLElement>('[data-tx-deck-active="true"]');

        // The window shows the current slide and what comes next as live previews.
        const previews = [...presenterHost.querySelectorAll<HTMLElement>('[data-tx-deck-preview]')];
        expect(previews.map((item) => item.dataset.txDeckPreview)).toEqual(['intro', 'goals']);

        // The stage drives the window.
        const slide = audienceSlide() as HTMLElement;
        slide.focus();
        await fireEvent.keyDown(slide, { key: 'ArrowRight' });
        await waitFor(() => expect(view()?.dataset.slideId).toBe('goals'));

        // Keys on the presenter window drive the stage (arrows, Space, End).
        const root = presenterHost.querySelector('[role="region"]') as HTMLElement;
        await fireEvent.keyDown(root, { key: ' ' });
        await waitFor(() => expect(audienceSlide()?.dataset.step).toBe('1'));
        await fireEvent.keyDown(root, { key: 'End' });
        await waitFor(() => expect(audienceSlide()?.dataset.slideId).toBe('close'));
        expect(view()?.dataset.slideId).toBe('close');
        // Text fields on the presenter screen keep their keys.
        const field = document.createElement('input');
        root.append(field);
        await fireEvent.keyDown(field, { key: 'Home' });
        expect(view()?.dataset.slideId).toBe('close');

        const count = posted.length;
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(posted).toHaveLength(count);
        expect(
          posted.every(
            (message) => isPresenterMessage(message) && Object.keys(message).length === 3
          )
        ).toBe(true);
        audience.remove();
        presenterHost.remove();
      },
      reset
    );
  });

  it('mirrors the stage root presentation attributes and --tx variables only', () => {
    const source = document.createElement('div');
    const target = document.createElement('div');
    source.setAttribute('lang', 'ar');
    source.setAttribute('dir', 'rtl');
    source.setAttribute('data-tx-theme', 'ocean');
    source.setAttribute('data-tx-mode', 'dark');
    source.setAttribute('onclick', 'alert(1)');
    source.style.setProperty('--tx-background', 'oklch(0.2 0 0)');
    source.style.setProperty('color', 'red');
    target.setAttribute('data-tx-surface', 'glass');
    target.style.setProperty('--tx-stale', '1');
    mirrorStageRoot(source, target);
    expect(target.getAttribute('lang')).toBe('ar');
    expect(target.getAttribute('dir')).toBe('rtl');
    expect(target.getAttribute('data-tx-theme')).toBe('ocean');
    expect(target.getAttribute('data-tx-mode')).toBe('dark');
    expect(target.hasAttribute('onclick')).toBe(false);
    expect(target.hasAttribute('data-tx-surface')).toBe(false);
    expect(target.style.getPropertyValue('--tx-background')).toBe('oklch(0.2 0 0)');
    expect(target.style.getPropertyValue('--tx-stale')).toBe('');
    expect(target.style.getPropertyValue('color')).toBe('');
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  createAutoSlideScheduler,
  createDeckController,
  createDeckNavigator,
  createPresenterTransport,
  DECK_CANVAS,
  DECK_CONTROLS,
  DECK_ESCAPE_ORDER,
  DECK_MESSAGES,
  decideDeckInput,
  fitDeckCanvas,
  formatDeckHash,
  formatDeckRoute,
  formatMessage,
  isPresenterMessage,
  modelSlideStepCount,
  PRESENTER_MESSAGE_TYPES,
  parseDeckHash,
  parseDeckRoute,
  parsePresenterMessage,
  presenterChannelName,
  presenterMessage,
  resolveDeckLocale,
  resolveDeckTransition,
  type SchedulerClock,
  sanitizePresenterNamespace,
} from '../src/engine/index.ts';
import { deckSchema, parseDeck, slideStepCount } from '../src/model/index.ts';
import { validate } from '../src/schema/index.ts';

const deck = {
  slides: [
    { id: 'cover', layout: 'free', steps: ['Context', 'Ask'], blocks: [] },
    { id: 'hidden', hidden: true, layout: 'free', blocks: [] },
    { id: 'section-one', layout: 'free', blocks: [{ type: 'text', step: 4 }] },
    { id: 'section-two', layout: 'free', blocks: [{ type: 'text', step: 9 }] },
    { id: 'close', layout: 'free', blocks: [] },
  ],
  outline: {
    sections: [
      { id: 'section', slideIds: ['section-one', 'section-two'], stack: true },
      { id: 'plain', slideIds: ['close'], stack: false },
    ],
  },
  navigation: { start: 'cover', loop: false },
} as const;

describe('deck navigator', () => {
  it('consumes canonical model slides and their public step count', () => {
    const draft = {
      formatVersion: 2,
      meta: { title: 'Engine fixture' },
      slides: [
        {
          id: 'opening',
          layout: 'free',
          blocks: [
            { type: 'text', markdown: 'First reveal', step: 2 },
            { type: 'text', markdown: 'Second reveal', step: 5 },
          ],
          steps: ['First', 'Second'],
        },
      ],
    };
    expect(validate(deckSchema, draft).ok).toBe(true);
    const parsed = parseDeck(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.deck) throw new Error('The valid model fixture must parse.');
    const slide = parsed.deck.slides[0];
    if (slide?.layout !== 'free') throw new Error('Expected a free slide.');
    expect(slideStepCount(slide)).toBe(2);
    const navigator = createDeckNavigator({ slides: [slide] });
    expect(navigator.getLocation()).toMatchObject({ slideId: 'opening', stepCount: 2 });
  });

  it('starts at the configured slide and counts model steps plus labels', () => {
    const navigator = createDeckNavigator(deck);
    expect(navigator.getLocation()).toMatchObject({
      slideId: 'cover',
      slideIndex: 0,
      step: 0,
      stepCount: 2,
    });
    expect(navigator.stepCountFor('section-one')).toBe(1);
    expect(modelSlideStepCount(deck.slides[2]!)).toBe(1);
    expect(modelSlideStepCount(deck.slides[0]!)).toBe(2);
    expect(navigator.visibleSlides().map(({ id }) => id)).toEqual([
      'cover',
      'section-one',
      'section-two',
      'close',
    ]);
  });

  it('advances and reverses through steps before changing slides', () => {
    const navigator = createDeckNavigator(deck);
    expect(navigator.next()).toMatchObject({ slideId: 'cover', step: 1 });
    expect(navigator.next()).toMatchObject({ slideId: 'cover', step: 2 });
    expect(navigator.next()).toMatchObject({
      slideId: 'section-one',
      step: 0,
      sectionId: 'section',
      verticalIndex: 0,
    });
    expect(navigator.prev()).toMatchObject({ slideId: 'cover', step: 2 });
    expect(navigator.prev()).toMatchObject({ slideId: 'cover', step: 1 });
  });

  it('traverses vertical stack members before the next horizontal slide and skips hidden slides', () => {
    const stackDeck = {
      slides: [{ id: 'section-one' }, { id: 'section-two' }, { id: 'close' }],
      outline: {
        sections: [{ id: 'section', slideIds: ['section-one', 'section-two'], stack: true }],
      },
    };
    const navigator = createDeckNavigator(stackDeck, { initialSlideId: 'section-one' });
    expect(navigator.getLocation()).toMatchObject({
      slideId: 'section-one',
      sectionId: 'section',
      verticalIndex: 0,
    });
    expect(navigator.next()).toMatchObject({
      slideId: 'section-two',
      sectionId: 'section',
      verticalIndex: 1,
    });
    expect(navigator.next()).toMatchObject({ slideId: 'close' });
    expect(navigator.prev()).toMatchObject({ slideId: 'section-two', step: 0 });

    const hiddenMiddle = {
      slides: [{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c' }, { id: 'd' }],
      outline: { sections: [{ id: 'stack', slideIds: ['a', 'b', 'c'], stack: true }] },
    };
    const stack = createDeckNavigator(hiddenMiddle, { initialSlideId: 'a' });
    expect(stack.next()).toMatchObject({ slideId: 'c', verticalIndex: 2 });
  });

  it('supports first, last, goTo by id/index/location, clamping, looping and safe fallback', () => {
    const navigator = createDeckNavigator(deck);
    expect(navigator.goTo('close')).toMatchObject({ slideId: 'close', step: 0 });
    expect(navigator.goTo(1)).toMatchObject({ slideId: 'section-one', step: 0 });
    expect(
      navigator.goTo({ slideId: 'section-two', slideIndex: 3, step: 40, stepCount: 0 })
    ).toMatchObject({ slideId: 'section-two', step: 1 });
    expect(navigator.goTo('missing')).toMatchObject({ slideId: 'cover', step: 0 });
    expect(navigator.goTo('hidden')).toMatchObject({ slideId: 'cover', step: 0 });
    expect(navigator.last()).toMatchObject({ slideId: 'close' });
    expect(navigator.first()).toMatchObject({ slideId: 'cover', step: 0 });
    expect(navigator.prev()).toMatchObject({ slideId: 'cover' });
    expect(navigator.goToVertical('section', 1)).toMatchObject({
      slideId: 'section-two',
      verticalIndex: 1,
    });
    expect(navigator.goToVertical('plain', 0)).toMatchObject({ slideId: 'section-two' });

    const looping = createDeckNavigator(
      { ...deck, navigation: { loop: true } },
      { initialSlideId: 'close' }
    );
    expect(looping.next()).toMatchObject({ slideId: 'cover' });
    expect(looping.prev()).toMatchObject({ slideId: 'close' });
  });
});

describe('hash routes', () => {
  it('parses and formats slide id and step routes', () => {
    expect(parseDeckHash('#/opening')).toEqual({ slideId: 'opening', step: 0 });
    expect(parseDeckHash('/opening/12')).toEqual({ slideId: 'opening', step: 12 });
    expect(formatDeckHash('opening', 12)).toBe('#/opening/12');
    expect(formatDeckHash('opening', -1)).toBe('#/opening/0');
    expect(formatDeckHash('Bad_ID')).toBe('#/');
    expect(formatDeckRoute({ slideId: 'opening', step: 3 }, { print: true, notes: true })).toBe(
      '?print=1&notes=1#/opening/3'
    );
    expect(parseDeckRoute('#/opening/3', '?print=1&notes=1')).toEqual({
      location: { slideId: 'opening', step: 3 },
      flags: { print: true, notes: true },
    });
    expect(parseDeckRoute('#/opening', '?print=true&notes=0').flags).toEqual({
      print: false,
      notes: false,
    });
  });

  it('rejects traversal, uppercase, encoded, malformed and out-of-range routes without throwing', () => {
    for (const value of [
      '',
      '#',
      '#/',
      '#/Opening',
      '#/one_two',
      '#/../secret',
      '#/a..b',
      '#/a//b',
      '#/a%2Fb',
      '#/a?print=1',
      '#/a/33',
      '#/a/-1',
      '#/a/1.5',
      '#/a/1/2',
      '#/a\\b',
    ]) {
      expect(() => parseDeckHash(value)).not.toThrow();
      expect(parseDeckHash(value), value).toBeNull();
    }
    expect(parseDeckHash('x'.repeat(257))).toBeNull();
    expect(parseDeckHash('#/ok/32')).toEqual({ slideId: 'ok', step: 32 });
  });
});

describe('input controls', () => {
  it('keeps one control registry with all documented keyboard shortcuts', () => {
    const shortcuts = DECK_CONTROLS.flatMap((control) =>
      control.keys.map((key) => [control.action, key.key, key.shift, key.modifier])
    );
    for (const [action, key] of [
      ['next', 'ArrowRight'],
      ['next', 'ArrowDown'],
      ['next', 'PageDown'],
      ['next', ' '],
      ['next', 'Enter'],
      ['prev', 'ArrowLeft'],
      ['prev', 'ArrowUp'],
      ['prev', 'PageUp'],
      ['prev', 'Backspace'],
      ['prev', ' '],
      ['first', 'Home'],
      ['last', 'End'],
      ['overview', 'o'],
      ['fullscreen', 'f'],
      ['presenter', 's'],
      ['presenter', 'p'],
      ['blackout', 'b'],
      ['blackout', '.'],
      ['laser', 'l'],
      ['help', '?'],
      ['debug', 'd'],
      ['print', 'p'],
    ])
      expect(shortcuts).toContainEqual(expect.arrayContaining([action, key]));
    expect(DECK_CONTROLS.find(({ action }) => action === 'print')?.keys).toEqual([
      { key: 'p', label: 'Ctrl + P', modifier: 'ctrl' },
      { key: 'p', label: '⌘ + P', modifier: 'meta' },
    ]);
    expect(DECK_ESCAPE_ORDER).toEqual([
      'debug',
      'help',
      'overview',
      'blackout',
      'laser',
      'fullscreen-exit',
    ]);
  });

  it('maps forward/back, first/last, toggles, modified print and RTL arrows', () => {
    const key = (
      value: string,
      modifiers: Record<string, unknown> = {},
      state: Record<string, unknown> = {}
    ) => decideDeckInput({ kind: 'key', key: value, ...modifiers } as never, state as never);
    for (const value of ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])
      expect(key(value)).toBe('next');
    for (const value of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])
      expect(key(value)).toBe('prev');
    expect(key(' ', { shiftKey: true })).toBe('prev');
    expect(key('Home')).toBe('first');
    expect(key('End')).toBe('last');
    expect(key('ArrowLeft', {}, { dir: 'rtl' })).toBe('next');
    expect(key('ArrowRight', {}, { dir: 'rtl' })).toBe('prev');
    for (const [value, action] of [
      ['o', 'overview'],
      ['f', 'fullscreen'],
      ['s', 'presenter'],
      ['p', 'presenter'],
      ['b', 'blackout'],
      ['.', 'blackout'],
      ['l', 'laser'],
      ['?', 'help'],
      ['d', 'debug'],
    ] as const) {
      const state = value === 'd' ? { debugAvailable: true } : {};
      expect(
        decideDeckInput(
          { kind: 'key', key: value, ...(value === '?' ? { shiftKey: true } : {}) },
          state
        )
      ).toBe(action);
    }
    expect(decideDeckInput({ kind: 'key', key: 'p', ctrlKey: true })).toBe('print');
    expect(decideDeckInput({ kind: 'key', key: 'p', metaKey: true })).toBe('print');
    expect(
      decideDeckInput({ kind: 'key', key: 'Escape' }, { debug: true, help: true, overview: 'open' })
    ).toBe('debug');
    expect(decideDeckInput({ kind: 'key', key: 'Escape' }, { overview: 'open' })).toBe('overview');
  });

  it('ignores input from fields, IME, modifiers, repeats, dialogs and interactive targets', () => {
    const editable = [{ tag: 'input' }];
    const interactive = [{ tag: 'div', attributes: ['data-tx-deck-interactive'] }];
    for (const event of [
      { kind: 'key', key: 'ArrowRight', path: editable },
      { kind: 'key', key: ' ', isComposing: true },
      { kind: 'key', key: 'ArrowRight', altKey: true },
      { kind: 'key', key: 'ArrowRight', ctrlKey: true },
      { kind: 'key', key: 'ArrowRight', metaKey: true },
      { kind: 'key', key: 'ArrowRight', path: interactive },
      { kind: 'key', key: 'ArrowRight', path: [{ tag: 'div', role: 'button' }] },
    ] as const)
      expect(decideDeckInput(event as never), JSON.stringify(event)).toBeNull();
    expect(decideDeckInput({ kind: 'key', key: 'ArrowRight' }, { help: true })).toBeNull();
    expect(decideDeckInput({ kind: 'key', key: 'ArrowRight' }, { overview: 'open' })).toBeNull();
    expect(decideDeckInput({ kind: 'key', key: 'ArrowRight' }, { overview: 'closing' })).toBeNull();
    expect(decideDeckInput({ kind: 'key', key: 'd' })).toBeNull();
    expect(decideDeckInput({ kind: 'key', key: 'p', ctrlKey: true, repeat: true })).toBeNull();
    expect(decideDeckInput({ kind: 'click', button: 2 })).toBeNull();
    expect(decideDeckInput({ kind: 'click', selectionLength: 1 })).toBeNull();
    expect(decideDeckInput({ kind: 'click', path: [{ tag: 'button' }] })).toBeNull();
  });

  it('applies swipe distance, axis dominance, duration, pointer and modal guards at the boundaries', () => {
    expect(
      decideDeckInput({ kind: 'swipe', dx: -50, dy: 0, durationMs: 799, pointerType: 'touch' })
    ).toBe('next');
    expect(
      decideDeckInput({ kind: 'swipe', dx: 75, dy: 50, durationMs: 799, pointerType: 'pen' })
    ).toBe('prev');
    for (const event of [
      { dx: -49.9, dy: 0, durationMs: 100 },
      { dx: -75, dy: 50.1, durationMs: 100 },
      { dx: -80, dy: 0, durationMs: 800 },
      { dx: -80, dy: 0, durationMs: 100, pointerType: 'mouse' as const },
      { dx: Number.NaN, dy: 0, durationMs: 100 },
    ])
      expect(decideDeckInput({ kind: 'swipe', ...event }), JSON.stringify(event)).toBeNull();
    expect(
      decideDeckInput({ kind: 'swipe', dx: -80, dy: 0, durationMs: 100 }, { blackout: true })
    ).toBeNull();
    expect(
      decideDeckInput({ kind: 'swipe', dx: -80, dy: 0, durationMs: 100 }, { overview: 'open' })
    ).toBeNull();
    expect(
      decideDeckInput({
        kind: 'swipe',
        dx: -80,
        dy: 0,
        durationMs: 100,
        path: [{ tag: 'a', href: true }],
      })
    ).toBeNull();
  });
});

describe('transition resolution', () => {
  it('prefers a valid slide override, then deck default, then fade fallback', () => {
    expect(
      resolveDeckTransition({ slide: { transition: 'zoom' }, style: { transition: 'slide' } })
    ).toMatchObject({ name: 'zoom', requested: 'zoom', durationMs: 350, reason: 'slide-override' });
    expect(resolveDeckTransition({ style: { transition: 'slide' } })).toMatchObject({
      name: 'slide',
      requested: 'slide',
      durationMs: 400,
      reason: 'deck-default',
    });
    expect(
      resolveDeckTransition({ slide: { transition: 'invalid' }, style: { transition: 'bad' } })
    ).toMatchObject({ name: 'fade', requested: 'fade', durationMs: 300, reason: 'engine-default' });
  });

  it('honors none, subtle and reduced-motion policies for every transition', () => {
    expect(
      resolveDeckTransition({ slide: { transition: 'zoom' }, style: { motion: 'none' } })
    ).toMatchObject({ name: 'none', requested: 'zoom', durationMs: 0, reason: 'motion-none' });
    expect(
      resolveDeckTransition({ slide: { transition: 'none' }, reducedMotion: true })
    ).toMatchObject({ name: 'none', requested: 'none', durationMs: 0 });
    expect(
      resolveDeckTransition({ slide: { transition: 'morph' }, reducedMotion: true })
    ).toMatchObject({
      name: 'fade',
      requested: 'morph',
      durationMs: 150,
      reason: 'reduced-motion',
    });
    expect(
      resolveDeckTransition({ slide: { transition: 'zoom' }, style: { motion: 'subtle' } })
    ).toMatchObject({ name: 'fade', requested: 'zoom', durationMs: 180, reason: 'subtle' });
    for (const name of ['none', 'fade', 'fade-up', 'slide', 'zoom', 'morph'] as const) {
      const full = resolveDeckTransition({ slide: { transition: name } });
      expect(full.durationMs).toBeLessThanOrEqual(400);
    }
  });
});

describe('virtual canvas fit', () => {
  it('exposes each fixed design canvas and computes centered contain letterboxing', () => {
    expect(DECK_CANVAS).toEqual({
      '16:9': { width: 1280, height: 720 },
      '4:3': { width: 1024, height: 768 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 1080, height: 1080 },
    });
    expect(fitDeckCanvas(1000, 1000)).toEqual({
      scale: 1000 / 1280,
      width: 1000,
      height: 562.5,
      offsetX: 0,
      offsetY: 218.75,
      canvasWidth: 1280,
      canvasHeight: 720,
      aspect: '16:9',
      fit: 'contain',
    });
    expect(fitDeckCanvas(300, 500, '4:3')).toMatchObject({
      scale: 300 / 1024,
      width: 300,
      height: 225,
      offsetX: 0,
      offsetY: 137.5,
      canvasWidth: 1024,
      canvasHeight: 768,
    });
    expect(fitDeckCanvas(0, 0)).toMatchObject({
      scale: 0,
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('supports cover and normalizes non-finite or negative container dimensions', () => {
    const cover = fitDeckCanvas(1000, 1000, '16:9', 'cover');
    expect(cover.scale).toBeCloseTo(1000 / 720);
    expect(cover.width).toBeCloseTo(1777.777777777778);
    expect(cover.height).toBe(1000);
    expect(cover.aspect).toBe('16:9');
    expect(cover.fit).toBe('cover');
    expect(cover.offsetX).toBeCloseTo(-388.888888888889);
    expect(cover.offsetY).toBe(0);
    expect(fitDeckCanvas(Number.NaN, -1, '1:1')).toMatchObject({
      scale: 0,
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
    });
    expect(fitDeckCanvas(Infinity, 800, '9:16')).toMatchObject({
      scale: 0,
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 400,
    });
    expect(fitDeckCanvas(1000, 1000, '16:9', 'container')).toMatchObject({
      scale: 1000 / 1280,
      fit: 'container',
    });
    expect(fitDeckCanvas(1000, 1000, '3:2')).toMatchObject({
      aspect: '16:9',
      canvasWidth: 1280,
      canvasHeight: 720,
    });
  });
});

class FakeClock implements SchedulerClock {
  private time = 0;
  private id = 0;
  private jobs = new Map<number, { due: number; callback: () => void }>();
  setTimeout(callback: () => void, delayMs: number): number {
    const id = ++this.id;
    this.jobs.set(id, { due: this.time + delayMs, callback });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.jobs.delete(handle as number);
  }
  now(): number {
    return this.time;
  }
  advance(ms: number): void {
    const end = this.time + ms;
    while (true) {
      const next = [...this.jobs.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > end) break;
      this.time = next[1].due;
      this.jobs.delete(next[0]);
      next[1].callback();
    }
    this.time = end;
  }
}

describe('auto-slide scheduler', () => {
  it('uses an injected clock, repeats on schedule, and pauses for manual input', () => {
    const clock = new FakeClock();
    const advance = vi.fn();
    const scheduler = createAutoSlideScheduler({ intervalMs: 2_000, clock, onAdvance: advance });
    scheduler.start();
    clock.advance(1_999);
    expect(advance).not.toHaveBeenCalled();
    clock.advance(1);
    expect(advance).toHaveBeenCalledTimes(1);
    clock.advance(2_000);
    expect(advance).toHaveBeenCalledTimes(2);
    scheduler.input();
    expect(scheduler.isPaused()).toBe(true);
    clock.advance(20_000);
    expect(advance).toHaveBeenCalledTimes(2);
    scheduler.resume();
    clock.advance(2_000);
    expect(advance).toHaveBeenCalledTimes(3);
    scheduler.stop();
    clock.advance(20_000);
    expect(advance).toHaveBeenCalledTimes(3);
  });

  it('starts paused when requested and clamps timer intervals to its documented bounds', () => {
    const clock = new FakeClock();
    const short = vi.fn();
    const scheduler = createAutoSlideScheduler({
      intervalMs: 1,
      clock,
      onAdvance: short,
      startPaused: true,
    });
    scheduler.start();
    clock.advance(10_000);
    expect(short).not.toHaveBeenCalled();
    scheduler.resume();
    clock.advance(999);
    expect(short).not.toHaveBeenCalled();
    clock.advance(1);
    expect(short).toHaveBeenCalledTimes(1);
    scheduler.stop();

    const longClock = new FakeClock();
    const long = vi.fn();
    const longScheduler = createAutoSlideScheduler({
      intervalMs: 900_000,
      clock: longClock,
      onAdvance: long,
    });
    longScheduler.start();
    longClock.advance(600_000);
    expect(long).toHaveBeenCalledTimes(1);
    longScheduler.stop();
  });
});

describe('presenter protocol', () => {
  it('uses a namespaced v1 channel and normalizes namespaces', () => {
    expect(PRESENTER_MESSAGE_TYPES).toEqual(['hello', 'sync', 'request']);
    expect(presenterChannelName(' Launch Deck ')).toBe('texuli-deck-presenter/1:launch-deck');
    expect(presenterChannelName('')).toBe('texuli-deck-presenter/1:default');
    expect(sanitizePresenterNamespace('A / deck')).toBe('a-deck');
  });

  it('accepts only closed, bounded message shapes', () => {
    const hello = presenterMessage('hello', 'slide-1', 0);
    expect(hello).toEqual({ type: 'hello', slideId: 'slide-1', step: 0 });
    expect(isPresenterMessage(hello)).toBe(true);
    expect(parsePresenterMessage({ type: 'sync', slideId: 's-2', step: 32 })).toEqual({
      type: 'sync',
      slideId: 's-2',
      step: 32,
    });
    for (const invalid of [
      null,
      [],
      {},
      { type: 'unknown', slideId: 'slide', step: 0 },
      { type: 'sync', slideId: 'Slide', step: 0 },
      { type: 'sync', slideId: '../x', step: 0 },
      { type: 'sync', slideId: 'slide', step: -1 },
      { type: 'sync', slideId: 'slide', step: 33 },
      { type: 'sync', slideId: 'slide', step: 1.5 },
      { type: 'sync', slideId: 'slide', step: 0, html: '<b>' },
    ]) {
      expect(isPresenterMessage(invalid)).toBe(false);
      expect(parsePresenterMessage(invalid)).toBeNull();
    }
    expect(presenterMessage('sync', 'slide', 33)).toBeNull();
  });

  it('uses a host-supplied transport and drops malformed incoming messages', () => {
    const outgoing: unknown[] = [];
    let onMessage: ((event: { data: unknown }) => void) | undefined;
    const remove = vi.fn();
    const close = vi.fn();
    const channel = {
      postMessage: (message: unknown) => outgoing.push(message),
      addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => {
        onMessage = listener;
      },
      removeEventListener: remove,
      close,
    };
    const transport = createPresenterTransport(channel);
    const received: unknown[] = [];
    const unsubscribe = transport.subscribe((message) => received.push(message));
    const sync = { type: 'sync', slideId: 'slide-1', step: 2 } as const;
    transport.post(sync);
    transport.post({ ...sync, unsafe: true } as never);
    onMessage?.({ data: { ...sync, unsafe: true } });
    onMessage?.({ data: sync });
    expect(outgoing).toEqual([sync]);
    expect(received).toEqual([sync]);
    unsubscribe();
    transport.close();
    expect(remove).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('deck controller', () => {
  it('provides imperative navigation, snapshots, subscriptions and typed state/action events', () => {
    const controller = createDeckController(deck);
    const states: string[] = [];
    const slides: string[] = [];
    const steps: string[] = [];
    const actions: string[] = [];
    const unsubscribe = controller.subscribe((state, previous) =>
      states.push(`${previous.slideId}->${state.slideId}:${state.step}`)
    );
    controller.subscribe('slidechange', ({ state }) => slides.push(state.slideId));
    controller.subscribe('stepchange', ({ state }) => steps.push(`${state.slideId}:${state.step}`));
    controller.subscribe('action', ({ action, source }) => actions.push(`${action}:${source}`));
    expect(controller.getState()).toMatchObject({
      slideId: 'cover',
      step: 0,
      overview: false,
      blackout: false,
      paused: false,
    });
    expect(controller.next()).toMatchObject({ slideId: 'cover', step: 1 });
    expect(controller.next({ source: 'presenter' })).toMatchObject({ slideId: 'cover', step: 2 });
    expect(controller.next()).toMatchObject({ slideId: 'section-one', step: 0 });
    expect(controller.goTo('close')).toMatchObject({ slideId: 'close' });
    expect(controller.first()).toMatchObject({ slideId: 'cover' });
    expect(controller.last()).toMatchObject({ slideId: 'close' });
    expect(controller.prev()).toMatchObject({ slideId: 'section-two', step: 1 });
    expect(states).toHaveLength(7);
    expect(slides).toEqual(['section-one', 'close', 'cover', 'close', 'section-two']);
    expect(steps).toEqual(['cover:1', 'cover:2']);
    controller.handleInput({ kind: 'key', key: 'Enter' });
    expect(actions.at(-1)).toBe('next:keyboard');
    unsubscribe();
    const length = states.length;
    controller.next();
    expect(states).toHaveLength(length);
    controller.destroy();
  });

  it('orders plugin setup, navigation/action hooks, cleanup and destroy hooks', () => {
    const order: string[] = [];
    const plugins = ['one', 'two'].map((name) => ({
      name,
      setup() {
        order.push(`${name}:setup`);
        return () => order.push(`${name}:cleanup`);
      },
      beforeNavigate() {
        order.push(`${name}:before`);
      },
      afterNavigate() {
        order.push(`${name}:after`);
      },
      onAction() {
        order.push(`${name}:action`);
      },
      onDestroy() {
        order.push(`${name}:destroy`);
      },
    }));
    const controller = createDeckController(deck, { plugins });
    expect(order.splice(0)).toEqual(['one:setup', 'two:setup']);
    controller.handleInput({ kind: 'key', key: 'Enter' });
    expect(order).toEqual([
      'one:action',
      'two:action',
      'one:before',
      'two:before',
      'one:after',
      'two:after',
    ]);
    order.length = 0;
    controller.destroy();
    expect(order).toEqual(['two:cleanup', 'one:cleanup', 'one:destroy', 'two:destroy']);
    expect(controller.next()).toMatchObject({ slideId: 'cover', step: 1 });
  });

  it('allows a plugin to veto or redirect navigation and emits overview, blackout and pause events', () => {
    const controller = createDeckController(deck, {
      plugins: [
        {
          name: 'policy',
          beforeNavigate(target) {
            if (target === 'close') return false;
            if (target === 'section-two')
              return { slideId: 'section-one', slideIndex: 2, step: 0, stepCount: 1 };
          },
        },
      ],
    });
    const overview: boolean[] = [];
    const blackout: boolean[] = [];
    const paused: boolean[] = [];
    controller.subscribe('overview', ({ open }) => overview.push(open));
    controller.subscribe('blackout', ({ active }) => blackout.push(active));
    controller.subscribe('pause', ({ paused: value }) => paused.push(value));
    expect(controller.goTo('close').slideId).toBe('cover');
    expect(controller.goTo('section-two').slideId).toBe('section-one');
    controller.setOverview(true);
    controller.setOverview(true);
    controller.setOverview(false);
    controller.setBlackout(true);
    controller.setBlackout(false);
    controller.pause();
    controller.pause();
    controller.resume();
    expect(overview).toEqual([true, false]);
    expect(blackout).toEqual([true, false]);
    expect(paused).toEqual([true, false]);
    controller.destroy();
  });

  it('pauses auto-slide after handled input and resumes on request using the injected clock', () => {
    const clock = new FakeClock();
    const controller = createDeckController(deck, { autoSlideMs: 1_000, clock });
    clock.advance(1_000);
    expect(controller.getState().slideId).toBe('cover');
    expect(controller.getState().step).toBe(1);
    expect(controller.handleInput({ kind: 'key', key: 'Enter' })).toBe('next');
    clock.advance(10_000);
    expect(controller.getState().slideId).toBe('cover');
    controller.resume();
    clock.advance(1_000);
    expect(controller.getState().step).toBe(2);
    controller.destroy();
  });
});

describe('localized messages', () => {
  it('has English defaults for every registry label and description key', () => {
    const keys = DECK_CONTROLS.flatMap(({ labelKey, descriptionKey }) => [
      labelKey,
      descriptionKey,
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(DECK_MESSAGES).toHaveProperty(key);
    expect(Object.values(DECK_MESSAGES).every((message) => message.length > 0)).toBe(true);
  });

  it('formats known placeholders, preserves missing placeholders and applies typed overrides', () => {
    expect(formatMessage('stage.slideOf', { current: 3, total: 9 })).toBe('Slide 3 of 9');
    expect(formatMessage('overview.selectSlide', { current: 2, title: 'Close' })).toBe(
      'Go to slide 2: Close'
    );
    expect(formatMessage('chrome.hintMove')).toBe('Use {key} to move,');
    expect(formatMessage('controls.next', {}, { 'controls.next': 'Continue' })).toBe('Continue');
  });

  it('passes locale and direction through from deck metadata with explicit overrides', () => {
    expect(resolveDeckLocale({ locale: 'ar', dir: 'rtl' })).toEqual({ locale: 'ar', dir: 'rtl' });
    expect(resolveDeckLocale({ locale: 'ar', dir: 'rtl' }, { locale: 'en-GB' })).toEqual({
      locale: 'en-GB',
      dir: 'rtl',
    });
    expect(resolveDeckLocale(null, { locale: 'es', dir: 'ltr' })).toEqual({
      locale: 'es',
      dir: 'ltr',
    });
    expect(resolveDeckLocale()).toEqual({ locale: 'en', dir: 'auto' });
  });
});

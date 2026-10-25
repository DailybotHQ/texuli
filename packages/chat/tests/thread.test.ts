import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatThread, groupMessages, MessageList, parseMessageText } from '../src/index.ts';
import type { ChatMessage } from '../src/thread/types.ts';
import { MessageVirtualWindow } from '../src/thread/virtual-window.ts';

afterEach(cleanup);

const jordan = { id: 'jordan', name: 'Jordan Lee' };
const avery = { id: 'avery', name: 'Avery Chen' };

function message(
  id: string,
  author = jordan,
  at = '2026-06-12T10:00:00.000Z',
  body = 'Hello'
): ChatMessage {
  return { id, author, at, body };
}

describe('groupMessages', () => {
  it('groups adjacent messages by author and time, and begins a new group at day boundaries', () => {
    const groups = groupMessages([
      message('one'),
      message('two', jordan, '2026-06-12T10:02:00.000Z'),
      message('three', avery, '2026-06-12T10:03:00.000Z'),
      message('four', jordan, '2026-06-12T10:04:00.000Z'),
      message('five', jordan, '2026-06-13T10:04:00.000Z'),
    ]);

    expect(groups.map((group) => group.messages.map(({ id }) => id))).toEqual([
      ['one', 'two'],
      ['three'],
      ['four'],
      ['five'],
    ]);
    expect(groups[0]?.dayStart?.toISOString()).toBe('2026-06-12T10:00:00.000Z');
    expect(groups[3]?.dayStart?.toISOString()).toBe('2026-06-13T10:04:00.000Z');
  });

  it('starts a new group after the grouping window or for out-of-order timestamps', () => {
    const groups = groupMessages([
      message('one'),
      message('two', jordan, '2026-06-12T10:06:00.000Z'),
      message('three', jordan, '2026-06-12T09:00:00.000Z'),
    ]);
    expect(groups).toHaveLength(3);
  });
});

describe('parseMessageText', () => {
  it('supports safe inline text formatting without interpreting HTML', () => {
    expect(parseMessageText('<img src=x onerror=alert(1)> **bold** *soft* `code`')).toEqual([
      { type: 'text', value: '<img src=x onerror=alert(1)> ' },
      { type: 'strong', value: 'bold' },
      { type: 'text', value: ' ' },
      { type: 'em', value: 'soft' },
      { type: 'text', value: ' ' },
      { type: 'code', value: 'code' },
    ]);
  });

  it('keeps unsafe links as literal text and accepts safe untrusted links', () => {
    const unsafeLink = parseMessageText('[bad](javascript:alert(1))');
    expect(unsafeLink.every((part) => part.type === 'text')).toBe(true);
    expect(unsafeLink.map((part) => part.value).join('')).toBe('[bad](javascript:alert(1))');
    expect(parseMessageText('[site](https://example.com)')).toEqual([
      { type: 'link', value: 'site', href: 'https://example.com' },
    ]);
  });
});

describe('MessageVirtualWindow', () => {
  it('renders a bounded window and maintains variable-height offsets', () => {
    const list = new MessageVirtualWindow(100, 50);
    expect(list.measure(0, 80)).toBe(true);
    expect(list.offsetOf(1)).toBe(80);
    const window = list.window(500, 100, 1);
    expect(window.totalSize).toBe(5030);
    expect(window.items.length).toBeLessThan(8);
    expect(window.items[0]?.index).toBe(8);
  });

  it('rejects invalid measurements and discards measurements beyond a resized thread', () => {
    const list = new MessageVirtualWindow(3, 20);
    expect(list.measure(3, 42)).toBe(false);
    expect(list.measure(1, Number.NaN)).toBe(false);
    expect(list.measure(2, 40)).toBe(true);
    expect(list.measure(2, 40)).toBe(false);
    list.resize(2);
    expect(list.offsetOf(2)).toBe(40);
    expect(list.window(0, 100).items).toHaveLength(2);
  });

  it('keeps each measurement with its row key when older rows are prepended', () => {
    const list = new MessageVirtualWindow(0, 100);
    list.resize(3, ['b', 'c', 'd']);
    expect(list.measureKey('b', 40)).toBe(true);
    expect(list.measureKey('d', 300)).toBe(true);
    expect(list.measureKey('missing', 10)).toBe(false);
    list.resize(4, ['a', 'b', 'c', 'd']);
    expect(list.indexOfKey('c')).toBe(2);
    // 'a' is new (estimate), 'b' keeps its 40, 'c' is unmeasured.
    expect(list.offsetOf(list.indexOfKey('c'))).toBe(140);
    expect(list.offsetOf(4)).toBe(540);
    expect(list.window(0, 1000).items.map(({ key, size }) => [key, size])).toEqual([
      ['a', 100],
      ['b', 40],
      ['c', 100],
      ['d', 300],
    ]);
    list.resize(2, ['c', 'd']);
    expect(list.offsetOf(2)).toBe(400);
  });
});

describe('MessageList', () => {
  it('groups messages, distinguishes own and other alignment, exposes a polite log, and renders hostile text as text', () => {
    render(MessageList, {
      props: {
        currentUserId: 'avery',
        messages: [
          message(
            'one',
            jordan,
            '2026-06-12T10:00:00.000Z',
            '<img src=x onerror=alert(1)> **hello**'
          ),
          message('two', jordan, '2026-06-12T10:01:00.000Z', 'Second'),
          message('three', avery, '2026-06-12T10:02:00.000Z', 'My reply'),
        ],
        labels: { you: 'Me' },
      },
    });
    const log = screen.getByRole('log', { name: 'Messages' });
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(log.querySelectorAll('[data-message-group]')).toHaveLength(2);
    expect(log.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(screen.getByText('hello', { selector: 'strong' })).toBeTruthy();
    expect(log.querySelector('[data-message-group="three-0"]')?.className).toContain('--own');
    expect(screen.getByText('Me')).toBeTruthy();
    expect(screen.getByText('JL')).toBeTruthy();
  });

  it('stays at the bottom when content grows after the first stick, unless the reader scrolled up', async () => {
    const callbacks: Array<(entries: unknown[]) => void> = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: (entries: unknown[]) => void) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      render(MessageList, { props: { messages: [message('one'), message('two')] } });
      // Let the first stick (after a tick) land before measuring.
      await tick();
      const log = screen.getByRole('log');
      let height = 400;
      Object.defineProperty(log, 'clientHeight', { value: 200, configurable: true });
      Object.defineProperty(log, 'scrollHeight', { get: () => height, configurable: true });
      // A late measurement (fonts, a typing footer) grows the content.
      height = 640;
      for (const callback of callbacks) callback([]);
      expect(log.scrollTop).toBe(640);

      // The reader scrolls up: growth no longer moves the list.
      log.scrollTop = 0;
      await fireEvent.scroll(log);
      height = 900;
      for (const callback of callbacks) callback([]);
      expect(log.scrollTop).toBe(0);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it('keeps the anchor message in place when older messages load before late measurements re-render', async () => {
    const observers: Array<{ callback: ResizeObserverCallback; targets: Element[] }> = [];
    const frames: FrameRequestCallback[] = [];
    const originalObserver = globalThis.ResizeObserver;
    const originalFrame = globalThis.requestAnimationFrame;
    globalThis.ResizeObserver = class {
      private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, targets: [] };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.push(target);
      }
      unobserve() {}
      disconnect() {
        this.entry.targets = [];
      }
    } as unknown as typeof ResizeObserver;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback);
    const flushFrames = () => {
      for (const callback of frames.splice(0)) callback(0);
    };
    const authors = [jordan, avery];
    const history = Array.from({ length: 60 }, (_, index) =>
      message(`h-${index}`, authors[index % 2], '2026-06-12T10:00:00.000Z', `Note ${index}`)
    );
    try {
      const view = render(MessageList, { props: { messages: history, virtualizeAfter: 20 } });
      const log = screen.getByRole('log');
      const canvas = log.firstElementChild as HTMLElement;
      // Layout stand-ins: the scroll height follows the rendered canvas, as in a browser.
      Object.defineProperty(log, 'clientHeight', { value: 360, configurable: true });
      Object.defineProperty(log, 'scrollHeight', {
        get: () => Number.parseFloat(canvas.style.blockSize || '0'),
        configurable: true,
      });
      const rowTop = (key: string) => {
        const row = log.querySelector<HTMLElement>(`[data-message-group="${key}"]`);
        return row ? Number.parseFloat(row.style.insetBlockStart) - log.scrollTop : undefined;
      };
      await tick();
      flushFrames();
      log.scrollTop = 1000;
      await fireEvent.scroll(log);
      // At an estimate of 112px per row, h-8 (896 to 1008) covers the top edge.
      const anchorKey = 'h-8-0';
      const anchorTop = rowTop(anchorKey);
      expect(anchorTop).toBeDefined();

      // Rows in view report their real (shorter) heights; their re-render waits for a frame.
      for (const { callback, targets } of observers) {
        for (const target of targets) {
          if (!target.hasAttribute('data-message-group')) continue;
          callback(
            [{ borderBoxSize: [{ blockSize: 60 }] } as unknown as ResizeObserverEntry],
            {} as ResizeObserver
          );
        }
      }
      // Older messages arrive before that frame.
      const older = Array.from({ length: 10 }, (_, index) =>
        message(`older-${index}`, avery, '2026-06-12T09:50:00.000Z', `Earlier ${index}`)
      );
      await view.rerender({ messages: [...older, ...history], virtualizeAfter: 20 });
      await tick();
      expect(rowTop(anchorKey)).toBe(anchorTop);

      // The pending frame re-renders the measured rows without moving the anchor.
      flushFrames();
      await tick();
      expect(rowTop(anchorKey)).toBe(anchorTop);
    } finally {
      globalThis.ResizeObserver = originalObserver;
      globalThis.requestAnimationFrame = originalFrame;
    }
  });

  it('virtualizes long histories and preserves keyboard focus on the scroll region', async () => {
    const messages = Array.from({ length: 400 }, (_, index) =>
      message(`message-${index}`, jordan, '2026-06-12T10:00:00.000Z', `Note ${index}`)
    );
    render(MessageList, { props: { messages, virtualizeAfter: 20 } });
    const log = screen.getByRole('log');
    expect(log.getAttribute('data-virtualized')).toBe('true');
    expect(log.querySelectorAll('[data-message-group]').length).toBeLessThan(30);
    await fireEvent.scroll(log, { target: { scrollTop: 5000 } });
    expect(log.querySelectorAll('[data-message-group]').length).toBeLessThan(30);
  });
});

describe('ChatThread', () => {
  it('composes the message log, typing status, and async composer callback', async () => {
    let sent: string | undefined;
    render(ChatThread, {
      props: {
        messages: [message('one')],
        typing: ['Avery'],
        onSend: async (body: string) => {
          sent = body;
        },
      },
    });
    expect(screen.getByRole('log')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Avery is typing');
    const field = screen.getByRole('textbox', { name: 'Message' });
    await fireEvent.input(field, { target: { value: 'A reply' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(sent).toBe('A reply');
    expect((field as HTMLTextAreaElement).value).toBe('');
  });
});

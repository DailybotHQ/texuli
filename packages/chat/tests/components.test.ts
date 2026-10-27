import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Composer from '../src/composer/Composer.svelte';
import { applyChatStreamEvent, ChatMessageDisplay, MessageList } from '../src/index.ts';
import { type ChatMessage } from '../src/thread/types.ts';

// Chat components: hostile text renders as text, the live log announces a
// streamed message once, scroll anchoring, and composer send rules.

describe('thread', () => {
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
  });
});

describe('stream', () => {
  const agent = { id: 'agent', name: 'Fictional Agent' };
  const at = '2026-10-24T10:00:00.000Z';

  function streamed(...events: unknown[]): ChatMessage[] {
    return events.reduce<ChatMessage[]>((list, event) => applyChatStreamEvent(list, event), []);
  }

  describe('MessageList streaming view', () => {
    it('hides partial text from the live log and marks the message busy', () => {
      const { container } = render(MessageList, {
        props: {
          messages: [{ id: 'r1', author: agent, at, body: 'Weekly **sum', streaming: true }],
        },
      });
      const bubble = container.querySelector('[data-streaming]');
      expect(bubble?.getAttribute('aria-busy')).toBe('true');
      expect(bubble?.textContent).toContain('Writing a reply…');
      const visible = bubble?.querySelector('[aria-hidden="true"]');
      expect(visible?.textContent).toBe('Weekly **sum');
      expect(bubble?.querySelector('.tx-chat-message__caret')).toBeTruthy();
    });

    it('replaces the streaming node with the finished message so it is announced once', async () => {
      const writing = streamed(
        { type: 'start', id: 'r1', author: agent, at },
        { type: 'delta', id: 'r1', text: 'All **done**' }
      );
      const view = render(MessageList, { props: { messages: writing } });
      const before = view.container.querySelector('[data-streaming]');
      expect(before).toBeTruthy();

      await view.rerender({ messages: applyChatStreamEvent(writing, { type: 'end', id: 'r1' }) });
      expect(view.container.querySelector('[data-streaming]')).toBeNull();
      expect(before?.isConnected).toBe(false);
      const strong = screen.getByText('done');
      expect(strong.tagName).toBe('STRONG');
      expect(strong.closest('[aria-hidden="true"]')).toBeNull();
    });
  });
});

describe('inline-tokens', () => {
  const avery = { id: 'avery', name: 'Avery Chen' };

  function message(body: string, id = 'm1'): ChatMessage {
    return { id, author: avery, at: '2026-10-24T10:00:00.000Z', body };
  }

  describe('G21 inline nodes', () => {
    it('paints the nodes as text with stable hooks, highlighting a mention of the reader', () => {
      const { container } = render(MessageList, {
        props: {
          currentUserId: 'jordan',
          locale: 'en-US',
          messages: [
            message(
              '@[Jordan Lee](mention:jordan) @[Sam](mention:sam) [[date:2026-10-24T15:00:00Z]] [[status:danger|Blocked]]'
            ),
          ],
        },
      });
      const mentions = container.querySelectorAll('.tx-chat-mention');
      expect(mentions).toHaveLength(2);
      expect(mentions[0]?.textContent).toBe('@Jordan Lee');
      expect(mentions[0]?.hasAttribute('data-self')).toBe(true);
      expect(mentions[1]?.hasAttribute('data-self')).toBe(false);
      expect(container.querySelector('time.tx-chat-date')?.getAttribute('datetime')).toBe(
        '2026-10-24T15:00:00.000Z'
      );
      const chip = container.querySelector('.tx-chat-status-chip');
      expect(chip?.getAttribute('data-tone')).toBe('danger');
      expect(chip?.textContent).toBe('Blocked');
    });
  });
});

describe('display', () => {
  describe('chat display components (G10)', () => {
    it('never interprets HTML or unsafe links in the text', () => {
      const { container } = render(ChatMessageDisplay, {
        props: {
          author: 'Sam',
          role: 'user',
          text: '<img src=x onerror=alert(1)> [x](javascript:alert(1))',
          at: 'not a date',
        },
      });
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('a')).toBeNull();
      expect(container.querySelector('time')).toBeNull();
      expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });
  });
});

describe('composer', () => {
  afterEach(cleanup);

  describe('Composer', () => {
    it('sends on Enter, preserves Shift+Enter, and ignores IME confirmation', async () => {
      const onSubmit = vi.fn();
      render(Composer, { props: { onSubmit } });
      const field = screen.getByRole('textbox', { name: 'Message' });
      Object.defineProperty(field, 'scrollHeight', { configurable: true, get: () => 500 });
      await fireEvent.input(field, { target: { value: '  Hello  ' } });
      expect((field as HTMLTextAreaElement).style.blockSize).toBe('160px');
      await fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
      await fireEvent.compositionStart(field);
      await fireEvent.keyDown(field, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
      await fireEvent.compositionEnd(field);
      await fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
      expect(onSubmit).not.toHaveBeenCalled();
      await fireEvent.keyDown(field, { key: 'Enter' });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Hello'));
      expect((field as HTMLTextAreaElement).value).toBe('');
    });

    it('keeps the draft after rejection and announces a localized failure', async () => {
      const failed = vi.fn().mockRejectedValue(new Error('private backend detail'));
      render(Composer, {
        props: {
          onSubmit: failed,
          labels: { sendError: 'Could not send this note.' },
        },
      });
      const field = screen.getByRole('textbox', { name: 'Message' });
      await fireEvent.input(field, { target: { value: 'Keep this draft' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Could not send this note.');
      expect(screen.getByRole('alert').textContent).not.toContain('private backend detail');
      expect((field as HTMLTextAreaElement).value).toBe('Keep this draft');
    });
  });
});

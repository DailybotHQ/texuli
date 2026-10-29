import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Composer from '../src/composer/Composer.svelte';
import { applyChatStreamEvent, ChatMessageDisplay, MessageList } from '../src/index.ts';
import { type ChatMessage, type ChatMessageActions } from '../src/thread/types.ts';

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

describe('message-actions', () => {
  afterEach(cleanup);
  const avery = { id: 'avery', name: 'Avery Chen' };
  const agent = { id: 'agent', name: 'Fictional Agent' };
  const at = '2026-10-24T10:00:00.000Z';

  // An actions snippet with one Edit button per message (G33).
  const editActions = createRawSnippet(
    (message: () => ChatMessage, actions: () => ChatMessageActions) => ({
      render: () => `<button type="button">Edit ${message().id}</button>`,
      setup(node: Element) {
        node.addEventListener('click', () => actions().edit());
      },
    })
  );

  describe('G33 per-message actions and inline edit', () => {
    it('renders actions per finished message, edits inline with keyboard save/cancel and restores focus', async () => {
      const onEdit = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(undefined);
      render(MessageList, {
        props: {
          currentUserId: 'avery',
          actions: editActions,
          onEdit,
          messages: [
            { id: 'm1', author: avery, at, body: 'First draft' },
            { id: 'r1', author: agent, at, body: 'Writing', streaming: true },
          ],
        },
      });
      expect(screen.getByRole('button', { name: 'Edit m1' })).toBeTruthy();
      // No actions while a reply is still streaming.
      expect(screen.queryByRole('button', { name: 'Edit r1' })).toBeNull();

      for (const [key, expected] of [
        ['Escape', 0],
        ['Enter', 1],
      ] as const) {
        const trigger = screen.getByRole('button', { name: 'Edit m1' });
        trigger.focus();
        await fireEvent.click(trigger);
        const field = screen.getByRole('textbox', { name: 'Edit message' }) as HTMLTextAreaElement;
        expect(document.activeElement).toBe(field);
        expect(field.value).toBe('First draft');
        await fireEvent.input(field, { target: { value: ' Final draft ' } });
        await fireEvent.keyDown(field, { key });
        await tick();
        expect(onEdit).toHaveBeenCalledTimes(expected);
      }
      // The host returned false: the editor stays open with the draft.
      expect(onEdit).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm1' }), 'Final draft');
      expect(screen.getByRole('textbox', { name: 'Edit message' })).toBeTruthy();
      await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(screen.queryByRole('textbox', { name: 'Edit message' })).toBeNull()
      );
      expect(onEdit).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit m1' }));
    });
  });

  describe('G33 streaming scroll anchor and jump to latest', () => {
    it('follows a streaming reply at the bottom, stays put once the reader scrolls up, and offers a jump to latest', async () => {
      const original = globalThis.ResizeObserver;
      // Inert observers: the list must follow the stream on its own.
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
      try {
        const start = [{ id: 'r1', author: agent, at, body: 'One', streaming: true }];
        const view = render(MessageList, { props: { messages: start } });
        const log = screen.getByRole('log');
        // Layout stand-in: the content height follows the rendered text.
        Object.defineProperty(log, 'clientHeight', { value: 200, configurable: true });
        Object.defineProperty(log, 'scrollHeight', {
          get: () => 200 + (log.firstElementChild?.textContent?.length ?? 0) * 10,
          configurable: true,
        });
        await tick();
        log.scrollTop = log.scrollHeight;
        await fireEvent.scroll(log);
        let messages = applyChatStreamEvent(start, {
          type: 'delta',
          id: 'r1',
          text: ' two three four five six',
        });
        await view.rerender({ messages });
        await tick();
        expect(log.scrollTop).toBe(log.scrollHeight);
        expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();

        // The reader scrolls up: more text does not move the view.
        log.scrollTop = 0;
        await fireEvent.scroll(log);
        messages = applyChatStreamEvent(messages, {
          type: 'delta',
          id: 'r1',
          text: ' seven eight nine ten',
        });
        await view.rerender({ messages });
        await tick();
        expect(log.scrollTop).toBe(0);
        const status = screen.getByRole('status');
        expect(status.textContent).toBe('');
        messages = [...messages, { id: 'm2', author: avery, at, body: 'Another message' }];
        await view.rerender({ messages });
        await tick();
        expect(log.scrollTop).toBe(0);
        expect(status.textContent).toBe('New messages below');

        await fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
        await tick();
        expect(log.scrollTop).toBe(log.scrollHeight);
        expect(document.activeElement).toBe(log);
        expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
        expect(status.textContent).toBe('');
      } finally {
        globalThis.ResizeObserver = original;
      }
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

  describe('G32 streaming stop, keydown hook and actions', () => {
    it('swaps send for a named Stop control while streaming; the button and Escape stop and keep focus in the field', async () => {
      const onSubmit = vi.fn();
      const onStop = vi.fn();
      const view = render(Composer, {
        props: { onSubmit, onStop, streaming: true, value: 'Next' },
      });
      const field = screen.getByRole('textbox', { name: 'Message' });
      expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
      const stop = screen.getByRole('button', { name: 'Stop generating' });
      expect(stop.getAttribute('aria-keyshortcuts')).toBe('Escape');
      // Enter does not send over a running reply.
      await fireEvent.keyDown(field, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
      for (const press of [
        () => fireEvent.click(stop),
        () => fireEvent.keyDown(field, { key: 'Escape' }),
      ]) {
        stop.focus();
        await press();
        expect(document.activeElement).toBe(field);
      }
      expect(onStop).toHaveBeenCalledTimes(2);
      await view.rerender({ streaming: false });
      expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy();
      await fireEvent.keyDown(field, { key: 'Escape' });
      expect(onStop).toHaveBeenCalledTimes(2);
    });

    it('runs the onkeydown hook first: preventDefault takes a key over, otherwise Enter still sends', async () => {
      const onSubmit = vi.fn();
      const seen: string[] = [];
      const onkeydown = vi.fn((event: KeyboardEvent) => {
        seen.push(event.key);
        if (event.key === 'Enter' && event.altKey) event.preventDefault();
      });
      render(Composer, { props: { onSubmit, onkeydown, value: 'Hello' } });
      const field = screen.getByRole('textbox', { name: 'Message' });
      await fireEvent.keyDown(field, { key: 'Enter', altKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
      await fireEvent.keyDown(field, { key: 'Enter' });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Hello'));
      expect(seen).toEqual(['Enter', 'Enter']);
    });

    it('renders the actions snippet beside the send control with the composer state and commands', async () => {
      const onSubmit = vi.fn();
      const actions = createRawSnippet(
        (context: () => { canSend: boolean; submit: () => Promise<void> }) => ({
          render: () =>
            `<button type="button" data-can-send="${context().canSend}">Custom send</button>`,
          setup(node: Element) {
            node.addEventListener('click', () => void context().submit());
          },
        })
      );
      render(Composer, { props: { onSubmit, actions, value: 'From actions' } });
      const custom = screen.getByRole('button', { name: 'Custom send' });
      expect(custom.closest('.tx-chat-composer__end')?.textContent).toContain('Send message');
      expect(custom.getAttribute('data-can-send')).toBe('true');
      await fireEvent.click(custom);
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('From actions'));
    });
  });
});

import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { applyChatStreamEvent, ChatThread, MAX_STREAM_BODY, MessageList } from '../src/index.ts';
import type { ChatMessage } from '../src/thread/types.ts';

const agent = { id: 'agent', name: 'Fictional Agent' };
const at = '2026-10-24T10:00:00.000Z';

function streamed(...events: unknown[]): ChatMessage[] {
  return events.reduce<ChatMessage[]>((list, event) => applyChatStreamEvent(list, event), []);
}

describe('applyChatStreamEvent', () => {
  it('starts, grows and finishes a streamed message', () => {
    const writing = streamed(
      { type: 'start', id: 'r1', author: agent, at },
      { type: 'delta', id: 'r1', text: 'Weekly ' },
      { type: 'delta', id: 'r1', text: 'summary' }
    );
    expect(writing).toEqual([
      { id: 'r1', author: agent, at, body: 'Weekly summary', streaming: true },
    ]);

    const done = applyChatStreamEvent(writing, { type: 'end', id: 'r1', status: 'delivered' });
    expect(done[0]).toMatchObject({
      body: 'Weekly summary',
      streaming: false,
      status: 'delivered',
    });
    expect(writing[0]?.streaming).toBe(true);
  });

  it('lets the end event replace the streamed text with the final body', () => {
    const done = streamed(
      { type: 'start', id: 'r1', author: agent, at },
      { type: 'delta', id: 'r1', text: 'draf' },
      { type: 'end', id: 'r1', body: 'Final answer.' }
    );
    expect(done[0]?.body).toBe('Final answer.');
  });

  it('marks a stream that errors as failed', () => {
    const failed = streamed(
      { type: 'start', id: 'r1', author: agent, at },
      { type: 'error', id: 'r1' }
    );
    expect(failed[0]).toMatchObject({ streaming: false, status: 'failed' });
  });

  it('ignores malformed, duplicate and out-of-order events, keeping the same array', () => {
    const list = streamed({ type: 'start', id: 'r1', author: agent, at });
    for (const event of [
      null,
      'delta',
      { type: 'delta', id: 'missing', text: 'x' },
      { type: 'delta', id: 'r1', text: 42 },
      { type: 'start', id: 'r1', author: agent, at },
      { type: 'start', id: 'r2', author: { id: 1 }, at },
      { type: 'unknown', id: 'r1' },
    ]) {
      expect(applyChatStreamEvent(list, event)).toBe(list);
    }
    const ended = applyChatStreamEvent(list, { type: 'end', id: 'r1' });
    expect(applyChatStreamEvent(ended, { type: 'delta', id: 'r1', text: 'late' })).toBe(ended);
    expect(applyChatStreamEvent(ended, { type: 'end', id: 'r1', body: 'again' })).toBe(ended);
  });

  it('caps a streamed body', () => {
    const list = streamed(
      { type: 'start', id: 'r1', author: agent, at },
      { type: 'delta', id: 'r1', text: 'x'.repeat(MAX_STREAM_BODY - 2) },
      { type: 'delta', id: 'r1', text: 'abcdef' }
    );
    expect(list[0]?.body.length).toBe(MAX_STREAM_BODY);
    expect(applyChatStreamEvent(list, { type: 'delta', id: 'r1', text: 'more' })).toBe(list);
  });
});

describe('MessageList streaming view', () => {
  it('hides partial text from the live log and marks the message busy', () => {
    const { container } = render(MessageList, {
      props: { messages: [{ id: 'r1', author: agent, at, body: 'Weekly **sum', streaming: true }] },
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

  it('localizes the writing label and shows no status while streaming', () => {
    const { container } = render(ChatThread, {
      props: {
        currentUserId: 'agent',
        labels: { streaming: 'Escribiendo…' },
        messages: [
          { id: 'r1', author: agent, at, body: 'Hola', streaming: true, status: 'sending' },
        ],
      },
    });
    expect(container.querySelector('[data-streaming]')?.textContent).toContain('Escribiendo…');
    expect(container.querySelector('.tx-chat-message-group__status')).toBeNull();
  });
});

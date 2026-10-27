import { cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import displaySource from '../src/display/ChatMessageDisplay.svelte?raw';
import {
  applyChatStreamEvent,
  groupMessages,
  MAX_STREAM_BODY,
  parseMessageText,
} from '../src/index.ts';
import listSource from '../src/thread/MessageList.svelte?raw';
import { type ChatMessage } from '../src/thread/types.ts';
import { MessageVirtualWindow } from '../src/thread/virtual-window.ts';

// Chat logic: the stream reducer, grouping, safe text parsing, the virtual
// window and inline tokens, plus the logical (RTL) bubble-tail CSS.

describe('stream', () => {
  const agent = { id: 'agent', name: 'Fictional Agent' };
  const at = '2026-10-24T10:00:00.000Z';

  function streamed(...events: unknown[]): ChatMessage[] {
    return events.reduce<ChatMessage[]>((list, event) => applyChatStreamEvent(list, event), []);
  }

  describe('applyChatStreamEvent', () => {
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
});

describe('thread', () => {
  afterEach(cleanup);

  const jordan = { id: 'jordan', name: 'Jordan Lee' };

  function message(
    id: string,
    author = jordan,
    at = '2026-06-12T10:00:00.000Z',
    body = 'Hello'
  ): ChatMessage {
    return { id, author, at, body };
  }

  describe('groupMessages', () => {
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
});

describe('inline-tokens', () => {
  describe('G21 inline nodes', () => {
    it('keeps tokens that fail their check as literal text', () => {
      const cases = [
        '@[Jordan](mention:bad id)',
        '@[Jordan](mention:<script>)',
        '[[date:tomorrow]]',
        '[[date:2026-13-45]]',
        '[[status:purple|Odd]]',
        `[[status:info|${'x'.repeat(65)}]]`,
      ];
      for (const value of cases) {
        const parts = parseMessageText(value);
        expect(parts.every((part) => part.type === 'text')).toBe(true);
        expect(parts.map((part) => part.value).join('')).toBe(value);
      }
    });
  });
});

describe('rtl', () => {
  // The package ships its Svelte source, so the style block in the component
  // file is the shipped CSS. The bubble tail is direction-aware visual grammar:
  // it must sit on the message's inline-end so it flips under RTL. It is
  // therefore painted with logical border-radius properties, never a physical
  // four-corner shorthand that would keep the tail on one fixed side.
  function styleBlock(source: string): string {
    const open = source.indexOf('<style>');
    const close = source.indexOf('</style>', open);
    return open === -1 || close === -1 ? '' : source.slice(open + 7, close);
  }

  describe('logical bubble tails (RTL)', () => {
    it('points MessageList bubble tails with logical border-radius properties', () => {
      const css = styleBlock(listSource);
      expect(css).toContain('border-end-start-radius');
      expect(css).toContain('border-end-end-radius');
      expect(css).not.toContain('1rem 1rem 1rem 0.25rem');
      expect(css).not.toContain('1rem 1rem 0.25rem 1rem');
    });

    it('points display transcript bubble tails with logical border-radius properties', () => {
      const css = styleBlock(displaySource);
      expect(css).toContain('border-end-start-radius');
      expect(css).toContain('border-end-end-radius');
      expect(css).not.toContain('1rem 1rem 1rem 0.25rem');
      expect(css).not.toContain('1rem 1rem 0.25rem 1rem');
    });
  });
});

import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { ChatThread, MessageList, messageTokens, parseMessageText } from '../src/index.ts';
import type { ChatMessage } from '../src/thread/types.ts';

const avery = { id: 'avery', name: 'Avery Chen' };

function message(body: string, id = 'm1'): ChatMessage {
  return { id, author: avery, at: '2026-10-24T10:00:00.000Z', body };
}

describe('G21 inline nodes', () => {
  it('parses mentions, dates and status chips as closed node types', () => {
    expect(
      parseMessageText(
        'Hi @[Jordan Lee](mention:jordan), due [[date:2026-10-24T15:00:00Z]] [[status:success|Shipped]]'
      )
    ).toEqual([
      { type: 'text', value: 'Hi ' },
      { type: 'mention', value: 'Jordan Lee', id: 'jordan' },
      { type: 'text', value: ', due ' },
      { type: 'date', value: '2026-10-24T15:00:00Z', iso: '2026-10-24T15:00:00.000Z' },
      { type: 'text', value: ' ' },
      { type: 'status', value: 'Shipped', tone: 'success' },
    ]);
  });

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

  it('builds tokens a host composer can insert, and they read back as nodes', () => {
    const mention = messageTokens.mention('Jordan [Lee] (ops)', 'jordan');
    expect(mention).toBe('@[Jordan Lee ops](mention:jordan)');
    expect(parseMessageText(mention ?? '')).toEqual([
      { type: 'mention', value: 'Jordan Lee ops', id: 'jordan' },
    ]);
    expect(messageTokens.mention('Jordan', 'has space')).toBeNull();
    expect(messageTokens.mention('[]()', 'jordan')).toBeNull();

    const date = messageTokens.date(new Date('2026-10-24T15:00:00Z'));
    expect(parseMessageText(date ?? '')[0]).toMatchObject({ type: 'date' });
    expect(messageTokens.date('not a date')).toBeNull();

    const status = messageTokens.status('warning', 'At risk | late');
    expect(parseMessageText(status ?? '')).toEqual([
      { type: 'status', value: 'At risk  late', tone: 'warning' },
    ]);
  });

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

describe('ChatThread composer host chrome', () => {
  it('renders the host composer instead of the built-in one, outside the log', () => {
    const composer = createRawSnippet(() => ({
      render: () => '<div data-testid="host-composer">Host composer</div>',
    }));
    const { container } = render(ChatThread, {
      props: { messages: [message('Hello')], composer, onSend: () => {} },
    });
    const slot = container.querySelector('[data-tx-chat-composer="host"]');
    expect(slot?.contains(screen.getByTestId('host-composer'))).toBe(true);
    expect(screen.getByRole('log').contains(slot)).toBe(false);
    expect(container.querySelector('[data-tx-chat-composer="built-in"]')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('passes composer labels to the built-in composer', () => {
    render(ChatThread, {
      props: {
        messages: [],
        onSend: () => {},
        composerLabels: { input: 'Mensaje', placeholder: 'Escribe…' },
      },
    });
    const box = screen.getByRole('textbox', { name: 'Mensaje' });
    expect(box.getAttribute('placeholder')).toBe('Escribe…');
  });
});

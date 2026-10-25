import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  CHAT_DISPLAY_LOADERS,
  CHAT_DISPLAY_ROLES,
  ChatMessageDisplay,
  ChatThreadDisplay,
} from '../src/index.ts';

describe('chat display components (G10)', () => {
  it('renders a message as an article named by its author line', () => {
    const { container } = render(ChatMessageDisplay, {
      props: {
        author: 'Fictional Agent',
        role: 'agent',
        at: '2026-10-24T09:00:00Z',
        text: 'Two items are **blocked**. See [the board](https://example.com/board).',
      },
    });
    const article = screen.getByRole('article');
    expect(article.getAttribute('data-role')).toBe('agent');
    expect(article.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Agent')).toBeTruthy();
    expect(screen.getByText('blocked').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'the board' }).getAttribute('href')).toBe(
      'https://example.com/board'
    );
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-24T09:00:00.000Z'
    );
  });

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

  it('renders block children under the text', () => {
    const children = createRawSnippet(() => ({ render: () => '<p>Body block</p>' }));
    render(ChatMessageDisplay, { props: { author: 'A', role: 'system', children } });
    expect(screen.getByText('Body block').closest('article')).toBeTruthy();
  });

  it('labels the thread and has no composer or live region', () => {
    const children = createRawSnippet(() => ({ render: () => '<p>Message</p>' }));
    const { container } = render(ChatThreadDisplay, { props: { label: 'Stand-up', children } });
    expect(screen.getByRole('region', { name: 'Stand-up' })).toBeTruthy();
    expect(container.querySelector('[aria-live], textarea, form')).toBeNull();
  });

  it('offers player loaders for exactly the display ids', async () => {
    expect(Object.keys(CHAT_DISPLAY_LOADERS).sort()).toEqual(['chat-message', 'chat-thread']);
    expect(await CHAT_DISPLAY_LOADERS['chat-message']?.()).toBe(ChatMessageDisplay);
    expect(await CHAT_DISPLAY_LOADERS['chat-thread']?.()).toBe(ChatThreadDisplay);
    expect(CHAT_DISPLAY_ROLES).toEqual(['user', 'agent', 'system']);
  });
});

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('chat display example', () => {
  it('renders all roles, distinguishes mention text, and keeps hostile markup inert', async () => {
    const entry = getExample('chat-display');
    expect(entry?.component).toBe('chat/ChatThreadDisplay');
    const loaded = await entry?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Chat display example did not load.');

    const { container } = render(loaded.default);
    expect(container.querySelectorAll('[data-tx-chat-display-message]')).toHaveLength(3);
    expect(container.querySelector('[data-role="system"]')).not.toBeNull();
    expect(container.querySelectorAll('.tx-chat-mention')).toHaveLength(2);
    expect(container.textContent).toContain('@not-a-known-person.');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

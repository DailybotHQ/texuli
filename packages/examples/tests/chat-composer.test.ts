import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('chat composer example', () => {
  it('registers, loads, and renders its accessible example controls', async () => {
    const entry = getExample('chat-composer');
    expect(entry?.component).toBe('chat/composer');
    const loaded = await entry?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Chat composer example did not load.');
    const { container } = render(loaded.default);
    expect(container.querySelector('textarea[aria-describedby]')).not.toBeNull();
    expect(container.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
      'Jordan is typing'
    );
    await waitFor(() =>
      expect(container.querySelector('button[aria-label="Attach a file"]')).not.toBeNull()
    );
  });
});

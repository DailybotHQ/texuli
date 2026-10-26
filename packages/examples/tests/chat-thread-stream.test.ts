import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('chat thread streaming example', () => {
  it('applies a simulated start, delta, and end sequence', async () => {
    const loaded = await getExample('chat-thread')?.load();
    expect(loaded).toBeDefined();
    if (!loaded) throw new Error('Chat thread example did not load.');

    const { getByRole, getByText } = render(loaded.default);
    await fireEvent.click(getByRole('button', { name: 'Simulate a streamed reply' }));
    await waitFor(() => expect(getByText('Streamed reply: review is complete.')).toBeTruthy());
  });
});

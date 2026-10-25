import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Composer from '../src/composer/Composer.svelte';
import TypingIndicator from '../src/composer/TypingIndicator.svelte';

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

  it('blocks duplicate sends while pending', async () => {
    let finish: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(Composer, { props: { onSubmit } });
    const field = screen.getByRole('textbox', { name: 'Message' });
    await fireEvent.input(field, { target: { value: 'Hello' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    expect(
      (screen.getByRole('button', { name: /Sending message/ }) as HTMLButtonElement).disabled
    ).toBe(true);
    await fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish?.();
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(''));
  });
});

describe('TypingIndicator', () => {
  it('announces a translated label and stays quiet when no one is typing', async () => {
    const { rerender } = render(TypingIndicator, {
      props: { names: ['Alex'], labels: { one: (name: string) => `${name} is composing` } },
    });
    expect(screen.getByRole('status').textContent).toContain('Alex is composing');
    await rerender({ names: [] });
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

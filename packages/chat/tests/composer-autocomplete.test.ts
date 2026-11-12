/**
 * Composer autocomplete, streaming stop state and the attachment card (PLAN_023 T-cmp-chat):
 * keyboard, screen-reader names, and never painting a refused attachment.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyChatStreamEvent,
  ChatAttachment,
  Composer,
  commandSuggestions,
  MessageList,
  mentionSuggestions,
  parseMessageText,
  runAttachmentCheck,
} from '../src/index.ts';

afterEach(cleanup);

const PEOPLE = [
  { id: 'jordan', name: 'Jordan Lee', description: 'Support lead' },
  { id: 'avery', name: 'Avery Chen' },
];
const COMMANDS = [{ name: 'summarize', description: 'Summarize the thread' }, { name: 'status' }];

async function type(field: HTMLTextAreaElement, text: string) {
  field.value = text;
  field.setSelectionRange(text.length, text.length);
  await fireEvent.input(field);
}

describe('composer autocomplete', () => {
  it('opens a named listbox for @, moves with arrows and inserts the mention token with Enter', async () => {
    const onSubmit = vi.fn();
    render(Composer, { props: { onSubmit, suggestions: [mentionSuggestions(PEOPLE)] } });
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    await type(field, 'Ask @');
    const list = await screen.findByRole('listbox', { name: 'People' });
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'J Jordan Lee Support lead',
      'A Avery Chen',
    ]);
    expect(field.getAttribute('aria-controls')).toBe(list.id);
    expect(field.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(document.querySelector('[data-tx-chat-suggestions-status]')?.textContent).toContain(
      '2 suggestions'
    );
    await fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(field.value).toBe('Ask @[Avery Chen](mention:avery) '));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(parseMessageText(field.value.trim()).at(-1)).toEqual({
      type: 'mention',
      value: 'Avery Chen',
      id: 'avery',
    });
  });

  it('filters by the query, closes with Escape and stays closed for that trigger', async () => {
    render(Composer, { props: { onSubmit: vi.fn(), suggestions: [mentionSuggestions(PEOPLE)] } });
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await type(field, '@av');
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    await type(field, '@ave');
    expect(screen.queryByRole('listbox')).toBeNull();
    await type(field, '');
    await type(field, '@');
    expect(await screen.findByRole('listbox')).toBeTruthy();
  });

  it('offers slash commands only at the start of a line, and inserts with a click', async () => {
    render(Composer, { props: { onSubmit: vi.fn(), suggestions: [commandSuggestions(COMMANDS)] } });
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await type(field, 'see /su');
    expect(screen.queryByRole('listbox')).toBeNull();
    await type(field, '/su');
    const option = await screen.findByRole('option', { name: /summarize/ });
    await fireEvent.click(option);
    await waitFor(() => expect(field.value).toBe('/summarize '));
  });

  it('sends with Enter when no list is open', async () => {
    const onSubmit = vi.fn();
    render(Composer, { props: { onSubmit, suggestions: [mentionSuggestions(PEOPLE)] } });
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await type(field, 'Hello team');
    await fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Hello team'));
  });
});

describe('streaming stop', () => {
  it('keeps the partial text of a stopped reply and labels it', () => {
    const agent = { id: 'agent', name: 'Fictional Agent' };
    let messages = applyChatStreamEvent([], {
      type: 'start',
      id: 'r',
      author: agent,
      at: '2026-11-12T10:00:00.000Z',
    });
    messages = applyChatStreamEvent(messages, { type: 'delta', id: 'r', text: 'Half an answer' });
    messages = applyChatStreamEvent(messages, { type: 'end', id: 'r', stopped: true });
    expect(messages[0]).toMatchObject({ body: 'Half an answer', streaming: false, stopped: true });
    render(MessageList, { props: { messages } });
    expect(screen.getByText('Half an answer')).toBeTruthy();
    expect(screen.getByText('Stopped before the end')).toBeTruthy();
  });

  it('renders plain-text runs through the text seam', () => {
    const text = createRawSnippet((value: () => string) => ({
      render: () => `<span data-run>${value().toUpperCase()}</span>`,
    }));
    render(MessageList, {
      props: {
        messages: [{ id: 'm', author: { id: 'a', name: 'Ana' }, at: 0, body: 'hi **there**' }],
        text,
      },
    });
    expect(document.querySelector('[data-run]')?.textContent).toBe('HI ');
  });
});

describe('attachment card', () => {
  const blueprint = { id: 'layout-doc', props: { title: 'Fictional report' } };
  const preview = createRawSnippet((value: () => unknown) => ({
    render: () => `<p data-painted>${String((value() as { id: string }).id)}</p>`,
  }));

  it('is a figure named by its title, with a disclosure that paints the validated value', async () => {
    render(ChatAttachment, {
      props: {
        artifact: blueprint,
        title: 'Weekly report',
        check: (artifact: unknown) => ({ ok: true as const, value: artifact, summary: '1 node' }),
        preview,
      },
    });
    const figure = screen.getByRole('figure', { name: 'Weekly report' });
    const toggle = screen.getByRole('button', { name: 'Show preview' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(figure.querySelector('[data-painted]')).toBeNull();
    await fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide preview' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    expect(figure.querySelector('[data-painted]')?.textContent).toBe('layout-doc');
  });

  it('never paints a refused artifact and lists why', () => {
    const paint = vi.fn();
    const spy = createRawSnippet(() => {
      paint();
      return { render: () => '<p data-painted></p>' };
    });
    render(ChatAttachment, {
      props: {
        artifact: { id: 'unknown-widget' },
        check: () => ({ ok: false as const, reasons: ['Unknown component "unknown-widget".'] }),
        preview: spy,
      },
    });
    expect(screen.getByRole('figure', { name: 'Blueprint attachment' }).dataset.state).toBe(
      'refused'
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Unknown component "unknown-widget".')).toBeTruthy();
    expect(paint).not.toHaveBeenCalled();
  });

  it('reads a throwing or malformed check as refused, capping the reasons', () => {
    const labels = { checkFailed: 'Could not check.' };
    expect(
      runAttachmentCheck(
        () => {
          throw new Error('x');
        },
        {},
        labels
      )
    ).toEqual({ ok: false, reasons: ['Could not check.'] });
    expect(runAttachmentCheck(() => null as never, {}, labels)).toEqual({
      ok: false,
      reasons: ['Could not check.'],
    });
    const many = runAttachmentCheck(
      () => ({ ok: false, reasons: Array.from({ length: 9 }, () => 'r'.repeat(500)) }),
      {},
      labels
    );
    expect(many.ok === false && [many.reasons.length, many.reasons[0]?.length]).toEqual([5, 200]);
  });
});

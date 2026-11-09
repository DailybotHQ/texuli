/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Input from '../src/components/input/Input.svelte';
import Textarea from '../src/components/input/Textarea.svelte';
import CommitNumberField from './fixtures/CommitNumberField.svelte';

// T-protoyard-round4 part B: plain Input and Textarea on the type scale, and
// NumberField commit modes.

const fieldCss = readFileSync(
  join(import.meta.dirname, '../src/components/input/field.css'),
  'utf8'
);

afterEach(() => cleanup());

describe('Input and Textarea appearance and size', () => {
  it('defaults to the bordered control at the control size', () => {
    render(Input, { props: { 'aria-label': 'Name' } });
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.dataset.txVariant).toBe('default');
    expect(input.dataset.txSize).toBe('control');
    expect(input.classList.contains('tx-field--plain')).toBe(false);
  });

  it('renders a plain Input with a type-scale size and keeps its label', () => {
    render(Input, {
      props: { appearance: 'plain', textSize: 'xl', 'aria-label': 'Title', 'aria-invalid': 'true' },
    });
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input.dataset.txVariant).toBe('plain');
    expect(input.dataset.txSize).toBe('xl');
    expect(input.dataset.txComponent).toBe('input');
    expect(input.classList.contains('tx-field--plain')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the native size attribute (character width) apart from textSize', () => {
    render(Input, { props: { size: 20, textSize: 'lg', 'aria-label': 'Code' } });
    const input = screen.getByRole('textbox', { name: 'Code' });
    expect(input.getAttribute('size')).toBe('20');
    expect(input.dataset.txSize).toBe('lg');
  });

  it('puts the attributes on the clearable group root', () => {
    render(Input, {
      props: { appearance: 'plain', textSize: 'lg', clearable: true, 'aria-label': 'Heading' },
    });
    const group = screen.getByRole('textbox', { name: 'Heading' }).closest('.tx-input-group');
    expect(group?.getAttribute('data-tx-variant')).toBe('plain');
    expect(group?.getAttribute('data-tx-size')).toBe('lg');
    expect(group?.classList.contains('tx-input-group--plain')).toBe(true);
  });

  it('renders a plain Textarea body and falls back on hostile values', async () => {
    render(Textarea, { props: { appearance: 'plain', textSize: 'md', 'aria-label': 'Body' } });
    const body = screen.getByRole('textbox', { name: 'Body' });
    expect(body.tagName).toBe('TEXTAREA');
    expect(body.dataset.txVariant).toBe('plain');
    expect(body.dataset.txSize).toBe('md');
    cleanup();
    render(Textarea, {
      props: { appearance: 'neon' as never, textSize: 'huge' as never, 'aria-label': 'Notes' },
    });
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    expect(notes.dataset.txVariant).toBe('default');
    expect(notes.dataset.txSize).toBe('control');
  });

  it('keeps focus visible on plain fields and reads the type roles', () => {
    expect(fieldCss).toMatch(
      /\.tx-field\.tx-field--plain:focus-visible,[\s\S]*?outline: var\(--tx-focus-ring-width, 2px\) solid var\(--tx-ring, Highlight\)/
    );
    expect(fieldCss).toContain('--tx-field-type-size: var(--tx-type-title-size)');
    expect(fieldCss).toContain('--tx-field-type-size: var(--tx-type-heading-size)');
    expect(fieldCss).toContain('--tx-field-type-size: var(--tx-type-body-size)');
    // Size rules key on a named size, never on a missing attribute.
    expect(fieldCss).toContain('.tx-field[data-tx-size]:not([data-tx-size="control"])');
  });
});

describe('NumberField commit modes', () => {
  async function setup(commit?: 'input' | 'blur' | 'enter') {
    const onValueChange = vi.fn();
    render(CommitNumberField, { props: { commit, onValueChange } });
    const input = screen.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement;
    input.focus();
    return { input, onValueChange, bound: () => screen.getByTestId('bound').textContent };
  }

  async function type(input: HTMLInputElement, text: string) {
    for (let index = 1; index <= text.length; index += 1) {
      await fireEvent.input(input, { target: { value: text.slice(0, index) } });
    }
    await tick();
  }

  it('enter (default): commits on Enter and on blur, not per keystroke', async () => {
    const { input, onValueChange, bound } = await setup();
    await type(input, '42');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(bound()).toBe('1');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenLastCalledWith(42);
    expect(bound()).toBe('42');
    await type(input, '7');
    await fireEvent.blur(input);
    expect(onValueChange).toHaveBeenLastCalledWith(7);
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('input: fires per keystroke and keeps the typed text', async () => {
    const { input, onValueChange, bound } = await setup('input');
    await type(input, '123');
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([12, 123]);
    expect(bound()).toBe('123');
    expect(input.value).toBe('123');
    await fireEvent.input(input, { target: { value: '' } });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    await fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it('blur: ignores keystrokes and Enter, commits on blur', async () => {
    const { input, onValueChange, bound } = await setup('blur');
    await type(input, '42');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(bound()).toBe('1');
    await fireEvent.blur(input);
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenLastCalledWith(42);
    expect(bound()).toBe('42');
  });

  it('steppers commit at once in every mode', async () => {
    for (const commit of ['input', 'blur', 'enter'] as const) {
      const { onValueChange } = await setup(commit);
      await fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
      expect(onValueChange, commit).toHaveBeenLastCalledWith(2);
      cleanup();
    }
  });
});

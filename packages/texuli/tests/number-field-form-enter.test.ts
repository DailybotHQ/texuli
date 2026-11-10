import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import FormCommitNumberField from './fixtures/FormCommitNumberField.svelte';

afterEach(() => cleanup());

it('commits a blur-mode draft on Enter before its owning form serializes FormData', async () => {
  const form = document.createElement('form');
  document.body.append(form);
  render(FormCommitNumberField, { target: form });
  await tick();

  const input = screen.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement;
  await fireEvent.input(input, { target: { value: '5' } });
  expect(new FormData(form).get('qty')).toBe('1');

  await fireEvent.keyDown(input, { key: 'Enter' });
  await fireEvent.submit(form);

  expect(new FormData(form).get('qty')).toBe('5');
});

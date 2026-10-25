import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptsValue,
  clampLength,
  pastedValue,
  pinCells,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from '../src/pin-input/index.ts';
import Fixture from './pin-input-fixture.svelte';

afterEach(() => {
  document.body.replaceChildren();
});

const digits = { maxlength: 6, pattern: REGEXP_ONLY_DIGITS };

describe('pin input rules', () => {
  it('accepts values within the length that match the whole pattern', () => {
    expect(acceptsValue('', digits)).toBe(true);
    expect(acceptsValue('123456', digits)).toBe(true);
    expect(acceptsValue('1234567', digits)).toBe(false);
    expect(acceptsValue('12a', digits)).toBe(false);
    expect(acceptsValue('ab', { maxlength: 4, pattern: REGEXP_ONLY_CHARS })).toBe(true);
    expect(acceptsValue('a1', { maxlength: 4, pattern: REGEXP_ONLY_DIGITS_AND_CHARS })).toBe(true);
    expect(acceptsValue('anything!', { maxlength: 10 })).toBe(true);
    // An invalid pattern refuses rather than allowing everything.
    expect(acceptsValue('1', { maxlength: 4, pattern: '(' })).toBe(false);
    expect([clampLength(0), clampLength(99), clampLength(4.7), clampLength(Number.NaN)]).toEqual([
      1, 32, 4, 6,
    ]);
  });

  it('cleans a paste, replaces the selection, cuts to the length, and refuses what does not fit the pattern', () => {
    expect(pastedValue('', '123 456', { start: 0, end: 0 }, digits)).toBe('123456');
    expect(pastedValue('', ' 12 34 56 78 ', { start: 0, end: 0 }, digits)).toBe('123456');
    expect(pastedValue('129', '45', { start: 2, end: 3 }, digits)).toBe('1245');
    expect(pastedValue('', 'code: 123456', { start: 0, end: 0 }, digits)).toBeNull();
    expect(pastedValue('', '   ', { start: 0, end: 0 }, digits)).toBeNull();
    expect(
      pastedValue('', 'G-123456', { start: 0, end: 0 }, digits, (text) => text.replace(/^G-/, ''))
    ).toBe('123456');
    expect(
      pastedValue('', 'x', { start: 0, end: 0 }, digits, () => {
        throw new Error('bad');
      })
    ).toBeNull();
  });

  it('describes each cell: the active one, the caret, the selection and masking', () => {
    const rules = { maxlength: 4 };
    expect(pinCells('12', rules, null).map((c) => [c.char, c.isActive])).toEqual([
      ['1', false],
      ['2', false],
      [null, false],
      [null, false],
    ]);
    const focused = pinCells('12', rules, { start: 2, end: 2 });
    expect(focused.map((c) => c.isActive)).toEqual([false, false, true, false]);
    expect(focused[2]?.hasFakeCaret).toBe(true);
    // Full: the last cell stays active.
    expect(pinCells('1234', rules, { start: 4, end: 4 }).map((c) => c.isActive)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(pinCells('1234', rules, { start: 1, end: 3 }).map((c) => c.isActive)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(pinCells('12', { ...rules, mask: true }, null).map((c) => c.char)).toEqual([
      '•',
      '•',
      null,
      null,
    ]);
  });
});

describe('PinInput', () => {
  const input = () =>
    screen.getByRole('textbox', { name: 'Verification code' }) as HTMLInputElement;
  const type = async (text: string) => {
    const field = input();
    field.value = text;
    await fireEvent.input(field);
  };

  it('is one named text input for one-time codes, drawn as hidden cells', () => {
    render(Fixture);
    const field = input();
    expect(field.getAttribute('autocomplete')).toBe('one-time-code');
    expect(field.getAttribute('inputmode')).toBe('numeric');
    expect(field.getAttribute('maxlength')).toBe('6');
    expect(field.getAttribute('name')).toBe('code');
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`cell-${i}`).getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.getByTestId('last-cell').getAttribute('aria-hidden')).toBe('true');
  });

  it('takes allowed characters and refuses others, keeping the code', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    await type('12');
    expect(screen.getByTestId('value').textContent).toBe('12');
    expect(screen.getByTestId('cell-1').textContent).toBe('2');
    expect(screen.getByTestId('cell-1').getAttribute('data-state')).toBe('filled');
    expect(screen.getByTestId('cell-2').getAttribute('data-state')).toBe('empty');
    await type('12a');
    expect(input().value).toBe('12');
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(['12']);
  });

  it('reports completion once, when the last cell is filled', async () => {
    const onComplete = vi.fn();
    render(Fixture, { props: { onComplete } });
    await type('12345');
    expect(onComplete).not.toHaveBeenCalled();
    await type('123456');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
    // The same code again (an input event with no change) does not report it twice.
    await type('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(input().getAttribute('data-state')).toBe('complete');
    await type('12345');
    expect(input().getAttribute('data-state')).toBe('incomplete');
  });

  it('pastes a spaced code into the cells and completes it', async () => {
    const onComplete = vi.fn();
    render(Fixture, { props: { onComplete } });
    input().focus();
    await fireEvent.paste(input(), { clipboardData: { getData: () => '123 456' } });
    expect(input().value).toBe('123456');
    expect(screen.getByTestId('last-cell').textContent).toBe('6');
    expect(onComplete).toHaveBeenCalledWith('123456');
    await type('');
    await fireEvent.paste(input(), { clipboardData: { getData: () => 'abc' } });
    expect(input().value).toBe('');
  });

  it('marks the active cell while focused', async () => {
    render(Fixture);
    await type('12');
    input().focus();
    await fireEvent.focus(input());
    expect(screen.getByTestId('cell-2').hasAttribute('data-active')).toBe(true);
    expect(screen.getByTestId('cell-2').hasAttribute('data-fake-caret')).toBe(true);
    expect(screen.getByTestId('cell-1').hasAttribute('data-active')).toBe(false);
    await fireEvent.blur(input());
    expect(screen.getByTestId('cell-2').hasAttribute('data-active')).toBe(false);
  });

  it('masks the code in the cells and from assistive tech', async () => {
    render(Fixture, { props: { mask: true } });
    const field = document.querySelector('input') as HTMLInputElement;
    expect(field.type).toBe('password');
    field.value = '42';
    await fireEvent.input(field);
    expect(screen.getByTestId('cell-0').textContent).toBe('•');
    expect(screen.getByTestId('cell-1').textContent).toBe('•');
  });

  it('follows a controlled value and can be disabled', async () => {
    const view = render(Fixture, { props: { value: '98' } });
    expect(input().value).toBe('98');
    await view.rerender({ value: '987654', disabled: true });
    expect(input().value).toBe('987654');
    expect(input().disabled).toBe(true);
    expect(document.querySelector('[data-pin-input-root]')?.getAttribute('data-state')).toBe(
      'complete'
    );
  });
});

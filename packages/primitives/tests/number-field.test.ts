import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPressRepeat,
  decimalPlaces,
  formatNumber,
  inputModeFor,
  isPartialNumber,
  largeStepNumber,
  parseNumber,
  snapToStep,
  stepNumber,
} from '../src/number-field/index.ts';
import NumberFieldHarness from './NumberFieldHarness.svelte';

const MINUS_SIGN = String.fromCharCode(0x2212);
const RLM = String.fromCharCode(0x200f);

afterEach(() => {
  vi.useRealTimers();
});

describe('parse and format', () => {
  it('round-trips the formatted text of many locales', () => {
    const cases: [string, number, Intl.NumberFormatOptions?][] = [
      ['en-US', 1234.5],
      ['de-DE', -1234.5],
      ['fr-FR', 1234.5],
      ['ar-EG', -1234.5],
      ['en-IN', 1234567.8],
      ['ja-JP', 42],
      ['en-US', 1234.5, { style: 'currency', currency: 'USD' }],
      ['de-DE', 12.5, { style: 'currency', currency: 'EUR' }],
      ['en-US', 0.45, { style: 'percent' }],
      ['de-CH', 9876.25],
    ];
    for (const [locale, value, options] of cases) {
      const text = formatNumber(value, locale, options);
      expect(parseNumber(text, locale, options), `${locale} ${text}`).toEqual({ ok: true, value });
    }
  });

  it('accepts typed variants: no grouping, minus forms, accounting, marks', () => {
    expect(parseNumber('1234.5', 'en-US')).toEqual({ ok: true, value: 1234.5 });
    expect(parseNumber('1234,5', 'de-DE')).toEqual({ ok: true, value: 1234.5 });
    expect(parseNumber(`${MINUS_SIGN}7`, 'en-US')).toEqual({ ok: true, value: -7 });
    expect(parseNumber('(12.5)', 'en-US')).toEqual({ ok: true, value: -12.5 });
    expect(parseNumber(`${RLM}-12`, 'en-US')).toEqual({ ok: true, value: -12 });
    expect(parseNumber('+3', 'en-US')).toEqual({ ok: true, value: 3 });
    expect(parseNumber('  ', 'en-US')).toEqual({ ok: true, value: null });
  });

  it('rejects text that is not a number for the locale', () => {
    for (const text of ['1.2.3', '12a', 'abc', '.', '-', '1,234.5.6', '1.234,5']) {
      expect(parseNumber(text, 'en-US').ok, text).toBe(false);
    }
    expect(parseNumber('1,5,3', 'de-DE').ok).toBe(false);
    expect(formatNumber(null, 'en-US')).toBe('');
    expect(formatNumber(Number.NaN, 'en-US')).toBe('');
  });

  it('allows partial text while typing', () => {
    for (const text of ['', '-', '12.', '1,', '('])
      expect(isPartialNumber(text, 'en-US'), text).toBe(true);
    for (const text of ['a', '1a', '1..']) expect(isPartialNumber(text, 'en-US'), text).toBe(false);
    expect(isPartialNumber('12,', 'de-DE')).toBe(true);
  });
});

describe('stepping math', () => {
  it('starts an empty field at min (or 0), within range', () => {
    expect(stepNumber(null, 1, { step: 1 })).toBe(0);
    expect(stepNumber(null, -1, { step: 1, min: 5 })).toBe(5);
    expect(stepNumber(null, 1, { step: 1, min: -10, max: -2 })).toBe(-10);
    expect(stepNumber(null, 1, { step: 1, max: -2 })).toBe(-2);
  });

  it('moves along the grid from min, clamped, without float noise', () => {
    expect(stepNumber(1, 1, { step: 2, min: 1 })).toBe(3);
    expect(stepNumber(9, 1, { step: 1, max: 9 })).toBe(9);
    let value = 0;
    for (let i = 0; i < 3; i += 1) value = stepNumber(value, 1, { step: 0.1 });
    expect(value).toBe(0.3);
    // Off the grid: the first step lands on the grid in that direction.
    expect(stepNumber(1.5, 1, { step: 1 })).toBe(2);
    expect(stepNumber(1.5, -1, { step: 1 })).toBe(1);
  });

  it('moves PageUp/PageDown by largeStep from the value, onto the step grid', () => {
    expect(largeStepNumber(4, 1, 10, { step: 1, min: 0, max: 100 })).toBe(14);
    expect(largeStepNumber(4, -1, 10, { step: 1, min: 0 })).toBe(0);
    expect(largeStepNumber(2.5, 1, 10, { step: 1 })).toBe(13);
    expect(largeStepNumber(null, 1, 10, { step: 1, min: 3 })).toBe(3);
  });

  it('snaps, counts decimals and picks the keyboard', () => {
    expect(snapToStep(0.30000000000000004, 0.1)).toBe(0.3);
    expect(snapToStep(7, 5, 1)).toBe(6);
    expect(decimalPlaces(0.25)).toBe(2);
    expect(decimalPlaces(1e-7)).toBe(7);
    expect(inputModeFor(1, 0)).toBe('numeric');
    expect(inputModeFor(1)).toBe('decimal');
    expect(inputModeFor(0.5, 0)).toBe('decimal');
  });

  it('repeats a held press until released or bounded', () => {
    vi.useFakeTimers();
    let count = 0;
    const repeat = createPressRepeat({ step: () => ++count < 5, delay: 400, interval: 60 });
    repeat.start();
    expect(count).toBe(1);
    vi.advanceTimersByTime(399);
    expect(count).toBe(1);
    vi.advanceTimersByTime(1);
    expect(count).toBe(2);
    vi.advanceTimersByTime(60 * 10);
    expect(count).toBe(5);
    expect(repeat.isActive()).toBe(false);

    count = 0;
    const held = createPressRepeat({
      step: () => {
        count += 1;
        return true;
      },
    });
    held.start();
    vi.advanceTimersByTime(400 + 60 * 2);
    held.stop();
    vi.advanceTimersByTime(1000);
    expect(count).toBe(4);
  });
});

describe('NumberField (APG spinbutton)', () => {
  const spin = (r: { getByRole: (role: 'spinbutton', options: { name: string }) => HTMLElement }) =>
    r.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement;
  const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };

  it('exposes the spinbutton value, range and formatted text', () => {
    const r = render(NumberFieldHarness, { value: 1234.5, min: 0, max: 5000, step: 0.5 });
    const input = spin(r);
    expect(input.type).toBe('text');
    expect(input.getAttribute('aria-valuenow')).toBe('1234.5');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('5000');
    expect(input.getAttribute('aria-valuetext')).toBe('1,234.5');
    expect(input.value).toBe('1,234.5');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('steps with the APG keys', async () => {
    const onValueChange = vi.fn();
    const r = render(NumberFieldHarness, {
      defaultValue: 5,
      min: 0,
      max: 100,
      step: 1,
      onValueChange,
    });
    const input = spin(r);
    expect(key(input, 'ArrowUp').defaultPrevented).toBe(true);
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('6');
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('4');
    key(input, 'PageUp');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('14');
    key(input, 'PageDown');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('4');
    key(input, 'End');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('100');
    key(input, 'ArrowUp');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('100');
    key(input, 'Home');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('0');
    expect(key(input, 'ArrowUp', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([6, 5, 4, 14, 4, 100, 0]);
  });

  it('leaves Home and End alone without bounds, and uses largeStep', async () => {
    const r = render(NumberFieldHarness, { defaultValue: 0, step: 5, largeStep: 25 });
    const input = spin(r);
    expect(key(input, 'Home').defaultPrevented).toBe(false);
    expect(key(input, 'End').defaultPrevented).toBe(false);
    key(input, 'PageUp');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('25');
  });

  it('commits typed text for the locale on Enter and on blur, clamped', async () => {
    const r = render(NumberFieldHarness, { locale: 'de-DE', min: 0, max: 5000 });
    const input = spin(r);
    await fireEvent.input(input, { target: { value: '1.234,5' } });
    expect(input.hasAttribute('aria-valuenow')).toBe(false);
    key(input, 'Enter');
    await Promise.resolve();
    expect(input.getAttribute('aria-valuenow')).toBe('1234.5');
    expect(input.value).toBe(formatNumber(1234.5, 'de-DE'));
    await fireEvent.input(input, { target: { value: '99999' } });
    await fireEvent.blur(input);
    expect(input.getAttribute('aria-valuenow')).toBe('5000');
    expect(r.getByTestId('value').textContent).toBe('5000');
  });

  it('reverts text that does not parse, and empties to null', async () => {
    const r = render(NumberFieldHarness, { value: 3 });
    const input = spin(r);
    await fireEvent.input(input, { target: { value: '3x' } });
    await fireEvent.blur(input);
    expect(input.value).toBe('3');
    expect(r.getByTestId('value').textContent).toBe('3');
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.blur(input);
    expect(r.getByTestId('value').textContent).toBe('null');
    expect(input.hasAttribute('aria-valuenow')).toBe(false);
    expect(input.hasAttribute('aria-valuetext')).toBe(false);
    expect(r.getByTestId('root').hasAttribute('data-empty')).toBe(true);
  });

  it('snaps committed values to the step grid when asked', async () => {
    const r = render(NumberFieldHarness, { min: 0, step: 5, snapOnStep: true });
    const input = spin(r);
    await fireEvent.input(input, { target: { value: '12' } });
    await fireEvent.blur(input);
    expect(input.getAttribute('aria-valuenow')).toBe('10');
  });

  it('refuses keystrokes that cannot lead to a number', () => {
    const r = render(NumberFieldHarness, {});
    const input = spin(r);
    const letter = new InputEvent('beforeinput', {
      data: 'x',
      inputType: 'insertText',
      cancelable: true,
      bubbles: true,
    });
    input.dispatchEvent(letter);
    expect(letter.defaultPrevented).toBe(true);
    const digit = new InputEvent('beforeinput', {
      data: '7',
      inputType: 'insertText',
      cancelable: true,
      bubbles: true,
    });
    input.dispatchEvent(digit);
    expect(digit.defaultPrevented).toBe(false);
  });

  it('labels the steppers, keeps them out of the Tab order and disables them at bounds', async () => {
    const r = render(NumberFieldHarness, {
      value: 1,
      min: 0,
      max: 2,
      incrementLabel: 'Más',
      decrementLabel: 'Menos',
    });
    const input = spin(r);
    const up = r.getByRole('button', { name: 'Más' }) as HTMLButtonElement;
    const down = r.getByRole('button', { name: 'Menos' }) as HTMLButtonElement;
    for (const button of [up, down]) {
      expect(button.tabIndex).toBe(-1);
      expect(button.getAttribute('aria-controls')).toBe(input.id);
      expect(button.type).toBe('button');
    }
    await fireEvent.pointerDown(up, { pointerType: 'mouse', button: 0, pointerId: 1 });
    await fireEvent.pointerUp(up, { pointerId: 1 });
    expect(input.getAttribute('aria-valuenow')).toBe('2');
    expect(up.disabled).toBe(true);
    expect(up.hasAttribute('data-disabled')).toBe(true);
    expect(down.disabled).toBe(false);
  });

  it('focuses the input on a mouse press but not on touch', async () => {
    const r = render(NumberFieldHarness, { value: 1 });
    const input = spin(r);
    const up = r.getByRole('button', { name: 'Increase' });
    r.getByTestId('elsewhere').focus();
    await fireEvent.pointerDown(up, { pointerType: 'touch', pointerId: 2 });
    await fireEvent.pointerUp(up, { pointerId: 2 });
    expect(document.activeElement).not.toBe(input);
    expect(input.getAttribute('aria-valuenow')).toBe('2');
    await fireEvent.pointerDown(up, { pointerType: 'mouse', button: 0, pointerId: 3 });
    await fireEvent.pointerUp(up, { pointerId: 3 });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-valuenow')).toBe('3');
  });

  it('repeats while held and steps once for assistive-technology clicks', async () => {
    vi.useFakeTimers();
    const r = render(NumberFieldHarness, { value: 0 });
    const input = spin(r);
    const down = r.getByRole('button', { name: 'Decrease' });
    await fireEvent.pointerDown(down, { pointerType: 'mouse', button: 0, pointerId: 4 });
    vi.advanceTimersByTime(400 + 60 * 3);
    await fireEvent.pointerUp(down, { pointerId: 4 });
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    // One step on press, then ticks at 400, 460, 520 and 580 ms.
    expect(input.getAttribute('aria-valuenow')).toBe('-5');
    // A pointer click after the press does not step again.
    await fireEvent.click(down, { detail: 1 });
    expect(input.getAttribute('aria-valuenow')).toBe('-5');
    await fireEvent.click(down, { detail: 0 });
    expect(input.getAttribute('aria-valuenow')).toBe('-6');
  });

  it('does nothing when disabled or read-only', async () => {
    for (const props of [{ disabled: true }, { readOnly: true }]) {
      const r = render(NumberFieldHarness, { value: 1, ...props });
      const input = spin(r);
      key(input, 'ArrowUp');
      await fireEvent.click(r.getByRole('button', { name: 'Increase' }), { detail: 0 });
      expect(input.getAttribute('aria-valuenow')).toBe('1');
      expect((r.getByRole('button', { name: 'Increase' }) as HTMLButtonElement).disabled).toBe(
        true
      );
      if ('disabled' in props) expect(input.disabled).toBe(true);
      else expect(input.readOnly).toBe(true);
      r.unmount();
    }
  });

  it('steps with the wheel only when allowed and focused', async () => {
    const r = render(NumberFieldHarness, { value: 0, allowWheel: true });
    const input = spin(r);
    await fireEvent.wheel(input, { deltaY: -10 });
    expect(input.getAttribute('aria-valuenow')).toBe('0');
    input.focus();
    const wheel = new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true });
    input.dispatchEvent(wheel);
    await Promise.resolve();
    expect(wheel.defaultPrevented).toBe(true);
    expect(input.getAttribute('aria-valuenow')).toBe('1');
  });

  it('follows a controlled value', async () => {
    const r = render(NumberFieldHarness, { value: 2 });
    await r.rerender({ value: 9 });
    expect(spin(r).getAttribute('aria-valuenow')).toBe('9');
  });

  it('submits the number, not the formatted text, and restores it on reset', async () => {
    const r = render(NumberFieldHarness, { defaultValue: 1234.5, name: 'amount', required: true });
    const form = r.getByTestId('form') as HTMLFormElement;
    expect(new FormData(form).get('amount')).toBe('1234.5');
    const input = spin(r);
    expect(input.hasAttribute('name')).toBe(false);
    expect(input.getAttribute('aria-required')).toBe('true');
    key(input, 'ArrowUp');
    await Promise.resolve();
    // Off the step grid, the first step lands on it.
    expect(new FormData(form).get('amount')).toBe('1235');
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.getAttribute('aria-valuenow')).toBe('1234.5');
  });

  it('wires a child input, including its element for focus', async () => {
    const r = render(NumberFieldHarness, { value: 1, childInput: true });
    const input = spin(r);
    expect(input.hasAttribute('data-custom')).toBe(true);
    await fireEvent.pointerDown(r.getByRole('button', { name: 'Increase' }), {
      pointerType: 'mouse',
      button: 0,
      pointerId: 9,
    });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-valuenow')).toBe('2');
  });
});

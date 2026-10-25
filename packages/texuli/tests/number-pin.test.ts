// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './fixtures/NumberPinHarness.svelte';

afterEach(cleanup);

describe('NumberField and PinInput styled components', () => {
  it('keeps primitive keyboard behavior and applies size and consumer classes', async () => {
    const view = render(Harness);
    const numberField = view.container.querySelector('[data-tx-number-field]');
    const input = screen.getByRole('spinbutton', { name: 'Quantity' });

    expect(numberField?.className).toContain('tx-number-field--md');
    expect(numberField?.className).toContain('custom-number-field');
    expect(input.className).toContain('tx-number-field__input');
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect((input as HTMLInputElement).getAttribute('aria-valuenow')).toBe('2');
  });

  it('renders accessible code cells and reflects disabled state', () => {
    const view = render(Harness);
    const pin = view.container.querySelector('[data-pin-input-root]');
    const realInput = screen.getByRole('textbox', { name: 'Verification code' });
    const cells = view.container.querySelectorAll('.tx-pin-input__cell');

    expect(pin?.className).toContain('tx-pin-input--md');
    expect(pin?.className).toContain('custom-pin-input');
    expect(realInput.getAttribute('autocomplete')).toBe('one-time-code');
    expect(cells).toHaveLength(4);
    expect(cells[0]?.textContent).toBe('1');
    expect(cells[1]?.textContent).toBe('2');
    expect(view.container.querySelector('.tx-pin-input__cells')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });
});

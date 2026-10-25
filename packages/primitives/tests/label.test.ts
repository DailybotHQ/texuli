import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  controlAttributes,
  type FieldState,
  joinIds,
  shouldPreventLabelSelection,
} from '../src/label/index.ts';
import FieldOutsideHarness from './FieldOutsideHarness.svelte';
import LabelChildHarness from './LabelChildHarness.svelte';
import LabelFieldHarness from './LabelFieldHarness.svelte';

const state = (overrides: Partial<FieldState> = {}): FieldState => ({
  controlId: 'f-control',
  labelId: 'f-label',
  descriptionId: 'f-description',
  errorId: 'f-error',
  invalid: false,
  disabled: false,
  required: false,
  hasDescription: true,
  hasError: true,
  ...overrides,
});

describe('attribute helpers', () => {
  it('joins id references without blanks or repeats', () => {
    expect(joinIds('a', undefined, '', false, 'b a', null, ' c ')).toBe('a b c');
    expect(joinIds(undefined, false)).toBeUndefined();
  });

  it('describes the control only with mounted parts', () => {
    expect(controlAttributes(state())['aria-describedby']).toBe('f-description');
    expect(controlAttributes(state({ hasDescription: false }))['aria-describedby']).toBeUndefined();
    const invalid = controlAttributes(state({ invalid: true }));
    expect(invalid['aria-describedby']).toBe('f-description f-error');
    expect(invalid['aria-invalid']).toBe('true');
    expect(invalid['aria-errormessage']).toBe('f-error');
    // Invalid without an error part: still invalid, but no dangling reference.
    const bare = controlAttributes(state({ invalid: true, hasError: false }));
    expect(bare['aria-describedby']).toBe('f-description');
    expect(bare['aria-errormessage']).toBeUndefined();
    expect(controlAttributes(state(), 'extra')['aria-describedby']).toBe('f-description extra');
  });

  it('marks required and disabled natively and with ARIA', () => {
    const attrs = controlAttributes(state({ required: true, disabled: true }));
    expect(attrs).toMatchObject({
      required: true,
      'aria-required': 'true',
      disabled: true,
      'data-required': '',
      'data-disabled': '',
    });
    const plain = controlAttributes(state());
    expect(plain.required).toBeUndefined();
    expect(plain.disabled).toBeUndefined();
    expect(plain['aria-invalid']).toBeUndefined();
  });

  it('prevents text selection on a double-click, except on interactive content', () => {
    const text = document.createElement('span');
    const button = document.createElement('button');
    expect(shouldPreventLabelSelection({ detail: 2, target: text, defaultPrevented: false })).toBe(
      true
    );
    expect(shouldPreventLabelSelection({ detail: 1, target: text, defaultPrevented: false })).toBe(
      false
    );
    expect(
      shouldPreventLabelSelection({ detail: 3, target: button, defaultPrevented: false })
    ).toBe(false);
    expect(shouldPreventLabelSelection({ detail: 2, target: text, defaultPrevented: true })).toBe(
      false
    );
  });
});

describe('Field', () => {
  it('associates the label, description and control (APG form field)', () => {
    const { getByLabelText, getByTestId } = render(LabelFieldHarness, { id: 'billing' });
    const input = getByLabelText('Work email') as HTMLInputElement;
    expect(input.id).toBe('billing-control');
    expect(input.type).toBe('email');
    expect(input.name).toBe('email');
    const label = getByTestId('field').querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe('billing-control');
    expect(label.id).toBe('billing-label');
    expect(input.getAttribute('aria-describedby')).toBe('billing-description');
    expect(document.getElementById('billing-description')?.textContent).toBe(
      'We send receipts here.'
    );
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('wires and announces the error only while invalid', async () => {
    const { getByLabelText, getByTestId, rerender } = render(LabelFieldHarness, { id: 'billing' });
    const input = getByLabelText('Work email');
    const error = document.getElementById('billing-error') as HTMLElement;
    expect(error.getAttribute('aria-live')).toBe('polite');
    expect(error.textContent).toBe('');
    expect(error.dataset.state).toBe('valid');

    await rerender({ id: 'billing', invalid: true });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('billing-description billing-error');
    expect(input.getAttribute('aria-errormessage')).toBe('billing-error');
    expect(error.textContent).toBe('Enter an address like name@example.com.');
    expect(error.dataset.state).toBe('invalid');
    expect(getByTestId('field').hasAttribute('data-invalid')).toBe(true);
    expect(getByTestId('field').querySelector('label')?.hasAttribute('data-invalid')).toBe(true);

    await rerender({ id: 'billing', invalid: false });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe('billing-description');
    expect(error.textContent).toBe('');
  });

  it('never references a part that is not mounted', async () => {
    const { getByLabelText, rerender } = render(LabelFieldHarness, {
      id: 'billing',
      invalid: true,
      showDescription: false,
      showError: false,
    });
    const input = getByLabelText('Work email');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await rerender({ id: 'billing', invalid: true, showDescription: true, showError: true });
    expect(input.getAttribute('aria-describedby')).toBe('billing-description billing-error');
    for (const id of (input.getAttribute('aria-describedby') ?? '').split(' ')) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('keeps the author’s own description references', () => {
    const { getByLabelText } = render(LabelFieldHarness, {
      id: 'billing',
      extraDescribedBy: 'extra-hint',
    });
    expect(getByLabelText('Work email').getAttribute('aria-describedby')).toBe(
      'billing-description extra-hint'
    );
  });

  it('applies required and disabled to the control and every part', () => {
    const { getByLabelText, getByTestId } = render(LabelFieldHarness, {
      required: true,
      disabled: true,
    });
    const input = getByLabelText('Work email') as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.disabled).toBe(true);
    expect(getByTestId('field').hasAttribute('data-required')).toBe(true);
    expect(getByTestId('field').hasAttribute('data-disabled')).toBe(true);
  });

  it('binds the value of the default input and of a child control', async () => {
    const plain = render(LabelFieldHarness, {});
    await fireEvent.input(plain.getByLabelText('Work email'), {
      target: { value: 'ada@example.com' },
    });
    expect(plain.getByTestId('value').textContent).toBe('ada@example.com');
    plain.unmount();

    const area = render(LabelFieldHarness, { asTextarea: true, invalid: true, id: 'notes' });
    const textarea = area.getByLabelText('Work email');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe('notes-description notes-error');
    await fireEvent.input(textarea, { target: { value: 'Ring twice' } });
    expect(area.getByTestId('value').textContent).toBe('Ring twice');
  });

  it('keeps the error content mounted with forceMount', () => {
    render(LabelFieldHarness, { id: 'billing', forceMount: true });
    expect(document.getElementById('billing-error')?.textContent).toBe(
      'Enter an address like name@example.com.'
    );
    expect(document.getElementById('billing-control')?.getAttribute('aria-describedby')).toBe(
      'billing-description'
    );
  });

  it('generates unique ids per field when none is given', () => {
    const first = render(LabelFieldHarness, {});
    const second = render(LabelFieldHarness, {});
    const ids = [first, second].map(
      (r) => (r.container.querySelector('input[type="email"]') as HTMLElement).id
    );
    expect(new Set(ids).size).toBe(2);
  });

  it('names the missing provider', () => {
    expect(() => render(FieldOutsideHarness)).toThrow(/Missing Field provider/);
  });
});

describe('Label', () => {
  it('names its control by for, or by wrapping it', () => {
    const { getByLabelText } = render(LabelFieldHarness, {});
    const plain = document.getElementById('plain-input') as HTMLInputElement;
    expect(plain.labels?.[0]?.textContent).toContain('Plain label');
    expect((getByLabelText('Remember me') as HTMLInputElement).type).toBe('checkbox');
  });

  it('stops double-click selection but not presses on interactive content', async () => {
    const { getByTestId } = render(LabelFieldHarness, {});
    const label = getByTestId('plain-label');
    const double = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    label.dispatchEvent(double);
    expect(double.defaultPrevented).toBe(true);
    const single = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 });
    label.dispatchEvent(single);
    expect(single.defaultPrevented).toBe(false);
    const onButton = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    label.querySelector('button')?.dispatchEvent(onButton);
    expect(onButton.defaultPrevented).toBe(false);
  });

  it('composes onto a child element; the consumer handler runs first and can opt out', () => {
    const onmousedown = vi.fn((event: MouseEvent) => event.preventDefault());
    const { getByTestId } = render(LabelChildHarness, { onmousedown });
    const child = getByTestId('child-label');
    expect(child.tagName).toBe('SPAN');
    expect(child.getAttribute('for')).toBe('target');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    child.dispatchEvent(event);
    expect(onmousedown).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });
});

import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type FieldErrorMap,
  fieldMessage,
  isValidErrorMap,
  toFieldErrorMap,
} from '../src/components/field/form-utils.ts';
import FieldHarness from './FieldHarness.svelte';

afterEach(cleanup);

describe('form-utils', () => {
  it('normalizes validation shapes into a field error map', () => {
    expect(toFieldErrorMap({ email: ' Required ' })).toEqual({ email: 'Required' });
    expect(toFieldErrorMap([['name', 'Too short']])).toEqual({ name: 'Too short' });
    expect(toFieldErrorMap('Something failed')).toEqual({ _form: 'Something failed' });
    expect(isValidErrorMap({})).toBe(true);
    expect(fieldMessage({ email: 'Nope' }, 'email')).toBe('Nope');
  });
});

describe('Field', () => {
  it('labels the control and marks invalid when error is set', () => {
    const view = render(FieldHarness, {
      props: {
        label: 'Work email',
        description: 'Fictional example.com only',
        error: 'Enter a work email',
        required: true,
      },
    });
    const input = view.getByRole('textbox', { name: 'Work email' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(view.getByText('Fictional example.com only')).toBeTruthy();
    expect(view.getByRole('alert').textContent).toContain('Enter a work email');
  });

  it('hides the label visually while keeping the accessible name', () => {
    const view = render(FieldHarness, {
      props: { label: 'Search', hideLabel: true },
    });
    expect(view.getByRole('textbox', { name: 'Search' })).toBeTruthy();
  });

  it('hands its disabled state to the control through control.props', () => {
    const view = render(FieldHarness, { props: { label: 'Locked field', disabled: true } });
    const input = view.getByRole('textbox', { name: 'Locked field' }) as HTMLInputElement;
    // The docs promise "chrome + control props" for disabled, like required.
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('leaves the control enabled when the field is not disabled', () => {
    const view = render(FieldHarness, { props: { label: 'Open field' } });
    const input = view.getByRole('textbox', { name: 'Open field' }) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });
});

describe('Form', () => {
  it('runs onValidate and blocks submit when errors are returned', async () => {
    const onSubmitValues = vi.fn();
    const view = render(FieldHarness, {
      props: {
        mode: 'form',
        onValidate: (values: Record<string, string>): FieldErrorMap => {
          if (values.email?.includes('@')) return {} as FieldErrorMap;
          return { email: 'Include an @ sign' };
        },
        onSubmitValues,
      },
    });
    const email = view.getByRole('textbox', { name: 'Email' });
    await fireEvent.input(email, { target: { value: 'not-an-email' } });
    await fireEvent.click(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(view.getByRole('alert').textContent).toContain('Include an @ sign');
    });
    expect(onSubmitValues).not.toHaveBeenCalled();

    await fireEvent.input(email, { target: { value: 'ada@example.com' } });
    await fireEvent.click(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmitValues).toHaveBeenCalled());
    expect(onSubmitValues.mock.calls[0]?.[0]).toMatchObject({ email: 'ada@example.com' });
  });

  it('submits after a failed attempt with native validation on', async () => {
    const onSubmitValues = vi.fn();
    const view = render(FieldHarness, {
      props: {
        mode: 'form',
        nativeValidation: true,
        onValidate: (values: Record<string, string>): FieldErrorMap =>
          values.email === 'ada@example.com'
            ? ({} as FieldErrorMap)
            : { email: 'Use your work address' },
        onSubmitValues,
      },
    });
    const email = view.getByRole('textbox', { name: 'Email' });
    await fireEvent.input(email, { target: { value: 'grace@example.com' } });
    await fireEvent.click(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(view.getByRole('alert').textContent).toContain('Use your work address');
    });
    // The message from the failed attempt must not block the next submit.
    await fireEvent.input(email, { target: { value: 'ada@example.com' } });
    await fireEvent.click(view.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmitValues).toHaveBeenCalledTimes(1));
  });
});

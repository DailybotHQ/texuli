import { fireEvent, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFormPlayerHost, type FormHostRequest } from '../src/host/index.ts';
import { CONTACT } from './fixtures.ts';
import RelationPicker from './RelationPicker.svelte';

/**
 * `@texuli/forms/host`: the `formHost` adapter `@texuli/player` paints
 * `schema-form` nodes with. It validates at the request's tier with the
 * registered validator names only, mounts `SchemaForm` lazily into the
 * player's element, forwards submits to the player, and unmounts on cleanup.
 */

afterEach(() => {
  document.body.replaceChildren();
});

function request(schema: unknown, overrides: Partial<FormHostRequest> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const submit = vi.fn(async (_values: Readonly<Record<string, unknown>>) => ({
    ok: true as const,
  }));
  const value: FormHostRequest = {
    schema,
    action: 'contact-us',
    formLabel: 'Contact form',
    tier: 'untrusted',
    active: true,
    labels: { submitted: 'Sent to the host.' },
    target,
    submit,
    ...overrides,
  };
  return { value, target, submit };
}

describe('createFormPlayerHost', () => {
  it('checks drafts with the registered validator names only (none registered: none allowed)', () => {
    const named = {
      title: 'Named',
      fields: [{ name: 'email', type: 'email', label: 'Email', validator: 'company-email' }],
    };
    const bare = createFormPlayerHost();
    expect(bare.validators).toEqual([]);
    expect(bare.checkForm(named, 'untrusted', bare.validators).ok).toBe(false);
    const registered = createFormPlayerHost({ validators: { 'company-email': () => undefined } });
    expect(registered.validators).toEqual(['company-email']);
    expect(registered.checkForm(named, 'untrusted', registered.validators).ok).toBe(true);
    // A pattern from an agent is never allowed.
    const evil = {
      title: 'Evil',
      fields: [{ name: 'c', type: 'text', label: 'C', pattern: '^(a+)+$' }],
    };
    expect(registered.checkForm(evil, 'untrusted', registered.validators).ok).toBe(false);
  });

  it('mounts the form lazily, forwards a valid submit, and unmounts on cleanup', async () => {
    const host = createFormPlayerHost();
    const { value, target, submit } = request(CONTACT);
    const cleanup = host.present(value);
    const form = await screen.findByRole('form', { name: 'Contact form' });
    expect(target.contains(form)).toBe(true);
    for (const input of target.querySelectorAll<HTMLInputElement>('input[type="email"]')) {
      await fireEvent.input(input, { target: { value: 'ada@example.com' } });
    }
    for (const input of target.querySelectorAll<HTMLInputElement>('input:not([type])')) {
      await fireEvent.input(input, { target: { value: 'Ada' } });
    }
    for (const area of target.querySelectorAll<HTMLTextAreaElement>('textarea')) {
      await fireEvent.input(area, { target: { value: 'Hello from example.com' } });
    }
    const send = target.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(send).not.toBeNull();
    await fireEvent.click(send as HTMLButtonElement);
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(typeof cleanup).toBe('function');
    cleanup?.();
    await waitFor(() => expect(target.querySelector('form')).toBeNull());
  });

  it('paints nothing for an invalid schema, without a target, or when cancelled before loading', async () => {
    const host = createFormPlayerHost();
    const invalid = request({ title: 'Bad', fields: [{ name: 'x', type: 'html', label: 'X' }] });
    expect(host.present(invalid.value)).toBeUndefined();
    const detached = request(CONTACT, { target: null });
    expect(host.present(detached.value)).toBeUndefined();
    const cancelled = request(CONTACT);
    host.present(cancelled.value)?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(invalid.target.childElementCount).toBe(0);
    expect(cancelled.target.childElementCount).toBe(0);
  });

  it('lets drafts use only the custom kinds it paints, validates them and submits their values (G113)', async () => {
    const ticket = {
      title: 'Ticket',
      fields: [
        { name: 'subject', type: 'text', label: 'Subject', required: true },
        { name: 'customer', type: 'custom', kind: 'relation', label: 'Customer', required: true },
      ],
    };
    const bare = createFormPlayerHost();
    expect(bare.customKinds).toEqual([]);
    expect(bare.checkForm(ticket, 'untrusted').issues.map((issue) => issue.code)).toEqual(['kind']);
    // A caller cannot widen the kinds past what the host paints.
    expect(bare.checkForm(ticket, 'untrusted', [], ['relation']).ok).toBe(false);
    const validate = vi.fn((value: unknown) =>
      value === 'gone' ? 'That customer was removed.' : null
    );
    const host = createFormPlayerHost({
      customFields: { relation: { component: RelationPicker, validate } },
    });
    expect(host.customKinds).toEqual(['relation']);
    expect(host.checkForm(ticket, 'untrusted', host.validators, host.customKinds).ok).toBe(true);
    const { value, target, submit } = request(ticket);
    const cleanup = host.present(value);
    await screen.findByRole('form', { name: 'Contact form' });
    const picker = target.querySelector<HTMLInputElement>('[data-relation-picker="relation"]');
    expect(picker).not.toBeNull();
    for (const input of target.querySelectorAll<HTMLInputElement>(
      'input:not([data-relation-picker])'
    )) {
      await fireEvent.input(input, { target: { value: 'Printer jam' } });
    }
    await fireEvent.input(picker as HTMLInputElement, { target: { value: 'gone' } });
    await fireEvent.click(target.querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(validate).toHaveBeenCalled());
    expect(submit).not.toHaveBeenCalled();
    await fireEvent.input(picker as HTMLInputElement, { target: { value: 'c-1' } });
    await fireEvent.click(target.querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ subject: 'Printer jam', customer: 'c-1' })
    );
    cleanup?.();
  });

  it('refuses password and otp fields unless the host allows credentials (G117)', () => {
    const login = { title: 'Login', fields: [{ name: 'pw', type: 'password', label: 'Password' }] };
    expect(
      createFormPlayerHost()
        .checkForm(login, 'untrusted')
        .issues.map((i) => i.code)
    ).toEqual(['credential']);
    expect(createFormPlayerHost({ credentials: true }).checkForm(login, 'untrusted').ok).toBe(true);
  });
});

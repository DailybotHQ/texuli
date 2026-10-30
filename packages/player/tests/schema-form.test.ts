import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { createFormPlayerHost } from '../../forms/src/host/index.ts';
import { formActionValues } from '../src/form-values.ts';
import Player from '../src/Player.svelte';

/**
 * `schema-form` (spec 0.8.0, ADR-015): the player paints a form as data
 * through the host's `formHost` (`createFormPlayerHost` from
 * `@texuli/forms/host`, as a host wires it), validates it before painting,
 * and proposes the node's action intent with the submitted values once the
 * form is valid. Without a host the form is refused.
 */

const formHost = createFormPlayerHost();

const SPEC = join(import.meta.dirname, '../../spec');
const golden = JSON.parse(
  readFileSync(join(SPEC, 'fixtures/golden/form-registration.json'), 'utf8')
);

const blueprint = (schema: unknown) => ({
  id: 'layout-page',
  props: { title: 'Support' },
  children: [{ id: 'schema-form', props: { action: 'request-help', schema } }],
});

const HELP = {
  title: 'Ask for help',
  submitLabel: 'Send',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },
    {
      name: 'areas',
      type: 'multiselect',
      label: 'Areas',
      options: [
        { value: 'billing', label: 'Billing' },
        { value: 'access', label: 'Access' },
      ],
    },
    { name: 'urgent', type: 'switch', label: 'Urgent' },
  ],
};

async function painted(container: HTMLElement): Promise<void> {
  await expect
    .poll(() => container.querySelector('[data-tx-player-skeleton]'), { timeout: 15_000 })
    .toBeNull();
}

describe('schema-form in the player', () => {
  it('paints the form-registration golden as a named form with its first step', {
    timeout: 30_000,
  }, async () => {
    const diagnostics = vi.fn();
    const { container } = render(Player, {
      props: { blueprint: golden, label: 'Golden', onDiagnostics: diagnostics, formHost },
    });
    await painted(container);
    const form = await screen.findByRole('form', { name: 'Community day registration' });
    expect(
      form.closest('[data-tx-player-schema-form]')?.getAttribute('data-tx-player-schema-form')
    ).toBe('register-attendee');
    expect(screen.getByRole('heading', { name: 'About you' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Full name/ })).toBeTruthy();
    expect(
      screen.getByRole('navigation', { name: 'Community day registration progress' })
    ).toBeTruthy();
  });

  it('proposes the action with the submitted values only once the form is valid', {
    timeout: 30_000,
  }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const { container } = render(Player, {
      props: { blueprint: blueprint(HELP), label: 'Help', onAction, formHost },
    });
    await painted(container);
    const send = await screen.findByRole('button', { name: 'Send' });
    await fireEvent.click(send);
    await screen.findByRole('heading', { name: 'There is a problem' });
    expect(onAction).not.toHaveBeenCalled();
    await fireEvent.input(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'ada@example.com' },
    });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Access' }));
    await fireEvent.click(send);
    await waitFor(() => expect(onAction).toHaveBeenCalledOnce());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: 'request-help',
      values: { email: 'ada@example.com', areas: '["access"]', urgent: false },
    });
  });

  it('shows the host refusal in the form and keeps the answers', { timeout: 30_000 }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'rejected' as const);
    const { container } = render(Player, {
      props: { blueprint: blueprint(HELP), label: 'Help', onAction, formHost },
    });
    await painted(container);
    await fireEvent.input(await screen.findByRole('textbox', { name: /Email/ }), {
      target: { value: 'ada@example.com' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledOnce());
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    expect(summary.parentElement?.textContent).toMatch(/declined|rejected|not/i);
    expect((screen.getByRole('textbox', { name: /Email/ }) as HTMLInputElement).value).toBe(
      'ada@example.com'
    );
  });

  it('refuses a schema with an agent pattern before painting', { timeout: 30_000 }, async () => {
    const errors: string[] = [];
    const bad = { ...HELP, fields: [{ ...HELP.fields[0], pattern: '^(a+)+$' }] };
    const { container } = render(Player, {
      props: {
        blueprint: blueprint(bad),
        label: 'Help',
        formHost,
        onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
          for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
        },
      },
    });
    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(container.querySelector('[data-tx-player-schema-form]')).toBeNull();
  });

  it('refuses a schema-form without a form host (form-unchecked) and paints nothing of it', {
    timeout: 30_000,
  }, async () => {
    const errors: string[] = [];
    const { container } = render(Player, {
      props: {
        blueprint: blueprint(HELP),
        label: 'Help',
        onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
          for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
        },
      },
    });
    await waitFor(() => expect(errors).toContain('form-unchecked'));
    expect(container.querySelector('[data-tx-player-schema-form]')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });

  it('passes the host validator names to validation and the functions to the form', {
    timeout: 30_000,
  }, async () => {
    const named = {
      ...HELP,
      fields: [{ ...HELP.fields[0], validator: 'company-email' }],
    };
    const errors: string[] = [];
    const onDiagnostics = (event: {
      diagnostics: readonly { code: string; severity: string }[];
    }) => {
      for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
    };
    // A name the host does not register is refused before painting.
    const bare = render(Player, {
      props: { blueprint: blueprint(named), label: 'Help', onDiagnostics, formHost },
    });
    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(bare.container.querySelector('form')).toBeNull();
    bare.unmount();
    // A registered one paints, and its function runs on submit.
    const companyEmail = vi.fn((value: unknown) =>
      typeof value === 'string' && value.endsWith('@example.com')
        ? undefined
        : 'Use a company email.'
    );
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const { container } = render(Player, {
      props: {
        blueprint: blueprint(named),
        label: 'Help',
        onAction,
        formHost: createFormPlayerHost({ validators: { 'company-email': companyEmail } }),
      },
    });
    await painted(container);
    await fireEvent.input(await screen.findByRole('textbox', { name: /Email/ }), {
      target: { value: 'ada@other.test' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(companyEmail).toHaveBeenCalled());
    expect(onAction).not.toHaveBeenCalled();
  });

  it('maps answers to scalar action values', () => {
    expect(
      formActionValues({
        name: 'Ada',
        age: 30,
        ok: true,
        none: null,
        nan: Number.NaN,
        tags: ['a', 'b'],
        files: [{ name: 'a.png', size: 1, type: 'image/png' }],
      })
    ).toEqual({ name: 'Ada', age: 30, ok: true, tags: '["a","b"]', files: '["a.png"]' });
  });
});

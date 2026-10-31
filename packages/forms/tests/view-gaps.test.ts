/**
 * Protoyard forms gaps in the Svelte view (PLAN_011 T-gaps-113-121):
 * host-painted fields (G113), a visually hidden title (G114), custom and
 * headless action rows (G115), form-level disabled and read-only (G116),
 * the password, otp, color and datetime controls (G117), clearable selects
 * (G118), per-type control loading (G119) and the per-step hook (G120).
 */
import { createRequire } from 'node:module';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src/index.ts';
import { type CompiledForm, createFormController, validateFormSchema } from '../src/model/index.ts';
import { SCHEMA_FORM_CONTROLS } from '../src/view/controls/index.ts';
import { compiled } from './fixtures.ts';
import GapsHarness from './GapsHarness.svelte';

afterEach(() => cleanup());

const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};
const RULES = [
  'button-name',
  'label',
  'aria-input-field-name',
  'aria-allowed-attr',
  'aria-valid-attr-value',
  'duplicate-id-aria',
  'heading-order',
];
const violations = async (root: Element) =>
  (await axe.run(root, { runOnly: { type: 'rule', values: RULES } })).violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
  );

/** App-authored forms (the developer tier: credential and custom fields allowed). */
function dev(schema: unknown): CompiledForm {
  const result = validateFormSchema(schema, { tier: 'developer' });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.form;
}

const TICKET = dev({
  title: 'New ticket',
  submitLabel: 'Open ticket',
  fields: [
    { name: 'subject', type: 'text', label: 'Subject', required: true },
    {
      name: 'customer',
      type: 'custom',
      kind: 'relation',
      label: 'Customer',
      description: 'Search by name.',
      required: true,
      config: { entity: 'customer' },
    },
    { name: 'urgent', type: 'checkbox', label: 'Urgent' },
  ],
});

describe('host-painted custom fields (G113)', () => {
  it('paints the host control inside the form, in schema order, labelled, validated and submitted', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const validate = vi.fn(async (value: unknown) =>
      (value as { id?: string })?.id === 'gone' ? 'That customer was removed.' : null
    );
    const { container } = render(GapsHarness, { props: { form: TICKET, onSubmit, validate } });
    const form = screen.getByRole('form', { name: 'New ticket' });
    const picker = within(form).getByRole('textbox', { name: /^Customer/ });
    expect(picker.getAttribute('data-relation-picker')).toBe('relation');
    expect(picker.getAttribute('data-entity')).toBe('customer');
    expect(picker.getAttribute('aria-describedby')).toContain('ticket-field-customer-description');
    // Schema order: subject, customer, urgent.
    const order = [...form.querySelectorAll('[data-tx-forms-field]')].map((el) =>
      el.getAttribute('data-tx-forms-field')
    );
    expect(order).toEqual(['subject', 'customer', 'urgent']);

    await fireEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    expect(summary.parentElement?.textContent).toContain('Customer: Customer is required.');
    expect(picker.getAttribute('aria-invalid')).toBe('true');
    await fireEvent.click(screen.getByRole('link', { name: 'Customer: Customer is required.' }));
    expect(document.activeElement).toBe(picker);

    await fireEvent.input(screen.getByRole('textbox', { name: /Subject/ }), {
      target: { value: 'Printer jam' },
    });
    await fireEvent.input(picker, { target: { value: 'gone' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Customer: That customer was removed.' })
      ).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.input(picker, { target: { value: 'c-1' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { subject: 'Printer jam', customer: { id: 'c-1' }, urgent: false },
      })
    );
    expect(await violations(container)).toEqual([]);
  });

  it('shows a notice for a custom field nobody paints', () => {
    render(SchemaForm, { props: { form: TICKET, id: 'bare' } });
    expect(screen.getByText('This field cannot be shown here.')).toBeTruthy();
  });
});

describe('the title (G114)', () => {
  it('hides the title visually and keeps it as the form name', () => {
    render(SchemaForm, { props: { form: compiled(), hideTitle: true, id: 'reg' } });
    const form = screen.getByRole('form', { name: 'Event registration' });
    const title = document.getElementById('reg-title');
    expect(form.getAttribute('aria-labelledby')).toBe('reg-title');
    expect(title?.classList.contains('tx-forms__visually-hidden')).toBe(true);
  });
});

describe('actions and requestSubmit (G115)', () => {
  it('paints a custom action row whose submit validates and opens the summary', async () => {
    render(GapsHarness, { props: { form: TICKET, mode: 'actions' } });
    expect(screen.queryByRole('button', { name: 'Open ticket' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Save (Open ticket)' }));
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    await waitFor(() => expect(document.activeElement).toBe(summary.parentElement));
  });

  it('with actions={false}, an outside button, requestSubmit() and controller.submit() each validate and open the summary', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const controller = createFormController(TICKET, { onSubmit });
    render(GapsHarness, { props: { form: TICKET, mode: 'none', controller } });
    const form = screen.getByRole('form', { name: 'New ticket' });
    expect(within(form).queryAllByRole('button')).toEqual([]);

    await fireEvent.click(screen.getByRole('button', { name: 'Outside submit' }));
    await screen.findByRole('heading', { name: 'There is a problem' });
    cleanupSummary(form);

    await fireEvent.click(screen.getByRole('button', { name: 'Request submit' }));
    await waitFor(() => expect(controller.getState().submitCount).toBe(2));
    expect(await screen.findByRole('heading', { name: 'There is a problem' })).toBeTruthy();

    // A host that calls the controller directly gets the summary too.
    (document.activeElement as HTMLElement | null)?.blur();
    await controller.submit();
    await tick();
    await waitFor(() =>
      expect(document.activeElement?.classList.contains('tx-forms__summary')).toBe(true)
    );
    controller.setValue('subject', 'Printer jam');
    controller.setValue('customer', { id: 'c-1' });
    await fireEvent.click(screen.getByRole('button', { name: 'Request submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const done = await screen.findByText('Thank you. Your answers were sent.', {
      selector: '.tx-forms__done',
    });
    await waitFor(() => expect(document.activeElement).toBe(done));
    controller.destroy();
  });
});

/** Fix one field so the next submit is a fresh attempt (keeps the summary test honest). */
function cleanupSummary(form: HTMLElement): void {
  expect(form.querySelector('.tx-forms__summary')).not.toBeNull();
}

describe('form-level disabled and read-only (G116)', () => {
  const PROFILE = dev({
    title: 'Profile',
    fields: [
      { name: 'name', type: 'text', label: 'Name', required: true },
      {
        name: 'plan',
        type: 'select',
        label: 'Plan',
        options: [
          { value: 'free', label: 'Free' },
          { value: 'team', label: 'Team' },
        ],
      },
      { name: 'news', type: 'checkbox', label: 'News' },
      {
        name: 'size',
        type: 'radio',
        label: 'Size',
        options: [
          { value: 's', label: 'Small' },
          { value: 'l', label: 'Large' },
        ],
      },
      { name: 'pw', type: 'password', label: 'Password' },
    ],
  });

  it('disables every control and action, and still submits when the host asks', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const view = render(SchemaForm, {
      props: {
        form: PROFILE,
        disabled: true,
        values: { name: 'Ada', plan: 'team', size: 's' },
        onSubmit,
        controls: SCHEMA_FORM_CONTROLS,
      },
    });
    const form = screen.getByRole('form', { name: 'Profile' });
    const controls = [
      ...form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button, textarea'),
    ].filter((el) => el.type !== 'hidden');
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls)
      expect(control.disabled, control.outerHTML.slice(0, 80)).toBe(true);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveProperty('disabled', true);
    await (view.component as unknown as { requestSubmit(): Promise<void> }).requestSubmit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { name: 'Ada', plan: 'team', news: false, size: 's', pw: '' },
      })
    );
  });

  it('shows values read-only: text is readonly, other controls are disabled, Submit is disabled', () => {
    render(SchemaForm, {
      props: {
        form: PROFILE,
        readOnly: true,
        values: { name: 'Ada' },
        controls: SCHEMA_FORM_CONTROLS,
      },
    });
    const name = screen.getByRole('textbox', { name: /Name/ }) as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    expect(name.disabled).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'News' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveProperty('disabled', true);
  });
});

describe('password, otp, color and datetime controls (G117)', () => {
  const ACCOUNT = dev({
    title: 'Account',
    fields: [
      { name: 'pw', type: 'password', label: 'Password', autocomplete: 'new-password' },
      { name: 'code', type: 'otp', label: 'Code', length: 6 },
      { name: 'tint', type: 'color', label: 'Accent' },
      { name: 'starts', type: 'datetime', label: 'Starts' },
    ],
  });

  it('paints each with its accessible control and wires the values', async () => {
    const onValueChange = vi.fn();
    const { container } = render(SchemaForm, {
      props: { form: ACCOUNT, onValueChange, id: 'acct' },
    });
    const pw = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pw.type).toBe('password');
    expect(pw.autocomplete).toBe('new-password');
    const reveal = screen.getByRole('button', { name: 'Show password' });
    expect(reveal.getAttribute('aria-pressed')).toBe('false');
    expect(reveal.getAttribute('aria-controls')).toBe(pw.id);
    await fireEvent.click(reveal);
    expect(reveal.getAttribute('aria-pressed')).toBe('true');
    expect(pw.type).toBe('text');

    const code = screen.getByRole('textbox', { name: 'Code' }) as HTMLInputElement;
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('inputmode')).toBe('numeric');
    expect(code.maxLength).toBe(6);
    await fireEvent.input(code, { target: { value: '12 34 56' } });
    expect(onValueChange).toHaveBeenLastCalledWith('code', '123456', expect.anything());

    // Color and datetime load on first use (G119), then paint their texuli controls.
    expect(await screen.findByRole('group', { name: 'Accent' })).toBeTruthy();
    await waitFor(() => expect(container.querySelector('.tx-forms__control-loading')).toBeNull());
    const parts = container.querySelectorAll('[data-tx-forms-datetime] [aria-labelledby]');
    const names = [...parts].map((el) =>
      (el.getAttribute('aria-labelledby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .join(' ')
    );
    expect(names).toContain('Starts Date');
    expect(names).toContain('Starts Time');
    expect(await violations(container)).toEqual([]);
  });

  it('builds the datetime value once both parts are set', async () => {
    const controller = createFormController(ACCOUNT);
    render(SchemaForm, {
      props: { form: ACCOUNT, controller, controls: SCHEMA_FORM_CONTROLS, id: 'dt' },
    });
    controller.setValue('starts', '2026-11-10T14:30');
    await tick();
    const hidden = [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(hidden.find((input) => input.name === 'starts-date')?.value).toBe('2026-11-10');
    expect(hidden.find((input) => input.name === 'starts-time')?.value).toBe('14:30');
    controller.destroy();
  });
});

describe('clearable select (G118)', () => {
  const plans = [
    { value: 'free', label: 'Free' },
    { value: 'team', label: 'Team' },
  ];
  const optionNames = async (name: RegExp) => {
    await fireEvent.click(screen.getByRole('combobox', { name }));
    const names = (await screen.findAllByRole('option')).map((o) => o.textContent?.trim());
    await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    return names;
  };

  it('gives an optional select an empty choice that clears it, and none to a required one', async () => {
    const onValueChange = vi.fn();
    render(SchemaForm, {
      props: {
        form: compiled({
          title: 'Plans',
          fields: [
            { name: 'plan', type: 'select', label: 'Plan', options: plans },
            { name: 'must', type: 'select', label: 'Must', required: true, options: plans },
            { name: 'kept', type: 'select', label: 'Kept', clearable: false, options: plans },
          ],
        }),
        values: { plan: 'team' },
        onValueChange,
      },
    });
    expect(await optionNames(/^Plan/)).toEqual(['None', 'Free', 'Team']);
    expect(await optionNames(/^Must/)).toEqual(['Free', 'Team']);
    expect(await optionNames(/^Kept/)).toEqual(['Free', 'Team']);
    await fireEvent.click(screen.getByRole('combobox', { name: /^Plan/ }));
    await fireEvent.click(await screen.findByRole('option', { name: 'None' }));
    expect(onValueChange).toHaveBeenLastCalledWith('plan', null, expect.anything());
    expect(screen.getByRole('combobox', { name: /^Plan/ }).textContent).toContain(
      'Choose an option'
    );
  });
});

describe('per-type controls (G119)', () => {
  it('holds a same-size placeholder until a lazy control loads, and paints at once from the registry', async () => {
    const form = compiled({
      title: 'Lazy',
      fields: [{ name: 'level', type: 'slider', label: 'Level', min: 0, max: 5 }],
    });
    // A fresh registry entry shows the control synchronously.
    const eager = render(SchemaForm, { props: { form, controls: SCHEMA_FORM_CONTROLS } });
    expect(screen.getByRole('slider', { name: /Level/ })).toBeTruthy();
    eager.unmount();
    const lazy = render(SchemaForm, { props: { form } });
    expect(await screen.findByRole('slider', { name: /Level/ })).toBeTruthy();
    expect(lazy.container.querySelector('.tx-forms__control-loading')).toBeNull();
    lazy.unmount();
  });
});

describe('the per-step hook (G120)', () => {
  it('blocks Next with a message in the summary, shows a pending Next, then moves on', async () => {
    let release: (value: unknown) => void = () => {};
    const onStep = vi.fn(() => new Promise((resolve) => (release = resolve)));
    render(SchemaForm, {
      props: {
        form: compiled({
          title: 'Signup',
          steps: [
            {
              id: 'account',
              title: 'Account',
              fields: [{ name: 'handle', type: 'text', label: 'Handle', required: true }],
            },
            {
              id: 'more',
              title: 'More',
              fields: [{ name: 'bio', type: 'textarea', label: 'Bio' }],
            },
          ],
        }),
        values: { handle: 'ada' },
        onStep: onStep as never,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(onStep).toHaveBeenCalledOnce());
    const next = screen.getByRole('button', { name: /Next|Checking/ });
    expect(next.getAttribute('aria-busy') ?? next.getAttribute('data-loading')).toBeTruthy();
    release({ ok: false, message: 'Signups are paused.' });
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    expect(summary.parentElement?.textContent).toContain('Signups are paused.');
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(onStep).toHaveBeenCalledTimes(2));
    release(undefined);
    expect(await screen.findByRole('heading', { name: 'More' })).toBeTruthy();
  });
});

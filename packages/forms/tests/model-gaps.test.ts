// @vitest-environment node
/**
 * Protoyard forms gaps in the framework-free model (PLAN_011 T-gaps-113-121):
 * host-painted `custom` fields (G113), form-level disabled and read-only
 * state (G116), the password, otp, color and datetime types (G117), the
 * `clearable` select member (G118), the per-step hook (G120) and url
 * fields that may allow http (G121).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  checkFieldValue,
  checkFormDraft,
  coerceValue,
  createFormController,
  createMemoryDrafts,
  FORM_FIELD_TYPES,
  type FormTimers,
  formatFormValue,
  formValuesToMarkdown,
  matchesFormat,
  validateFormSchema,
} from '../src/model/index.ts';
import { compiled } from './fixtures.ts';

const schemaWith = (...fields: unknown[]) => ({ title: 'T', fields });
const codes = (input: unknown, options = {}) => {
  const result = validateFormSchema(input, options);
  return result.ok ? [] : result.issues.map((issue) => `${issue.code} ${issue.path}`);
};
const noTimers: FormTimers = { set: () => 0, clear: () => {} };
/** Compile app-authored schemas (the developer tier allows credential fields). */
const dev = (schema: unknown) => {
  const result = validateFormSchema(schema, { tier: 'developer' });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.form;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('custom fields (G113)', () => {
  const ticket = (extra: Record<string, unknown> = {}) =>
    schemaWith(
      { name: 'subject', type: 'text', label: 'Subject', required: true },
      {
        name: 'customer',
        type: 'custom',
        kind: 'relation',
        label: 'Customer',
        required: true,
        config: { entity: 'customer', pageSize: 20, multiple: false },
        ...extra,
      }
    );

  it('declares a custom field with a kind and scalar config, refused without a registered kind at the untrusted tier', () => {
    expect(FORM_FIELD_TYPES).toContain('custom');
    // The developer tier accepts any kind; the app paints it.
    expect(codes(ticket(), { tier: 'developer' })).toEqual([]);
    // Agent output (untrusted, the default): only kinds the host registered.
    expect(codes(ticket())).toEqual(['kind $.fields[1].kind']);
    expect(codes(ticket(), { kinds: ['relation'] })).toEqual([]);
    expect(codes(ticket(), { kinds: ['address'] })).toEqual(['kind $.fields[1].kind']);
    expect(checkFormDraft(ticket(), 'untrusted', [], ['relation']).ok).toBe(true);
    expect(checkFormDraft(ticket(), 'untrusted', []).issues.map((i) => i.code)).toEqual(['kind']);
    // A custom field needs a kind; config holds scalars under field-like keys only.
    expect(codes(ticket({ kind: undefined }), { tier: 'developer' })).toEqual([
      'missing $.fields[1].kind',
    ]);
    expect(codes(ticket({ kind: 'Bad Kind' }), { tier: 'developer' })).toEqual([
      'name $.fields[1].kind',
    ]);
    expect(codes(ticket({ config: { nested: { a: 1 } } }), { tier: 'developer' })).toEqual([
      'shape $.fields[1].config.nested',
    ]);
    expect(codes(ticket({ config: { 'bad key': 1 } }), { tier: 'developer' })).toEqual([
      'name $.fields[1].config',
    ]);
    // kind and config belong to custom fields only.
    expect(
      codes(schemaWith({ name: 'a', type: 'text', label: 'A', kind: 'relation' }), {
        tier: 'developer',
      })
    ).toEqual(['not-applicable $.fields[0].kind']);
  });

  it('holds bounded JSON values, validates with the host validator by name or kind, and submits in schema order', async () => {
    const result = validateFormSchema(ticket(), { kinds: ['relation'] });
    if (!result.ok) throw new Error('invalid');
    const form = result.form;
    expect(coerceValue({ type: 'custom' }, { id: 'c-1', label: 'Example Co' })).toEqual({
      id: 'c-1',
      label: 'Example Co',
    });
    expect(coerceValue({ type: 'custom' }, ['a', 1, true, null])).toEqual(['a', 1, true, null]);
    expect(coerceValue({ type: 'custom' }, () => 1)).toBeUndefined();
    expect(coerceValue({ type: 'custom' }, { a: Number.NaN })).toBeUndefined();
    expect(coerceValue({ type: 'custom' }, 'x'.repeat(20_000))).toBeUndefined();
    let deep: unknown = 'leaf';
    for (let i = 0; i < 20; i += 1) deep = [deep];
    expect(coerceValue({ type: 'custom' }, deep)).toBeUndefined();
    // An empty object reads as empty for `required`.
    expect(checkFieldValue(form.byName.get('customer')!.field, {}, true)).toBe(
      'Customer is required.'
    );

    const relation = vi.fn(async (value: unknown) =>
      (value as { id?: string } | null)?.id === 'c-404' ? 'That customer no longer exists.' : null
    );
    const onSubmit = vi.fn();
    const controller = createFormController(form, {
      customValidators: { relation },
      onSubmit,
      timers: noTimers,
    });
    let outcome = await controller.submit();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors).toEqual({
        subject: 'Subject is required.',
        customer: 'Customer is required.',
      });
      expect(outcome.firstInvalid).toBe('subject');
    }
    controller.setValue('subject', 'Printer jam');
    controller.setValue('customer', { id: 'c-404' });
    outcome = await controller.submit();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok)
      expect(outcome.errors).toEqual({ customer: 'That customer no longer exists.' });
    expect(relation).toHaveBeenCalledWith(
      { id: 'c-404' },
      expect.objectContaining({ name: 'customer' })
    );
    controller.setValue('customer', { id: 'c-1' });
    outcome = await controller.submit();
    expect(outcome.ok).toBe(true);
    expect(Object.keys(onSubmit.mock.calls[0]?.[0].values)).toEqual(['subject', 'customer']);
    // A validator keyed by the field name wins over the kind's.
    const byName = vi.fn(() => 'Pick an active customer.');
    const named = createFormController(form, {
      customValidators: { relation, customer: byName },
      values: { subject: 'S', customer: { id: 'c-1' } },
      timers: noTimers,
    });
    expect((await named.submit()).ok).toBe(false);
    expect(byName).toHaveBeenCalledOnce();
  });
});

describe('form-level disabled and read-only (G116)', () => {
  it('keeps the flags in state, changes them at run time, and still validates and submits programmatically', async () => {
    const onSubmit = vi.fn();
    const form = compiled(
      schemaWith(
        { name: 'email', type: 'email', label: 'Email', required: true },
        { name: 'plan', type: 'select', label: 'Plan', options: [{ value: 'a', label: 'A' }] }
      )
    );
    const controller = createFormController(form, {
      disabled: true,
      values: { email: 'ada@example.com', plan: 'a' },
      onSubmit,
      timers: noTimers,
    });
    expect(controller.getState().disabled).toBe(true);
    expect(controller.getState().readOnly).toBe(false);
    // Form-level disabled is presentation: logic still treats fields as enabled.
    expect(controller.getState().logic.fields.email?.enabled).toBe(true);
    const outcome = await controller.submit();
    expect(outcome.ok).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith({ values: { email: 'ada@example.com', plan: 'a' } });
    const seen: boolean[] = [];
    controller.subscribe((state) => seen.push(state.readOnly));
    controller.setReadOnly(true);
    controller.setDisabled(false);
    expect(controller.getState()).toMatchObject({ disabled: false, readOnly: true });
    expect(seen).toContain(true);
  });
});

describe('password, otp, color and datetime (G117)', () => {
  it('validates each new type with its own members', () => {
    for (const type of ['password', 'otp', 'color', 'datetime'])
      expect(FORM_FIELD_TYPES).toContain(type);
    const dev = { tier: 'developer' as const };
    expect(
      codes(
        schemaWith(
          {
            name: 'pw',
            type: 'password',
            label: 'Password',
            autocomplete: 'new-password',
            minLength: 12,
          },
          { name: 'code', type: 'otp', label: 'Code', length: 6 },
          { name: 'tint', type: 'color', label: 'Tint', default: '#3366FF' },
          {
            name: 'at',
            type: 'datetime',
            label: 'Starts',
            min: '2026-11-01T09:00',
            max: '2026-11-30T18:00',
          }
        ),
        dev
      )
    ).toEqual([]);
    expect(
      codes(
        schemaWith(
          { name: 'pw', type: 'password', label: 'P', autocomplete: 'email' },
          { name: 'em', type: 'text', label: 'E', autocomplete: 'current-password' },
          { name: 'code', type: 'otp', label: 'Code', length: 30 },
          { name: 'tint', type: 'color', label: 'Tint', default: 'red' },
          { name: 'at', type: 'datetime', label: 'At', min: '2026-11-01' }
        ),
        dev
      )
    ).toEqual([
      'type $.fields[0].autocomplete',
      'type $.fields[1].autocomplete',
      'range $.fields[2].length',
      'default $.fields[3].default',
      'range $.fields[4].min',
    ]);
  });

  it('refuses password and otp fields in agent output unless the host allows credentials', () => {
    const login = schemaWith(
      { name: 'pw', type: 'password', label: 'Password' },
      { name: 'code', type: 'otp', label: 'Code' }
    );
    expect(codes(login)).toEqual(['credential $.fields[0].type', 'credential $.fields[1].type']);
    expect(codes(login, { credentials: true })).toEqual([]);
    expect(codes(login, { tier: 'developer' })).toEqual([]);
  });

  it('coerces, checks and formats each value', () => {
    const otp = dev(schemaWith({ name: 'code', type: 'otp', label: 'Code', length: 6 })).fields[0]!
      .field;
    expect(coerceValue(otp, '123456')).toBe('123456');
    expect(checkFieldValue(otp, '12345', true)).toBe('Enter a valid 6-digit code.');
    expect(checkFieldValue(otp, '12a456', true)).toBe('Enter a valid 6-digit code.');
    expect(checkFieldValue(otp, '123456', true)).toBeNull();

    const color = { name: 'tint', type: 'color' as const, label: 'Tint' };
    expect(coerceValue(color, '#3366FF')).toBe('#3366ff');
    expect(coerceValue(color, '#36f')).toBe('#36f');
    expect(coerceValue(color, '#3366ff80')).toBe('#3366ff80');
    expect(coerceValue(color, 'rgb(1 2 3)')).toBeUndefined();
    expect(coerceValue(color, '')).toBeNull();

    const at = compiled(
      schemaWith({
        name: 'at',
        type: 'datetime',
        label: 'Starts',
        min: '2026-11-01T09:00',
      })
    ).fields[0]!.field;
    expect(coerceValue(at, '2026-11-10T14:30')).toBe('2026-11-10T14:30');
    expect(coerceValue(at, '2026-02-30T14:30')).toBeUndefined();
    expect(coerceValue(at, '2026-11-10T25:00')).toBeUndefined();
    expect(coerceValue(at, '2026-11-10')).toBeUndefined();
    expect(checkFieldValue(at, '2026-10-31T23:59', false)).toBe(
      'Choose 2026-11-01T09:00 or later.'
    );

    const pw = { name: 'pw', type: 'password' as const, label: 'Password', minLength: 8 };
    expect(checkFieldValue(pw, 'short', true)).toBe('Use at least 8 characters.');

    // A fixed mask, so a password's length is not told.
    expect(formatFormValue(pw, 'hunter2')).toBe('••••••••');
    expect(formatFormValue(otp, '123456')).toBe('••••••');
    expect(formatFormValue(color, '#3366ff')).toBe('#3366ff');
    expect(formatFormValue(at, '2026-11-10T14:30')).toBe('2026-11-10 14:30');
    expect(formatFormValue({ name: 'c', type: 'custom', label: 'C' }, { id: 'c-1' })).toBe(
      '{"id":"c-1"}'
    );
    expect(formatFormValue(pw, '')).toBe('');
  });

  it('writes a Markdown summary that masks secrets and escapes Markdown', () => {
    const form = dev({
      title: 'Account',
      fields: [
        { name: 'email', type: 'email', label: 'Email *work*' },
        { name: 'pw', type: 'password', label: 'Password' },
        { name: 'tint', type: 'color', label: 'Accent' },
        { name: 'tags', type: 'tags', label: 'Tags' },
        { name: 'ok', type: 'checkbox', label: 'Agreed' },
      ],
    });
    expect(
      formValuesToMarkdown(form, {
        email: 'ada@example.com',
        pw: 'secret-pass',
        tint: '#3366ff',
        tags: ['a', 'b_c'],
        ok: true,
      })
    ).toBe(
      [
        '- **Email \\*work\\***: ada@example.com',
        '- **Password**: ••••••••',
        '- **Accent**: #3366ff',
        '- **Tags**: a, b\\_c',
        '- **Agreed**: Yes',
        '',
      ].join('\n')
    );
  });

  it('never writes passwords or one-time codes into drafts', async () => {
    const storage = createMemoryDrafts();
    const form = dev({
      title: 'Login',
      fields: [
        { name: 'email', type: 'email', label: 'Email' },
        { name: 'pw', type: 'password', label: 'Password' },
        { name: 'code', type: 'otp', label: 'Code' },
      ],
    });
    const controller = createFormController(form, {
      drafts: { storage, key: 'login', debounceMs: 0 },
      timers: noTimers,
    });
    controller.setValue('email', 'ada@example.com');
    controller.setValue('pw', 'secret-pass');
    controller.setValue('code', '123456');
    await controller.saveDraft();
    expect(storage.entries.get('login')?.values).toEqual({ email: 'ada@example.com' });
    storage.save('login', {
      format: 'texuli-form-draft',
      version: 1,
      values: { email: 'b@example.com', pw: 'planted', code: '999999' },
      step: 0,
      savedAt: 1,
    });
    const fresh = createFormController(form, {
      drafts: { storage, key: 'login' },
      timers: noTimers,
    });
    await fresh.restoreDraft();
    expect(fresh.getState().values).toMatchObject({ email: 'b@example.com', pw: '', code: '' });
  });
});

describe('clearable select (G118)', () => {
  it('accepts clearable on select fields only', () => {
    expect(
      codes(
        schemaWith({
          name: 'plan',
          type: 'select',
          label: 'Plan',
          clearable: false,
          options: [{ value: 'a', label: 'A' }],
        })
      )
    ).toEqual([]);
    expect(codes(schemaWith({ name: 'a', type: 'text', label: 'A', clearable: true }))).toEqual([
      'not-applicable $.fields[0].clearable',
    ]);
  });
});

describe('the per-step hook (G120)', () => {
  const twoSteps = {
    title: 'Signup',
    steps: [
      {
        id: 'account',
        title: 'Account',
        fields: [{ name: 'handle', type: 'text', label: 'Handle', required: true }],
      },
      { id: 'more', title: 'More', fields: [{ name: 'bio', type: 'textarea', label: 'Bio' }] },
    ],
  };

  it('runs after the step validates, blocks with field errors or a step message, and reports pending', async () => {
    let release: (value: unknown) => void = () => {};
    const onStep = vi.fn(
      (context: { step: { id: string }; values: Record<string, unknown> }) =>
        new Promise((resolve) => {
          release = resolve;
          void context;
        })
    );
    const controller = createFormController(compiled(twoSteps), {
      onStep: onStep as never,
      timers: noTimers,
    });
    // An invalid step never reaches the hook.
    expect((await controller.next()).ok).toBe(false);
    expect(onStep).not.toHaveBeenCalled();
    controller.setValue('handle', 'ada');
    const moving = controller.next();
    await settle();
    expect(controller.getState().status).toBe('validating');
    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ step: expect.objectContaining({ id: 'account' }), position: 0 })
    );
    expect(onStep.mock.calls[0]?.[0].values).toEqual({ handle: 'ada' });
    release({ ok: false, errors: { handle: 'That handle is taken.' } });
    const blocked = await moving;
    expect(blocked.ok).toBe(false);
    expect(controller.getState()).toMatchObject({
      step: 0,
      status: 'editing',
      errors: { handle: 'That handle is taken.' },
    });
    if (!blocked.ok) expect(blocked.firstInvalid).toBe('handle');

    const second = controller.next();
    await settle();
    release({ ok: false, message: 'Signups are paused.' });
    await second;
    expect(controller.getState().stepError).toBe('Signups are paused.');
    expect(controller.getState().step).toBe(0);

    const third = controller.next();
    await settle();
    release(undefined);
    expect((await third).ok).toBe(true);
    expect(controller.getState()).toMatchObject({ step: 1, stepError: null });
  });

  it('treats a throwing hook as a blocked step with a generic message', async () => {
    const controller = createFormController(compiled(twoSteps), {
      values: { handle: 'ada' },
      onStep: () => {
        throw new Error('network');
      },
      timers: noTimers,
    });
    expect((await controller.next()).ok).toBe(false);
    expect(controller.getState().stepError).toBe('This step could not be checked. Try again.');
  });
});

describe('url protocols (G121)', () => {
  it('defaults to https and lets a field allow http, never anything else', () => {
    const https = { name: 'site', type: 'url' as const, label: 'Site' };
    const both = { ...https, protocols: ['http', 'https'] as const };
    expect(checkFieldValue(https, 'http://example.com', false)).toBe(
      'Enter a valid https:// web address.'
    );
    expect(checkFieldValue(both, 'http://example.com/a?b=1', false)).toBeNull();
    expect(checkFieldValue(both, 'https://example.com', false)).toBeNull();
    for (const hostile of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'http://user:pw@example.com',
      'http:example.com',
      'http://exa​mple.com',
      'ftp://example.com',
    ]) {
      expect(checkFieldValue(both, hostile, false), hostile).not.toBeNull();
    }
    expect(matchesFormat('url', 'http://example.com', { protocols: ['http'] })).toBe(true);
    expect(matchesFormat('url', 'https://example.com', { protocols: ['http'] })).toBe(false);
    expect(checkFieldValue(both, 'http://example.com', false)).toBeNull();
    expect(codes(schemaWith({ ...https, protocols: ['http', 'https'] }))).toEqual([]);
    expect(codes(schemaWith({ ...https, protocols: ['javascript'] }))).toEqual([
      'type $.fields[0].protocols',
    ]);
    expect(codes(schemaWith({ ...https, protocols: [] }))).toEqual(['shape $.fields[0].protocols']);
    expect(codes(schemaWith({ name: 'a', type: 'text', label: 'A', protocols: ['http'] }))).toEqual(
      ['not-applicable $.fields[0].protocols']
    );
    const message = checkFieldValue({ ...https, protocols: ['http', 'https'] }, 'x', false);
    expect(message).toBe('Enter a valid web address (http:// or https://).');
  });
});

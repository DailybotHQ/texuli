// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  checkFieldValue,
  coerceValue,
  computeFormLogic,
  createFormController,
  createMemoryDrafts,
  createWebStorageDrafts,
  FORM_FORMATS,
  FORM_LIMITS,
  type FormFormat,
  type FormTimers,
  formatMessage,
  matchesFormat,
  validateFormSchema,
  validateFormValues,
} from '../src/model/index.ts';
import { CONTACT, compiled } from './fixtures.ts';

const field = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'text',
  label: name,
  ...extra,
});
const schemaWith = (...fields: unknown[]) => ({ title: 'T', fields });

/** Fake timers: run() fires everything scheduled. */
function fakeTimers(): FormTimers & { run(): void; size(): number } {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    set(callback) {
      next += 1;
      pending.set(next, callback);
      return next;
    },
    clear(handle) {
      pending.delete(handle as number);
    },
    run() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
    size: () => pending.size,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the schema validator', () => {
  it('compiles a multi-step form with sections, conditions and rules', () => {
    const form = compiled();
    expect(form.multiStep).toBe(true);
    expect(form.steps.map((s) => s.id)).toEqual(['about', 'attendance', 'extras']);
    expect(form.sections.map((s) => s.id)).toEqual(['when', 'what']);
    expect(form.fields).toHaveLength(17);
    expect(form.byName.get('guardian')?.show?.fields).toEqual(['age']);
    expect(form.rules[0]?.test.fields).toEqual(['arrival', 'departure']);
    expect(Object.isFrozen(form.schema)).toBe(true);
    const contact = compiled(CONTACT);
    expect(contact.multiStep).toBe(false);
    expect(contact.steps).toHaveLength(1);
    expect(contact.steps[0]?.title).toBe('Contact us');
  });

  it('refuses each invalid schema with its code and path', () => {
    const cases: [unknown, string, string][] = [
      [[], 'shape', '$'],
      [{ title: 'T' }, 'layout', '$'],
      [{ title: 'T', fields: [], sections: [] }, 'layout', '$'],
      [{ title: '', fields: [field('a')] }, 'missing', '$.title'],
      [{ ...schemaWith(field('a')), script: 'x' }, 'unknown-member', '$.script'],
      [schemaWith(field('a', { pattern: '^(a+)+$' })), 'unknown-member', '$.fields[0].pattern'],
      [schemaWith(field('a', { format: '^\\d+$' })), 'type', '$.fields[0].format'],
      [schemaWith(field('a', { type: 'password' })), 'type', '$.fields[0].type'],
      [schemaWith(field('A b')), 'name', '$.fields[0].name'],
      [schemaWith(field('a'), field('a')), 'duplicate', '$.fields[1].name'],
      [schemaWith(field('a', { min: 3 })), 'not-applicable', '$.fields[0].min'],
      [schemaWith(field('a', { type: 'number', min: 5, max: 1 })), 'range', '$.fields[0].min'],
      [schemaWith(field('a', { type: 'select' })), 'shape', '$.fields[0].options'],
      [
        schemaWith(
          field('a', {
            type: 'radio',
            options: [
              { value: 'x', label: 'X' },
              { value: 'x', label: 'Y' },
            ],
          })
        ),
        'duplicate',
        '$.fields[0].options[1].value',
      ],
      [
        schemaWith(
          field('a', { type: 'select', options: [{ value: 'x', label: 'X' }], default: 'y' })
        ),
        'default',
        '$.fields[0].default',
      ],
      [
        schemaWith(field('a', { type: 'date', default: '2026-02-30' })),
        'default',
        '$.fields[0].default',
      ],
      [schemaWith(field('a', { label: 'bad\u0000label' })), 'text', '$.fields[0].label'],
      [
        schemaWith(field('a', { link: { label: 'Help', href: 'javascript:alert(1)' } })),
        'url',
        '$.fields[0].link.href',
      ],
      [
        schemaWith(field('a', { link: { label: 'Help', href: 'http://example.com' } })),
        'url',
        '$.fields[0].link.href',
      ],
      [
        schemaWith(field('a', { type: 'file', accept: ['<script>'] })),
        'type',
        '$.fields[0].accept',
      ],
      [
        schemaWith(
          field('a', { when: { show: { op: 'field', name: 'b' } } }),
          field('b', { type: 'checkbox' })
        ),
        'forward-reference',
        '$.fields[0].when.show.name',
      ],
      [
        schemaWith(field('a', { when: { show: { op: 'field', name: 'zzz' } } })),
        'expression',
        '$.fields[0].when.show.name',
      ],
      [
        schemaWith(field('a'), field('b', { when: { show: { op: 'field', name: 'a' } } })),
        'expression',
        '$.fields[1].when.show',
      ],
      [
        schemaWith(field('a', { when: { hide: { op: 'bool', value: true } } })),
        'unknown-member',
        '$.fields[0].when.hide',
      ],
      [
        schemaWith(field('a', { when: { show: { op: 'call', fn: 'fetch', args: [] } } })),
        'expression',
        '$.fields[0].when.show.fn',
      ],
      [
        {
          ...schemaWith(field('a')),
          rules: [{ id: 'r', message: 'm', field: 'nope', test: { op: 'bool', value: true } }],
        },
        'name',
        '$.rules[0].field',
      ],
      [
        {
          title: 'T',
          steps: [
            { id: 's', title: 'S', fields: [field('a')] },
            { id: 's', title: 'S2', fields: [field('b')] },
          ],
        },
        'duplicate',
        '$.steps[1].id',
      ],
      [
        schemaWith(...Array.from({ length: FORM_LIMITS.fields + 1 }, (_, i) => field(`f${i}`))),
        'too-many',
        '$.fields',
      ],
    ];
    for (const [input, code, path] of cases) {
      const result = validateFormSchema(input);
      expect(result.ok, JSON.stringify(input).slice(0, 100)).toBe(false);
      const issue = result.issues.find((entry) => entry.code === code);
      expect(issue?.path, `${code} in ${JSON.stringify(result.issues).slice(0, 300)}`).toBe(path);
    }
  });

  it('checks help links at the given tier and validator names against the host list', () => {
    const local = schemaWith(field('a', { link: { label: 'Help', href: '/help' } }));
    expect(validateFormSchema(local).ok).toBe(false);
    expect(validateFormSchema(local, { tier: 'developer' }).ok).toBe(true);
    const named = schemaWith(field('a', { validator: 'uniqueHandle' }));
    expect(validateFormSchema(named).ok).toBe(true);
    expect(validateFormSchema(named, { validators: ['uniqueHandle'] }).ok).toBe(true);
    expect(validateFormSchema(named, { validators: [] }).issues[0]?.path).toBe(
      '$.fields[0].validator'
    );
  });

  it('stays linear on hostile schemas', () => {
    const huge = { title: 'T', fields: Array.from({ length: 100_000 }, (_, i) => field(`f${i}`)) };
    const deep: Record<string, unknown> = { op: 'bool', value: true };
    let node = deep;
    for (let i = 0; i < 50_000; i += 1) node = { op: 'not', value: node };
    const many = {
      title: 'T',
      fields: Array.from({ length: FORM_LIMITS.fields }, (_, i) =>
        field(`f${i}`, {
          type: 'select',
          options: Array.from({ length: 10_000 }, (_, j) => ({ value: `${j}`, label: 'x' })),
        })
      ),
    };
    const start = performance.now();
    expect(validateFormSchema(huge).issues[0]?.code).toBe('too-many');
    expect(
      validateFormSchema(schemaWith(field('a', { when: { show: node } }))).issues[0]?.code
    ).toBe('expression');
    expect(validateFormSchema(many).issues[0]?.code).toBe('too-many');
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe('named formats', () => {
  const cases: Record<FormFormat, [string[], string[]]> = {
    email: [
      ['ada@example.com', 'a.b+c@mail.example.org'],
      ['ada', 'a@b', 'a b@example.com', 'a@@example.com', '.a@example.com', 'a@example.c0m'],
    ],
    url: [
      ['https://example.com', 'https://example.com/a?b=1'],
      [
        'http://example.com',
        'javascript:alert(1)',
        'mailto:a@example.com',
        'https://',
        'example.com',
      ],
    ],
    phone: [
      ['+57 300 123 4567', '(555) 010-0199'],
      ['12345', '555-CALL-NOW', '1+2345678'],
    ],
    'postal-code': [
      ['SW1A 1AA', '110111', '10115'],
      ['1', '-123', 'a_b'],
    ],
    'postal-code-us': [
      ['94105', '94105-1234'],
      ['9410', '94105-12'],
    ],
    'postal-code-ca': [['K1A 0B1', 'K1A0B1'], ['K1A 0B']],
    'postal-code-uk': [['SW1A 1AA', 'M1 1AE'], ['SW1A1A']],
    'postal-code-de': [['10115'], ['1011']],
    'postal-code-fr': [['75008'], ['7500A']],
    'postal-code-es': [['28013'], ['2801']],
    'postal-code-mx': [['06600'], ['066000']],
    'postal-code-br': [['01310-100', '01310100'], ['01310-10']],
    'postal-code-co': [['110111'], ['11011']],
    'postal-code-in': [['110001'], ['11000']],
    'postal-code-jp': [['100-0001', '1000001'], ['100-001']],
    'postal-code-au': [['2000'], ['200']],
    digits: [['0042'], ['4.2', '']],
    alphanumeric: [['Ab12'], ['a-b']],
    slug: [['my-event-2026'], ['My-Event', '-a', 'a--b']],
    'iso-date': [['2024-02-29'], ['2023-02-29', '2024-2-1']],
    time: [
      ['09:30', '23:59'],
      ['24:00', '9:30'],
    ],
    'hex-color': [
      ['#3366ff', '#fff'],
      ['3366ff', '#ggg'],
    ],
  };

  it('accepts and refuses representative values for every format', () => {
    expect(Object.keys(cases).sort()).toEqual([...FORM_FORMATS].sort());
    for (const [format, [good, bad]] of Object.entries(cases) as [
      FormFormat,
      [string[], string[]],
    ][]) {
      for (const value of good)
        expect(matchesFormat(format, value), `${format} ${value}`).toBe(true);
      for (const value of bad)
        expect(matchesFormat(format, value), `${format} ${value}`).toBe(false);
    }
  });

  it('checks hostile inputs in linear time', () => {
    const start = performance.now();
    for (const format of FORM_FORMATS) {
      for (const value of [
        `${'a'.repeat(999)}!`,
        `${'1-'.repeat(499)}x`,
        `${'a.'.repeat(400)}@${'b.'.repeat(40)}`,
        'x'.repeat(5_000_000),
      ]) {
        matchesFormat(format, value);
      }
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('values and messages', () => {
  it('coerces values per type and refuses the wrong shape', () => {
    const cases: [Record<string, unknown>, unknown, unknown][] = [
      [{ type: 'text' }, 'hi', 'hi'],
      [{ type: 'text' }, 3, undefined],
      [{ type: 'text' }, 'x'.repeat(FORM_LIMITS.valueLength + 1), undefined],
      [{ type: 'number' }, '', null],
      [{ type: 'number' }, Number.NaN, undefined],
      [{ type: 'checkbox' }, 'true', undefined],
      [{ type: 'date' }, '2026-11-02', '2026-11-02'],
      [{ type: 'date' }, '2026-13-02', undefined],
      [{ type: 'time' }, '25:00', undefined],
      [{ type: 'tags' }, ['a', 'b'], ['a', 'b']],
      [{ type: 'tags' }, ['a', 1], undefined],
      [
        { type: 'file' },
        [{ name: 'a.png', size: 10, type: 'image/png', extra: 1 }],
        [{ name: 'a.png', size: 10, type: 'image/png' }],
      ],
      [{ type: 'file' }, [{ name: '', size: 1 }], undefined],
    ];
    for (const [shape, raw, expected] of cases) {
      expect(coerceValue(shape as never, raw), JSON.stringify([shape, raw]).slice(0, 80)).toEqual(
        expected
      );
    }
  });

  it('reports the first closed-rule problem with the field or default message', () => {
    const f = (extra: Record<string, unknown>) =>
      ({ name: 'x', label: 'Code', type: 'text', ...extra }) as never;
    expect(checkFieldValue(f({}), '', true)).toBe('Code is required.');
    expect(checkFieldValue(f({ minLength: 3 }), 'ab', false)).toBe('Use at least 3 characters.');
    expect(checkFieldValue(f({ maxLength: 2 }), '😀😀', false)).toBe(null);
    expect(checkFieldValue(f({ format: 'postal-code-us' }), 'abc', false)).toBe(
      'Enter a valid postal code us.'
    );
    expect(checkFieldValue(f({ messages: { required: 'Tell us your {label}' } }), ' ', true)).toBe(
      'Tell us your Code'
    );
    expect(checkFieldValue(f({ type: 'number', min: 1, step: 0.5 }), 1.25, false)).toBe(
      'Enter a value in steps of 0.5.'
    );
    expect(checkFieldValue(f({ type: 'number', step: 0.1 }), 0.3, false)).toBe(null);
    expect(checkFieldValue(f({ type: 'date', min: '2026-11-01' }), '2026-10-31', false)).toBe(
      'Choose 2026-11-01 or later.'
    );
    expect(
      checkFieldValue(f({ type: 'select', options: [{ value: 'a', label: 'A' }] }), 'b', false)
    ).toBe('Choose one of the options.');
    expect(checkFieldValue(f({ type: 'checkbox' }), false, true)).toBe('Code is required.');
    expect(
      checkFieldValue(
        f({ type: 'file', accept: ['.pdf'] }),
        [{ name: 'a.exe', size: 1, type: '' }],
        false
      )
    ).toBe('This file type is not accepted.');
    expect(
      checkFieldValue(
        f({ type: 'file', maxSize: 2048 }),
        [{ name: 'a.pdf', size: 4096, type: '' }],
        false
      )
    ).toBe('Each file must be 2 KB or smaller.');
    expect(checkFieldValue(f({ type: 'email' }), 'not-an-email', false)).toBe(
      'Enter a valid email address.'
    );
    expect(formatMessage('{a} {b} {', { a: 1 })).toBe('1 {b} {');
  });
});

describe('conditional logic', () => {
  const form = compiled();

  it('shows, requires and enables fields from earlier answers, through steps and sections', () => {
    const minor = computeFormLogic(form, { age: 15, track: null, newsletter: false });
    expect(minor.fields.guardian).toEqual({ visible: true, required: true, enabled: true });
    expect(minor.steps).toEqual([true, true, false]);
    expect(minor.fields.terms?.visible).toBe(false);
    const adult = computeFormLogic(form, { age: 30, track: 'design', newsletter: false });
    expect(adult.fields.guardian?.visible).toBe(false);
    expect(adult.steps[2]).toBe(true);
    expect(adult.fields.topics).toEqual({ visible: true, required: false, enabled: false });
    expect(computeFormLogic(form, { age: null }).fields.guardian?.visible).toBe(false);
  });

  it('validates visible, enabled fields and cross-field rules, never hidden ones', () => {
    const values = {
      name: 'Ada',
      email: 'ada@example.com',
      age: 30,
      arrival: '2026-11-10',
      departure: '2026-11-09',
      track: 'design',
      terms: false,
    };
    const result = validateFormValues(form, values);
    expect(result.errors).toEqual({
      departure: 'Departure must be on or after arrival.',
      terms: 'I accept the code of conduct is required.',
    });
    expect(result.errors.guardian).toBeUndefined();
    const young = validateFormValues(form, { ...values, age: 12 });
    expect(young.errors.age).toBe('Enter 13 or more.');
  });
});

describe('the controller', () => {
  const valid = {
    name: 'Ada Example',
    email: 'ada@example.com',
    age: 30,
    arrival: '2026-11-10',
    departure: '2026-11-12',
    track: 'engineering',
    terms: true,
  };

  it('walks steps, blocks on an invalid step and submits only visible, enabled values', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const controller = createFormController(compiled(), { onSubmit });
    const seen: string[] = [];
    controller.subscribe((state) => seen.push(state.status));
    let outcome = await controller.next();
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.firstInvalid).toBe('name');
    expect(controller.getState().errors).toMatchObject({
      name: 'Full name is required.',
      email: 'Email is required.',
    });
    expect(controller.getState().errors.arrival).toBeUndefined();
    for (const [name, value] of Object.entries(valid)) controller.setValue(name, value);
    controller.setValue('guardian', 'Should not be sent');
    expect(controller.getState().errors).toEqual({});
    outcome = await controller.next();
    expect(outcome.ok).toBe(true);
    expect(controller.getState().step).toBe(1);
    expect(controller.getState().steps.map((s) => s.id)).toEqual(['about', 'attendance', 'extras']);
    controller.back();
    expect(controller.getState().step).toBe(0);
    expect(await controller.goTo(2)).toBe(true);
    controller.setValue('topics', ['a']);
    const result = await controller.submit();
    expect(result.ok).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
    const sent = (onSubmit.mock.calls[0] as unknown as [{ values: Record<string, unknown> }])[0]
      .values;
    expect(sent.guardian).toBeUndefined();
    expect(sent.topics).toBeUndefined();
    expect(sent.email).toBe('ada@example.com');
    expect(controller.getState().status).toBe('submitted');
    expect(seen).toContain('submitting');
  });

  it('ignores refused values, clears an error as it is fixed and moves to the first invalid step', async () => {
    const controller = createFormController(compiled());
    controller.setValue('age', 'thirty');
    expect(controller.getState().values.age).toBe(null);
    controller.setValue('nope', 1);
    await controller.blur('email');
    expect(controller.getState().touched.email).toBe(true);
    expect(controller.getState().errors.email).toBe('Email is required.');
    controller.setValue('email', 'ada@');
    expect(controller.getState().errors.email).toBe('Enter a valid email address.');
    controller.setValue('email', 'ada@example.com');
    expect(controller.getState().errors.email).toBeUndefined();
    for (const [name, value] of Object.entries(valid)) controller.setValue(name, value);
    controller.setValue('departure', '2026-11-01');
    expect(await controller.goTo(2)).toBe(false);
    expect(controller.getState().step).toBe(1);
    const outcome = await controller.submit();
    expect(outcome.ok === false && outcome.firstInvalid).toBe('departure');
    expect(controller.getState().step).toBe(1);
    expect(controller.getState().status).toBe('failed');
  });

  it('runs host validators, marks them pending, fails closed when one is missing and shows server errors', async () => {
    const schema = schemaWith(
      field('handle', { validator: 'uniqueHandle', required: true }),
      field('code', { validator: 'missing' })
    );
    let resolve: (value: string | null) => void = () => {};
    const uniqueHandle = vi.fn(
      (_value: unknown, { signal }: { signal: AbortSignal }) =>
        new Promise<string | null>((done) => {
          resolve = done;
          signal.addEventListener('abort', () => done(null));
        })
    );
    const controller = createFormController(compiled(schema), {
      validators: { uniqueHandle },
      onSubmit: () => ({
        ok: false,
        errors: { handle: 'Taken on the server.', other: 'x' },
        message: 'Not saved.',
      }),
    });
    controller.setValue('handle', 'ada');
    const blur = controller.blur('handle');
    await settle();
    expect(controller.getState().pending.handle).toBe(true);
    resolve('That handle is taken.');
    await blur;
    expect(controller.getState().errors.handle).toBe('That handle is taken.');
    expect(controller.getState().pending.handle).toBeUndefined();
    controller.setValue('code', 'x');
    const submit = controller.submit();
    await settle();
    resolve(null);
    const outcome = await submit;
    expect(outcome.ok === false && outcome.errors.code).toBe(
      'This answer cannot be checked right now.'
    );
    controller.setValue('code', '');
    const stripped = createFormController(
      compiled(schemaWith(field('handle', { validator: 'uniqueHandle' }))),
      {
        validators: { uniqueHandle: () => null },
        onSubmit: () => ({
          ok: false,
          errors: { handle: 'Taken on the server.', other: 'x' },
          message: 'Not saved.',
        }),
      }
    );
    const failed = await stripped.submit();
    expect(failed.ok === false && failed.errors).toEqual({ handle: 'Taken on the server.' });
    expect(stripped.getState().formErrors).toEqual(['Not saved.']);
  });

  it('autosaves drafts after the debounce, restores them as untrusted data and clears them on submit', async () => {
    const timers = fakeTimers();
    const storage = createMemoryDrafts();
    const drafts = { storage, key: 'registration', debounceMs: 500 };
    const controller = createFormController(compiled(), {
      drafts,
      timers,
      now: () => 1_000,
      onSubmit: () => undefined,
    });
    controller.setValue('name', 'Ada');
    controller.setValue('email', 'ada@example.com');
    controller.setValue('badge', [{ name: 'me.png', size: 10, type: 'image/png' }]);
    expect(timers.size()).toBe(1);
    expect(storage.entries.size).toBe(0);
    timers.run();
    await settle();
    const saved = storage.entries.get('registration');
    expect(saved?.values).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
    expect(saved?.values.badge).toBeUndefined();
    expect(controller.getState().draft).toEqual({ status: 'saved', savedAt: 1_000 });

    // A tampered draft: wrong types are dropped, unknown fields ignored, the step clamped.
    storage.save('registration', {
      format: 'texuli-form-draft',
      version: 1,
      values: { name: 'Grace', age: 'old', email: 42, __proto__: { polluted: true }, unknown: 1 },
      step: 9,
      savedAt: 5,
    } as never);
    const restored = createFormController(compiled(), { drafts, timers });
    expect(await restored.restoreDraft()).toBe(true);
    expect(restored.getState().values).toMatchObject({ name: 'Grace', age: null, email: '' });
    expect(restored.getState().step).toBe(0);
    expect(restored.getState().draft.status).toBe('restored');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    for (const [name, value] of Object.entries(valid)) controller.setValue(name, value);
    expect((await controller.submit()).ok).toBe(true);
    expect(storage.entries.size).toBe(0);
    expect(controller.getState().draft.status).toBe('none');
  });

  it('reads and writes Web Storage drafts and survives broken storage', async () => {
    const store = new Map<string, string>();
    const storage = createWebStorageDrafts({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    });
    const controller = createFormController(compiled(CONTACT), {
      drafts: { storage, key: 'contact', debounceMs: 0 },
    });
    controller.setValue('email', 'ada@example.com');
    await controller.saveDraft();
    expect(JSON.parse(store.get('contact') ?? '{}').values.email).toBe('ada@example.com');
    store.set('contact', '{not json');
    expect(
      await createFormController(compiled(CONTACT), {
        drafts: { storage, key: 'contact' },
      }).restoreDraft()
    ).toBe(false);
    const broken = createFormController(compiled(CONTACT), {
      drafts: {
        storage: {
          load: () => {
            throw new Error('x');
          },
          save: () => Promise.reject(new Error('quota')),
          remove: () => undefined,
        },
        key: 'k',
      },
    });
    expect(await broken.restoreDraft()).toBe(false);
    await broken.saveDraft();
    expect(broken.getState().draft.status).toBe('error');
    controller.destroy();
    broken.destroy();
  });
});

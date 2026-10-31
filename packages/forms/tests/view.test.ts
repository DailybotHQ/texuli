import { createRequire } from 'node:module';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src/index.ts';
import {
  createFormController,
  createMemoryDrafts,
  FORM_FIELD_TYPES,
  validateFormSchema,
} from '../src/model/index.ts';
import { compiled, REGISTRATION } from './fixtures.ts';
import MultiFormHarness from './MultiFormHarness.svelte';

afterEach(() => cleanup());

const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};
// Name and ARIA rules only: happy-dom has no layout (contrast lives in the browser sweeps).
const RULES = [
  'button-name',
  'label',
  'aria-input-field-name',
  'aria-toggle-field-name',
  'aria-allowed-attr',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'aria-required-attr',
  'duplicate-id-aria',
  'heading-order',
  'link-name',
];

/** Every built-in field type on one page (custom fields are host-painted: view-gaps.test.ts). */
const BUILT_IN_TYPES = FORM_FIELD_TYPES.filter((type) => type !== 'custom');
const EVERY_TYPE = {
  title: 'Every field',
  fields: BUILT_IN_TYPES.map((type) => ({
    name: `f${type.replace(/[^a-z]/g, '')}`,
    type,
    label: `Field ${type}`,
    description: `About ${type}`,
    // Required everywhere, so aria-required lands only where ARIA allows it.
    required: true,
    ...(type === 'select' || type === 'radio' || type === 'multiselect'
      ? {
          options: [
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ],
        }
      : {}),
    ...(type === 'slider' ? { min: 0, max: 10 } : {}),
  })),
};

const ADULT = {
  name: 'Ada Example',
  email: 'ada@example.com',
  age: 30,
  arrival: '2026-11-10',
  departure: '2026-11-12',
};

describe('SchemaForm', () => {
  it('paints every field type with a texuli control named by its label, with no name or ARIA violations (axe)', async () => {
    // Credential fields are app-authored here (the developer tier).
    const every = validateFormSchema(EVERY_TYPE, { tier: 'developer' });
    if (!every.ok) throw new Error(JSON.stringify(every.issues));
    const { container } = render(SchemaForm, { props: { form: every.form, id: 'all' } });
    const form = screen.getByRole('form', { name: 'Every field' });
    expect(form.getAttribute('novalidate')).not.toBeNull();
    // Per-type controls load on first use (G119); wait until none is a placeholder.
    await waitFor(() => expect(container.querySelector('.tx-forms__control-loading')).toBeNull());
    for (const type of BUILT_IN_TYPES) {
      const root = container.querySelector(`[data-type="${type}"]`);
      expect(root, type).not.toBeNull();
    }
    expect(
      screen
        .getByRole('textbox', { name: /^Field text\b(?!area)/ })
        .getAttribute('aria-describedby')
    ).toContain('all-field-ftext-description');
    expect(screen.getByRole('spinbutton', { name: /Field number/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Field checkbox/ })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Field switch/ })).toBeTruthy();
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getByRole('group', { name: /Field multiselect/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Field slider/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Field select/ })).toBeTruthy();
    expect(screen.getByLabelText(/Field file/).getAttribute('type')).toBe('file');
    const result = await axe.run(container, { runOnly: { type: 'rule', values: RULES } });
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    ).toEqual([]);
  });

  it('blocks Next on an invalid step, focuses an error summary and links errors to their controls', async () => {
    render(SchemaForm, { props: { form: compiled(), id: 'reg' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    await waitFor(() => expect(document.activeElement).toBe(summary.parentElement));
    expect(summary.parentElement?.textContent).toContain('2 answers need attention.');
    const name = screen.getByRole('textbox', { name: /Full name/ });
    expect(name.getAttribute('aria-invalid')).toBe('true');
    const errorId = (name.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .find((id) => id.endsWith('-error'));
    expect(document.getElementById(errorId ?? '')?.textContent).toBe('Full name is required.');
    expect(document.getElementById(errorId ?? '')?.getAttribute('role')).toBe('alert');
    await fireEvent.click(screen.getByRole('link', { name: 'Email: Email is required.' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Email/ }));
  });

  it('moves through steps, focuses each step heading, announces it and shows conditional fields', async () => {
    render(SchemaForm, { props: { form: compiled(), values: ADULT, id: 'reg' } });
    expect(screen.queryByRole('textbox', { name: /Guardian/ })).toBeNull();
    await fireEvent.input(screen.getByRole('spinbutton', { name: 'Age' }), {
      target: { value: '15' },
    });
    expect(screen.getByRole('textbox', { name: /Guardian name/ })).toBeTruthy();
    await fireEvent.input(screen.getByRole('textbox', { name: /Guardian name/ }), {
      target: { value: 'Grace Example' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const heading = await screen.findByRole('heading', { name: 'Attendance' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole('status').textContent).toBe('Step 2 of 2: Attendance');
    expect(screen.getByRole('group', { name: 'When' })).toBeTruthy();
    await fireEvent.click(await screen.findByRole('radio', { name: 'Design' }));
    // Choosing a track reveals the third step.
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('About you'));
  });

  it('submits visible values with their files and focuses the confirmation', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const schema = {
      title: 'Feedback',
      submitLabel: 'Send feedback',
      fields: [
        { name: 'email', type: 'email', label: 'Email', required: true },
        { name: 'shot', type: 'file', label: 'Screenshot', accept: ['image/*'], maxItems: 1 },
        { name: 'more', type: 'checkbox', label: 'Contact me' },
        {
          name: 'phone',
          type: 'text',
          label: 'Phone',
          format: 'phone',
          when: { show: { op: 'field', name: 'more' } },
        },
      ],
    };
    render(SchemaForm, { props: { form: compiled(schema), onSubmit } });
    await fireEvent.input(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'ada@example.com' },
    });
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    const upload = await screen.findByLabelText('Screenshot', { selector: 'input' });
    await fireEvent.change(upload, { target: { files: [file] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [submission] = onSubmit.mock.calls[0] as unknown as [
      { values: Record<string, unknown>; files: Record<string, File[]> },
    ];
    expect(submission.values).toEqual({
      email: 'ada@example.com',
      shot: [{ name: 'shot.png', size: 3, type: 'image/png' }],
      more: false,
    });
    expect(submission.files.shot?.[0]).toBe(file);
    const done = await screen.findByText('Thank you. Your answers were sent.', {
      selector: '.tx-forms__done',
    });
    await waitFor(() => expect(document.activeElement).toBe(done));
  });

  it('rebuilds its controller for a new form: new fields respond, steps and errors follow', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }) as const);
    const onValueChange = vi.fn();
    const first = compiled({
      title: 'Contact',
      fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
    });
    const second = compiled({
      title: 'Profile',
      submitLabel: 'Save profile',
      steps: [
        {
          id: 'who',
          title: 'Who',
          fields: [
            { name: 'email', type: 'email', label: 'Email', required: true },
            { name: 'nickname', type: 'text', label: 'Nickname', required: true },
          ],
        },
        {
          id: 'wrap',
          title: 'Wrap up',
          fields: [{ name: 'notes', type: 'textarea', label: 'Notes' }],
        },
      ],
    });
    const view = render(SchemaForm, {
      props: { form: first, onSubmit, onValueChange, id: 'swap' },
    });
    await fireEvent.input(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'ada@example.com' },
    });
    await view.rerender({ form: second, onSubmit, onValueChange, id: 'swap' });
    expect(screen.getByRole('form', { name: 'Profile' })).toBeTruthy();
    // The new form's steps: Next checks its required fields (values started over).
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const summary = await screen.findByRole('heading', { name: 'There is a problem' });
    expect(summary.parentElement?.textContent).toContain('Nickname: Nickname is required.');
    await fireEvent.input(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'grace@example.com' },
    });
    await fireEvent.input(screen.getByRole('textbox', { name: /Nickname/ }), {
      target: { value: 'Grace' },
    });
    expect(onValueChange).toHaveBeenLastCalledWith(
      'nickname',
      'Grace',
      expect.objectContaining({ nickname: 'Grace' })
    );
    expect(screen.getByRole('textbox', { name: /Nickname/ })).toHaveProperty('value', 'Grace');
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Wrap up' });
    await fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [submission] = onSubmit.mock.calls[0] as unknown as [{ values: Record<string, unknown> }];
    expect(submission.values).toMatchObject({ email: 'grace@example.com', nickname: 'Grace' });
  });

  it('paints a passed controller form and warns when the form prop differs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const mine = compiled({
        title: 'Mine',
        fields: [{ name: 'email', type: 'email', label: 'Email' }],
      });
      const other = compiled({ title: 'Other', fields: [{ name: 'x', type: 'text', label: 'X' }] });
      const controller = createFormController(mine);
      render(SchemaForm, { props: { form: other, controller } });
      await tick();
      expect(screen.getByRole('form', { name: 'Mine' })).toBeTruthy();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('another form'));
      controller.destroy();
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps field ids apart from its own ids, whatever the field names (title, description, summary)', async () => {
    const names = ['title', 'description', 'summary'];
    const { container } = render(SchemaForm, {
      props: {
        id: 'clash',
        form: compiled({
          title: 'Clashing names',
          description: 'Fields named after the form parts.',
          fields: names.map((name) => ({
            name,
            type: 'text',
            label: `Field ${name}`,
            description: `About ${name}`,
            required: true,
          })),
        }),
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'There is a problem' });
    expect(screen.getByRole('form', { name: 'Clashing names' })).toBeTruthy();
    for (const name of names) {
      const control = screen.getByRole('textbox', { name: `Field ${name}` });
      expect(control.id, name).not.toBe(`clash-${name}`);
    }
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    const result = await axe.run(container, {
      runOnly: { type: 'rule', values: [...RULES, 'duplicate-id'] },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it('names each multi-step progress landmark after its form, so two forms pass landmark-unique (axe)', async () => {
    const { container } = render(MultiFormHarness, {
      props: {
        first: compiled(REGISTRATION),
        second: compiled({ ...REGISTRATION, title: 'Volunteer signup' }),
      },
    });
    const navs = await screen.findAllByRole('navigation');
    expect(navs.map((nav) => nav.getAttribute('aria-label'))).toEqual([
      'Event registration progress',
      'Volunteer signup progress',
    ]);
    const result = await axe.run(container, {
      runOnly: { type: 'rule', values: ['landmark-unique'] },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it('restores a draft on mount, announces it, autosaves and uses localized labels', async () => {
    const storage = createMemoryDrafts();
    storage.save('feedback', {
      format: 'texuli-form-draft',
      version: 1,
      values: { name: 'Draft name' },
      step: 0,
      savedAt: 1,
    });
    render(SchemaForm, {
      props: {
        form: compiled(REGISTRATION),
        drafts: { storage, key: 'feedback', debounceMs: 0 },
        labels: { next: 'Siguiente', draftSaved: 'Borrador guardado' },
      },
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Your saved draft was restored.')
    );
    expect((screen.getByRole('textbox', { name: /Full name/ }) as HTMLInputElement).value).toBe(
      'Draft name'
    );
    await fireEvent.input(screen.getByRole('textbox', { name: /Full name/ }), {
      target: { value: 'Ada' },
    });
    await waitFor(() => expect(storage.entries.get('feedback')?.values.name).toBe('Ada'));
    await waitFor(() => expect(screen.getByText('Borrador guardado')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeTruthy();
    await tick();
  });
});

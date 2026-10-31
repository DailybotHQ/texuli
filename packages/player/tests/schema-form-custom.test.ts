import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { createFormPlayerHost } from '../../forms/src/host/index.ts';
import { checkFormDraft } from '../../forms/src/model/index.ts';
import RelationPicker from '../../forms/tests/RelationPicker.svelte';
import type { FormPlayerHost } from '../src/form-host.ts';
import { formActionValues } from '../src/form-values.ts';
import Player from '../src/Player.svelte';

/**
 * Host-painted `custom` fields in agent output (G113, PLAN_011
 * T-gaps-113-121): the player hands validation the custom kinds its form
 * host paints (`customKinds`), so a draft may declare a custom field only of
 * a registered kind; any other is refused before painting. The submitted
 * custom answer reaches the action as JSON text.
 */

const TICKET = {
  title: 'Open a ticket',
  submitLabel: 'Open ticket',
  fields: [
    { name: 'subject', type: 'text', label: 'Subject', required: true },
    { name: 'customer', type: 'custom', kind: 'relation', label: 'Customer', required: true },
  ],
};

const blueprint = (schema: unknown) => ({
  id: 'layout-page',
  props: { title: 'Support' },
  children: [{ id: 'schema-form', props: { action: 'open-ticket', schema } }],
});

const painter = createFormPlayerHost({ customFields: { relation: { component: RelationPicker } } });
/** A host whose check takes the kinds only from the player's arguments. */
const host = (customKinds?: readonly string[]): FormPlayerHost => ({
  checkForm: checkFormDraft,
  ...(customKinds ? { customKinds } : {}),
  present: painter.present,
});

describe('custom fields in the player (G113)', () => {
  it('refuses a custom field of a kind the host does not paint', { timeout: 30_000 }, async () => {
    const errors: string[] = [];
    const { container } = render(Player, {
      props: {
        blueprint: blueprint(TICKET),
        label: 'Ticket',
        formHost: host(),
        onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
          for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
        },
      },
    });
    await waitFor(() => expect(errors).toContain('form-schema'));
    expect(container.querySelector('form')).toBeNull();
  });

  it('paints a registered kind and proposes its answer with the others', {
    timeout: 30_000,
  }, async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    render(Player, {
      props: {
        blueprint: blueprint(TICKET),
        label: 'Ticket',
        formHost: host(['relation']),
        onAction,
      },
    });
    await screen.findByRole('form', { name: 'Open a ticket' });
    const picker = document.querySelector<HTMLInputElement>('[data-relation-picker="relation"]');
    expect(picker).not.toBeNull();
    await fireEvent.input(screen.getByRole('textbox', { name: /Subject/ }), {
      target: { value: 'Printer jam' },
    });
    await fireEvent.input(picker as HTMLInputElement, { target: { value: 'c-1' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledOnce());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: 'open-ticket',
      values: { subject: 'Printer jam', customer: 'c-1' },
    });
  });

  it('maps object and mixed-list answers to JSON text', () => {
    expect(
      formActionValues({ customer: { id: 'c-1' }, picks: [1, { id: 'x' }], tags: ['a'] })
    ).toEqual({ customer: '{"id":"c-1"}', picks: '[1,{"id":"x"}]', tags: '["a"]' });
  });
});

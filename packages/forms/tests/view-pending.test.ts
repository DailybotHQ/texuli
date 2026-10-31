/**
 * The readiness signal of per-type controls (G119): a SchemaForm whose lazy
 * controls have not arrived carries `data-tx-pending` and `aria-busy`, and so
 * does each placeholder, until the controls mount. Hosts, tests and the
 * visual harness wait for it. In its own file, so no other test has loaded a
 * control chunk first (vitest isolates modules per file).
 */
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { SchemaForm } from '../src/index.ts';
import { SCHEMA_FORM_CONTROLS } from '../src/view/controls/index.ts';
import { compiled } from './fixtures.ts';

afterEach(() => cleanup());

describe('control readiness (G119)', () => {
  it('marks the form and each placeholder data-tx-pending (and the form aria-busy) until its controls arrive', async () => {
    // No control chunk has loaded in this file yet.
    const form = compiled({
      title: 'Pending',
      fields: [{ name: 'topics', type: 'tags', label: 'Topics' }],
    });
    const { container } = render(SchemaForm, { props: { form } });
    const root = screen.getByRole('form', { name: 'Pending' });
    expect(root.hasAttribute('data-tx-pending')).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.tx-forms__control-loading[data-tx-pending]')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('[data-tx-pending]')).toBeNull());
    expect(root.hasAttribute('aria-busy')).toBe(false);
    // With the static registry nothing is ever pending.
    const eager = render(SchemaForm, {
      props: {
        form: compiled({
          title: 'Eager',
          fields: [{ name: 'day', type: 'datetime', label: 'Day' }],
        }),
        controls: SCHEMA_FORM_CONTROLS,
      },
    });
    expect(eager.container.querySelector('[data-tx-pending]')).toBeNull();
  });
});

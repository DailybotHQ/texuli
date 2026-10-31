import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';

// data-filter-builder in the player (T-gaps-100-104, G101): a blueprint's
// optionLabels give enum values their menu text, and its issues show under
// their conditions with the value control marked invalid.

function envelope(tree: unknown) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'filter-props',
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.3.0',
    tree: { id: 'layout-page', props: { title: 'Filters' }, children: [tree] },
  };
}

describe('data-filter-builder props in the player', () => {
  it('shows optionLabels as menu text and issues under their condition', async () => {
    render(Player, {
      props: {
        blueprint: envelope({
          id: 'data-filter-builder',
          props: {
            label: 'Order filter',
            fields: [
              {
                key: 'status',
                header: 'Status',
                type: 'enum',
                options: ['open', 'closed'],
                optionLabels: { open: 'Open order' },
              },
            ],
            value: {
              type: 'group',
              op: 'and',
              children: [{ type: 'condition', field: 'status', operator: 'eq', value: 'open' }],
            },
            issues: [{ path: [0], message: 'Open orders are archived nightly' }],
          },
        }),
      },
    });
    const region = await screen.findByRole('region', { name: 'Order filter' }, { timeout: 5000 });
    const value = within(region).getByRole('combobox', { name: 'Value' }) as HTMLSelectElement;
    expect(value.value).toBe('open');
    expect([...value.options].map((option) => option.textContent)).toEqual([
      'Choose…',
      'Open order',
      'closed',
    ]);
    expect(value.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(value.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Open orders are archived nightly'
    );
  });
});

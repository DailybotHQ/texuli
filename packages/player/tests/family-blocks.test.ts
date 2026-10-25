import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Player from '../src/Player.svelte';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

/** Blocks the core parser does not know, but their own family renders (audit G05). */
const FAMILY_ONLY: ReadonlyArray<[string, Record<string, unknown>]> = [
  [
    'blocks-diagram',
    {
      type: 'flow',
      nodes: [
        { id: 'plan', label: 'Plan' },
        { id: 'ship', label: 'Ship' },
      ],
      edges: [{ from: 'plan', to: 'ship' }],
    },
  ],
  ['blocks-embed', { type: 'link-preview', href: 'https://example.com/guide', title: 'Guide' }],
  [
    'blocks-map',
    {
      type: 'map',
      label: 'Fictional harbor',
      points: [{ id: 'north', label: 'North Pier', lat: 10, lng: 20 }],
    },
  ],
];

function doc(id: string, block: unknown) {
  return {
    id: 'layout-doc',
    props: { title: 'Family report' },
    children: [{ id, props: { block } }],
  };
}

describe('Player block validation', () => {
  it.each(FAMILY_ONLY)('accepts a valid %s block checked by its own family', (id, block) => {
    const onDiagnostics = vi.fn();
    render(Player, {
      props: {
        blueprint: doc(id, block),
        loaders: { 'layout-doc': layoutLoader, [id]: () => new Promise(() => {}) },
        loadTimeoutMs: 0,
        onDiagnostics,
      },
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onDiagnostics.mock.calls[0]?.[0].receipt.ok).toBe(true);
  });

  it('refuses a block that another family renders', () => {
    render(Player, {
      props: { blueprint: doc('blocks-text', FAMILY_ONLY[0]?.[1]) },
    });
    expect(screen.getByRole('alert').textContent).toContain('could not be validated');
  });
});

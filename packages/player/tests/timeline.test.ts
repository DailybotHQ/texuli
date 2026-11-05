/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';

/**
 * `data-timeline` in the player (spec 0.12.0, D-G-033): an agent's groups
 * paint as headers with bands, markers as labelled lines, and the selected
 * row as the current one; collapsing a group and selecting a row write the
 * bound list and string states back and run `on.collapse` and `on.select`.
 */

afterEach(cleanup);

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/fixtures/golden/source-tickets.json'), 'utf8')
) as Record<string, unknown>;

const blueprint = {
  ...golden,
  state: {
    folded: { type: 'list', maxItems: 100, initial: [] },
    picked: { type: 'string', maxLength: 64, initial: 'p' },
  },
  tree: {
    id: 'layout-page',
    props: { title: 'Plan' },
    children: [timeline()],
  },
};

function timeline() {
  return {
    id: 'data-timeline',
    props: {
      label: 'Rollout',
      tasks: [
        { id: 'r', title: 'Research', start: '2026-11-02', end: '2026-11-06', group: 'discovery' },
        { id: 'p', title: 'Pilot', start: '2026-11-09', end: '2026-11-20', group: 'delivery' },
      ],
      groups: [
        {
          id: 'discovery',
          label: 'Discovery',
          band: { start: '2026-11-02', end: '2026-11-06', label: 'Discovery phase', tone: 'info' },
        },
        { id: 'delivery', label: 'Delivery' },
      ],
      markers: [{ at: '2026-11-20', label: 'Pilot review', tone: 'warning' }],
    },
    bind: { collapsed: { $state: 'folded' }, selectedRow: { $state: 'picked' } },
    on: {
      collapse: [{ op: 'emit', intent: 'group-toggled', values: { view: 'rollout' } }],
      select: [{ op: 'emit', intent: 'row-opened', values: { view: 'rollout' } }],
    },
  };
}

function paint(value: unknown) {
  const errors: string[] = [];
  const states: Record<string, unknown>[] = [];
  const actions: string[] = [];
  const result = render(Player, {
    props: {
      blueprint: value,
      label: 'Timeline',
      onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
      },
      onStateChange: (snapshot: Record<string, unknown>) => states.push(snapshot),
      onAction: (intent: { action: string }) => {
        actions.push(intent.action);
        return 'confirmed';
      },
    },
  });
  return { ...result, errors, states, actions };
}

describe('data-timeline in the player', () => {
  it('paints group bands, markers and the selected row from the blueprint', async () => {
    const { container, errors } = paint(blueprint);
    await waitFor(() => expect(container.querySelector('[data-band="discovery"]')).not.toBeNull());
    expect(errors).toEqual([]);
    const band = container.querySelector('[data-band="discovery"]') as HTMLElement;
    expect(band.dataset.tone).toBe('info');
    expect(band.textContent).toContain('Discovery phase');
    const marker = container.querySelector('[data-timeline-marker]') as HTMLElement;
    expect(marker.dataset.tone).toBe('warning');
    expect(marker.textContent).toContain('Pilot review');
    const toggles = [...container.querySelectorAll<HTMLButtonElement>('button.group-toggle')];
    expect(toggles.map((t) => t.textContent?.trim().split(' ')[0])).toEqual([
      'Discovery',
      'Delivery',
    ]);
    expect(container.querySelector('[data-task-row="p"]')?.getAttribute('aria-current')).toBe(
      'true'
    );
    expect(container.querySelector('[data-task-row="r"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('writes collapse and selection back to bound state and runs on.collapse and on.select', async () => {
    const { container, states, actions } = paint(blueprint);
    await waitFor(() => expect(container.querySelector('button.row-select')).not.toBeNull());
    const research = [...container.querySelectorAll<HTMLButtonElement>('button.row-select')].find(
      (button) => button.textContent === 'Research'
    ) as HTMLButtonElement;
    await fireEvent.click(research);
    await waitFor(() => expect(states.at(-1)?.picked).toBe('r'));
    expect(actions).toEqual(['row-opened']);
    await waitFor(() =>
      expect(container.querySelector('[data-task-row="r"]')?.getAttribute('aria-current')).toBe(
        'true'
      )
    );

    const discovery = container.querySelector('button.group-toggle') as HTMLButtonElement;
    await fireEvent.click(discovery);
    await waitFor(() => expect(states.at(-1)?.folded).toEqual([{ id: 'discovery' }]));
    expect(actions).toEqual(['row-opened', 'group-toggled']);
    await waitFor(() => expect(container.querySelector('[data-task-row="r"]')).toBeNull());
    expect(discovery.getAttribute('aria-expanded')).toBe('false');
  });
});

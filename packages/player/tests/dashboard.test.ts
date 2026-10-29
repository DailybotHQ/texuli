/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Player from '../src/Player.svelte';
import { testSourceHost } from './source-host.ts';

/**
 * Dashboards as data in the player (spec 0.8.0, PLAN_010 T-dashboard): an
 * agent's data-dashboard paints its widgets in reading order, people move
 * and resize them by keyboard, the layout persists through a bound list
 * state (and `on.change` runs), and a widget's data comes only from a host
 * registered source.
 */

afterEach(cleanup);

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/fixtures/golden/source-tickets.json'), 'utf8')
) as Record<string, unknown>;

const gauge = (label: string, value: number) => ({
  id: 'charts-gauge',
  props: { label, value, min: 0, max: 100 },
});

function blueprint(extra: { layout?: unknown; grid?: unknown } = {}) {
  return {
    ...golden,
    state: {
      arrangement: {
        type: 'list',
        maxItems: 200,
        initial: (extra.layout as unknown[]) ?? [],
      },
    },
    tree: {
      id: 'data-dashboard',
      props: { label: 'Operations', editable: true },
      bind: { layout: { $state: 'arrangement' } },
      on: { change: [{ op: 'emit', intent: 'layout-saved', values: { board: 'ops' } }] },
      children: [
        {
          id: 'data-dashboard-widget',
          props: { widgetId: 'uptime', title: 'Uptime', place: { x: 6, y: 0, w: 6, h: 2 } },
          children: [gauge('Uptime', 99)],
        },
        {
          id: 'data-dashboard-widget',
          props: { widgetId: 'errors', title: 'Errors', place: { x: 0, y: 0, w: 6, h: 2 } },
          children: [gauge('Error budget', 40)],
        },
        ...(extra.grid
          ? [
              {
                id: 'data-dashboard-widget',
                props: {
                  widgetId: 'tickets',
                  title: 'Tickets',
                  place: { x: 0, y: 2, w: 12, h: 4 },
                },
                children: [extra.grid],
              },
            ]
          : []),
      ],
    },
  };
}

function paint(value: unknown, props: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const states: Record<string, unknown>[] = [];
  const actions: { action: string; values?: unknown }[] = [];
  const result = render(Player, {
    props: {
      blueprint: value,
      label: 'Dashboard',
      onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
      },
      onStateChange: (snapshot: Record<string, unknown>) => states.push(snapshot),
      onAction: (intent: { action: string; values?: unknown }) => {
        actions.push(intent);
        return 'confirmed';
      },
      ...props,
    },
  });
  return { ...result, errors, states, actions };
}

const order = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-dashboard-widget]')].map(
    (el) => el.dataset.widgetId
  );

describe('data-dashboard in the player', () => {
  it('paints widgets in reading order with their content', async () => {
    const { container, errors } = paint(blueprint());
    await waitFor(() => expect(order(container)).toEqual(['errors', 'uptime']));
    expect(errors).toEqual([]);
    expect(container.querySelector('[aria-label="Operations"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Move Uptime"]')).not.toBeNull();
  });

  it('a keyboard move persists through the bound list state and runs on.change', async () => {
    const { container, states, actions } = paint(blueprint());
    await waitFor(() => expect(order(container)).toEqual(['errors', 'uptime']));
    const handle = container.querySelector('[aria-label="Move Uptime"]') as HTMLButtonElement;
    await fireEvent.keyDown(handle, { key: 'Enter' });
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    await fireEvent.keyDown(container.querySelector('[aria-label="Move Uptime"]') as Element, {
      key: 'Enter',
    });
    await waitFor(() => expect(actions.map((a) => a.action)).toContain('layout-saved'));
    const last = states.at(-1) as { arrangement?: { id: string; x: number; y: number }[] };
    const uptime = last.arrangement?.find((item) => item.id === 'uptime');
    expect(uptime).toMatchObject({ x: 5, y: 0 });
    // Errors was in the way and moved below it.
    expect(last.arrangement?.find((item) => item.id === 'errors')).toMatchObject({ x: 0, y: 2 });
  });

  it('restores a saved layout from state, normalized', async () => {
    const { container } = paint(
      blueprint({
        layout: [
          { id: 'uptime', x: 0, y: 0, w: 12, h: 2 },
          { id: 'errors', x: 0, y: 0, w: 12, h: 2 },
        ],
      })
    );
    // Both claimed the same cell: normalizing settles them by id, the same on every replica.
    await waitFor(() => expect(order(container)).toEqual(['errors', 'uptime']));
    const uptime = container.querySelector<HTMLElement>('[data-widget-id="uptime"]');
    expect(uptime?.style.gridRow).toBe('3 / span 2');
    expect(uptime?.style.gridColumn).toBe('1 / span 12');
  });

  it('reads widget data only from a host-registered source', async () => {
    const host = testSourceHost();
    const grid = (rows: unknown) => ({
      id: 'data-grid',
      props: { caption: 'Open tickets', columns: [{ id: 'title', header: 'Title' }], rows },
    });
    const ok = paint(blueprint({ grid: grid({ $source: 'tickets' }) }), {
      sourceRegistry: host.registry,
    });
    await waitFor(() => expect(ok.container.textContent).toContain('Ticket 1'));
    ok.unmount();
    const url = paint(blueprint({ grid: grid({ $source: 'https://attacker.example/rows' }) }), {
      sourceRegistry: host.registry,
    });
    await waitFor(() => expect(url.container.textContent).not.toContain('Ticket 1'));
    await waitFor(() => expect(url.container.querySelector('[data-dashboard-widget]')).toBeNull());
  });
});

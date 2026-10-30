/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { buildCatalog } from '@texuli/catalog/build';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { createSourceLoader, sourceError } from '@texuli/core/data-source';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import Player from '../src/Player.svelte';
import {
  changesFromItem,
  itemsFromRows,
  SOURCE_SHAPES,
  sourceShape,
} from '../src/sources/shapes.ts';
import { createSourceViews } from '../src/sources/views.ts';
import { CATALOG_GROUPS } from './catalog-groups.ts';
import { FIXTURE_SOURCES, testSourceHost, ticketRows } from './source-host.ts';

/**
 * Spec 0.8.0 data sources in the player (ADR-015): a blueprint names a
 * source the host registered, the player checks the binding against the
 * host's descriptors (refusing it without them), loads through the host's
 * adapter only, shows loading, empty and error states accessibly, pages,
 * and writes edits back optimistically with rollback.
 */

afterEach(cleanup);

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/fixtures/golden/source-tickets.json'), 'utf8')
) as Record<string, unknown>;

function grid(rows: unknown, extra: Record<string, unknown> = {}) {
  return {
    ...golden,
    tree: {
      id: 'layout-page',
      props: { title: 'Tickets' },
      children: [
        {
          id: 'data-grid',
          props: {
            caption: 'Open tickets',
            columns: [
              { id: 'title', header: 'Title' },
              { id: 'points', header: 'Points', kind: 'number' },
            ],
            rows,
            ...extra,
          },
        },
      ],
    },
  };
}

function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const issues: string[] = [];
  const errors: string[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Tickets',
      onDiagnostics: (event: {
        diagnostics: readonly { code: string; severity: string }[];
        stateIssues: readonly { code: string }[];
      }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') errors.push(d.code);
        for (const issue of event.stateIssues) issues.push(issue.code);
      },
      ...props,
    },
  });
  // Every polite message the player spoke, in order (each replaces the last in its region).
  const spoken: string[] = [];
  const observer = new MutationObserver(() => {
    for (const region of result.container.querySelectorAll('[aria-live="polite"]')) {
      const text = region.textContent?.trim() ?? '';
      if (text && spoken.at(-1) !== text) spoken.push(text);
    }
  });
  observer.observe(result.container, { subtree: true, childList: true, characterData: true });
  const politeLog = () => spoken.join(' | ');
  return { ...result, issues, errors, politeLog };
}

/** A loader without automatic retries, so failures show at once. */
const noRetry = (host: ReturnType<typeof testSourceHost>) =>
  createSourceLoader({ registry: host.registry, retry: false });

describe('player data sources: binding checks (fail closed)', () => {
  it('refuses every source binding when the host passes no sources', async () => {
    const { container, issues } = paint(grid({ $source: 'tickets' }));
    await waitFor(() => expect(issues).toContain('source'));
    expect(container.textContent).not.toContain('Ticket 1');
  });

  it('refuses an unknown source, a URL, an undeclared field and a non-sourceable prop', async () => {
    const host = testSourceHost();
    for (const [blueprint, code] of [
      [grid({ $source: 'payments' }), 'unknown-source'],
      [grid({ $source: 'https://attacker.example/api' }), 'source'],
      [
        grid({
          $source: 'tickets',
          query: { filter: { type: 'condition', field: 'ssn', operator: 'eq', value: '1' } },
        }),
        'source',
      ],
      [grid([], { columns: { $source: 'tickets' } }), 'source'],
    ] as const) {
      const { issues, unmount } = paint(blueprint, { sourceRegistry: host.registry });
      await waitFor(() => expect(issues).toContain(code));
      unmount();
    }
    // Nothing reached the host's adapter.
    expect(host.lists).toEqual([]);
  });
});

describe('player data sources: loading, rows and states', () => {
  it('shows a busy, named loading status, then the rows the adapter returned', async () => {
    const host = testSourceHost({ hold: true });
    const { container, errors, issues } = paint(golden, { sourceRegistry: host.registry });
    await waitFor(() => expect(host.lists.length).toBe(2));
    const frame = await waitFor(
      () => {
        const found = container.querySelector('[data-tx-player-source="loading"]');
        if (!found) throw new Error('no loading frame yet');
        return found;
      },
      { timeout: 5000 }
    );
    expect(frame.getAttribute('aria-busy')).toBe('true');
    await waitFor(() =>
      expect(container.querySelectorAll('[data-tx-player-source]').length).toBe(2)
    );
    const statuses = [...container.querySelectorAll('[data-tx-player-source] [role="status"]')]
      .map((node) => node.textContent?.trim())
      .join(' | ');
    expect(statuses).toContain('Loading Open tickets by points…');
    expect(statuses).toContain('Loading Tickets by status…');
    // The adapter got the validated query, never the blueprint's raw value.
    const gridRequest = host.lists.find((call) => call.request.query.filter !== undefined);
    expect(gridRequest?.request.query).toMatchObject({
      fields: ['title', 'status', 'points'],
      sort: [{ field: 'points', direction: 'desc' }],
    });
    expect(Object.isFrozen(gridRequest?.request.query)).toBe(true);
    for (const call of host.lists) call.resolve(host.page(call.request));
    await waitFor(() => expect(screen.getAllByText('Ticket 1').length).toBeGreaterThan(0));
    expect(container.querySelector('[data-tx-player-source="loading"]')).toBeNull();
    expect(errors).toEqual([]);
    expect(issues).toEqual([]);
  });

  it('says when a source is empty', async () => {
    const host = testSourceHost({ rows: [] });
    const { container } = paint(grid({ $source: 'tickets' }), { sourceRegistry: host.registry });
    await waitFor(() =>
      expect(container.querySelector('[data-tx-player-source-empty]')?.textContent).toContain(
        'Nothing to show yet.'
      )
    );
  });

  it('shows and announces a failed load with a retry that recovers', async () => {
    const host = testSourceHost();
    host.failNext(sourceError('unavailable'));
    const { container, politeLog } = paint(grid({ $source: 'tickets' }), {
      sourceLoader: noRetry(host),
    });
    const retry = await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 });
    expect(container.querySelector('[data-tx-player-source-error]')?.textContent).toContain(
      'Open tickets could not be loaded. The data source is unavailable right now.'
    );
    await waitFor(() => expect(politeLog()).toContain('Open tickets could not be loaded.'));
    await fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('Ticket 1')).toBeTruthy());
    expect(container.querySelector('[data-tx-player-source-error]')).toBeNull();
  });

  it('never shows what an adapter threw, and offers no retry where asking again cannot help', async () => {
    const host = testSourceHost();
    host.failNext(new Error('password=hunter2 at db.internal.example'));
    const { container } = paint(grid({ $source: 'tickets' }), { sourceLoader: noRetry(host) });
    await waitFor(() =>
      expect(container.querySelector('[data-tx-player-source-error]')).not.toBeNull()
    );
    expect(container.textContent).not.toContain('hunter2');
    expect(container.textContent).toContain('Something went wrong loading this data.');

    const stale = createSourceLoader({ registry: testSourceHost().registry, retry: false });
    const other = paint(grid({ $source: 'tickets' }), { sourceLoader: stale });
    await waitFor(() => expect(other.container.textContent).toContain('Ticket 1'));
  });

  it('pages with a load-more button, announces the rows added, and keeps focus in the frame', async () => {
    const host = testSourceHost({ rows: ticketRows(5) });
    const { container, politeLog } = paint(grid({ $source: 'tickets', query: { pageSize: 2 } }), {
      sourceRegistry: host.registry,
    });
    const more = await screen.findByRole('button', { name: 'Load more' }, { timeout: 5000 });
    expect(screen.queryByText('Ticket 3')).toBeNull();
    more.focus();
    await fireEvent.click(more);
    await waitFor(() => expect(screen.getByText('Ticket 4')).toBeTruthy());
    await waitFor(() => expect(politeLog()).toContain('2 more shown.'));
    await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getByText('Ticket 5')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    // The button went away; focus moved to the frame, not to the document.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-tx-player-source')).toBe('ready')
    );
    expect(container.querySelectorAll('[data-tx-player-source]').length).toBe(1);
  });

  it('paints the source golden with the board reading the same source through its map', async () => {
    const host = testSourceHost();
    const { container, errors } = paint(golden, { sourceRegistry: host.registry });
    await waitFor(() =>
      expect(container.querySelectorAll('[data-tx-player-source="ready"]').length).toBe(2)
    );
    expect(errors).toEqual([]);
    // Ticket 1 is "open": the board shows it in the Open column (map: column ← status).
    expect(container.textContent).toContain('Ticket 1');
  });
});

describe('player data sources: optimistic edits', () => {
  it('moves a board card at once, writes the status back, and rolls back when refused', {
    timeout: 30_000,
  }, async () => {
    const host = testSourceHost({ hold: true });
    const loader = createSourceLoader({ registry: host.registry, retry: false });
    const { container, politeLog } = paint(golden, { sourceLoader: loader });
    await waitFor(() => expect(host.lists.length).toBe(2));
    for (const call of host.lists) call.resolve(host.page(call.request));
    await waitFor(
      () => expect(container.querySelectorAll('[data-tx-player-source="ready"]').length).toBe(2),
      {
        timeout: 5000,
      }
    );
    const move = await screen.findByRole('button', { name: /Move Ticket 1/ }, { timeout: 5000 });
    await fireEvent.click(move);
    const doing = await waitFor(() => screen.getAllByRole('menuitem', { name: /Doing/ })[0], {
      timeout: 5000,
    });
    if (!doing) throw new Error('no Doing destination');
    await fireEvent.click(doing);
    // The update went to the source with the mapped, editable field only.
    await waitFor(() => expect(host.updates.length).toBe(1));
    expect(host.updates[0]).toMatchObject({ id: 't1', changes: { status: 'doing' } });
    // Optimistic: the card shows in Doing while the source decides.
    const columnOf = (title: string) =>
      [...container.querySelectorAll('[data-column-id]')]
        .find((column) => column.textContent?.includes(title))
        ?.getAttribute('data-column-id');
    await waitFor(() => expect(columnOf('Ticket 1')).toBe('doing'));
    host.updates[0]?.reject(sourceError('conflict'));
    await waitFor(() =>
      expect(politeLog()).toContain('The change was not saved and has been undone.')
    );
    expect(container.querySelector('[data-tx-player-source-write-error]')?.textContent).toContain(
      'Someone else changed this item.'
    );
    // Rolled back: the card is in Open again, and the source never changed.
    await waitFor(() => expect(columnOf('Ticket 1')).toBe('open'));
    expect(host.rows[0]?.status).toBe('open');
  });
});

describe('player data sources: shapes and views (framework-free)', () => {
  it('covers exactly the catalog sourceable props with their item fields', async () => {
    const build = await buildCatalog(CATALOG_GROUPS);
    const catalog = renderCatalogFromBuild(build.catalog);
    const expected: Record<string, string[]> = {};
    for (const entry of build.catalog.entries) {
      for (const prop of entry.sourceable ?? []) {
        const schema = catalog.get(entry.id)?.props.find((p) => p.name === prop)?.schema;
        expected[`${entry.id}.${prop}`] = Object.keys(schema?.items?.properties ?? {}).sort();
        expect(sourceShape(entry.id, prop)?.maxItems, entry.id).toBe(schema?.maxItems);
      }
    }
    const actual = Object.fromEntries(
      Object.entries(SOURCE_SHAPES).map(([key, shape]) => [key, [...shape.fields].sort()])
    );
    expect(actual).toEqual(expected);
    // The player's lean catalog carries the same sourceable lists.
    const lean = createPlayerCatalog();
    for (const key of Object.keys(SOURCE_SHAPES)) {
      const [id, prop] = key.split('.') as [string, string];
      expect(lean.get(id)?.sourceable).toContain(prop);
    }
  });

  it('maps rows to items and edits back to editable source fields only', () => {
    const board = SOURCE_SHAPES['data-board.items'];
    if (!board) throw new Error('board shape');
    const rows = [{ id: 7, title: 'Fix login', status: 'open', points: null }];
    const items = itemsFromRows(board, rows, 'id', { column: 'status' });
    expect(items).toEqual([{ id: '7', title: 'Fix login', column: 'open' }]);
    const [tickets] = FIXTURE_SOURCES;
    if (!tickets) throw new Error('tickets');
    const changes = changesFromItem(
      board,
      items[0] as Record<string, unknown>,
      { ...items[0], column: 'done', rank: 'a0', title: 'Fix login now' },
      tickets,
      { column: 'status' }
    );
    // rank is no source field; title and status are editable.
    expect(changes).toEqual({ status: 'done', title: 'Fix login now' });
    const cells = itemsFromRows(SOURCE_SHAPES['data-grid.rows'] as never, rows, 'id');
    expect(cells).toEqual([
      { id: '7', cells: { id: '7', title: 'Fix login', status: 'open', points: '' } },
    ]);
  });

  it('opens one view per bound prop, keeps it across re-syncs, and drops it with its binding', async () => {
    const host = testSourceHost();
    const onChange = vi.fn();
    const views = createSourceViews({ registry: host.registry, onChange });
    const ref = {
      path: '0.children.0',
      prop: 'rows',
      id: 'data-grid',
      binding: { $source: 'tickets' },
    };
    views.sync([ref]);
    views.sync([{ ...ref, binding: { $source: 'tickets' } }]);
    await waitFor(() => expect(views.state('0.children.0')?.status).toBe('ready'));
    expect(views.items('0.children.0', 'rows', { $source: 'tickets' })).toHaveLength(5);
    expect(views.items('0.children.0', 'rows', { $source: 'tickets', query: {} })).toBeUndefined();
    views.sync([]);
    expect(views.state('0.children.0')).toBeNull();
    views.destroy();
  });
});

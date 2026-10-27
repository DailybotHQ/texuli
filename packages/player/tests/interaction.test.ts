import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Player from '../src/Player.svelte';
import { moveListItem, runActions } from '../src/state/reducers.ts';
import { type ListItem, parseStateDeclarations } from '../src/state/schema.ts';

const items = (...ids: string[]): ListItem[] => ids.map((id) => ({ id, label: id.toUpperCase() }));

describe('moveItem reducer (spec 0.3.0 semantics)', () => {
  const lists = { a: items('x', 'y', 'z'), b: items('w') };
  const max = { a: 500, b: 2 };

  it('moves within a list and between lists, clamping the index', () => {
    const within = moveListItem(lists, max, { from: 'a', item: 'x', index: 99 });
    expect(within.ok && within.lists.a?.map((i) => i.id)).toEqual(['y', 'z', 'x']);
    const across = moveListItem(lists, max, { from: 'a', item: 'y', to: 'b', index: 0 });
    expect(
      across.ok && [across.lists.a?.map((i) => i.id), across.lists.b?.map((i) => i.id)]
    ).toEqual([
      ['x', 'z'],
      ['y', 'w'],
    ]);
  });

  it('refuses a missing or locked item, a full target and pull none, with no change', () => {
    expect(moveListItem(lists, max, { from: 'a', item: 'nope' })).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
    expect(moveListItem(lists, max, { from: 'a', item: 'x' }, { locked: ['x'] })).toEqual({
      ok: false,
      reason: 'locked',
    });
    const full = moveListItem({ ...lists, b: items('w', 'v') }, max, {
      from: 'a',
      item: 'x',
      to: 'b',
    });
    expect(full).toEqual({ ok: false, reason: 'full' });
    expect(moveListItem(lists, max, { from: 'a', item: 'x', to: 'b' }, { pull: 'none' })).toEqual({
      ok: false,
      reason: 'pull',
    });
  });

  it('clones with the smallest free -n suffix and refuses ids past 64 characters', () => {
    const cloned = moveListItem(
      { a: items('x'), b: items('x-2') },
      { a: 9, b: 9 },
      { from: 'a', item: 'x', to: 'b' },
      { pull: 'clone' }
    );
    expect(
      cloned.ok && [cloned.lists.a?.map((i) => i.id), cloned.lists.b?.map((i) => i.id)]
    ).toEqual([['x'], ['x-2', 'x-3']]);
    const long = 'x'.repeat(63);
    const refused = moveListItem(
      { a: items(long), b: [] },
      { a: 9, b: 9 },
      { from: 'a', item: long, to: 'b' },
      { pull: 'clone' }
    );
    expect(refused).toEqual({ ok: false, reason: 'clone-id' });
  });
});

describe('runActions', () => {
  const parsed = parseStateDeclarations({
    open: { type: 'boolean' },
    q: { type: 'string', maxLength: 5 },
    host: { type: 'string', source: 'tickets.title' },
    n: { type: 'number', min: 0, max: 3 },
  });
  if (!parsed.ok) throw new Error('declarations');
  const declarations = parsed.declarations;
  const snapshot = Object.freeze({ open: false, q: '', host: 'Fixed', n: 0 });
  const run = (actions: unknown[], event = 'press', detail?: { value?: unknown }) =>
    runActions(actions, { snapshot, declarations, event, ...(detail ? { detail } : {}) });

  it('runs actions in order against a working copy and commits all of them', () => {
    const result = run([
      { op: 'toggleState', state: 'open' },
      { op: 'setState', state: 'n', value: 2 },
      { op: 'flowGo', event: 'next' },
    ]);
    expect(result).toMatchObject({
      ok: true,
      snapshot: { open: true, n: 2 },
      effects: [{ kind: 'flow', event: 'next' }],
    });
    expect(snapshot.open).toBe(false);
  });

  it('is all or none: a refused action refuses the list', () => {
    expect(
      run([
        { op: 'toggleState', state: 'open' },
        { op: 'setState', state: 'n', value: 9 },
      ])
    ).toEqual({ ok: false, reason: 'value' });
    expect(run([{ op: 'setState', state: 'host', value: 'x' }])).toEqual({
      ok: false,
      reason: 'state',
    });
    expect(
      run([{ op: 'setState', state: 'q', fromEvent: 'value' }], 'press', { value: 'x' })
    ).toEqual({ ok: false, reason: 'fromEvent' });
    expect(
      run([{ op: 'setState', state: 'q', fromEvent: 'value' }], 'change', { value: 'too long' })
    ).toEqual({ ok: false, reason: 'value' });
    expect(run(Array.from({ length: 9 }, () => ({ op: 'toggleState', state: 'open' })))).toEqual({
      ok: false,
      reason: 'actions',
    });
  });

  it('emits closed intents with scalar values, reading $state values', () => {
    const result = run(
      [
        { op: 'setState', state: 'q', fromEvent: 'value' },
        { op: 'emit', intent: 'search', values: { q: { $state: 'q' }, n: 1 } },
      ],
      'change',
      { value: 'hi' }
    );
    expect(result).toMatchObject({
      ok: true,
      effects: [{ kind: 'emit', intent: 'search', values: { q: 'hi', n: 1 } }],
    });
    expect(run([{ op: 'emit', intent: 'bad intent!' }])).toEqual({ ok: false, reason: 'intent' });
    expect(run([{ op: 'emit', intent: 'x', values: { blob: { nested: 1 } } }])).toEqual({
      ok: false,
      reason: 'values',
    });
    // Value names follow the intent-name pattern, as the spec requires.
    for (const name of ['__proto__', 'bad key <x>', '1st'])
      expect(run([{ op: 'emit', intent: 'x', values: JSON.parse(`{"${name}":"y"}`) }])).toEqual({
        ok: false,
        reason: 'values',
      });
  });
});

function envelope(tree: unknown, extra: Record<string, unknown> = {}) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'interaction',
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.3.0',
    ...extra,
    // The player's frame-root rule: every tree starts at a page.
    tree: { id: 'layout-page', props: { title: 'Interaction' }, children: [tree] },
  };
}

describe('the player runs spec 0.3.0 interaction', () => {
  it('lifts state and flow from the envelope and runs on.press actions, emitting intents to the host', async () => {
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const onStateChange = vi.fn();
    render(Player, {
      props: {
        blueprint: envelope(
          {
            id: 'layout-stack',
            props: {},
            children: [
              { id: 'flow-view', props: { name: 'ask', label: 'Ask' }, children: [] },
              {
                id: 'flow-action',
                props: { event: 'next', label: 'Next' },
                on: {
                  press: [
                    { op: 'toggleState', state: 'seen' },
                    { op: 'emit', intent: 'step-done', values: { seen: { $state: 'seen' } } },
                  ],
                },
              },
            ],
          },
          {
            state: { seen: { type: 'boolean' } },
            flow: {
              views: ['ask', 'done'],
              initial: 'ask',
              transitions: [{ from: 'ask', to: 'done', on: 'next' }],
            },
          }
        ),
        onAction,
        onStateChange,
      },
    });
    const next = await screen.findByRole('button', { name: 'Next' }, { timeout: 5000 });
    await fireEvent.click(next);
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: 'step-done',
      values: { seen: true },
    });
    expect(onStateChange).toHaveBeenLastCalledWith({ seen: true });
  });

  it('reads $data from the host and paints it', async () => {
    render(Player, {
      props: {
        blueprint: envelope({ id: 'layout-tile', props: { title: { $data: 'report.title' } } }),
        dataSources: { 'report.title': 'Weekly revenue' },
      },
    });
    expect(await screen.findByText('Weekly revenue', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('paints a sortable list from its bound list and refuses an undeclared list', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: envelope(
          {
            id: 'sortable-list',
            props: { label: 'Priorities', reorder: { bind: { $state: 'tasks' } } },
          },
          {
            state: {
              tasks: {
                type: 'list',
                initial: [
                  { id: 'a', label: 'Alpha' },
                  { id: 'b', label: 'Beta' },
                ],
              },
            },
          }
        ),
      },
    });
    expect(await screen.findByText('Alpha', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(container.querySelector('[data-tx-player-error]')).toBeNull();

    const refused = render(Player, {
      props: {
        blueprint: envelope(
          { id: 'sortable-list', props: { label: 'P', reorder: { bind: { $state: 'nope' } } } },
          { state: {} }
        ),
      },
    });
    await waitFor(() =>
      expect(refused.container.querySelector('[data-status="invalid"]')).toBeTruthy()
    );
  });

  it('reads item fields as own properties only, never through the prototype', async () => {
    render(Player, {
      props: {
        blueprint: envelope(
          {
            id: 'sortable-list',
            props: {
              label: 'Inherited',
              itemLabel: 'constructor',
              itemDetail: 'label',
              reorder: { bind: { $state: 'tasks' } },
            },
          },
          { state: { tasks: { type: 'list', initial: [{ id: 'a', label: 'Alpha' }] } } }
        ),
      },
    });
    expect(await screen.findByText('Alpha', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText(/native code/)).toBeNull();
  });

  it('two-way binds a data view prop and runs on.change', async () => {
    const onStateChange = vi.fn();
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    render(Player, {
      props: {
        blueprint: envelope(
          {
            id: 'data-files',
            props: { label: 'Drive', entries: [{ id: 'f', name: 'Reports', kind: 'folder' }] },
            bind: { layout: { $state: 'layout' } },
            on: {
              change: [
                { op: 'emit', intent: 'layout-changed', values: { layout: { $state: 'layout' } } },
              ],
            },
          },
          { state: { layout: { type: 'enum', values: ['grid', 'list'] } } }
        ),
        onStateChange,
        onAction,
      },
    });
    const list = await screen.findByRole('button', { name: 'List' }, { timeout: 5000 });
    await fireEvent.click(list);
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith({ layout: 'list' }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: 'layout-changed',
      values: { layout: 'list' },
    });
  });

  it('paints a workflow graph read-only, and refuses a graph the workflow model rejects', async () => {
    const graph = {
      version: 1,
      cycles: 'forbid',
      nodeTypes: [
        {
          id: 'step',
          label: 'Step',
          ports: [
            { id: 'in', direction: 'in' },
            { id: 'out', direction: 'out', multiple: true },
          ],
        },
      ],
      nodes: [
        { id: 'a', type: 'step', label: 'Request', position: { x: 0, y: 0 } },
        { id: 'b', type: 'step', label: 'Review', position: { x: 260, y: 0 } },
      ],
      edges: [{ id: 'e', from: { node: 'a', port: 'out' }, to: { node: 'b', port: 'in' } }],
    };
    render(Player, {
      props: { blueprint: envelope({ id: 'workflow-graph', props: { label: 'Approval', graph } }) },
    });
    expect(await screen.findByRole('figure', { name: 'Approval' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Request')).toBeTruthy();

    const cyclic = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: 'back', from: { node: 'b', port: 'out' }, to: { node: 'a', port: 'in' } },
      ],
    };
    render(Player, {
      props: {
        blueprint: envelope({ id: 'workflow-graph', props: { label: 'Loop', graph: cyclic } }),
      },
    });
    expect(
      await screen.findByText('Loop: this workflow could not be shown.', {}, { timeout: 5000 })
    ).toBeTruthy();
  });
});

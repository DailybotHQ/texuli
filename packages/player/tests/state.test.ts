import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { validateCatalogManifests } from '@texuli/catalog/manifest';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { CONTROL_MANIFESTS, CONTROL_STATE_TYPES } from '../src/control-manifests.ts';
import { createPlayerFrameHost } from '../src/embed/host.ts';
import {
  PLAYER_FRAME_PROTOCOL,
  parseFrameMessage,
  parseHostMessage,
} from '../src/embed/protocol.ts';
import { applyHostData, checkHostBoundWriters, sanitizeDataSources } from '../src/host-data.ts';
import { PLAYER_GRAMMAR_ROLES } from '../src/layout-manifests.ts';
import {
  carryFlowView,
  carryStateSnapshot,
  keepSameNodes,
  planIdentities,
} from '../src/live-update.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayer, mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import {
  LOCAL_STATE_FORMAT,
  resolveStateBindings,
  splitStatefulBlueprint,
} from '../src/state/bind.ts';
import { checkControlBindings } from '../src/state/controls.ts';
import { nextFlowView, parseFlowDeclaration } from '../src/state/flow.ts';
import {
  MAX_STATE_VARS,
  parseStateDeclarations,
  type StateDeclarations,
} from '../src/state/schema.ts';
import {
  AUTOCOMPLETE_ALLOWLIST,
  actionValues,
  checkActionNodes,
  DEFAULT_FIELD_MESSAGES,
  MAX_ACTION_VALUE_LENGTH,
  runAction,
  validateFieldValue,
} from './action-test-helpers.ts';
import { scenario } from './scenario.ts';

describe('local state', () => {
  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
  const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };

  function stateful(state: unknown, title: unknown = { $state: 'week' }, extra: object = {}) {
    return {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state,
      blueprint: {
        id: 'layout-page',
        props: { title, description: { $state: 'note' } },
        children: [{ id: 'layout-card', props: { title: 'Static card' } }],
      },
      ...extra,
    };
  }

  const declared = {
    week: { type: 'enum', values: ['Week 41', 'Week 42'], initial: 'Week 42' },
    note: { type: 'string', maxLength: 40, initial: 'Fictional backlog' },
    limit: { type: 'number', min: 0, max: 10, initial: 5 },
    details: { type: 'boolean' },
  };

  describe('state declarations', () => {
    it('state declarations are typed and bounded, refusing malformed ones and too many variables', () => {
      // reads typed, bounded variables with defaults
      {
        const parsed = parseStateDeclarations(declared);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.declarations.details).toEqual({ type: 'boolean', initial: false });
        expect(parsed.declarations.limit).toMatchObject({ min: 0, max: 10, initial: 5 });
      }
      for (const [name, input] of BAD_DECLARATIONS) {
        expect(parseStateDeclarations(input).ok, name).toBe(false);
      }
      // caps the number of variables
      {
        const many = Object.fromEntries(
          Array.from({ length: MAX_STATE_VARS + 1 }, (_, i) => [`v${i}`, { type: 'boolean' }])
        );
        const parsed = parseStateDeclarations(many);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) expect(parsed.issues[0]?.code).toBe('state-limit');
      }
    });

    const BAD_DECLARATIONS: ReadonlyArray<[string, unknown]> = [
      ['an object type', { a: { type: 'object' } }],
      ['an unknown field', { a: { type: 'boolean', persist: true } }],
      ['a bad name', { 'Bad-Name': { type: 'boolean' } }],
      ['a prototype name', { __proto__x: { type: 'boolean' } }],
      ['an initial out of range', { a: { type: 'number', min: 0, max: 1, initial: 2 } }],
      ['an enum initial not listed', { a: { type: 'enum', values: ['x'], initial: 'y' } }],
      ['duplicate enum values', { a: { type: 'enum', values: ['x', 'x'] } }],
      ['a huge string cap', { a: { type: 'string', maxLength: 100_000 } }],
      ['an array', [{ type: 'boolean' }]],
    ];
  });

  describe('bindings', () => {
    it('bindings pass plain blueprints through, read wrappers strictly and replace props deeply', () => {
      // passes plain blueprints and non-JSON text through unchanged
      {
        const tree = { id: 'layout-page', props: { title: 'x' } };
        expect(splitStatefulBlueprint(tree)).toEqual({ kind: 'plain', blueprint: tree });
        expect(splitStatefulBlueprint('{nope')).toEqual({ kind: 'plain', blueprint: '{nope' });
      }
      expect(splitStatefulBlueprint(JSON.stringify(stateful(declared))).kind).toBe('stateful');
      expect(
        splitStatefulBlueprint(stateful(declared, 'x', { fetch: 'https://x.example' }))
      ).toMatchObject({ kind: 'invalid' });
      // replaces binding objects in props only, deeply, and flags unknown names
      {
        const { blueprint, issues } = resolveStateBindings(
          {
            id: 'layout-page',
            props: {
              title: { $state: 'a' },
              rows: [{ label: { $state: 'b' } }],
              other: { $state: 'zz' },
            },
            children: [{ id: { $state: 'a' }, props: {} }],
          },
          { a: 'One', b: 2 }
        );
        expect(blueprint).toMatchObject({
          props: { title: 'One', rows: [{ label: 2 }] },
          children: [{ id: { $state: 'a' } }],
        });
        expect(issues).toEqual([
          expect.objectContaining({ code: 'unknown-state', path: '0.props.other' }),
        ]);
      }
    });
  });

  describe('Player local state', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('local state paints, re-validates, refuses and never touches the network or storage', async () => {
      await scenario('paints bound props from the declared initial values', async () => {
        render(Player, { props: { blueprint: stateful(declared), loaders } });
        expect(await screen.findByRole('heading', { level: 1, name: 'Week 42' })).toBeTruthy();
        expect(screen.getByText('Fictional backlog')).toBeTruthy();
      });
      await scenario(
        'applies host initialState overrides that fit, ignoring ones that do not',
        async () => {
          render(Player, {
            props: {
              blueprint: stateful(declared),
              loaders,
              initialState: { week: 'Week 41', note: 'x'.repeat(41) },
            },
          });
          expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
          expect(screen.getByText('Fictional backlog')).toBeTruthy();
        }
      );
      await scenario(
        're-validates and repaints on setState, and reports snapshots to the host only',
        async () => {
          const onStateChange = vi.fn();
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: stateful(declared),
            loaders,
            onStateChange,
          });
          expect(await screen.findByRole('heading', { level: 1, name: 'Week 42' })).toBeTruthy();

          expect(mounted.setState('week', 'Week 41')).toBe(true);
          flushSync();
          expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
          expect(onStateChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ week: 'Week 41' })
          );

          expect(mounted.setState('week', 'Week 99')).toBe(false);
          expect(mounted.setState('limit', 11)).toBe(false);
          expect(mounted.setState('missing', true)).toBe(false);
          expect(mounted.getState().week).toBe('Week 41');
          expect(onStateChange).toHaveBeenCalledTimes(1);

          mounted.update({ label: 'Renamed' });
          expect(mounted.getState().week).toBe('Week 41');
          expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
          mounted.dispose();
        }
      );
      await scenario(
        'keeps validating bound values: an HTML string in state never paints',
        async () => {
          const onDiagnostics = vi.fn();
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: stateful(declared),
            loaders,
            onDiagnostics,
          });
          await screen.findByRole('heading', { level: 1, name: 'Week 42' });
          expect(mounted.setState('note', '<img src=x onerror=alert(1)>')).toBe(true);
          flushSync();
          expect(target.querySelector('img')).toBeNull();
          expect(screen.getByRole('alert').textContent).toContain('could not be validated');
          expect(onDiagnostics.mock.lastCall?.[0].receipt.ok).toBe(false);
          mounted.dispose();
        }
      );
      await scenario(
        'refuses invalid declarations and unknown bindings with a visible notice',
        async () => {
          const onDiagnostics = vi.fn();
          const { container } = render(Player, {
            props: {
              blueprint: stateful({ week: { type: 'object' } }),
              loaders,
              onDiagnostics,
            },
          });
          expect(container.querySelector('[data-tx-player-state-notice]')).toBeTruthy();
          expect(screen.getByText('Invalid draft')).toBeTruthy();
          expect(onDiagnostics.mock.calls[0]?.[0]).toMatchObject({
            status: 'invalid',
            receipt: null,
          });

          render(Player, {
            props: { blueprint: stateful({ week: declared.week }, { $state: 'nope' }), loaders },
          });
          expect(screen.getAllByRole('alert').at(-1)?.textContent).toContain('No state variable');
        }
      );
      await scenario(
        're-validates on the same handle, so painters are not loaded again',
        async () => {
          const page = vi.fn(layoutLoader);
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: stateful(declared),
            loaders: { 'layout-page': page, 'layout-card': layoutLoader },
          });
          await screen.findByRole('heading', { level: 1, name: 'Week 42' });
          mounted.setState('week', 'Week 41');
          flushSync();
          await screen.findByRole('heading', { level: 1, name: 'Week 41' });
          expect(page).toHaveBeenCalledTimes(1);
          mounted.dispose();
        }
      );
      await scenario('makes no network or storage calls while state changes', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        const target = document.createElement('div');
        document.body.append(target);
        const mounted = mountPlayer(target, { blueprint: stateful(declared), loaders });
        await screen.findByRole('heading', { level: 1, name: 'Week 42' });
        mounted.setState('details', true);
        mounted.setState('limit', 3);
        flushSync();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
        setItem.mockRestore();
        mounted.dispose();
      });
    });
  });
});

describe('live updates', () => {
  /**
   * Live updates (player design R20, audit G22): the host replaces the
   * blueprint, the player re-validates all of it, and what the reader did
   * survives where it still fits: declared state, the flow view, the selection
   * of nodes still at their path, and loaded painters.
   */

  const layoutLoader = async () =>
    import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
  const card = (title: string) => ({ id: 'layout-card', props: { title } });

  function declarations(input: unknown): StateDeclarations {
    const parsed = parseStateDeclarations(input);
    if (!parsed.ok) throw new Error('bad declarations');
    return parsed.declarations;
  }

  describe('carrying state, views and node identity', () => {
    it('carrying state, views and node identity across a new blueprint', () => {
      // keeps live values that still fit, resets the rest, drops removed variables
      {
        const next = declarations({
          limit: { type: 'number', min: 0, max: 10, initial: 5 },
          week: { type: 'enum', values: ['Week 42', 'Week 43'], initial: 'Week 43' },
          fresh: { type: 'boolean', initial: false },
        });
        const live = { limit: 8, week: 'Week 41', gone: 'x' };
        expect(carryStateSnapshot(next, live, { fresh: true, limit: 1 })).toEqual({
          limit: 8, // still fits
          week: 'Week 43', // Week 41 is no longer declared: initial
          fresh: true, // new variable: the host seed applies
        });
      }
      // keeps the live view while the flow still declares it
      {
        const flow = { views: ['cart', 'pay'], initial: 'cart', transitions: [] } as never;
        expect(carryFlowView(flow, 'pay')).toBe('pay');
        expect(carryFlowView(flow, 'done')).toBe('cart');
        expect(carryFlowView(flow, 'pay', 'cart')).toBe('cart');
        expect(carryFlowView(flow, null)).toBe('cart');
      }
      // drops a selected path only when another component now sits there
      {
        const plan = (children: { id: string }[]) =>
          planIdentities([
            {
              kind: 'component',
              path: '0',
              id: 'layout-page',
              props: {},
              children: children.map((c, i) => ({
                kind: 'component' as const,
                path: `0.children.${i}`,
                id: c.id,
                props: {},
                children: [],
              })),
            },
          ]);
        const before = plan([{ id: 'layout-card' }, { id: 'layout-grid' }]);
        const after = plan([{ id: 'layout-grid' }]);
        expect(keepSameNodes(['0', '0.children.0', '0.children.1', '9'], before, after)).toEqual([
          '0',
          '0.children.1',
          '9',
        ]);
      }
    });
  });

  describe('live updates through mountPlayer', () => {
    const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };
    const stateful = (state: object, title: string, cards: string[]) => ({
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state,
      blueprint: { id: 'layout-page', props: { title }, children: cards.map(card) },
    });
    const v1State = {
      limit: { type: 'number', min: 0, max: 10, initial: 5 },
      note: { type: 'string', maxLength: 40, initial: 'Fictional' },
    };

    it('live updates through mountPlayer keep state, painters and the flow view', async () => {
      await scenario(
        'keeps declared state and loaded painters across a blueprint update',
        async () => {
          const target = document.createElement('div');
          document.body.append(target);
          const onStateChange = vi.fn();
          const mounted = mountPlayer(target, {
            blueprint: stateful(v1State, 'Week 42', ['Static card']),
            loaders,
            onStateChange,
          });
          const before = await screen.findByRole('heading', { name: 'Static card' });
          expect(mounted.setState('limit', 7)).toBe(true);
          onStateChange.mockClear();

          mounted.update({
            blueprint: stateful({ ...v1State, details: { type: 'boolean' } }, 'Week 43', [
              'Static card',
              'New card',
            ]),
          });
          expect(await screen.findByRole('heading', { level: 1, name: 'Week 43' })).toBeTruthy();
          expect(await screen.findByText('New card')).toBeTruthy();
          expect(mounted.getState()).toEqual({ limit: 7, note: 'Fictional', details: false });
          // The unchanged card kept its painted element: nothing remounted.
          expect(screen.getByRole('heading', { name: 'Static card' })).toBe(before);
          expect(before.isConnected).toBe(true);
          // The snapshot gained a variable, so the host hears the new one once.
          expect(onStateChange).toHaveBeenCalledTimes(1);
          expect(onStateChange).toHaveBeenLastCalledWith({
            limit: 7,
            note: 'Fictional',
            details: false,
          });

          // A narrower range no longer fits 7: the value resets and the host hears it.
          mounted.update({
            blueprint: stateful(
              { limit: { type: 'number', min: 0, max: 3, initial: 1 } },
              'Week 44',
              ['Static card']
            ),
          });
          await screen.findByRole('heading', { level: 1, name: 'Week 44' });
          expect(mounted.getState()).toEqual({ limit: 1 });
          expect(onStateChange).toHaveBeenLastCalledWith({ limit: 1 });
          mounted.dispose();
          target.remove();
        }
      );
      await scenario('keeps the flow view while the updated flow still declares it', async () => {
        const target = document.createElement('div');
        document.body.append(target);
        const flowLoaders = {
          ...loaders,
          'flow-view': async () => import('../src/flow/FlowView.svelte').then((m) => m.default),
        };
        const wizard = (views: string[], note: string) => ({
          format: LOCAL_STATE_FORMAT,
          version: 1,
          state: {},
          flow: {
            views,
            initial: 'details',
            transitions: views.includes('review')
              ? [{ from: 'details', to: 'review', on: 'next' }]
              : [],
          },
          blueprint: {
            id: 'layout-page',
            props: { title: note },
            children: views.map((name) => ({
              id: 'flow-view',
              props: { name, label: name },
              children: [card(`${name} card`)],
            })),
          },
        });
        const mounted = mountPlayer(target, {
          blueprint: wizard(['details', 'review'], 'v1'),
          loaders: flowLoaders,
          // A host view seeds the flow; it does not pull the reader back on later updates.
          view: 'details',
        });
        await screen.findByRole('heading', { level: 1, name: 'v1' });
        expect(mounted.dispatchFlow('next')).toBe(true);
        expect(mounted.getView()).toBe('review');

        mounted.update({ blueprint: wizard(['details', 'review'], 'v2') });
        await screen.findByRole('heading', { level: 1, name: 'v2' });
        expect(mounted.getView()).toBe('review');

        mounted.update({ blueprint: wizard(['details'], 'v3') });
        await screen.findByRole('heading', { level: 1, name: 'v3' });
        expect(mounted.getView()).toBe('details');

        // A host that changes its view still moves the reader.
        mounted.update({ blueprint: wizard(['details', 'review'], 'v4'), view: 'review' });
        await screen.findByRole('heading', { level: 1, name: 'v4' });
        expect(mounted.getView()).toBe('review');
        mounted.dispose();
        target.remove();
      });
    });
  });

  describe('selection across a live update', () => {
    const loaders = {
      'layout-page': layoutLoader,
      'layout-card': layoutLoader,
      'layout-grid': layoutLoader,
    };
    const page = (first: object) => ({
      id: 'layout-page',
      props: { title: 'Selection page' },
      children: [first, card('B')],
    });

    it('keeps a selected node that is still at its path, and drops one that changed component', async () => {
      const onSelectionChange = vi.fn();
      const view = render(Player, {
        props: {
          blueprint: page(card('A')),
          tier: 'developer',
          loaders,
          selectable: true,
          selection: ['0.children.0', '0.children.1'],
          onSelectionChange,
        },
      });
      const selected = () =>
        Array.from(view.container.querySelectorAll('[data-tx-player-selected]')).map((element) =>
          element.getAttribute('data-tx-player-path')
        );
      await waitFor(() => expect(selected()).toEqual(['0.children.0', '0.children.1']));

      // Same components, new copy: the selection stays.
      await view.rerender({ blueprint: page(card('A, revised')) });
      await screen.findByText('A, revised');
      await tick();
      expect(selected()).toEqual(['0.children.0', '0.children.1']);
      expect(onSelectionChange).not.toHaveBeenCalled();

      // A grid now sits where card A was: that path is deselected.
      await view.rerender({
        blueprint: page({ id: 'layout-grid', props: { columns: 2 }, children: [card('G1')] }),
      });
      await screen.findByText('G1');
      await waitFor(() => expect(selected()).toEqual(['0.children.1']));
      expect(onSelectionChange).toHaveBeenLastCalledWith(['0.children.1']);
    });
  });
});

describe('host binding (G01)', () => {
  const state = {
    team: { type: 'string', maxLength: 60, initial: 'Team', source: 'team.name' },
    columns: { type: 'number', min: 1, max: 4, initial: 2, source: 'layout.columns' },
    note: { type: 'string', maxLength: 60, initial: 'Local note' },
  };

  function wrapped(children: unknown[] = [], declarations: unknown = state) {
    return {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: declarations,
      blueprint: {
        id: 'layout-page',
        props: { title: { $state: 'team' }, description: { $state: 'note' } },
        children: [
          {
            id: 'layout-grid',
            props: { columns: { $state: 'columns' } },
            children: [{ id: 'layout-card', props: { title: 'Tile' } }],
          },
          ...children,
        ],
      },
    };
  }

  function declarations(input: unknown): StateDeclarations {
    const parsed = parseStateDeclarations(input);
    if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join('; '));
    return parsed.declarations;
  }

  const gridStyle = (root: ParentNode) =>
    root.querySelector('.tx-player-layout--grid')?.getAttribute('style') ?? '';

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('host-bound state declarations (host G01)', () => {
    it('host-bound declarations take dotted sources, fitting values and plain scalars, and refuse writers', () => {
      expect(declarations(state).team?.source).toBe('team.name');
      for (const source of ['', 'Team Name', '../secrets', 'a..b', 7, `a.${'x'.repeat(70)}`]) {
        expect(parseStateDeclarations({ v: { type: 'string', source } }).ok).toBe(false);
      }
      // take host values that fit their declaration, else their initial value
      {
        const decl = declarations({
          ...state,
          flag: { type: 'boolean', initial: true, source: 'flag' },
          count: { type: 'number', min: 0, max: 9, initial: 5, source: 'count' },
        });
        const base = { team: 'Team', columns: 2, note: 'Local note', flag: true, count: 5 };
        const out = applyHostData(decl, base, {
          'team.name': 'Harbor ops',
          'layout.columns': 9,
          flag: false,
          count: 0,
        });
        expect(out).toMatchObject({
          team: 'Harbor ops',
          columns: 2,
          flag: false,
          count: 0,
          note: 'Local note',
        });
        expect(applyHostData(decl, base, { 'team.name': 42 }).team).toBe('Team');
        expect(applyHostData(decl, { ...base, team: 'Old' }, undefined).team).toBe('Team');
        const same = applyHostData(decl, base, {
          'team.name': 'Team',
          'layout.columns': 2,
          flag: true,
          count: 5,
        });
        expect(same).toBe(base);
      }
      expect(
        sanitizeDataSources({
          'team.name': 'Ops',
          'layout.columns': 3,
          ok: true,
          nested: { a: 1 },
          list: [1],
          big: 'x'.repeat(3000),
          nan: Number.NaN,
          'bad name': 'x',
        })
      ).toEqual({ 'team.name': 'Ops', 'layout.columns': 3, ok: true });
      expect(sanitizeDataSources('nope')).toBeNull();
      // refuse controls and fields that would write a host-bound variable
      {
        const tree = {
          id: 'layout-page',
          props: {},
          children: [{ id: 'control-filter', props: { state: 'team', label: 'Team' } }],
        };
        expect(checkHostBoundWriters(tree, declarations(state))[0]?.code).toBe('host-binding');
        expect(checkHostBoundWriters(tree, declarations({ team: { type: 'string' } }))).toEqual([]);
      }
    });
  });

  describe('the binding channel in the player', () => {
    it('the binding channel binds in place, fully validates host data and never fetches', async () => {
      await scenario(
        'binds host data into state, and an in-place update keeps the reader’s place',
        async () => {
          const onStateChange = vi.fn();
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: wrapped(),
            loaders: PLAYER_LOADERS,
            dataSources: { 'team.name': 'Harbor ops', 'layout.columns': 3 },
            onStateChange,
          });
          expect(
            await screen.findByRole('heading', { level: 1, name: 'Harbor ops' }, { timeout: 5000 })
          ).toBeTruthy();
          await waitFor(() => expect(gridStyle(target)).toContain('--tx-player-columns: 3'));
          const root = target.querySelector('[data-tx-player]');

          expect(mounted.setState('note', 'Edited by the reader')).toBe(true);
          expect(mounted.setState('team', 'Forged by the page')).toBe(false);

          mounted.update({ dataSources: { 'team.name': 'Billing', 'layout.columns': 4 } });
          expect(await screen.findByRole('heading', { level: 1, name: 'Billing' })).toBeTruthy();
          await waitFor(() => expect(gridStyle(target)).toContain('--tx-player-columns: 4'));
          expect(target.querySelector('[data-tx-player]')).toBe(root);
          expect(mounted.getState()).toMatchObject({
            team: 'Billing',
            columns: 4,
            note: 'Edited by the reader',
          });
          expect(onStateChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ team: 'Billing' })
          );
          mounted.dispose();
        }
      );
      await scenario(
        'runs host data through full validation: hostile markup refuses, good data recovers',
        async () => {
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: wrapped(),
            loaders: PLAYER_LOADERS,
            dataSources: { 'team.name': 'Harbor ops' },
          });
          await screen.findByRole('heading', { level: 1, name: 'Harbor ops' }, { timeout: 5000 });
          mounted.update({ dataSources: { 'team.name': '<img src=x onerror=alert(1)>' } });
          await waitFor(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
          expect(target.querySelector('img')).toBeNull();
          mounted.update({ dataSources: { 'team.name': 'Recovered' } });
          expect(await screen.findByRole('heading', { level: 1, name: 'Recovered' })).toBeTruthy();
          mounted.dispose();
        }
      );
      await scenario('refuses a control bound to host data, and never fetches', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { container } = render(Player, {
          props: {
            blueprint: wrapped([{ id: 'control-filter', props: { state: 'team', label: 'Team' } }]),
            loaders: PLAYER_LOADERS,
            dataSources: { 'team.name': 'Ops' },
          },
        });
        await waitFor(() =>
          expect(container.querySelector('[data-tx-player-state-notice]')?.textContent).toContain(
            'comes from the host'
          )
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('host data through the frame protocol', () => {
    it('host data through the frame protocol: strict messages, in-place binding, ready frames', async () => {
      await scenario('parses data messages strictly', async () => {
        expect(
          parseHostMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'data',
            sources: { a: 1, b: { c: 2 } },
          })
        ).toEqual({
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'data',
          sources: { a: 1 },
        });
        expect(
          parseHostMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'data', sources: [1] })
        ).toBeNull();
      });
      await scenario('binds host data sent to a frame, in place', async () => {
        const parent = Object.assign(new EventTarget(), { postMessage: vi.fn() });
        const win = Object.assign(new EventTarget(), {
          postMessage: vi.fn(),
          parent,
        }) as unknown as Window;
        const target = document.createElement('div');
        document.body.append(target);
        const frame = mountPlayerFrame(target, {
          parentOrigins: ['https://host.example'],
          window: win,
          loaders: PLAYER_LOADERS,
        });
        const send = (data: unknown) => {
          const event = new MessageEvent('message', { origin: 'https://host.example', data });
          Object.defineProperty(event, 'source', { value: parent });
          (win as unknown as EventTarget).dispatchEvent(event);
        };
        send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'init', blueprint: wrapped(), options: {} });
        expect(
          await screen.findByRole('heading', { level: 1, name: 'Team' }, { timeout: 5000 })
        ).toBeTruthy();
        send({
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'data',
          sources: { 'team.name': 'From the host' },
        });
        expect(
          await screen.findByRole('heading', { level: 1, name: 'From the host' })
        ).toBeTruthy();
        frame.dispose();
      });
      await scenario('lets the host send data to a ready frame', async () => {
        const hostWindow = new EventTarget() as Window & EventTarget;
        const frameWindow = Object.assign(new EventTarget(), { postMessage: vi.fn() });
        const iframe = Object.assign(new EventTarget(), {
          contentWindow: frameWindow,
          ownerDocument: { defaultView: hostWindow },
        }) as unknown as HTMLIFrameElement;
        const host = createPlayerFrameHost({ frame: iframe });
        expect(host.data({ 'team.name': 'Ops' })).toBe(false);
        const ready = new MessageEvent('message', {
          origin: 'null',
          data: { protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' },
        });
        Object.defineProperty(ready, 'source', { value: frameWindow });
        hostWindow.dispatchEvent(ready);
        expect(host.data({ 'team.name': 'Ops' })).toBe(true);
        expect(frameWindow.postMessage).toHaveBeenCalledWith(
          { protocol: PLAYER_FRAME_PROTOCOL, type: 'data', sources: { 'team.name': 'Ops' } },
          '*'
        );
      });
    });
  });
});

describe('controls (G06)', () => {
  async function mount(children: unknown[] = controls, extra: Record<string, unknown> = {}) {
    const onStateChange = vi.fn();
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, {
      blueprint: wrapped(children),
      loaders: PLAYER_LOADERS,
      onStateChange,
      ...extra,
    });
    await screen.findByRole('heading', { level: 1, name: 'w42' }, { timeout: 5000 });
    await waitFor(() => expect(target.querySelector('[data-tx-player-skeleton]')).toBeNull(), {
      timeout: 5000,
    });
    await tick();
    return { target, mounted, onStateChange };
  }

  const state = {
    details: { type: 'boolean' },
    week: { type: 'enum', values: ['w41', 'w42', 'w43'], initial: 'w42' },
    limit: { type: 'number', min: 0, max: 10, initial: 5 },
    query: { type: 'string', maxLength: 20 },
  };

  function wrapped(children: unknown[], declarations: unknown = state) {
    return {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: declarations,
      blueprint: {
        id: 'layout-page',
        props: { title: { $state: 'week' }, description: { $state: 'query' } },
        children,
      },
    };
  }

  const controls = [
    { id: 'control-toggle', props: { state: 'details', label: 'Show details' } },
    { id: 'control-choice', props: { state: 'week', label: 'Week' } },
    { id: 'control-slider', props: { state: 'limit', label: 'Items shown', step: 1 } },
    {
      id: 'control-filter',
      props: { state: 'query', label: 'Filter tickets', placeholder: 'Search' },
    },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('state-only control manifests (G06, D14)', () => {
    it('state-only control manifests are valid, emittable and bind only declared variables of their type', () => {
      // are valid, agent-emittable and interactive in the grammar
      {
        expect(validateCatalogManifests(CONTROL_MANIFESTS)).toMatchObject({ valid: true });
        const catalog = createPlayerCatalog();
        for (const id of Object.keys(CONTROL_STATE_TYPES)) {
          expect(catalog.allows?.(id, 'untrusted')).toBe(true);
          expect(PLAYER_GRAMMAR_ROLES.get(id)?.role).toBe('interactive');
        }
      }
      // bind only to a declared variable of the type they write
      {
        const declarations = {
          details: { type: 'boolean', initial: false },
          week: { type: 'enum', values: ['a'], initial: 'a' },
        } as const;
        const tree = (props: Record<string, unknown>) => ({
          id: 'layout-page',
          props: {},
          children: [{ id: 'control-toggle', props }],
        });
        expect(checkControlBindings(tree({ state: 'details', label: 'x' }), declarations)).toEqual(
          []
        );
        expect(
          checkControlBindings(tree({ state: 'week', label: 'x' }), declarations)[0]?.message
        ).toContain('writes a boolean');
        expect(
          checkControlBindings(tree({ state: 'nope', label: 'x' }), declarations)[0]?.code
        ).toBe('control-binding');
        expect(checkControlBindings(tree({ label: 'x' }), declarations)).toHaveLength(1);
        expect(
          checkControlBindings(tree({ state: 'details', label: 'x' }), null)[0]?.message
        ).toContain('declares none');
      }
    });
  });

  describe('controls write state and nothing else', () => {
    it('controls write state and nothing else: toggle, roving choice, bounded slider and filter, at the untrusted tier', async () => {
      await scenario('toggle flips its boolean and raises a state event', async () => {
        const { onStateChange } = await mount();
        const toggle = screen.getByRole('switch', { name: 'Show details' });
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(toggle.getAttribute('type')).toBe('button');
        await fireEvent.click(toggle);
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ details: true }));
      });
      await scenario(
        'choice is a roving radio group that sets its enum, and bound content follows',
        async () => {
          const { onStateChange } = await mount();
          const group = screen.getByRole('radiogroup', { name: 'Week' });
          const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
          expect(radios.map((radio) => radio.textContent?.trim())).toEqual(['w41', 'w42', 'w43']);
          expect(radios.map((radio) => radio.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
          await fireEvent.click(radios[0] as HTMLElement);
          expect(await screen.findByRole('heading', { level: 1, name: 'w41' })).toBeTruthy();
          radios[0]?.focus();
          await fireEvent.keyDown(radios[0] as HTMLElement, {
            key: 'End',
            bubbles: true,
            cancelable: true,
          });
          expect(await screen.findByRole('heading', { level: 1, name: 'w43' })).toBeTruthy();
          await fireEvent.keyDown(group.querySelector('[aria-checked="true"]') as HTMLElement, {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          expect(await screen.findByRole('heading', { level: 1, name: 'w41' })).toBeTruthy();
          expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ week: 'w41' }));
        }
      );
      await scenario(
        'slider keeps to its declared range and filter to its declared length',
        async () => {
          const { mounted } = await mount();
          const slider = screen.getByRole('slider', { name: 'Items shown' }) as HTMLInputElement;
          expect([slider.min, slider.max, slider.value]).toEqual(['0', '10', '5']);
          await fireEvent.input(slider, { target: { value: '8' } });
          expect(mounted.getState().limit).toBe(8);
          const filter = screen.getByRole('searchbox', {
            name: 'Filter tickets',
          }) as HTMLInputElement;
          expect(filter.maxLength).toBe(20);
          await fireEvent.input(filter, { target: { value: 'billing' } });
          expect(mounted.getState().query).toBe('billing');
          expect(await screen.findByText('billing')).toBeTruthy();
        }
      );
      await scenario('works at the untrusted tier, the default for agent output', async () => {
        const { target } = await mount(controls, { tier: 'untrusted' });
        expect(target.querySelectorAll('[data-tx-player-control]')).toHaveLength(4);
        expect(target.querySelector('[role="alert"]')).toBeNull();
      });
    });
  });

  describe('no submits (D14)', () => {
    it('no submits: neither host forms around the player nor forms inside painted components', async () => {
      await scenario(
        'never submits a host form around the player, by click or by Enter',
        async () => {
          const hostForm = document.createElement('form');
          const submitted = vi.fn((event: Event) => event.preventDefault());
          hostForm.addEventListener('submit', submitted);
          document.body.append(hostForm);
          const view = render(Player, {
            target: hostForm,
            props: { blueprint: wrapped(controls), loaders: PLAYER_LOADERS },
          });
          await screen.findByRole('heading', { level: 1, name: 'w42' }, { timeout: 5000 });
          await waitFor(() =>
            expect(view.container.querySelectorAll('[data-tx-player-control]')).toHaveLength(4)
          );
          for (const button of view.container.querySelectorAll('[data-tx-player-control] button')) {
            expect(button.getAttribute('type')).toBe('button');
          }
          await fireEvent.click(screen.getByRole('switch', { name: 'Show details' }));
          const filter = screen.getByRole('searchbox', { name: 'Filter tickets' });
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          filter.dispatchEvent(enter);
          expect(enter.defaultPrevented).toBe(true);
          // A submit raised from inside the painted surface is cancelled there.
          const surface = view.container.querySelector('[data-tx-player-surface]') as HTMLElement;
          const submit = new Event('submit', { bubbles: true, cancelable: true });
          surface.querySelector('[data-tx-player-control]')?.dispatchEvent(submit);
          expect(submit.defaultPrevented).toBe(true);
          expect(submitted).not.toHaveBeenCalled();
        }
      );
      await scenario('cancels a submit from a form inside any painted component', async () => {
        const base = createPlayerCatalog();
        const catalog: RenderCatalog = {
          get: (id) =>
            id === 'test-form'
              ? { id, label: 'Form', props: [], emit: ['developer'] }
              : base.get(id),
          allows: (id, tier) => (id === 'test-form' ? true : (base.allows?.(id, tier) ?? false)),
        };
        const outer = vi.fn();
        document.addEventListener('submit', outer);
        const view = render(Player, {
          props: {
            blueprint: {
              id: 'layout-page',
              props: { title: 'Forms' },
              children: [{ id: 'test-form', props: {} }],
            },
            catalog,
            tier: 'developer',
            loaders: {
              ...PLAYER_LOADERS,
              'test-form': async () => (await import('./FormStub.svelte')).default,
            },
          },
        });
        const form = await screen.findByTestId('painted-form', {}, { timeout: 5000 });
        const submit = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submit);
        expect(submit.defaultPrevented).toBe(true);
        expect(outer).not.toHaveBeenCalled();
        document.removeEventListener('submit', outer);
        view.unmount();
      });
    });
  });

  describe('refusals', () => {
    it('refuses a control without declared state, and one bound to the wrong type', async () => {
      const plain = render(Player, {
        props: {
          blueprint: { id: 'layout-page', props: { title: 'Plain' }, children: [controls[0]] },
          loaders: PLAYER_LOADERS,
        },
      });
      expect(plain.container.querySelector('[data-tx-player-state-notice]')?.textContent).toContain(
        'declares none'
      );
      plain.unmount();
      const mismatched = render(Player, {
        props: {
          blueprint: wrapped([{ id: 'control-slider', props: { state: 'week', label: 'Wrong' } }]),
          loaders: PLAYER_LOADERS,
        },
      });
      expect(
        mismatched.container.querySelector('[data-tx-player-state-notice]')?.textContent
      ).toContain('writes a number');
    });
  });
});

describe('actions (G17)', () => {
  async function paint(extra: Record<string, unknown> = {}, blueprint: unknown = wrapped()) {
    const view = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS, ...extra } });
    await screen.findByRole('heading', { level: 1, name: 'Fictional access' }, { timeout: 5000 });
    await waitFor(
      () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
      { timeout: 5000 }
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send request' })).toBeTruthy());
    await tick();
    return view;
  }

  async function fill() {
    await fireEvent.input(screen.getByLabelText(/Email/), { target: { value: 'ada@example.com' } });
    await fireEvent.input(screen.getByLabelText(/Team/), { target: { value: 'harbor-ops' } });
    await fireEvent.input(screen.getByLabelText(/Seats/), { target: { value: '5' } });
  }

  const state = {
    email: { type: 'string', maxLength: 120 },
    team: { type: 'string', maxLength: 40 },
    seats: { type: 'number', min: 0, max: 50, initial: 0 },
  };

  const field = (props: Record<string, unknown>) => ({ id: 'form-field', props });
  const form = (children: unknown[], props: Record<string, unknown> = {}) => ({
    id: 'action-form',
    props: { action: 'request-access', label: 'Request access', ...props },
    children,
  });
  const fields = [
    field({
      name: 'email',
      state: 'email',
      label: 'Email',
      kind: 'email',
      required: true,
      autocomplete: 'email',
    }),
    field({ name: 'team', state: 'team', label: 'Team', pattern: 'slug' }),
    field({
      name: 'seats',
      state: 'seats',
      label: 'Seats',
      kind: 'number',
      min: 1,
      max: 20,
      required: true,
    }),
    { id: 'form-submit', props: { label: 'Send request' } },
  ];

  function wrapped(children: unknown[] = [form(fields)], declarations: unknown = state) {
    return {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: declarations,
      blueprint: { id: 'layout-page', props: { title: 'Fictional access' }, children },
    };
  }

  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  const receipt = (container: Element) =>
    container.querySelector('[data-tx-player-receipt]')?.textContent?.trim();

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('action model (G17)', () => {
    it('the action model validates fields, caps values, keeps sensitive autocomplete out, maps receipts and checks declared state', async () => {
      await scenario(
        'validates required, pattern, length and range with fixed messages',
        async () => {
          const messages = DEFAULT_FIELD_MESSAGES;
          expect(
            validateFieldValue({ label: 'Email', kind: 'email', required: true }, '', messages)
          ).toBe('Email is required.');
          expect(
            validateFieldValue({ label: 'Email', kind: 'email' }, 'not-an-email', messages)
          ).toContain('expected format');
          expect(
            validateFieldValue(
              { label: 'Team', kind: 'text', pattern: 'slug' },
              'Harbor Ops',
              messages
            )
          ).toContain('expected format');
          expect(
            validateFieldValue({ label: 'Code', kind: 'text', minLength: 4 }, 'ab', messages)
          ).toBe('Code must be 4 to 2048 characters.');
          expect(
            validateFieldValue({ label: 'Seats', kind: 'number', min: 1, max: 20 }, 25, messages)
          ).toBe('Seats must be between 1 and 20.');
          expect(validateFieldValue({ label: 'Note', kind: 'text' }, '', messages)).toBeNull();
        }
      );
      await scenario('caps action values to plain scalars', async () => {
        expect(
          actionValues([
            ['email', 'a@example.com'],
            ['seats', 3],
            ['ok', true],
          ])
        ).toEqual({ email: 'a@example.com', seats: 3, ok: true });
        expect(actionValues([['big', 'x'.repeat(MAX_ACTION_VALUE_LENGTH + 1)]])).toBeNull();
        expect(
          actionValues([
            ['a', 1],
            ['a', 2],
          ])
        ).toBeNull();
        expect(actionValues([['bad name', 1]])).toBeNull();
        expect(
          actionValues(Array.from({ length: 33 }, (_, i) => [`f${i}`, i] as const))
        ).toBeNull();
        const proto = actionValues([['__proto__', 'x']]);
        expect(proto).toBeNull();
      });
      await scenario(
        'keeps payment, credential and one-time-code tokens out of autocomplete',
        async () => {
          for (const token of [
            'cc-number',
            'cc-csc',
            'cc-exp',
            'current-password',
            'new-password',
            'one-time-code',
          ]) {
            expect((AUTOCOMPLETE_ALLOWLIST as readonly string[]).includes(token)).toBe(false);
          }
        }
      );
      await scenario('maps host answers to receipts', async () => {
        const intent = { id: 'action-1', action: 'a', values: {} };
        expect(await runAction(undefined, intent)).toBe('unavailable');
        expect(await runAction(() => 'confirmed', intent)).toBe('confirmed');
        expect(await runAction(async () => 'rejected' as const, intent)).toBe('rejected');
        expect(
          await runAction(() => {
            throw new Error('down');
          }, intent)
        ).toBe('failed');
        expect(await runAction((() => 'maybe') as never, intent)).toBe('failed');
      });
      await scenario('checks forms, fields and submits against the declared state', async () => {
        const declarations = {
          email: { type: 'string', maxLength: 10, initial: '' },
          seats: { type: 'number', min: 0, max: 1, initial: 0 },
        } as const;
        const tree = (children: unknown[]) => ({ id: 'layout-page', props: {}, children });
        expect(
          checkActionNodes(
            tree([form([field({ name: 'email', state: 'email', label: 'E' })])]),
            declarations
          )
        ).toEqual([]);
        expect(
          checkActionNodes(
            tree([field({ name: 'email', state: 'email', label: 'E' })]),
            declarations
          )[0]?.message
        ).toContain('inside an "action-form"');
        expect(
          checkActionNodes(
            tree([form([field({ name: 'n', state: 'seats', label: 'N' })])]),
            declarations
          )[0]?.message
        ).toContain('writes a string');
        expect(
          checkActionNodes(
            tree([
              form([
                field({ name: 'e', state: 'email', label: 'A' }),
                field({ name: 'e', state: 'email', label: 'B' }),
              ]),
            ]),
            declarations
          )[0]?.message
        ).toContain('used twice');
        expect(checkActionNodes(tree([form([form([])])]), declarations)[0]?.message).toContain(
          'cannot nest'
        );
        expect(
          checkActionNodes(tree([form([], { action: 'bad action!' })]), declarations)[0]?.message
        ).toContain('action name');
      });
    });
  });

  describe('the action surface in the player', () => {
    it('the action surface blocks invalid submits, proposes one intent, shows receipts and never submits host forms', async () => {
      await scenario(
        'blocks an invalid submit: errors linked to fields, focus on the first, no intent',
        async () => {
          const onAction = vi.fn(() => 'confirmed' as const);
          const { container } = await paint({ onAction });
          await submit();
          const email = screen.getByLabelText(/Email/);
          expect(email.getAttribute('aria-invalid')).toBe('true');
          expect(
            container.querySelector(`#${email.getAttribute('aria-describedby')}`)?.textContent
          ).toBe('Email is required.');
          expect(document.activeElement).toBe(email);
          expect(onAction).not.toHaveBeenCalled();
          expect(email.getAttribute('autocomplete')).toBe('email');
        }
      );
      await scenario(
        'proposes one action intent with the named values and shows the receipt',
        async () => {
          let answer: (value: 'confirmed' | 'rejected') => void = () => {};
          const onAction = vi.fn(
            () =>
              new Promise<'confirmed' | 'rejected'>((resolve) => {
                answer = resolve;
              })
          );
          const { container } = await paint({ onAction });
          await fill();
          await submit();
          expect(onAction).toHaveBeenCalledTimes(1);
          expect(onAction).toHaveBeenCalledWith({
            id: 'action-1',
            action: 'request-access',
            values: { email: 'ada@example.com', team: 'harbor-ops', seats: 5 },
          });
          await tick();
          expect(receipt(container)).toBe('Sending…');
          const button = screen.getByRole('button', { name: 'Send request' });
          expect(button.hasAttribute('disabled')).toBe(true);
          await submit();
          expect(onAction).toHaveBeenCalledTimes(1);
          answer('confirmed');
          await waitFor(() => expect(receipt(container)).toBe('Sent.'));
          await waitFor(() =>
            expect(container.querySelector('[data-tx-player-announcer]')?.textContent?.trim()).toBe(
              'Sent.'
            )
          );
        }
      );
      await scenario('shows the rejected and failed receipts', async () => {
        for (const [name, onAction, text] of RECEIPTS) {
          const { container } = await paint({ onAction });
          await fill();
          await submit();
          await waitFor(() => expect(receipt(container), name).toBe(text));
          cleanup();
        }
      });
      await scenario('is unavailable without a host handler, and sends nothing', async () => {
        const { container } = await paint();
        expect(
          screen.getByRole('button', { name: 'Send request' }).getAttribute('aria-disabled')
        ).toBe('true');
        await fill();
        await submit();
        await waitFor(() => expect(receipt(container)).toBe('This preview cannot send.'));
      });
      await scenario(
        'never hands a native submission to a host form around the player',
        async () => {
          const hostForm = document.createElement('form');
          const submitted = vi.fn((event: Event) => event.preventDefault());
          hostForm.addEventListener('submit', submitted);
          document.body.append(hostForm);
          const onAction = vi.fn(() => 'confirmed' as const);
          render(Player, {
            target: hostForm,
            props: { blueprint: wrapped(), loaders: PLAYER_LOADERS, onAction },
          });
          await screen.findByRole('button', { name: 'Send request' }, { timeout: 5000 });
          await fill();
          // Enter in a field submits the action form (implicit submission): only the intent leaves.
          const formElement = document.querySelector(
            '[data-tx-player-action-form]'
          ) as HTMLFormElement;
          formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
          expect(submitted).not.toHaveBeenCalled();
        }
      );
      await scenario(
        'refuses fields outside forms, of the wrong type or without declared state',
        async () => {
          for (const [name, blueprint, message] of BAD_FIELDS) {
            const { container } = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS } });
            await tick();
            expect(
              container.querySelector('[data-tx-player-state-notice]')?.textContent ?? '',
              name
            ).toContain(message);
            cleanup();
          }
        }
      );
      await scenario('refuses a payment autocomplete token through the manifest enum', async () => {
        const { container } = render(Player, {
          props: {
            blueprint: wrapped([
              form([
                field({ name: 'card', state: 'email', label: 'Card', autocomplete: 'cc-number' }),
              ]),
            ]),
            loaders: PLAYER_LOADERS,
          },
        });
        await tick();
        expect(container.querySelector('[role="alert"]')).not.toBeNull();
        expect(container.querySelector('input[autocomplete="cc-number"]')).toBeNull();
      });
    });

    const RECEIPTS: ReadonlyArray<[string, () => unknown, string]> = [
      ['rejected', () => 'rejected' as const, 'Not accepted.'],
      [
        'failed',
        () => {
          throw new Error('down');
        },
        'Could not send. Please try again.',
      ],
    ];

    const BAD_FIELDS: ReadonlyArray<[string, unknown, string]> = [
      [
        'a field outside a form',
        wrapped([field({ name: 'email', state: 'email', label: 'E' })]),
        'inside an "action-form"',
      ],
      [
        'a number field on a string variable',
        wrapped([form([field({ name: 'email', state: 'email', label: 'E', kind: 'number' })])]),
        'writes a number',
      ],
      [
        'a field without declared state',
        {
          id: 'layout-page',
          props: { title: 'X' },
          children: [form([field({ name: 'email', state: 'email', label: 'E' })])],
        },
        'declares none',
      ],
    ];
  });

  describe('actions through the frame protocol', () => {
    it('actions through the frame protocol: capped messages, host answers as receipts', async () => {
      await scenario('parses action messages under the same caps', async () => {
        expect(
          parseFrameMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action',
            id: 'action-1',
            action: 'a',
            values: { n: 1 },
          })
        ).toMatchObject({ type: 'action' });
        expect(
          parseFrameMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action',
            id: 'action-1',
            action: 'a',
            values: { big: 'x'.repeat(3000) },
          })
        ).toBeNull();
        expect(
          parseFrameMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action',
            id: 'x',
            action: 'a',
            values: {},
          })
        ).toBeNull();
        expect(
          parseHostMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action-result',
            id: 'action-2',
            status: 'confirmed',
          })
        ).toMatchObject({ status: 'confirmed' });
        expect(
          parseHostMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action-result',
            id: 'action-2',
            status: 'maybe',
          })
        ).toBeNull();
      });
      await scenario(
        'sends a frame action to the host and shows the host answer as the receipt',
        async () => {
          const parent = Object.assign(new EventTarget(), { postMessage: vi.fn() });
          const win = Object.assign(new EventTarget(), {
            postMessage: vi.fn(),
            parent,
          }) as unknown as Window;
          const target = document.createElement('div');
          document.body.append(target);
          const frame = mountPlayerFrame(target, {
            parentOrigins: ['https://host.example'],
            window: win,
            loaders: PLAYER_LOADERS,
          });
          const send = (data: unknown) => {
            const event = new MessageEvent('message', { origin: 'https://host.example', data });
            Object.defineProperty(event, 'source', { value: parent });
            (win as unknown as EventTarget).dispatchEvent(event);
          };
          send({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'init',
            blueprint: wrapped(),
            options: {},
          });
          await screen.findByRole('button', { name: 'Send request' }, { timeout: 5000 });
          await fill();
          await submit();
          await waitFor(() =>
            expect(parent.postMessage).toHaveBeenCalledWith(
              {
                protocol: PLAYER_FRAME_PROTOCOL,
                type: 'action',
                id: 'action-1',
                action: 'request-access',
                values: { email: 'ada@example.com', team: 'harbor-ops', seats: 5 },
              },
              'https://host.example'
            )
          );
          send({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'action-result',
            id: 'action-1',
            status: 'confirmed',
          });
          await waitFor(() => expect(receipt(target)).toBe('Sent.'));
          frame.dispose();
        }
      );
      await scenario('answers a frame action from the host handler', async () => {
        const hostWindow = new EventTarget() as Window & EventTarget;
        const frameWindow = Object.assign(new EventTarget(), { postMessage: vi.fn() });
        const iframe = Object.assign(new EventTarget(), {
          contentWindow: frameWindow,
          ownerDocument: { defaultView: hostWindow },
        }) as unknown as HTMLIFrameElement;
        const onAction = vi.fn(async () => 'rejected' as const);
        createPlayerFrameHost({ frame: iframe, onAction });
        const post = (data: unknown) => {
          const event = new MessageEvent('message', { origin: 'null', data });
          Object.defineProperty(event, 'source', { value: frameWindow });
          hostWindow.dispatchEvent(event);
        };
        post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' });
        post({
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'action',
          id: 'action-3',
          action: 'a',
          values: { n: 1 },
        });
        await waitFor(() =>
          expect(frameWindow.postMessage).toHaveBeenCalledWith(
            {
              protocol: PLAYER_FRAME_PROTOCOL,
              type: 'action-result',
              id: 'action-3',
              status: 'rejected',
            },
            '*'
          )
        );
        expect(onAction).toHaveBeenCalledWith({ id: 'action-3', action: 'a', values: { n: 1 } });
      });
    });
  });
});

describe('flows', () => {
  async function paint(extra: Record<string, unknown> = {}, blueprint: unknown = wizard()) {
    const onFlowChange = vi.fn();
    const view = render(Player, {
      props: { blueprint, loaders: PLAYER_LOADERS, onFlowChange, ...extra },
    });
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Fictional onboarding' },
      { timeout: 5000 }
    );
    await waitFor(
      () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
      { timeout: 5000 }
    );
    await tick();
    return { ...view, onFlowChange };
  }

  const agreed = { op: 'eq', left: { op: 'var', name: 'agree' }, right: { op: 'num', value: 1 } };

  const flow = {
    views: ['details', 'review', 'done'],
    initial: 'details',
    transitions: [
      { from: 'details', to: 'review', on: 'next', when: agreed },
      { from: 'review', to: 'details', on: 'back' },
      { from: 'review', to: 'done', on: 'next' },
      { from: '*', to: 'details', on: 'restart' },
    ],
  };

  const card = (title: string) => ({ id: 'layout-card', props: { title } });
  const action = (event: string, label: string) => ({ id: 'flow-action', props: { event, label } });

  function wizard(overrides: Record<string, unknown> = {}) {
    return {
      format: LOCAL_STATE_FORMAT,
      version: 1,
      state: { agree: { type: 'boolean' } },
      flow,
      blueprint: {
        id: 'layout-page',
        props: { title: 'Fictional onboarding' },
        children: [
          { id: 'control-toggle', props: { state: 'agree', label: 'I agree' } },
          {
            id: 'flow-view',
            props: { name: 'details', label: 'Details' },
            children: [card('Your details'), action('next', 'Next')],
          },
          {
            id: 'flow-view',
            props: { name: 'review', label: 'Review' },
            children: [card('Check everything'), action('back', 'Back'), action('next', 'Confirm')],
          },
          {
            id: 'flow-view',
            props: { name: 'done', label: 'Done' },
            children: [card('All set'), action('restart', 'Start over')],
          },
        ],
      },
      ...overrides,
    };
  }

  const shown = (container: Element) =>
    Array.from(container.querySelectorAll('[data-tx-player-flow-view]')).map((view) =>
      view.getAttribute('data-tx-player-flow-view')
    );

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('flow declaration', () => {
    it('flow declarations: views, initial view, guarded transitions and refusals', () => {
      // reads views, the initial view and a closed transition table with guards
      {
        const parsed = parseFlowDeclaration(flow);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.flow.initial).toBe('details');
        expect(parsed.flow.transitions).toHaveLength(4);
        expect(nextFlowView(parsed.flow, 'details', 'next', { agree: 0 })).toBeNull();
        expect(nextFlowView(parsed.flow, 'details', 'next', { agree: 1 })).toBe('review');
        expect(nextFlowView(parsed.flow, 'done', 'restart', {})).toBe('details');
        expect(nextFlowView(parsed.flow, 'details', 'jump', {})).toBeNull();
      }
      for (const [name, input] of BAD_FLOWS) {
        expect(parseFlowDeclaration(input).ok, name).toBe(false);
      }
    });

    const BAD_FLOWS: ReadonlyArray<[string, unknown]> = [
      ['no views', { views: [], transitions: [] }],
      ['17 views', { views: Array.from({ length: 17 }, (_, i) => `v${i}`), transitions: [] }],
      ['a bad view name', { views: ['Bad View'], transitions: [] }],
      ['an undeclared target', { views: ['a'], transitions: [{ from: 'a', to: 'b', on: 'next' }] }],
      ['a bad event', { views: ['a'], transitions: [{ from: 'a', to: 'a', on: 'Next!' }] }],
      [
        'an invalid guard',
        { views: ['a'], transitions: [{ from: 'a', to: 'a', on: 'go', when: { op: 'eval' } }] },
      ],
      ['an unknown field', { views: ['a'], transitions: [], url: '/x' }],
      [
        'a transition field',
        { views: ['a'], transitions: [{ from: 'a', to: 'a', on: 'go', href: '/x' }] },
      ],
    ];
  });

  describe('flows in the player', () => {
    it('flows in the player: current view, guarded moves, host view, mountPlayer API, no location or history', async () => {
      await scenario(
        'paints only the current view and moves through guarded transitions',
        async () => {
          const { container, onFlowChange } = await paint();
          expect(shown(container)).toEqual(['details']);
          expect(screen.queryByText('Check everything')).toBeNull();

          const next = screen.getByRole('button', { name: 'Next' });
          expect(next.getAttribute('type')).toBe('button');
          expect(next.getAttribute('aria-disabled')).toBe('true');
          await fireEvent.click(next);
          expect(shown(container)).toEqual(['details']);
          expect(onFlowChange).not.toHaveBeenCalled();

          await fireEvent.click(screen.getByRole('switch', { name: 'I agree' }));
          expect(next.getAttribute('aria-disabled')).toBe('false');
          await fireEvent.click(next);
          await tick();
          expect(shown(container)).toEqual(['review']);
          expect(onFlowChange).toHaveBeenLastCalledWith({
            from: 'details',
            to: 'review',
            event: 'next',
          });
          await waitFor(() =>
            expect(document.activeElement?.getAttribute('data-tx-player-flow-view')).toBe('review')
          );
          await waitFor(() =>
            expect(container.querySelector('[data-tx-player-announcer]')?.textContent?.trim()).toBe(
              'Now showing Review.'
            )
          );

          await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
          await tick();
          expect(shown(container)).toEqual(['details']);
        }
      );
      await scenario(
        'lets the host set the view, ignoring a view that is not declared',
        async () => {
          const { container } = await paint({ view: 'done' });
          expect(shown(container)).toEqual(['done']);
          document.body.innerHTML = '';
          const other = await paint({ view: 'nowhere' });
          expect(shown(other.container)).toEqual(['details']);
        }
      );
      await scenario(
        'exposes dispatchFlow and getView on mountPlayer, and keeps the view across update()',
        async () => {
          const target = document.createElement('div');
          document.body.append(target);
          const mounted = mountPlayer(target, {
            blueprint: wizard(),
            loaders: PLAYER_LOADERS,
            initialState: { agree: true },
          });
          await screen.findByRole(
            'heading',
            { level: 1, name: 'Fictional onboarding' },
            { timeout: 5000 }
          );
          expect(mounted.getView()).toBe('details');
          expect(mounted.dispatchFlow('back')).toBe(false);
          expect(mounted.dispatchFlow('next')).toBe(true);
          expect(mounted.getView()).toBe('review');
          mounted.update({ label: 'Renamed' });
          expect(mounted.getView()).toBe('review');
          mounted.dispose();
        }
      );
      await scenario('never touches location or history', async () => {
        const push = vi.spyOn(history, 'pushState');
        const replace = vi.spyOn(history, 'replaceState');
        const before = location.href;
        const { container } = await paint({ initialState: { agree: true } });
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
        await tick();
        expect(shown(container)).toEqual(['done']);
        expect(push).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
        expect(location.href).toBe(before);
      });
    });
  });

  describe('refusals', () => {
    const BAD_BLUEPRINTS: ReadonlyArray<[string, unknown, string]> = [
      [
        'a view that is not declared',
        wizard({
          blueprint: {
            id: 'layout-page',
            props: { title: 'X' },
            children: [{ id: 'flow-view', props: { name: 'ghost' } }],
          },
        }),
        'names no declared view',
      ],
      [
        'an event no transition handles',
        wizard({
          blueprint: {
            id: 'layout-page',
            props: { title: 'X' },
            children: [action('submit', 'Pay')],
          },
        }),
        'no transition handles',
      ],
      [
        'flow nodes without a flow',
        { id: 'layout-page', props: { title: 'X' }, children: [action('next', 'Next')] },
        'declares none',
      ],
      [
        'a malformed flow',
        wizard({ flow: { views: ['a'], transitions: [{ from: 'a', to: 'z', on: 'go' }] } }),
        'to must be a declared view',
      ],
    ];

    it('refuses undeclared views, unhandled events, flowless nodes and malformed flows', async () => {
      for (const [name, blueprint, message] of BAD_BLUEPRINTS) {
        const { container } = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS } });
        await tick();
        expect(
          container.querySelector('[data-tx-player-state-notice]')?.textContent,
          name
        ).toContain(message);
        cleanup();
      }
    });
  });

  describe('flow events through the frame protocol', () => {
    it('flow events through the frame protocol, in both directions', async () => {
      await scenario('parses flow messages strictly and a host view update', async () => {
        expect(
          parseFrameMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'flow',
            from: 'a',
            to: 'b',
            event: 'next',
          })
        ).toMatchObject({ type: 'flow', to: 'b' });
        expect(
          parseFrameMessage({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'flow',
            from: 'a',
            to: 'https://evil.example',
            event: 'next',
          })
        ).toBeNull();
        expect(
          parseHostMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'update', view: 'review' })
        ).toMatchObject({ view: 'review' });
        expect(
          parseHostMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'update', view: '../x' })
        ).not.toHaveProperty('view');
      });
      await scenario(
        'reports a frame flow change to the host, and the host can set the frame view',
        async () => {
          const parent = Object.assign(new EventTarget(), {
            postMessage: vi.fn(),
          }) as EventTarget & {
            postMessage: ReturnType<typeof vi.fn>;
            parent?: unknown;
          };
          const win = Object.assign(new EventTarget(), {
            postMessage: vi.fn(),
            parent,
          }) as unknown as Window;
          const target = document.createElement('div');
          document.body.append(target);
          const frame = mountPlayerFrame(target, {
            parentOrigins: ['https://host.example'],
            window: win,
            loaders: PLAYER_LOADERS,
          });
          const send = (data: unknown) => {
            const event = new MessageEvent('message', { origin: 'https://host.example', data });
            Object.defineProperty(event, 'source', { value: parent });
            (win as unknown as EventTarget).dispatchEvent(event);
          };
          send({
            protocol: PLAYER_FRAME_PROTOCOL,
            type: 'init',
            blueprint: wizard(),
            options: { view: 'review' },
          });
          await screen.findByRole('button', { name: 'Confirm' }, { timeout: 5000 });
          await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
          expect(parent.postMessage).toHaveBeenCalledWith(
            {
              protocol: PLAYER_FRAME_PROTOCOL,
              type: 'flow',
              from: 'review',
              to: 'done',
              event: 'next',
            },
            'https://host.example'
          );
          send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'update', view: 'details' });
          await waitFor(() => expect(shown(target)).toEqual(['details']));
          frame.dispose();
        }
      );
      await scenario('hands a frame flow message to the host onFlow callback', async () => {
        const hostWindow = new EventTarget() as Window & EventTarget;
        const frameWindow = Object.assign(new EventTarget(), { postMessage: vi.fn() });
        const iframe = Object.assign(new EventTarget(), {
          contentWindow: frameWindow,
          ownerDocument: { defaultView: hostWindow },
        }) as unknown as HTMLIFrameElement;
        const onFlow = vi.fn();
        createPlayerFrameHost({ frame: iframe, onFlow });
        const post = (data: unknown) => {
          const event = new MessageEvent('message', { origin: 'null', data });
          Object.defineProperty(event, 'source', { value: frameWindow });
          hostWindow.dispatchEvent(event);
        };
        post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' });
        post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'flow', from: 'a', to: 'b', event: 'next' });
        expect(onFlow).toHaveBeenCalledWith({ from: 'a', to: 'b', event: 'next' });
      });
    });
  });
});

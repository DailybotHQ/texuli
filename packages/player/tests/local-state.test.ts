import { render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import {
  LOCAL_STATE_FORMAT,
  resolveStateBindings,
  splitStatefulBlueprint,
} from '../src/state/bind.ts';
import { MAX_STATE_VARS, parseStateDeclarations } from '../src/state/schema.ts';

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
  it('reads typed, bounded variables with defaults', () => {
    const parsed = parseStateDeclarations(declared);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.declarations.details).toEqual({ type: 'boolean', initial: false });
    expect(parsed.declarations.limit).toMatchObject({ min: 0, max: 10, initial: 5 });
  });

  it.each([
    ['an object type', { a: { type: 'object' } }],
    ['an unknown field', { a: { type: 'boolean', persist: true } }],
    ['a bad name', { 'Bad-Name': { type: 'boolean' } }],
    ['a prototype name', { __proto__x: { type: 'boolean' } }],
    ['an initial out of range', { a: { type: 'number', min: 0, max: 1, initial: 2 } }],
    ['an enum initial not listed', { a: { type: 'enum', values: ['x'], initial: 'y' } }],
    ['duplicate enum values', { a: { type: 'enum', values: ['x', 'x'] } }],
    ['a huge string cap', { a: { type: 'string', maxLength: 100_000 } }],
    ['an array', [{ type: 'boolean' }]],
  ])('refuses %s', (_name, input) => {
    expect(parseStateDeclarations(input).ok).toBe(false);
  });

  it('caps the number of variables', () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_STATE_VARS + 1 }, (_, i) => [`v${i}`, { type: 'boolean' }])
    );
    const parsed = parseStateDeclarations(many);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues[0]?.code).toBe('state-limit');
  });
});

describe('bindings', () => {
  it('passes plain blueprints and non-JSON text through unchanged', () => {
    const tree = { id: 'layout-page', props: { title: 'x' } };
    expect(splitStatefulBlueprint(tree)).toEqual({ kind: 'plain', blueprint: tree });
    expect(splitStatefulBlueprint('{nope')).toEqual({ kind: 'plain', blueprint: '{nope' });
  });

  it('reads the wrapper from text and refuses unknown wrapper fields', () => {
    expect(splitStatefulBlueprint(JSON.stringify(stateful(declared))).kind).toBe('stateful');
    expect(
      splitStatefulBlueprint(stateful(declared, 'x', { fetch: 'https://x.example' }))
    ).toMatchObject({ kind: 'invalid' });
  });

  it('replaces binding objects in props only, deeply, and flags unknown names', () => {
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
  });
});

describe('Player local state', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('paints bound props from the declared initial values', async () => {
    render(Player, { props: { blueprint: stateful(declared), loaders } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 42' })).toBeTruthy();
    expect(screen.getByText('Fictional backlog')).toBeTruthy();
  });

  it('applies host initialState overrides that fit, ignoring ones that do not', async () => {
    render(Player, {
      props: {
        blueprint: stateful(declared),
        loaders,
        initialState: { week: 'Week 41', note: 'x'.repeat(41) },
      },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
    expect(screen.getByText('Fictional backlog')).toBeTruthy();
  });

  it('re-validates and repaints on setState, and reports snapshots to the host only', async () => {
    const onStateChange = vi.fn();
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, { blueprint: stateful(declared), loaders, onStateChange });
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 42' })).toBeTruthy();

    expect(mounted.setState('week', 'Week 41')).toBe(true);
    flushSync();
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ week: 'Week 41' }));

    expect(mounted.setState('week', 'Week 99')).toBe(false);
    expect(mounted.setState('limit', 11)).toBe(false);
    expect(mounted.setState('missing', true)).toBe(false);
    expect(mounted.getState().week).toBe('Week 41');
    expect(onStateChange).toHaveBeenCalledTimes(1);

    mounted.update({ label: 'Renamed' });
    expect(mounted.getState().week).toBe('Week 41');
    expect(await screen.findByRole('heading', { level: 1, name: 'Week 41' })).toBeTruthy();
    mounted.dispose();
  });

  it('keeps validating bound values: an HTML string in state never paints', async () => {
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
  });

  it('refuses invalid declarations and unknown bindings with a visible notice', () => {
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
    expect(onDiagnostics.mock.calls[0]?.[0]).toMatchObject({ status: 'invalid', receipt: null });

    render(Player, {
      props: { blueprint: stateful({ week: declared.week }, { $state: 'nope' }), loaders },
    });
    expect(screen.getAllByRole('alert').at(-1)?.textContent).toContain('No state variable');
  });

  it('re-validates on the same handle, so painters are not loaded again', async () => {
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
  });

  it('makes no network or storage calls while state changes', async () => {
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

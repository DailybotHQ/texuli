import { render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerFrameHost } from '../src/embed/host.ts';
import { PLAYER_FRAME_PROTOCOL, parseHostMessage } from '../src/embed/protocol.ts';
import { applyHostData, checkHostBoundWriters, sanitizeDataSources } from '../src/host-data.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayer, mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import { parseStateDeclarations, type StateDeclarations } from '../src/state/schema.ts';

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
  it('accept a dotted data source name and refuse anything else', () => {
    expect(declarations(state).team?.source).toBe('team.name');
    for (const source of ['', 'Team Name', '../secrets', 'a..b', 7, `a.${'x'.repeat(70)}`]) {
      expect(parseStateDeclarations({ v: { type: 'string', source } }).ok).toBe(false);
    }
  });

  it('take host values that fit their declaration, else their initial value', () => {
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
  });

  it('sanitizes host data from untrusted input to named plain scalars', () => {
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
  });

  it('refuse controls and fields that would write a host-bound variable', () => {
    const tree = {
      id: 'layout-page',
      props: {},
      children: [{ id: 'control-filter', props: { state: 'team', label: 'Team' } }],
    };
    expect(checkHostBoundWriters(tree, declarations(state))[0]?.code).toBe('host-binding');
    expect(checkHostBoundWriters(tree, declarations({ team: { type: 'string' } }))).toEqual([]);
  });
});

describe('the binding channel in the player', () => {
  it('binds host data into state, and an in-place update keeps the reader’s place', async () => {
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
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ team: 'Billing' }));
    mounted.dispose();
  });

  it('runs host data through full validation: hostile markup refuses, good data recovers', async () => {
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
  });

  it('refuses a control bound to host data, and never fetches', async () => {
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

describe('host data through the frame protocol', () => {
  it('parses data messages strictly', () => {
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

  it('binds host data sent to a frame, in place', async () => {
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
    expect(await screen.findByRole('heading', { level: 1, name: 'From the host' })).toBeTruthy();
    frame.dispose();
  });

  it('lets the host send data to a ready frame', () => {
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

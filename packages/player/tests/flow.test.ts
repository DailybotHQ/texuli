import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerFrameHost } from '../src/embed/host.ts';
import {
  PLAYER_FRAME_PROTOCOL,
  parseFrameMessage,
  parseHostMessage,
} from '../src/embed/protocol.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayer, mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import { nextFlowView, parseFlowDeclaration } from '../src/state/flow.ts';

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

async function paint(extra: Record<string, unknown> = {}, blueprint: unknown = wizard()) {
  const onFlowChange = vi.fn();
  const view = render(Player, {
    props: { blueprint, loaders: PLAYER_LOADERS, onFlowChange, ...extra },
  });
  await screen.findByRole('heading', { level: 1, name: 'Fictional onboarding' }, { timeout: 5000 });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    { timeout: 5000 }
  );
  await tick();
  return { ...view, onFlowChange };
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
  it('reads views, the initial view and a closed transition table with guards', () => {
    const parsed = parseFlowDeclaration(flow);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.flow.initial).toBe('details');
    expect(parsed.flow.transitions).toHaveLength(4);
    expect(nextFlowView(parsed.flow, 'details', 'next', { agree: 0 })).toBeNull();
    expect(nextFlowView(parsed.flow, 'details', 'next', { agree: 1 })).toBe('review');
    expect(nextFlowView(parsed.flow, 'done', 'restart', {})).toBe('details');
    expect(nextFlowView(parsed.flow, 'details', 'jump', {})).toBeNull();
  });

  it.each([
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
  ])('refuses %s', (_name, input) => {
    expect(parseFlowDeclaration(input).ok).toBe(false);
  });
});

describe('flows in the player', () => {
  it('paints only the current view and moves through guarded transitions', async () => {
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
    expect(onFlowChange).toHaveBeenLastCalledWith({ from: 'details', to: 'review', event: 'next' });
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
  });

  it('lets the host set the view, ignoring a view that is not declared', async () => {
    const { container } = await paint({ view: 'done' });
    expect(shown(container)).toEqual(['done']);
    document.body.innerHTML = '';
    const other = await paint({ view: 'nowhere' });
    expect(shown(other.container)).toEqual(['details']);
  });

  it('exposes dispatchFlow and getView on mountPlayer, and keeps the view across update()', async () => {
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
  });

  it('never touches location or history', async () => {
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

describe('refusals', () => {
  it.each([
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
  ])('refuses %s', async (_name, blueprint, message) => {
    const { container } = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS } });
    await tick();
    expect(container.querySelector('[data-tx-player-state-notice]')?.textContent).toContain(
      message
    );
  });
});

describe('flow events through the frame protocol', () => {
  it('parses flow messages strictly and a host view update', () => {
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

  it('reports a frame flow change to the host, and the host can set the frame view', async () => {
    const parent = Object.assign(new EventTarget(), { postMessage: vi.fn() }) as EventTarget & {
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
      { protocol: PLAYER_FRAME_PROTOCOL, type: 'flow', from: 'review', to: 'done', event: 'next' },
      'https://host.example'
    );
    send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'update', view: 'details' });
    await waitFor(() => expect(shown(target)).toEqual(['details']));
    frame.dispose();
  });

  it('hands a frame flow message to the host onFlow callback', () => {
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

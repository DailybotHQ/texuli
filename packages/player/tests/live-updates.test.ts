import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  carryFlowView,
  carryStateSnapshot,
  keepSameNodes,
  planIdentities,
} from '../src/live-update.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import { parseStateDeclarations, type StateDeclarations } from '../src/state/schema.ts';

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
  it('keeps live values that still fit, resets the rest, drops removed variables', () => {
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
  });

  it('keeps the live view while the flow still declares it', () => {
    const flow = { views: ['cart', 'pay'], initial: 'cart', transitions: [] } as never;
    expect(carryFlowView(flow, 'pay')).toBe('pay');
    expect(carryFlowView(flow, 'done')).toBe('cart');
    expect(carryFlowView(flow, 'pay', 'cart')).toBe('cart');
    expect(carryFlowView(flow, null)).toBe('cart');
  });

  it('drops a selected path only when another component now sits there', () => {
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

  it('keeps declared state and loaded painters across a blueprint update', async () => {
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
    expect(onStateChange).toHaveBeenLastCalledWith({ limit: 7, note: 'Fictional', details: false });

    // A narrower range no longer fits 7: the value resets and the host hears it.
    mounted.update({
      blueprint: stateful({ limit: { type: 'number', min: 0, max: 3, initial: 1 } }, 'Week 44', [
        'Static card',
      ]),
    });
    await screen.findByRole('heading', { level: 1, name: 'Week 44' });
    expect(mounted.getState()).toEqual({ limit: 1 });
    expect(onStateChange).toHaveBeenLastCalledWith({ limit: 1 });
    mounted.dispose();
    target.remove();
  });

  it('keeps the flow view while the updated flow still declares it', async () => {
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

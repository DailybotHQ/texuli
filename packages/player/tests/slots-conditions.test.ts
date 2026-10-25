import { render, screen, within } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { sameConditionInputs, stateConditionInputs } from '../src/conditions.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { groupSlots } from '../src/slots.ts';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import type { PlayerPaintNode } from '../src/types.ts';

/**
 * The Svelte adapter for the catalog's G04 named slots and G07 `when`
 * conditions: slotted children reach the component's named snippets, and
 * `when` reads the player's local state.
 */

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const slotLoader = async () => import('./SlotStub.svelte').then((m) => m.default);

const card = (title: string, extra: object = {}) => ({
  id: 'layout-card',
  props: { title },
  ...extra,
});

describe('stateConditionInputs', () => {
  it('passes numbers, maps booleans to 1 and 0, and leaves strings and enums out', () => {
    expect(
      stateConditionInputs({ limit: 5, details: true, hidden: false, week: 'Week 42' })
    ).toEqual({ limit: 5, details: 1, hidden: 0 });
    expect(sameConditionInputs({ a: 1 }, { a: 1 })).toBe(true);
    expect(sameConditionInputs({ a: 1 }, { a: 0 })).toBe(false);
    expect(sameConditionInputs({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('groupSlots', () => {
  const node = (path: string, slot?: string) =>
    ({
      kind: 'placeholder',
      id: 'x',
      path,
      label: 'x',
      reason: 'unknown-id',
      slot,
    }) as PlayerPaintNode;

  it('groups named slots in first-seen order and keeps unsafe names in the default slot', () => {
    const groups = groupSlots([
      node('a', 'footer'),
      node('b'),
      node('c', 'hero'),
      node('d', 'footer'),
      node('e', '__proto__'),
      node('f', 'children'),
    ]);
    expect(groups.names).toEqual(['footer', 'hero']);
    expect(groups.groups.footer?.map((n) => n.path)).toEqual(['a', 'd']);
    expect(groups.defaults.map((n) => n.path)).toEqual(['b', 'e', 'f']);
    expect(Object.hasOwn(groups.groups, '__proto__')).toBe(false);
  });
});

describe('named slots in the Svelte player (G04)', () => {
  // A host catalog that adds one component with named slots to the player's own.
  const base = createPlayerCatalog();
  const catalog: RenderCatalog = {
    get: (id) =>
      id === 'slot-stub'
        ? {
            id,
            label: 'Slot stub',
            agentEmittable: true,
            emit: ['developer', 'untrusted'],
            props: [
              { name: 'hero', kind: 'slot' },
              { name: 'footer', kind: 'slot' },
              { name: 'children', kind: 'slot' },
            ],
          }
        : base.get(id),
    allows: (id, tier) => (id === 'slot-stub' ? true : (base.allows?.(id, tier) ?? false)),
  };

  it('routes each slotted child to the snippet it names', async () => {
    const { container } = render(Player, {
      props: {
        catalog,
        loaders: {
          'layout-page': layoutLoader,
          'layout-card': layoutLoader,
          'slot-stub': slotLoader,
        },
        blueprint: {
          id: 'layout-page',
          props: { title: 'Harbor Notes' },
          children: [
            {
              id: 'slot-stub',
              children: [
                card('Footer card', { slot: 'footer' }),
                card('Body card'),
                card('Hero card', { slot: 'hero' }),
              ],
            },
          ],
        },
      },
    });
    await screen.findByText('Hero card');
    const region = (name: string) =>
      container.querySelector<HTMLElement>(`[data-region="${name}"]`) as HTMLElement;
    expect(within(region('hero')).getByText('Hero card')).toBeTruthy();
    expect(within(region('body')).getByText('Body card')).toBeTruthy();
    expect(within(region('footer')).getByText('Footer card')).toBeTruthy();
    expect(within(region('body')).queryByText('Hero card')).toBeNull();
  });
});

describe('when conditions in the Svelte player (G07)', () => {
  const details = {
    op: 'eq',
    left: { op: 'var', name: 'details' },
    right: { op: 'num', value: 1 },
  };
  const overLimit = {
    op: 'gt',
    left: { op: 'var', name: 'limit' },
    right: { op: 'num', value: 3 },
  };
  const blueprint = {
    format: LOCAL_STATE_FORMAT,
    version: 1,
    state: {
      details: { type: 'boolean' },
      limit: { type: 'number', min: 0, max: 10, initial: 5 },
      week: { type: 'enum', values: ['Week 41', 'Week 42'], initial: 'Week 42' },
    },
    blueprint: {
      id: 'layout-page',
      props: { title: 'Weekly report' },
      children: [
        card('Always shown'),
        card('Details card', { when: details }),
        card('Over the limit', { when: overLimit }),
        card('Reads an enum', {
          when: { op: 'eq', left: { op: 'var', name: 'week' }, right: { op: 'num', value: 1 } },
        }),
      ],
    },
  };
  const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };

  it('shows and hides regions as the local state changes', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, { blueprint, loaders });
    expect(await screen.findByText('Always shown')).toBeTruthy();
    expect(screen.getByText('Over the limit')).toBeTruthy();
    expect(screen.queryByText('Details card')).toBeNull();
    // An enum is not a number: the condition is unknown, so it stays hidden.
    expect(screen.queryByText('Reads an enum')).toBeNull();
    expect(target.querySelector('.tx-player__notice')).toBeNull();

    expect(mounted.setState('details', true)).toBe(true);
    expect(await screen.findByText('Details card')).toBeTruthy();
    expect(mounted.setState('limit', 2)).toBe(true);
    await expect.poll(() => screen.queryByText('Over the limit')).toBeNull();
    expect(mounted.setState('details', false)).toBe(true);
    await expect.poll(() => screen.queryByText('Details card')).toBeNull();
    expect(screen.getByText('Always shown')).toBeTruthy();
    mounted.dispose();
    target.remove();
  });
});
